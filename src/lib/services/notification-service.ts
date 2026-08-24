import { AppNotification, NotificationType } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, getStored, setStored } from './storage-helpers';
import { GroupService } from './group-service';

// ---------------------------------------------------------------------------
// CENTRAL DE NOTIFICAÇÕES EM TEMPO REAL
// ---------------------------------------------------------------------------
export const NotificationService = {
  getNotifications(groupId?: string): AppNotification[] {
    const list = getStored<AppNotification[]>('app_notifications', []);
    if (groupId) {
      return list.filter((n) => !n.groupId || n.groupId === groupId);
    }
    return list;
  },

  getUnreadCount(groupId?: string): number {
    const list = this.getNotifications(groupId);
    return list.filter((n) => !n.read).length;
  },

  addNotification(
    groupId: string,
    data: {
      type: NotificationType;
      title: string;
      message: string;
      groupName?: string;
      data?: AppNotification['data'];
    }
  ): AppNotification {
    const list = getStored<AppNotification[]>('app_notifications', []);
    const newNotif: AppNotification = {
      id: generateUUID(),
      groupId,
      groupName: data.groupName,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      data: data.data,
      createdAt: new Date().toISOString(),
    };

    const updated = [newNotif, ...list].slice(0, 50);
    setStored('app_notifications', updated);
    return newNotif;
  },

  markAsRead(notificationId: string): void {
    const list = getStored<AppNotification[]>('app_notifications', []);
    const updated = list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
    setStored('app_notifications', updated);
  },

  markAllAsRead(groupId?: string): void {
    const list = getStored<AppNotification[]>('app_notifications', []);
    const updated = list.map((n) => {
      if (!groupId || n.groupId === groupId) {
        return { ...n, read: true };
      }
      return n;
    });
    setStored('app_notifications', updated);
  },

  async approveMemberRequest(groupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    const members = GroupService.getMembers(groupId);
    const target = members.find((m) => m.id === memberId || m.userId === memberId);
    if (!target) return { success: false, error: 'Membro não encontrado.' };

    target.status = 'active';
    setStored(`members_${groupId}`, members);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('group_members').update({ status: 'active' }).eq('id', target.id);
      } catch (e) {
        console.warn('Erro ao aprovar membro no Supabase:', e);
      }
    }

    this.addNotification(groupId, {
      type: 'member_approved',
      title: 'Membro Aprovado ✅',
      message: `${target.user.name} foi aceito e agora é membro ativo da pelada.`,
      data: { memberId: target.id, userId: target.userId, userName: target.user.name }
    });

    return { success: true };
  },

  async rejectMemberRequest(groupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    const res = await GroupService.removeMember(groupId, memberId);
    return res;
  }
};
