import { AppNotification, NotificationType } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, getStored, isValidUUID, setStored } from './storage-helpers';
import { GroupService } from './group-service';
import { UserService } from './user-service';

type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  groupName?: string;
  data?: AppNotification['data'];
  actorUserId?: string;
};

function mapCloudNotification(row: any): AppNotification {
  return {
    id: row.id, groupId: row.group_id, groupName: row.group_name || undefined,
    recipientUserId: row.recipient_user_id, actorUserId: row.actor_user_id || undefined,
    type: row.type, title: row.title, message: row.message, read: Boolean(row.read),
    data: row.data || undefined, createdAt: row.created_at,
  };
}

function storeNotifications(items: AppNotification[]): AppNotification[] {
  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);
  setStored('app_notifications', unique);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications_updated'));
  return unique;
}

export const NotificationService = {
  getNotifications(groupId?: string): AppNotification[] {
    const currentUserId = UserService.getCurrentUser()?.id;
    return getStored<AppNotification[]>('app_notifications', []).filter((notification) =>
      notification.recipientUserId === currentUserId &&
      (!groupId || notification.groupId === groupId)
    );
  },

  async syncFromCloud(groupId?: string, userId?: string): Promise<AppNotification[]> {
    const recipientUserId = userId || UserService.getCurrentUser()?.id;
    const local = this.getNotifications(groupId);
    if (!isSupabaseConfigured || !supabase || !isValidUUID(recipientUserId)) return local;
    let query = supabase.from('notifications').select('*')
      .eq('recipient_user_id', recipientUserId).order('created_at', { ascending: false }).limit(100);
    if (groupId && isValidUUID(groupId)) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      console.warn('Erro ao buscar notificacoes:', error);
      return local;
    }
    const remote = (data || []).map(mapCloudNotification);
    const otherGroups = getStored<AppNotification[]>('app_notifications', []).filter(
      (notification) => Boolean(groupId) && notification.groupId !== groupId
    );
    const stored = storeNotifications([...remote, ...otherGroups]);
    return stored.filter((notification) => !groupId || notification.groupId === groupId);
  },

  getUnreadCount(groupId?: string): number {
    return this.getNotifications(groupId).filter((notification) => !notification.read).length;
  },

  addNotification(groupId: string, input: NotificationInput): AppNotification {
    const notification: AppNotification = {
      id: generateUUID(), groupId, groupName: input.groupName,
      recipientUserId: UserService.getCurrentUser()?.id, actorUserId: input.actorUserId,
      type: input.type, title: input.title, message: input.message, read: false,
      data: input.data, createdAt: new Date().toISOString(),
    };
    storeNotifications([notification, ...getStored<AppNotification[]>('app_notifications', [])]);
    return notification;
  },

  async notifyUser(groupId: string, recipientUserId: string, input: NotificationInput): Promise<void> {
    if (!recipientUserId) return;
    const id = generateUUID();
    const createdAt = new Date().toISOString();
    const currentUserId = UserService.getCurrentUser()?.id;
    if (isSupabaseConfigured && supabase && isValidUUID(groupId) && isValidUUID(recipientUserId)) {
      const actorUserId = input.actorUserId || currentUserId;
      const { error } = await supabase.from('notifications').insert([{
        id, group_id: groupId,
        group_name: input.groupName || GroupService.getGroupById(groupId)?.name || null,
        recipient_user_id: recipientUserId,
        actor_user_id: isValidUUID(actorUserId) ? actorUserId : null,
        type: input.type, title: input.title, message: input.message,
        data: input.data || {}, read: false, created_at: createdAt,
      }]);
      if (error) console.warn('Erro ao enviar notificacao:', error);
    }
    if (recipientUserId === currentUserId) {
      storeNotifications([{
        id, groupId, groupName: input.groupName, recipientUserId,
        actorUserId: input.actorUserId || currentUserId, type: input.type,
        title: input.title, message: input.message, read: false,
        data: input.data, createdAt,
      }, ...getStored<AppNotification[]>('app_notifications', [])]);
    }
  },

  async notifyGroup(groupId: string, input: NotificationInput): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(groupId)) {
      this.addNotification(groupId, input);
      return;
    }
    const { data: members, error } = await supabase.from('group_members').select('user_id')
      .eq('group_id', groupId).eq('status', 'active');
    if (error) {
      console.warn('Erro ao localizar destinatarios:', error);
      return;
    }
    const ids = Array.from(new Set((members || []).map((member: any) => member.user_id)))
      .filter((id): id is string => typeof id === 'string' && isValidUUID(id));
    await Promise.all(ids.map((id) => this.notifyUser(groupId, id, input)));
  },

  async notifyDirectors(groupId: string, input: NotificationInput): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(groupId)) return;
    const { data: directors, error } = await supabase.from('group_members').select('user_id')
      .eq('group_id', groupId).eq('status', 'active')
      .in('role', ['presidente', 'adm', 'tesoureiro']);
    if (error) {
      console.warn('Erro ao localizar a diretoria:', error);
      return;
    }
    const ids = Array.from(new Set((directors || []).map((member: any) => member.user_id)))
      .filter((id): id is string => typeof id === 'string' && isValidUUID(id));
    await Promise.all(ids.map((id) => this.notifyUser(groupId, id, input)));
  },

  async markAsRead(notificationId: string): Promise<void> {
    storeNotifications(getStored<AppNotification[]>('app_notifications', []).map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    ));
    if (isSupabaseConfigured && supabase && isValidUUID(notificationId)) {
      await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    }
  },

  async markAllAsRead(groupId?: string): Promise<void> {
    const currentUserId = UserService.getCurrentUser()?.id;
    storeNotifications(getStored<AppNotification[]>('app_notifications', []).map((notification) =>
      (!groupId || notification.groupId === groupId) ? { ...notification, read: true } : notification
    ));
    if (isSupabaseConfigured && supabase && isValidUUID(currentUserId)) {
      let query = supabase.from('notifications').update({ read: true }).eq('recipient_user_id', currentUserId);
      if (groupId && isValidUUID(groupId)) query = query.eq('group_id', groupId);
      await query;
    }
  },

  subscribe(userId: string, onChange: () => void) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(userId)) return null;
    return supabase.channel(`notifications_${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications',
      filter: `recipient_user_id=eq.${userId}`,
    }, onChange).subscribe();
  },

  async approveMemberRequest(groupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    const members = GroupService.getMembers(groupId);
    const target = members.find((member) => member.id === memberId || member.userId === memberId);
    if (!target) return { success: false, error: 'Membro nao encontrado.' };
    target.status = 'active';
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('group_members').update({ status: 'active' })
        .eq('id', target.id).eq('group_id', groupId);
      if (error) return { success: false, error: error.message };
    }
    setStored(`members_${groupId}`, members);
    await this.notifyUser(groupId, target.userId, {
      type: 'member_approved', title: 'Entrada aprovada',
      message: 'Sua entrada no grupo foi aprovada.',
      data: { memberId: target.id, userId: target.userId, userName: target.user.name },
    });
    return { success: true };
  },

  async rejectMemberRequest(groupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    return GroupService.removeMember(groupId, memberId);
  },
};
