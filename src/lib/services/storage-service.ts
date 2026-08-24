import { 
  Group, 
  GroupMember, 
  Match, 
  MatchAttendance, 
  FinancialTransaction, 
  UserProfile, 
  GroupRole, 
  MembershipType, 
  MemberStatus,
  SoccerType, 
  PlayerMatchStat,
  AppNotification,
  NotificationType,
  TransactionCategory,
  UserPosition,
  DominantFoot
} from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Helpers para Geração e Validação de UUIDs (compatíveis com PostgreSQL)
// ---------------------------------------------------------------------------
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Helper de LocalStorage Seguro para SSR
function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(`pelada_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`pelada_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error('Storage error:', err);
  }
}

// ---------------------------------------------------------------------------
// 0. GESTÃO DE USUÁRIO LOGADO & PERFIL
// ---------------------------------------------------------------------------
export const UserService = {
  getCurrentUser(): UserProfile {
    const defaultUser: UserProfile = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Atleta Conectado',
      email: 'atleta@gestaopelada.com',
      phone: '(11) 99999-8888',
      cpf: '123.456.789-00',
      address: 'Rua do Futebol, 100 - São Paulo, SP',
      mainPosition: 'meia',
      secondaryPosition: 'atacante',
      dominantFoot: 'destro',
      heightCm: 178,
      weightKg: 76,
      overallRating: 7.0,
      createdAt: new Date().toISOString(),
    };

    if (typeof window === 'undefined') return defaultUser;
    
    let resolvedUser: UserProfile | null = null;

    // 1. Tenta pegar do storage de autenticação
    const authUser = localStorage.getItem('gestao_pelada_user');
    if (authUser) {
      try {
        const parsed = JSON.parse(authUser);
        if (parsed && parsed.name) resolvedUser = parsed;
      } catch {}
    }

    // 2. Tenta pegar do storage do app
    if (!resolvedUser) {
      const appUser = getStored<UserProfile | null>('current_user', null);
      if (appUser && appUser.name) resolvedUser = appUser;
    }

    if (!resolvedUser) resolvedUser = defaultUser;

    // Garante que o ID é um UUID válido para banco relacional
    if (!isValidUUID(resolvedUser.id)) {
      resolvedUser.id = generateUUID();
      this.setCurrentUser(resolvedUser);
    }

    return resolvedUser;
  },

  setCurrentUser(user: UserProfile): void {
    if (!isValidUUID(user.id)) {
      user.id = generateUUID();
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('gestao_pelada_user', JSON.stringify(user));
    }
    setStored('current_user', user);
  },

  async ensureUserInCloud(user: UserProfile): Promise<string> {
    if (!isSupabaseConfigured || !supabase) {
      return user.id;
    }

    try {
      const cleanCpf = (user.cpf || '').replace(/\D/g, '');
      
      // Procura se o usuário já existe no banco pelo ID ou pelo CPF
      let query = supabase.from('users').select('id, name, cpf');
      if (isValidUUID(user.id)) {
        query = query.or(`id.eq.${user.id},cpf.eq.${user.cpf},cpf.eq.${cleanCpf}`);
      } else {
        query = query.or(`cpf.eq.${user.cpf},cpf.eq.${cleanCpf}`);
      }

      const { data, error } = await query.maybeSingle();

      if (data && data.id) {
        if (user.id !== data.id) {
          user.id = data.id;
          this.setCurrentUser(user);
        }
        return data.id;
      }

      // Se não existe, insere o usuário no PostgreSQL
      const newUserId = isValidUUID(user.id) ? user.id : generateUUID();
      user.id = newUserId;

      const { data: inserted, error: insertError } = await supabase.from('users').insert([{
        id: newUserId,
        name: user.name || 'Atleta Sem Nome',
        email: user.email || `atleta_${Date.now()}@gestaopelada.com`,
        phone: user.phone || '(11) 99999-9999',
        cpf: user.cpf || '000.000.000-00',
        address: user.address || 'Endereço Padrão',
        main_position: user.mainPosition || 'meia',
        secondary_position: user.secondaryPosition || null,
        dominant_foot: user.dominantFoot || 'destro',
        height_cm: user.heightCm || null,
        weight_kg: user.weightKg || null,
        overall_rating: user.overallRating || 6.5,
      }]).select('id').single();

      if (inserted && inserted.id) {
        user.id = inserted.id;
        this.setCurrentUser(user);
        return inserted.id;
      }

      if (insertError) {
        console.warn('Aviso ao sincronizar usuário no Supabase:', insertError.message);
      }
    } catch (err) {
      console.warn('Erro em ensureUserInCloud:', err);
    }

    return user.id;
  },

  async updateUserProfile(userIdOrData: string | Partial<UserProfile>, maybeData?: Partial<UserProfile>): Promise<UserProfile> {
    let targetUserId: string;
    let patchData: Partial<UserProfile>;

    if (typeof userIdOrData === 'string') {
      targetUserId = userIdOrData;
      patchData = maybeData || {};
    } else {
      const current = this.getCurrentUser();
      targetUserId = current.id;
      patchData = userIdOrData || {};
    }

    const current = this.getCurrentUser();
    const updated: UserProfile = { 
      ...current, 
      ...patchData, 
      id: targetUserId || current.id,
      mainPosition: (patchData.mainPosition !== undefined ? patchData.mainPosition : current.mainPosition) || 'goleiro',
    };
    this.setCurrentUser(updated);

    // Atualiza o objeto do atleta dentro de todos os grupos locais
    const allGroups = GroupService.getGroups();
    allGroups.forEach((g) => {
      const members = GroupService.getMembers(g.id);
      let changed = false;
      const newMembers = members.map((m) => {
        if (m.userId === updated.id || m.user.cpf === updated.cpf || m.user.id === updated.id) {
          changed = true;
          return {
            ...m,
            user: {
              ...m.user,
              ...updated,
            }
          };
        }
        return m;
      });
      if (changed) {
        setStored(`members_${g.id}`, newMembers);
      }
    });

    if (isSupabaseConfigured && supabase && isValidUUID(targetUserId)) {
      try {
        await supabase.from('users').update({
          name: updated.name,
          phone: updated.phone,
          address: updated.address,
          main_position: updated.mainPosition,
          secondary_position: updated.secondaryPosition || null,
          dominant_foot: updated.dominantFoot,
          height_cm: updated.heightCm || null,
          weight_kg: updated.weightKg || null,
        }).eq('id', targetUserId);
      } catch (err) {
        console.error('Erro ao atualizar no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: updated }));
      window.dispatchEvent(new Event('storage'));
    }

    return updated;
  }
};

// ---------------------------------------------------------------------------
// 1. GESTÃO DE GRUPOS & MEMBROS
// ---------------------------------------------------------------------------
export const GroupService = {
  getGroups(): Group[] {
    return getStored<Group[]>('groups', []);
  },

  getGroupById(id: string): Group | undefined {
    const groups = this.getGroups();
    return groups.find((g) => g.id === id);
  },

  getGroupByInviteCode(code: string): Group | undefined {
    if (!code) return undefined;
    const cleanAlpha = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanTrim = code.trim().toLowerCase();
    const groups = this.getGroups();
    return groups.find((g) => {
      if (g.id === code.trim()) return true;
      const gAlpha = (g.inviteCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (gAlpha === cleanAlpha) return true;
      if ((g.name || '').toLowerCase() === cleanTrim) return true;
      if ((g.name || '').toLowerCase().includes(cleanTrim)) return true;
      return false;
    });
  },

  async findGroupByInviteCodeAsync(code: string): Promise<Group | undefined> {
    if (!code) return undefined;
    const rawTrim = code.trim();
    const cleanRaw = rawTrim.toUpperCase();
    const cleanNoSpaces = cleanRaw.replace(/\s+/g, '');
    const cleanAlpha = cleanRaw.replace(/[^A-Z0-9]/g, '');

    // 1. Tenta achar no LocalStorage
    const local = this.getGroupByInviteCode(rawTrim);
    if (local) return local;

    // 2. Busca no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('groups').select('*');

        if (isValidUUID(rawTrim)) {
          const { data } = await query.eq('id', rawTrim).maybeSingle();
          if (data) return this.mapCloudGroup(data);
        }

        // Tenta query específica por invite_code ou por nome
        const { data } = await supabase
          .from('groups')
          .select('*')
          .or(`invite_code.ilike.${cleanRaw},invite_code.ilike.${cleanNoSpaces},name.ilike.%${rawTrim}%`)
          .limit(1)
          .maybeSingle();

        let matched = data;

        // Se não achou na query exata, busca todos os grupos e compara por caracteres alfanuméricos
        if (!matched) {
          const { data: allGroups } = await supabase.from('groups').select('*').limit(100);
          if (allGroups && allGroups.length > 0) {
            matched = allGroups.find((g: any) => {
              const gAlpha = (g.invite_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
              const gName = (g.name || '').toLowerCase();
              return (
                gAlpha === cleanAlpha ||
                (cleanAlpha.length >= 3 && gAlpha.includes(cleanAlpha)) ||
                gName.includes(rawTrim.toLowerCase())
              );
            });
          }
        }

        if (matched) {
          return this.mapCloudGroup(matched);
        }
      } catch (err) {
        console.error('Erro ao buscar grupo na nuvem:', err);
      }
    }

    return undefined;
  },

  mapCloudGroup(matched: any): Group {
    const groups = this.getGroups();
    const idx = groups.findIndex((g) => g.id === matched.id);
    const existingLocal = idx !== -1 ? groups[idx] : null;

    let resolvedMaxSlots = 24;
    if (existingLocal && existingLocal.maxSlots && Number(existingLocal.maxSlots) > 0) {
      resolvedMaxSlots = Number(existingLocal.maxSlots);
    } else if (matched.max_slots && Number(matched.max_slots) > 0) {
      resolvedMaxSlots = Number(matched.max_slots);
    } else if (matched.players_per_team) {
      resolvedMaxSlots = Number(matched.players_per_team) * 3;
    }

    const group: Group = {
      id: matched.id,
      name: matched.name,
      soccerType: matched.soccer_type,
      playersPerTeam: matched.players_per_team || Math.max(1, Math.round(resolvedMaxSlots / 3)),
      maxSlots: resolvedMaxSlots,
      fieldAddress: matched.field_address,
      matchDay: matched.match_day,
      matchTime: (matched.match_time || '20:00').substring(0, 5),
      matchDurationMinutes: matched.match_duration_minutes,
      rules: matched.rules,
      monthlyFee: matched.monthly_fee || 80,
      dailyFee: matched.daily_fee || 25,
      inviteCode: matched.invite_code,
      isPublic: matched.is_public,
      whatsappGroupUrl: matched.whatsapp_group_url || matched.whatsappGroupUrl || undefined,
      isOpenAttendance: existingLocal?.isOpenAttendance ?? false,
      createdBy: matched.created_by,
      createdAt: matched.created_at || existingLocal?.createdAt || new Date().toISOString(),
    };

    if (idx === -1) groups.push(group);
    else groups[idx] = group;
    setStored('groups', groups);

    // Busca também membros existentes do grupo
    this.syncGroupMembersFromCloud(group.id);

    return group;
  },

  async searchGroups(term: string): Promise<Group[]> {
    const rawTrim = (term || '').trim();
    if (!rawTrim) {
      return this.getAllPublicGroups();
    }

    const localMatches = this.getGroups().filter((g) => {
      const nameMatch = g.name.toLowerCase().includes(rawTrim.toLowerCase());
      const codeMatch = (g.inviteCode || '').toUpperCase().includes(rawTrim.toUpperCase());
      const addrMatch = (g.fieldAddress || '').toLowerCase().includes(rawTrim.toLowerCase());
      return nameMatch || codeMatch || addrMatch;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('groups')
          .select('*')
          .or(`name.ilike.%${rawTrim}%,invite_code.ilike.%${rawTrim}%,field_address.ilike.%${rawTrim}%`)
          .limit(30);

        if (data && data.length > 0) {
          const cloudList = data.map((d: any) => this.mapCloudGroup(d));
          const merged = [...localMatches];
          cloudList.forEach((cg) => {
            if (!merged.some((m) => m.id === cg.id)) merged.push(cg);
          });
          return merged;
        }
      } catch (err) {
        console.warn('Erro ao pesquisar grupos no Supabase:', err);
      }
    }

    return localMatches;
  },

  async getAllPublicGroups(): Promise<Group[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(30);
        if (data && data.length > 0) {
          const cloudGroups: Group[] = data.map((d: any) => this.mapCloudGroup(d));
          return cloudGroups;
        }
      } catch (err) {
        console.warn('Erro ao carregar grupos públicos:', err);
      }
    }
    return this.getGroups();
  },

  async syncAllWithCloud(): Promise<Array<{ group: Group; member: GroupMember }>> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getUserGroups();
    }

    try {
      const user = UserService.getCurrentUser();
      const validUserId = await UserService.ensureUserInCloud(user);

      // 1. Puxa todos os grupos da nuvem
      const { data: cloudGroups } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      const localGroups = this.getGroups();

      // 2. Se houver grupo local que não existe na nuvem, sobe para o Supabase
      for (const lg of localGroups) {
        const inCloud = cloudGroups?.some((cg: any) => 
          cg.id === lg.id || 
          cg.name.toLowerCase() === lg.name.toLowerCase() ||
          cg.invite_code === lg.inviteCode
        );

        if (!inCloud && lg.name) {
          const newGroupId = isValidUUID(lg.id) ? lg.id : generateUUID();
          const rawTime = (lg.matchTime || '20:00').trim();
          const formattedTime = rawTime.includes(':')
            ? (rawTime.split(':').length === 2 ? `${rawTime}:00` : rawTime)
            : '20:00:00';

          const groupPayload: any = {
            id: newGroupId,
            name: lg.name,
            soccer_type: lg.soccerType || 'society',
            players_per_team: lg.playersPerTeam || Math.max(1, Math.round((lg.maxSlots || 18) / 3)),
            field_address: lg.fieldAddress || '',
            match_day: lg.matchDay || 'Quinta-feira',
            match_time: formattedTime,
            match_duration_minutes: lg.matchDurationMinutes || 90,
            rules: lg.rules || '',
            monthly_fee: lg.monthlyFee || 80,
            daily_fee: lg.dailyFee || 25,
            invite_code: lg.inviteCode || `PEL-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            is_public: lg.isPublic ?? true,
            whatsapp_group_url: lg.whatsappGroupUrl || null,
            created_by: validUserId,
          };

          try {
            const { error: insErr } = await supabase.from('groups').insert([{
              ...groupPayload,
              max_slots: lg.maxSlots || 18,
            }]);
            if (insErr) {
              await supabase.from('groups').insert([groupPayload]);
            }
          } catch {
            await supabase.from('groups').insert([groupPayload]);
          }

          const memberId = generateUUID();
          await supabase.from('group_members').insert([{
            id: memberId,
            group_id: newGroupId,
            user_id: validUserId,
            role: 'presidente',
            membership_type: 'associado',
            status: 'active',
          }]);
        }
      }

      // 3. Atualiza os grupos locais com a lista completa do Supabase
      const { data: updatedCloudGroups } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (updatedCloudGroups && updatedCloudGroups.length > 0) {
        const merged: Group[] = updatedCloudGroups.map((d: any) => this.mapCloudGroup(d));
        setStored('groups', merged);

        for (const g of merged) {
          await this.syncGroupMembersFromCloud(g.id);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com nuvem:', err);
    }

    return this.getUserGroups();
  },

  getActiveGroupId(): string | null {
    const userGroups = this.getUserGroups();
    if (userGroups.length === 0) return null;
    const stored = getStored<string | null>('active_group_id', null);
    if (stored && userGroups.some((ug) => ug.group.id === stored)) {
      return stored;
    }
    const defaultId = userGroups[0].group.id;
    setStored('active_group_id', defaultId);
    return defaultId;
  },

  setActiveGroupId(groupId: string): void {
    setStored('active_group_id', groupId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('active_group_changed', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  getUserGroups(userId?: string): Array<{ group: Group; member: GroupMember }> {
    const user = UserService.getCurrentUser();
    const targetUserId = userId || user.id;
    const allGroups = this.getGroups();
    const result: Array<{ group: Group; member: GroupMember }> = [];

    allGroups.forEach((group) => {
      const members = this.getMembers(group.id);
      let member = members.find((m) => 
        m.userId === targetUserId || 
        m.userId === user.id ||
        (m.user && (
          m.user.id === targetUserId || 
          m.user.id === user.id ||
          (user.cpf && m.user.cpf === user.cpf) ||
          (user.email && m.user.email?.toLowerCase() === user.email.toLowerCase())
        ))
      );

      // Se o usuário é o criador do grupo mas ainda não constava na lista de membros locais, registra-o como Presidente
      if (!member && (group.createdBy === targetUserId || group.createdBy === user.id)) {
        member = {
          id: generateUUID(),
          groupId: group.id,
          userId: targetUserId,
          user: user,
          role: 'presidente',
          membershipType: 'associado',
          status: 'active',
          isBlockedFinancial: false,
          joinedAt: group.createdAt || new Date().toISOString(),
        };
        members.unshift(member);
        setStored(`members_${group.id}`, members);
      }

      if (member) {
        result.push({ group, member });
      }
    });

    return result;
  },

  getMemberInGroup(groupId: string, userId?: string): GroupMember | undefined {
    const user = UserService.getCurrentUser();
    const targetUserId = userId || user.id;
    const members = this.getMembers(groupId);
    let member = members.find((m) => 
      m.userId === targetUserId || 
      m.userId === user.id ||
      (m.user && (
        m.user.id === targetUserId || 
        m.user.id === user.id ||
        (user.cpf && m.user.cpf === user.cpf) ||
        (user.email && m.user.email?.toLowerCase() === user.email.toLowerCase())
      ))
    );

    if (!member) {
      const group = this.getGroupById(groupId);
      if (group && (group.createdBy === targetUserId || group.createdBy === user.id)) {
        member = {
          id: generateUUID(),
          groupId: group.id,
          userId: targetUserId,
          user: user,
          role: 'presidente',
          membershipType: 'associado',
          status: 'active',
          isBlockedFinancial: false,
          joinedAt: group.createdAt || new Date().toISOString(),
        };
        members.unshift(member);
        setStored(`members_${group.id}`, members);
      }
    }

    return member;
  },

  async syncGroupMembersFromCloud(groupId: string): Promise<GroupMember[]> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(groupId)) {
      return this.getMembers(groupId);
    }

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          user_id,
          role,
          membership_type,
          status,
          is_blocked_financial,
          blocked_reason,
          joined_at,
          users:user_id (
            id,
            name,
            email,
            phone,
            cpf,
            address,
            avatar_url,
            main_position,
            secondary_position,
            dominant_foot,
            height_cm,
            weight_kg,
            overall_rating,
            created_at
          )
        `)
        .eq('group_id', groupId);

      if (data && data.length > 0) {
        const cloudMembers: GroupMember[] = data.map((item: any) => {
          const u = item.users || {};
          const userProf: UserProfile = {
            id: u.id || item.user_id,
            name: u.name || 'Atleta',
            email: u.email || '',
            phone: u.phone || '',
            cpf: u.cpf || '',
            address: u.address || '',
            avatarUrl: u.avatar_url,
            mainPosition: u.main_position || 'meia',
            secondaryPosition: u.secondary_position,
            dominantFoot: u.dominant_foot || 'destro',
            heightCm: u.height_cm,
            weightKg: u.weight_kg,
            overallRating: u.overall_rating || 6.5,
            createdAt: u.created_at || new Date().toISOString(),
          };

          return {
            id: item.id,
            groupId: item.group_id,
            userId: item.user_id,
            user: userProf,
            role: item.role as GroupRole,
            membershipType: item.membership_type as MembershipType,
            status: item.status,
            isBlockedFinancial: item.is_blocked_financial || false,
            blockedReason: item.blocked_reason,
            joinedAt: item.joined_at,
          };
        });

        setStored(`members_${groupId}`, cloudMembers);
        return cloudMembers;
      }
    } catch (err) {
      console.warn('Erro ao sincronizar membros do grupo da nuvem:', err);
    }

    return this.getMembers(groupId);
  },

  async createGroup(data: {
    name: string;
    soccerType: SoccerType;
    playersPerTeam: number;
    maxSlots?: number;
    fieldAddress: string;
    matchDay: string;
    matchTime: string;
    matchDurationMinutes: number;
    rules?: string;
    monthlyFee?: number;
    dailyFee?: number;
    isPublic: boolean;
    whatsappGroupUrl?: string;
  }): Promise<Group> {
    const user = UserService.getCurrentUser();
    const validUserId = await UserService.ensureUserInCloud(user);

    const groups = this.getGroups();
    const groupId = generateUUID();
    const memberId = generateUUID();
    const cleanPrefix = data.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'PEL') || 'PEL';
    const inviteCode = `${cleanPrefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newGroup: Group = {
      ...data,
      id: groupId,
      maxSlots: data.maxSlots || (data.playersPerTeam * 3) || 18,
      isOpenAttendance: false,
      inviteCode,
      whatsappGroupUrl: data.whatsappGroupUrl || undefined,
      createdBy: validUserId,
      createdAt: new Date().toISOString(),
    };

    // Salva localmente
    groups.push(newGroup);
    setStored('groups', groups);

    // Cadastra o criador como PRESIDENTE e ASSOCIADO
    const presidentMember: GroupMember = {
      id: memberId,
      groupId: newGroup.id,
      userId: validUserId,
      user,
      role: 'presidente',
      membershipType: 'associado',
      status: 'active',
      isBlockedFinancial: false,
      joinedAt: new Date().toISOString(),
    };

    setStored(`members_${newGroup.id}`, [presidentMember]);
    this.setActiveGroupId(newGroup.id);

    // Sincroniza com PostgreSQL / Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const rawTime = (data.matchTime || '20:00').trim();
        const formattedTime = rawTime.includes(':')
          ? (rawTime.split(':').length === 2 ? `${rawTime}:00` : rawTime)
          : '20:00:00';

        const groupPayload: any = {
          id: newGroup.id,
          name: newGroup.name,
          soccer_type: newGroup.soccerType,
          players_per_team: newGroup.playersPerTeam || Math.max(1, Math.round((newGroup.maxSlots || 18) / 3)),
          field_address: newGroup.fieldAddress,
          match_day: newGroup.matchDay,
          match_time: formattedTime,
          match_duration_minutes: newGroup.matchDurationMinutes || 90,
          rules: newGroup.rules || '',
          monthly_fee: newGroup.monthlyFee || 80,
          daily_fee: newGroup.dailyFee || 25,
          invite_code: newGroup.inviteCode,
          is_public: newGroup.isPublic ?? true,
          whatsapp_group_url: newGroup.whatsappGroupUrl || null,
          created_by: validUserId,
        };

        try {
          const { error: groupError } = await supabase.from('groups').insert([{
            ...groupPayload,
            max_slots: newGroup.maxSlots || 18,
          }]);

          if (groupError) {
            await supabase.from('groups').insert([groupPayload]);
          }
        } catch {
          await supabase.from('groups').insert([groupPayload]);
        }

        try {
          await supabase.from('group_members').insert([{
            id: memberId,
            group_id: newGroup.id,
            user_id: validUserId,
            role: 'presidente',
            membership_type: 'associado',
            status: 'active',
          }]);
        } catch (memberError) {
          console.error('Erro ao salvar membro presidente no Supabase:', memberError);
        }
      } catch (err) {
        console.error('Erro ao sincronizar novo grupo no Supabase:', err);
      }
    }

    return newGroup;
  },

  async updateGroup(id: string, partial: Partial<Group>): Promise<Group | null> {
    const groups = this.getGroups();
    let idx = groups.findIndex((g) => g.id === id);
    if (idx === -1 && groups.length > 0) {
      const activeId = this.getActiveGroupId();
      idx = groups.findIndex((g) => g.id === activeId);
      if (idx === -1) idx = 0;
    }
    if (idx === -1) return null;

    const currentGroup = groups[idx];
    const newMaxSlots = partial.maxSlots !== undefined ? Number(partial.maxSlots) : (currentGroup.maxSlots || 18);
    const newPlayersPerTeam = partial.playersPerTeam !== undefined 
      ? partial.playersPerTeam 
      : (partial.maxSlots !== undefined ? Math.max(1, Math.round(newMaxSlots / 3)) : currentGroup.playersPerTeam);

    groups[idx] = { 
      ...currentGroup, 
      ...partial,
      maxSlots: newMaxSlots,
      playersPerTeam: newPlayersPerTeam,
    };
    setStored('groups', groups);

    const targetGroupId = groups[idx].id;

    // Atualiza partidas ativas/agendadas para refletirem o novo limite de vagas
    if (partial.maxSlots !== undefined) {
      const matches = MatchService.getMatches(targetGroupId);
      if (matches.length > 0) {
        const updatedMatches = matches.map((m) => {
          if (m.status !== 'finished') {
            return { ...m, maxPlayers: newMaxSlots };
          }
          return m;
        });
        setStored(`matches_${targetGroupId}`, updatedMatches);
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const updated = groups[idx];
        const formattedTime = updated.matchTime
          ? (updated.matchTime.length === 5 ? `${updated.matchTime}:00` : updated.matchTime)
          : '20:00:00';

        const payload: any = {
          name: updated.name,
          soccer_type: updated.soccerType,
          players_per_team: updated.playersPerTeam || Math.max(1, Math.round((updated.maxSlots || 18) / 3)),
          field_address: updated.fieldAddress,
          match_day: updated.matchDay,
          match_time: formattedTime,
          match_duration_minutes: updated.matchDurationMinutes || 90,
          rules: updated.rules || '',
          monthly_fee: updated.monthlyFee,
          daily_fee: updated.dailyFee,
          whatsapp_group_url: updated.whatsappGroupUrl || null,
          is_public: updated.isPublic ?? true,
        };

        const targetIdInCloud = isValidUUID(targetGroupId) ? targetGroupId : (isValidUUID(id) ? id : null);

        if (targetIdInCloud) {
          try {
            const { error } = await supabase.from('groups').update({
              ...payload,
              max_slots: updated.maxSlots || 18,
            }).eq('id', targetIdInCloud);

            if (error) {
              await supabase.from('groups').update(payload).eq('id', targetIdInCloud);
            }
          } catch {
            await supabase.from('groups').update(payload).eq('id', targetIdInCloud);
          }

          if (partial.maxSlots !== undefined) {
            try {
              await supabase.from('matches').update({ max_players: newMaxSlots }).eq('group_id', targetIdInCloud).eq('status', 'scheduled');
            } catch (e) {
              console.warn('Erro ao atualizar max_players de matches:', e);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar grupo no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('group_updated', { detail: groups[idx] }));
      window.dispatchEvent(new Event('storage'));
    }

    return groups[idx];
  },

  getMembers(groupId: string): GroupMember[] {
    return getStored<GroupMember[]>(`members_${groupId}`, []);
  },

  async addMember(groupId: string, data: {
    name: string;
    phone?: string;
    mainPosition: UserPosition;
    dominantFoot?: DominantFoot;
    overallRating?: number;
    role?: GroupRole;
  }): Promise<GroupMember> {
    const members = this.getMembers(groupId);
    const newUserId = generateUUID();
    const newMemberId = generateUUID();

    const newProfile: UserProfile = {
      id: newUserId,
      name: data.name,
      email: `${data.name.toLowerCase().replace(/\s+/g, '.')}_${Date.now().toString().slice(-4)}@gestaopelada.com`,
      phone: data.phone || '(11) 99999-9999',
      cpf: `manual_${Date.now().toString().slice(-8)}`,
      address: 'Cadastrado pela Diretoria',
      mainPosition: data.mainPosition,
      dominantFoot: data.dominantFoot || 'destro',
      overallRating: data.overallRating || 7.0,
      createdAt: new Date().toISOString(),
    };

    const newMember: GroupMember = {
      id: newMemberId,
      groupId,
      userId: newUserId,
      user: newProfile,
      role: data.role || 'associado',
      membershipType: data.role === 'diarista' ? 'diarista' : (data.role === 'goleiro' ? 'goleiro' : 'associado'),
      status: 'active',
      isBlockedFinancial: false,
      joinedAt: new Date().toISOString(),
    };

    members.push(newMember);
    setStored(`members_${groupId}`, members);

    if (isSupabaseConfigured && supabase && isValidUUID(groupId)) {
      try {
        await supabase.from('users').insert([{
          id: newUserId,
          name: newProfile.name,
          email: newProfile.email,
          phone: newProfile.phone,
          cpf: newProfile.cpf,
          address: newProfile.address,
          main_position: newProfile.mainPosition,
          dominant_foot: newProfile.dominantFoot,
          overall_rating: newProfile.overallRating,
        }]);

        await supabase.from('group_members').insert([{
          id: newMemberId,
          group_id: groupId,
          user_id: newUserId,
          role: newMember.role,
          membership_type: newMember.membershipType,
          status: 'active',
          is_blocked_financial: false,
        }]);
      } catch (err) {
        console.warn('Aviso ao sincronizar atleta manual no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('member_added', { detail: newMember }));
      window.dispatchEvent(new Event('storage'));
    }

    return newMember;
  },

  async updateMemberRole(groupId: string, memberId: string, role: GroupRole): Promise<void> {
    const members = this.getMembers(groupId);
    let targetMember: GroupMember | undefined;

    const updated = members.map((m) => {
      if (m.id === memberId || m.userId === memberId) {
        let membershipType: MembershipType = 'associado';
        if (role === 'diarista') membershipType = 'diarista';
        else if (role === 'goleiro') membershipType = 'goleiro';
        else membershipType = 'associado';

        const updatedItem: GroupMember = { 
          ...m, 
          role, 
          membershipType,
          isBlockedFinancial: role === 'goleiro' ? false : m.isBlockedFinancial
        };
        targetMember = updatedItem;
        return updatedItem;
      }
      return m;
    });
    setStored(`members_${groupId}`, updated);

    // Se o membro alterado for o usuário logado
    const currentUser = UserService.getCurrentUser();
    if (targetMember && (targetMember.userId === currentUser.id || targetMember.user.cpf === currentUser.cpf)) {
      UserService.setCurrentUser({
        ...currentUser,
        mainPosition: targetMember.user.mainPosition,
      });
    }

    if (isSupabaseConfigured && supabase && targetMember) {
      try {
        let updatedInCloud = false;

        // 1. Tenta atualizar por ID do membro se for UUID válido
        if (isValidUUID(targetMember.id)) {
          const { data } = await supabase
            .from('group_members')
            .update({
              role: targetMember.role,
              membership_type: targetMember.membershipType,
            })
            .eq('id', targetMember.id)
            .select('id');
          if (data && data.length > 0) updatedInCloud = true;
        }

        // 2. Tenta atualizar por group_id + user_id
        if (!updatedInCloud && isValidUUID(targetMember.userId) && isValidUUID(groupId)) {
          const { data } = await supabase
            .from('group_members')
            .update({
              role: targetMember.role,
              membership_type: targetMember.membershipType,
            })
            .match({ group_id: groupId, user_id: targetMember.userId })
            .select('id');
          if (data && data.length > 0) updatedInCloud = true;
        }

        // 3. Se ainda não existia no Supabase, garante o usuário e insere o membro
        if (!updatedInCloud && isValidUUID(groupId)) {
          const validUserId = await UserService.ensureUserInCloud(targetMember.user);
          await supabase.from('group_members').upsert([{
            id: isValidUUID(targetMember.id) ? targetMember.id : generateUUID(),
            group_id: groupId,
            user_id: validUserId,
            role: targetMember.role,
            membership_type: targetMember.membershipType,
            status: targetMember.status || 'active',
          }], { onConflict: 'group_id,user_id' });
        }
      } catch (err) {
        console.warn('Erro ao atualizar cargo no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('members_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  async transferPresidency(groupId: string, newPresidentMemberId: string): Promise<void> {
    const members = this.getMembers(groupId);
    const targetMember = members.find((m) => m.id === newPresidentMemberId || m.userId === newPresidentMemberId);
    if (!targetMember) return;

    const formerPresident = members.find((m) => m.role === 'presidente');

    const updated = members.map((m) => {
      if (m.role === 'presidente') {
        return { ...m, role: 'adm' as GroupRole, membershipType: 'associado' as MembershipType };
      }
      if (m.id === targetMember.id) {
        return { ...m, role: 'presidente' as GroupRole, membershipType: 'associado' as MembershipType };
      }
      return m;
    });

    setStored(`members_${groupId}`, updated);

    // Sincroniza com Supabase
    if (isSupabaseConfigured && supabase && isValidUUID(groupId)) {
      try {
        if (formerPresident) {
          if (isValidUUID(formerPresident.id)) {
            await supabase.from('group_members').update({ role: 'adm' }).eq('id', formerPresident.id);
          } else if (isValidUUID(formerPresident.userId)) {
            await supabase.from('group_members').update({ role: 'adm' }).match({ group_id: groupId, user_id: formerPresident.userId });
          }
        }

        if (isValidUUID(targetMember.id)) {
          await supabase.from('group_members').update({ role: 'presidente' }).eq('id', targetMember.id);
        } else if (isValidUUID(targetMember.userId)) {
          await supabase.from('group_members').update({ role: 'presidente' }).match({ group_id: groupId, user_id: targetMember.userId });
        }
      } catch (err) {
        console.warn('Erro ao sincronizar transferência de presidência no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('members_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  async updateMemberDetails(
    groupId: string,
    memberId: string,
    data: {
      name?: string;
      phone?: string;
      mainPosition?: any;
      secondaryPosition?: any;
      dominantFoot?: any;
      overallRating?: number;
      role?: GroupRole;
      membershipType?: MembershipType;
    }
  ): Promise<void> {
    const members = this.getMembers(groupId);
    let targetMember: GroupMember | undefined;

    const updated = members.map((m) => {
      if (m.id === memberId || m.userId === memberId) {
        let role = data.role !== undefined ? data.role : m.role;
        let membershipType = data.membershipType !== undefined ? data.membershipType : m.membershipType;
        if (role === 'diarista') membershipType = 'diarista';
        else if (role === 'goleiro') membershipType = 'goleiro';
        else if (['presidente', 'adm', 'tesoureiro', 'associado'].includes(role)) membershipType = 'associado';

        const updatedItem: GroupMember = {
          ...m,
          role,
          membershipType,
          user: {
            ...m.user,
            name: data.name !== undefined ? data.name : m.user.name,
            phone: data.phone !== undefined ? data.phone : m.user.phone,
            mainPosition: data.mainPosition !== undefined ? data.mainPosition : m.user.mainPosition,
            secondaryPosition: data.secondaryPosition !== undefined ? data.secondaryPosition : m.user.secondaryPosition,
            dominantFoot: data.dominantFoot !== undefined ? data.dominantFoot : m.user.dominantFoot,
            overallRating: data.overallRating !== undefined ? data.overallRating : m.user.overallRating,
          }
        };
        targetMember = updatedItem;
        return updatedItem;
      }
      return m;
    });
    setStored(`members_${groupId}`, updated);

    const currentUser = UserService.getCurrentUser();
    if (targetMember && (targetMember.userId === currentUser.id || targetMember.user.cpf === currentUser.cpf)) {
      UserService.setCurrentUser({
        ...currentUser,
        ...targetMember.user,
      });
    }

    if (isSupabaseConfigured && supabase && targetMember) {
      try {
        const u = targetMember.user;
        const validRating = typeof u.overallRating === 'number'
          ? Math.min(10, Math.max(1, parseFloat(u.overallRating.toFixed(2))))
          : 6.50;

        // 1. Atualiza ou insere usuário no Supabase
        let targetUserId = targetMember.userId;
        if (isValidUUID(targetUserId)) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', targetUserId)
            .maybeSingle();

          if (existingUser) {
            await supabase.from('users').update({
              name: u.name,
              phone: u.phone,
              main_position: u.mainPosition,
              secondary_position: u.secondaryPosition || null,
              dominant_foot: u.dominantFoot,
              overall_rating: validRating,
            }).eq('id', targetUserId);
          } else {
            targetUserId = await UserService.ensureUserInCloud(u);
          }
        } else {
          targetUserId = await UserService.ensureUserInCloud(u);
        }

        // 2. Atualiza ou insere membro no Supabase
        let memberUpdated = false;
        if (isValidUUID(targetMember.id)) {
          const { data } = await supabase
            .from('group_members')
            .update({
              role: targetMember.role,
              membership_type: targetMember.membershipType,
            })
            .eq('id', targetMember.id)
            .select('id');
          if (data && data.length > 0) memberUpdated = true;
        }

        if (!memberUpdated && isValidUUID(targetUserId) && isValidUUID(groupId)) {
          const { data } = await supabase
            .from('group_members')
            .update({
              role: targetMember.role,
              membership_type: targetMember.membershipType,
            })
            .match({ group_id: groupId, user_id: targetUserId })
            .select('id');
          if (data && data.length > 0) memberUpdated = true;
        }

        if (!memberUpdated && isValidUUID(targetUserId) && isValidUUID(groupId)) {
          await supabase.from('group_members').upsert([{
            id: isValidUUID(targetMember.id) ? targetMember.id : generateUUID(),
            group_id: groupId,
            user_id: targetUserId,
            role: targetMember.role,
            membership_type: targetMember.membershipType,
            status: targetMember.status || 'active',
          }], { onConflict: 'group_id,user_id' });
        }
      } catch (err) {
        console.warn('Erro ao sincronizar detalhes do membro no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('members_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  async removeMember(groupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    const members = this.getMembers(groupId);
    const target = members.find((m) => m.id === memberId || m.userId === memberId);
    if (!target) return { success: false, error: 'Membro não encontrado.' };
    if (target.role === 'presidente') {
      return { success: false, error: 'O Presidente Titular não pode ser excluído. Transfira a presidência antes.' };
    }

    const filtered = members.filter((m) => m.id !== target.id && m.userId !== target.userId);
    setStored(`members_${groupId}`, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        if (isValidUUID(target.id)) {
          await supabase.from('group_members').delete().eq('id', target.id);
        } else if (isValidUUID(target.userId) && isValidUUID(groupId)) {
          await supabase.from('group_members').delete().match({ group_id: groupId, user_id: target.userId });
        }
      } catch (err) {
        console.warn('Erro ao remover membro no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('members_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    return { success: true };
  },

  async deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const user = UserService.getCurrentUser();
    const group = this.getGroupById(groupId);
    if (!group) return { success: false, error: 'Grupo não encontrado.' };

    const member = this.getMemberInGroup(groupId, user.id);
    const isCreator = group.createdBy === user.id || member?.role === 'presidente';

    if (!isCreator) {
      return { success: false, error: 'Apenas o Criador / Presidente Titular tem permissão para excluir este grupo.' };
    }

    // 1. Remove do Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('group_members').delete().eq('group_id', groupId);
        await supabase.from('matches').delete().eq('group_id', groupId);
        await supabase.from('financial_transactions').delete().eq('group_id', groupId);
        await supabase.from('groups').delete().eq('id', groupId);
      } catch (err) {
        console.warn('Erro ao excluir dados do grupo no Supabase:', err);
      }
    }

    // 2. Remove do LocalStorage
    const groups = this.getGroups().filter((g) => g.id !== groupId);
    setStored('groups', groups);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`members_${groupId}`);
      localStorage.removeItem(`matches_${groupId}`);
      localStorage.removeItem(`transactions_${groupId}`);
      localStorage.removeItem(`rules_${groupId}`);
    }

    // 3. Atualiza o grupo ativo
    const remainingUserGroups = this.getUserGroups();
    if (remainingUserGroups.length > 0) {
      this.setActiveGroupId(remainingUserGroups[0].group.id);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active_group_id');
      }
    }

    return { success: true };
  },

  async joinGroupById(
    groupId: string,
    membershipType: MembershipType
  ): Promise<{ success: boolean; group?: Group; member?: GroupMember; error?: string }> {
    return this.joinGroupByCode(groupId, membershipType);
  },

  async joinGroupByCode(
    inviteCodeOrName: string, 
    membershipType: MembershipType
  ): Promise<{ success: boolean; group?: Group; member?: GroupMember; error?: string }> {
    const cleanTerm = (inviteCodeOrName || '').trim();
    
    // 1. Busca grupo local ou no Supabase por Código, UUID ou Nome
    let group = await this.findGroupByInviteCodeAsync(cleanTerm);

    if (!group) {
      return { success: false, error: 'Grupo não encontrado. Verifique se digitou o nome ou código corretamente.' };
    }

    const user = UserService.getCurrentUser();
    const validUserId = await UserService.ensureUserInCloud(user);

    // Garante que os membros da nuvem estejam sincronizados
    const members = await this.syncGroupMembersFromCloud(group.id);
    const existing = members.find((m) => m.userId === validUserId || m.user.cpf === user.cpf);
    if (existing) {
      this.setActiveGroupId(group.id);
      return { success: true, group, member: existing };
    }

    let initialRole: GroupRole = 'associado';
    if (membershipType === 'diarista') initialRole = 'diarista';
    else if (membershipType === 'goleiro' || user.mainPosition === 'goleiro') initialRole = 'goleiro';

    const isCreator = group.createdBy === validUserId || group.createdBy === user.id;
    const initialStatus: MemberStatus = isCreator ? 'active' : 'pending_approval';

    const memberId = generateUUID();
    const newMember: GroupMember = {
      id: memberId,
      groupId: group.id,
      userId: validUserId,
      user,
      role: initialRole,
      membershipType,
      status: initialStatus,
      isBlockedFinancial: false,
      joinedAt: new Date().toISOString(),
    };

    members.push(newMember);
    setStored(`members_${group.id}`, members);
    this.setActiveGroupId(group.id);

    // Sincroniza novo membro no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('group_members').insert([{
          id: memberId,
          group_id: group.id,
          user_id: validUserId,
          role: initialRole,
          membership_type: membershipType,
          status: initialStatus,
        }]);
      } catch (err) {
        console.error('Erro ao salvar novo membro no Supabase:', err);
      }
    }

    // Dispara notificação de solicitação de entrada para a diretoria
    try {
      NotificationService.addNotification(group.id, {
        type: 'member_request',
        title: isCreator ? 'Criador no Grupo 👑' : 'Solicitação de Entrada no Grupo 📩',
        message: isCreator
          ? `${user.name} criou o grupo.`
          : `${user.name} solicitou entrada no grupo como ${membershipType.toUpperCase()}. Aguarda aprovação do Presidente, ADM ou Tesoureiro.`,
        groupName: group.name,
        data: {
          memberId,
          userId: validUserId,
          userName: user.name,
          role: initialRole,
          membershipType,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de membro:', e);
    }

    return { success: true, group, member: newMember };
  }
};

// ---------------------------------------------------------------------------
// 2. GESTÃO DE PELADAS & PRESENÇA (ABERTURA MANUAL PELA COMISSÃO)
// ---------------------------------------------------------------------------
export const MatchService = {
  getMatches(groupId: string): Match[] {
    return getStored<Match[]>(`matches_${groupId}`, []);
  },

  getMatchById(matchId: string): Match | undefined {
    const allGroups = GroupService.getGroups();
    for (const g of allGroups) {
      const matches = this.getMatches(g.id);
      const target = matches.find((m) => m.id === matchId);
      if (target) return target;
    }
    return undefined;
  },

  openMatchAttendance(
    groupId: string, 
    matchDate: string, 
    startTime: string, 
    maxPlayers: number, 
    costDiarista: number = 25,
    confirmationDeadline?: string
  ): Match {
    const matches = this.getMatches(groupId);
    const newMatch: Match = {
      id: generateUUID(),
      groupId,
      matchDate,
      startTime,
      confirmationDeadline,
      maxPlayers,
      costDiarista,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    matches.unshift(newMatch);
    setStored(`matches_${groupId}`, matches);

    // Marca o grupo como lista aberta
    GroupService.updateGroup(groupId, { isOpenAttendance: true, maxSlots: maxPlayers });

    // Dispara notificação oficial para todos os associados do grupo
    try {
      const group = GroupService.getGroupById(groupId);
      let deadlineText = '';
      if (confirmationDeadline) {
        try {
          const d = new Date(confirmationDeadline);
          deadlineText = ` • Prazo limite: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          deadlineText = ` • Prazo: ${confirmationDeadline}`;
        }
      }

      NotificationService.addNotification(groupId, {
        type: 'match_opened',
        title: 'Lista de Presença Aberta! ⚽',
        message: `A lista para a pelada de ${matchDate} às ${startTime} foi aberta (${maxPlayers} vagas)!${deadlineText} Confirme sua vaga.`,
        data: {
          matchId: newMatch.id,
          slotNumber: maxPlayers,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de abertura de lista:', e);
    }

    return newMatch;
  },

  closeMatchAttendance(groupId: string, matchId: string): void {
    const matches = this.getMatches(groupId);
    const target = matches.find((m) => m.id === matchId);
    if (target) {
      target.status = 'in_progress';
      setStored(`matches_${groupId}`, matches);
    }
    GroupService.updateGroup(groupId, { isOpenAttendance: false });
  },

  updateMatchMaxPlayers(groupId: string, matchId: string, maxPlayers: number): void {
    const matches = this.getMatches(groupId);
    const target = matches.find((m) => m.id === matchId);
    if (target) {
      target.maxPlayers = maxPlayers;
      setStored(`matches_${groupId}`, matches);
    }
    GroupService.updateGroup(groupId, { maxSlots: maxPlayers });
  },

  getAttendances(matchId: string): MatchAttendance[] {
    return getStored<MatchAttendance[]>(`attendances_${matchId}`, []);
  },

  confirmAttendance(matchId: string, user: UserProfile, maxPlayers: number, groupId?: string): MatchAttendance {
    const attendances = this.getAttendances(matchId);
    const existing = attendances.find((a) => a.userId === user.id);
    if (existing && existing.status !== 'cancelled') return existing;

    const match = this.getMatchById(matchId);
    let isExpiredDeadline = false;
    if (match?.confirmationDeadline) {
      const deadlineDate = new Date(match.confirmationDeadline);
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        isExpiredDeadline = true;
      }
    }

    const confirmedCount = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present').length;
    const isWaitlist = isExpiredDeadline || confirmedCount >= maxPlayers;

    const newAttendance: MatchAttendance = {
      id: existing ? existing.id : generateUUID(),
      matchId,
      userId: user.id,
      user,
      status: isWaitlist ? 'waitlist' : 'confirmed',
      isFinancialBlocked: false,
      confirmedAt: new Date().toISOString(),
    };

    if (existing) {
      const idx = attendances.findIndex((a) => a.id === existing.id);
      attendances[idx] = newAttendance;
    } else {
      attendances.push(newAttendance);
    }
    setStored(`attendances_${matchId}`, attendances);

    // Dispara notificação da lista de presença
    try {
      const gid = groupId || match?.groupId || GroupService.getActiveGroupId() || '';
      NotificationService.addNotification(gid, {
        type: 'attendance_confirmed',
        title: isWaitlist ? (isExpiredDeadline ? 'Fila de Espera (Prazo Expirado) ⏳' : 'Fila de Espera ⏳') : 'Presença Confirmada ✅',
        message: isExpiredDeadline
          ? `${user.name} confirmou presença após o prazo limite e entrou na Fila de Espera.`
          : `${user.name} confirmou presença na lista (${isWaitlist ? 'Fila de Espera' : `Vaga #${confirmedCount + 1}`}).`,
        data: {
          userId: user.id,
          userName: user.name,
          matchId,
          slotNumber: isWaitlist ? undefined : confirmedCount + 1,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de presença:', e);
    }

    return newAttendance;
  },

  promoteWaitlistToConfirmed(matchId: string, attendanceIdOrUserId: string): MatchAttendance | null {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId);
    if (!target) return null;

    target.status = 'confirmed';
    setStored(`attendances_${matchId}`, attendances);

    try {
      const match = this.getMatchById(matchId);
      const gid = match?.groupId || GroupService.getActiveGroupId() || '';
      NotificationService.addNotification(gid, {
        type: 'attendance_confirmed',
        title: 'Promovido para a Lista de Confirmados! ⚽',
        message: `${target.user.name} foi promovido para os confirmados pela diretoria.`,
        data: {
          userId: target.userId,
          userName: target.user.name,
          matchId,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação:', e);
    }

    return target;
  },

  demoteConfirmedToWaitlist(matchId: string, attendanceIdOrUserId: string): MatchAttendance | null {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId);
    if (!target) return null;

    target.status = 'waitlist';
    setStored(`attendances_${matchId}`, attendances);
    return target;
  },

  addGuestAttendance(
    matchId: string,
    hostUser: UserProfile,
    guestData: {
      name: string;
      position: UserPosition;
      overallRating?: number;
      dominantFoot?: DominantFoot;
      phone?: string;
    },
    maxPlayers: number,
    groupId?: string
  ): MatchAttendance {
    const attendances = this.getAttendances(matchId);
    const guestUserId = `guest_${generateUUID().substring(0, 8)}`;
    
    const confirmedCount = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present').length;
    const isWaitlist = confirmedCount >= maxPlayers;

    const guestProfile: UserProfile = {
      id: guestUserId,
      name: guestData.name.trim(),
      email: '',
      phone: guestData.phone || hostUser.phone || '',
      cpf: '',
      address: `Convidado por ${hostUser.name}`,
      mainPosition: guestData.position,
      dominantFoot: guestData.dominantFoot || 'destro',
      overallRating: guestData.overallRating || 6.5,
      createdAt: new Date().toISOString(),
    };

    const newAttendance: MatchAttendance = {
      id: generateUUID(),
      matchId,
      userId: guestUserId,
      user: guestProfile,
      status: isWaitlist ? 'waitlist' : 'confirmed',
      isFinancialBlocked: false,
      isGuest: true,
      invitedByUserId: hostUser.id,
      invitedByName: hostUser.name,
      guestPhone: guestData.phone,
      confirmedAt: new Date().toISOString(),
    };

    attendances.push(newAttendance);
    setStored(`attendances_${matchId}`, attendances);

    try {
      const gid = groupId || GroupService.getActiveGroupId() || '';
      NotificationService.addNotification(gid, {
        type: 'attendance_confirmed',
        title: 'Novo Convidado na Lista 🎟️',
        message: `${hostUser.name} adicionou o convidado ${guestData.name} (${guestData.position.toUpperCase()}) na lista da pelada.`,
        data: {
          userId: guestUserId,
          userName: guestData.name,
          matchId,
          role: 'convidado',
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de convidado:', e);
    }

    return newAttendance;
  },

  removeGuestAttendance(matchId: string, attendanceIdOrUserId: string): { promotedUser?: UserProfile } {
    const attendances = this.getAttendances(matchId);
    const targetIdx = attendances.findIndex((a) => (a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId) && a.status !== 'cancelled');
    if (targetIdx === -1) return {};

    const wasConfirmed = attendances[targetIdx].status === 'confirmed';
    attendances[targetIdx].status = 'cancelled';

    let promotedUser: UserProfile | undefined;
    if (wasConfirmed) {
      const waitlistCandidate = attendances.find((a) => a.status === 'waitlist');
      if (waitlistCandidate) {
        waitlistCandidate.status = 'confirmed';
        promotedUser = waitlistCandidate.user;
      }
    }

    setStored(`attendances_${matchId}`, attendances);
    return { promotedUser };
  },

  cancelAttendance(matchId: string, userId: string): { promotedUser?: UserProfile } {
    const attendances = this.getAttendances(matchId);
    const leavingIdx = attendances.findIndex((a) => a.userId === userId && a.status !== 'cancelled');
    if (leavingIdx === -1) return {};

    const wasConfirmed = attendances[leavingIdx].status === 'confirmed';
    attendances[leavingIdx].status = 'cancelled';

    let promotedUser: UserProfile | undefined;
    if (wasConfirmed) {
      const waitlistCandidate = attendances.find((a) => a.status === 'waitlist');
      if (waitlistCandidate) {
        waitlistCandidate.status = 'confirmed';
        promotedUser = waitlistCandidate.user;
      }
    }

    setStored(`attendances_${matchId}`, attendances);
    return { promotedUser };
  },

  checkInArrival(matchId: string, userId: string, order: number, groupId?: string): void {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.userId === userId);
    if (target) {
      target.status = 'present';
      target.arrivalOrder = order;
      target.checkedInAt = new Date().toISOString();
      setStored(`attendances_${matchId}`, attendances);

      try {
        const gid = groupId || GroupService.getActiveGroupId() || '';
        NotificationService.addNotification(gid, {
          type: 'player_arrived',
          title: 'Chegada ao Campo ⚽',
          message: `${target.user.name} chegou ao campo (Ordem de chegada #${order})!`,
          data: {
            userId,
            userName: target.user.name,
            matchId,
            arrivalOrder: order,
          }
        });
      } catch (e) {
        console.warn('Erro ao disparar notificação de chegada:', e);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// 3. PÓS-PELADA E VOTAÇÃO DE NOTAS
// ---------------------------------------------------------------------------
export const RatingService = {
  submitRatings(
    matchId: string, 
    raterUserId: string, 
    ratings: Array<{ ratedUserId: string; rating: number; tag?: string }>
  ): void {
    const existingRatings = getStored<any[]>(`ratings_${matchId}`, []);
    ratings.forEach((item) => {
      existingRatings.push({
        id: generateUUID(),
        matchId,
        raterUserId,
        ratedUserId: item.ratedUserId,
        rating: item.rating,
        tag: item.tag,
        createdAt: new Date().toISOString(),
      });
    });
    setStored(`ratings_${matchId}`, existingRatings);
  }
};

// ---------------------------------------------------------------------------
// 4. SÚMULA, ESTATÍSTICAS & RANKINGS (ARTILHEIRO, GARÇOM, XERIFE, PAREDÃO, MVP)
// ---------------------------------------------------------------------------
export const MatchStatsService = {
  getMatchStats(matchId: string): PlayerMatchStat[] {
    return getStored<PlayerMatchStat[]>(`stats_${matchId}`, []);
  },

  savePlayerMatchStats(matchId: string, stats: PlayerMatchStat[]): void {
    setStored(`stats_${matchId}`, stats);
  },

  getGroupStats(groupId: string): PlayerMatchStat[] {
    const allMatches = MatchService.getMatches(groupId);
    const allStats: PlayerMatchStat[] = [];
    allMatches.forEach((m) => {
      const stats = this.getMatchStats(m.id);
      allStats.push(...stats);
    });
    return allStats;
  },

  getGroupRankings(groupId: string): {
    topScorers: Array<{ userId: string; userName: string; count: number }>;
    topAssists: Array<{ userId: string; userName: string; count: number }>;
    topTackles: Array<{ userId: string; userName: string; count: number }>;
    topKeepers: Array<{ userId: string; userName: string; count: number }>;
    topMvps: Array<{ userId: string; userName: string; count: number }>;
    cardsSummary: Array<{ userId: string; userName: string; yellowCards: number; redCards: number }>;
  } {
    const allStats = this.getGroupStats(groupId);
    const userMap = new Map<string, {
      userName: string;
      goals: number;
      assists: number;
      tackles: number;
      saves: number;
      mvpCount: number;
      yellowCards: number;
      redCards: number;
    }>();

    allStats.forEach((st) => {
      const current = userMap.get(st.userId) || {
        userName: st.userName,
        goals: 0,
        assists: 0,
        tackles: 0,
        saves: 0,
        mvpCount: 0,
        yellowCards: 0,
        redCards: 0,
      };

      current.goals += st.goals || 0;
      current.assists += st.assists || 0;
      current.tackles += st.tackles || 0;
      current.saves += st.saves || 0;
      if (st.isMvp) current.mvpCount += 1;
      current.yellowCards += st.yellowCards || 0;
      current.redCards += st.redCards || 0;

      userMap.set(st.userId, current);
    });

    const entries = Array.from(userMap.entries()).map(([userId, data]) => ({ userId, ...data }));

    return {
      topScorers: entries.map(e => ({ userId: e.userId, userName: e.userName, count: e.goals })).filter(e => e.count > 0).sort((a, b) => b.count - a.count),
      topAssists: entries.map(e => ({ userId: e.userId, userName: e.userName, count: e.assists })).filter(e => e.count > 0).sort((a, b) => b.count - a.count),
      topTackles: entries.map(e => ({ userId: e.userId, userName: e.userName, count: e.tackles })).filter(e => e.count > 0).sort((a, b) => b.count - a.count),
      topKeepers: entries.map(e => ({ userId: e.userId, userName: e.userName, count: e.saves })).filter(e => e.count > 0).sort((a, b) => b.count - a.count),
      topMvps: entries.map(e => ({ userId: e.userId, userName: e.userName, count: e.mvpCount })).filter(e => e.count > 0).sort((a, b) => b.count - a.count),
      cardsSummary: entries.filter((e) => e.yellowCards > 0 || e.redCards > 0),
    };
  }
};

// ---------------------------------------------------------------------------
// 5. GESTÃO FINANCEIRA (MENSALIDADES, DIÁRIAS, DESPESAS & BAIXAS)
// ---------------------------------------------------------------------------
export const FinanceService = {
  getTransactions(groupId: string): FinancialTransaction[] {
    return getStored<FinancialTransaction[]>(`transactions_${groupId}`, []);
  },

  createTransaction(groupId: string, data: Omit<FinancialTransaction, 'id' | 'createdAt' | 'groupId'>): FinancialTransaction {
    const transactions = this.getTransactions(groupId);
    const newTrans: FinancialTransaction = {
      ...data,
      id: generateUUID(),
      groupId,
      createdAt: new Date().toISOString(),
    };
    transactions.unshift(newTrans);
    setStored(`transactions_${groupId}`, transactions);
    return newTrans;
  },

  generateMonthlyDuesBatch(
    groupId: string, 
    monthRef: string, 
    amount: number, 
    dueDate: string, 
    isPaid: boolean = false,
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): { generatedCount: number; transactions: FinancialTransaction[] } {
    const members = GroupService.getMembers(groupId);
    const transactions = this.getTransactions(groupId);
    const createdList: FinancialTransaction[] = [];

    const payingMembers = members.filter((m) => {
      const isGoleiro = m.role === 'goleiro' || m.membershipType === 'goleiro';
      if (isGoleiro) return false;
      return m.membershipType === 'associado' || ['presidente', 'adm', 'tesoureiro', 'associado'].includes(m.role);
    });

    payingMembers.forEach((member) => {
      const description = `Mensalidade ${monthRef}`;
      const alreadyExists = transactions.some(
        (t) => t.userId === member.userId && t.description.toLowerCase().includes(monthRef.toLowerCase()) && t.category === 'mensalidade'
      );

      if (!alreadyExists) {
        const newTrans: FinancialTransaction = {
          id: generateUUID(),
          groupId,
          userId: member.userId,
          userName: member.user.name,
          type: 'income',
          category: 'mensalidade',
          description: `${description} (${member.user.name})`,
          amount,
          dueDate,
          status: isPaid ? 'paid' : 'pending',
          paidAt: isPaid ? new Date().toISOString() : undefined,
          recordedBy,
          createdAt: new Date().toISOString(),
        };
        transactions.unshift(newTrans);
        createdList.push(newTrans);
      }
    });

    setStored(`transactions_${groupId}`, transactions);
    return { generatedCount: createdList.length, transactions: createdList };
  },

  generateSingleMonthlyDue(
    groupId: string,
    userId: string,
    userName: string,
    monthRef: string,
    amount: number,
    dueDate: string,
    isPaid: boolean = false,
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): FinancialTransaction {
    const description = `Mensalidade ${monthRef} (${userName})`;
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'mensalidade',
      description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy,
    });
  },

  generateDailyFee(
    groupId: string, 
    userId: string, 
    userName: string, 
    matchDate: string, 
    amount: number, 
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): FinancialTransaction {
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'diaria',
      description: `Diária da Pelada de ${matchDate} (${userName})`,
      amount,
      dueDate: matchDate,
      status: 'pending',
      recordedBy,
    });
  },

  generateCardFine(
    groupId: string,
    userId: string,
    userName: string,
    cardType: 'cartao_azul' | 'cartao_vermelho' | 'multa_atraso' | 'multa_falta' | 'cartao_amarelo',
    amount: number,
    matchDate: string,
    description?: string,
    isPaid: boolean = false,
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): FinancialTransaction {
    const defaultLabels: Record<string, string> = {
      cartao_azul: 'Multa - Cartão Azul 🟦',
      cartao_vermelho: 'Multa - Cartão Vermelho 🟥',
      cartao_amarelo: 'Multa - Cartão Amarelo 🟨',
      multa_atraso: 'Multa - Atraso de Horário ⏰',
      multa_falta: 'Multa - Falta sem Aviso ⏳',
    };
    const title = description || `${defaultLabels[cardType]} (${userName} - ${matchDate})`;
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: cardType,
      description: title,
      amount,
      dueDate: matchDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy,
    });
  },

  generateCustomIncome(
    groupId: string,
    category: TransactionCategory,
    description: string,
    amount: number,
    dueDate: string,
    userId?: string,
    userName?: string,
    isPaid: boolean = true,
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): FinancialTransaction {
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category,
      description: userName ? `${description} (${userName})` : description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy,
    });
  },

  createExpense(
    groupId: string, 
    category: any, 
    description: string, 
    amount: number, 
    dueDate: string, 
    userId?: string, 
    userName?: string, 
    isPaid: boolean = true, 
    recordedBy: string = '00000000-0000-4000-8000-000000000001'
  ): FinancialTransaction {
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'expense',
      category,
      description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy,
    });
  },

  settleTransaction(groupId: string, transactionId: string): void {
    const transactions = this.getTransactions(groupId);
    let settledUserId: string | undefined;

    const updated = transactions.map((t) => {
      if (t.id === transactionId) {
        settledUserId = t.userId;
        return { ...t, status: 'paid' as any, paidAt: new Date().toISOString() };
      }
      return t;
    });

    setStored(`transactions_${groupId}`, updated);

    if (settledUserId) {
      const remainingDebts = updated.some(
        (t) => t.userId === settledUserId && (t.status === 'overdue' || t.status === 'pending')
      );
      if (!remainingDebts) {
        const members = GroupService.getMembers(groupId);
        const updatedMembers = members.map((m) =>
          m.userId === settledUserId ? { ...m, isBlockedFinancial: false, blockedReason: undefined } : m
        );
        setStored(`members_${groupId}`, updatedMembers);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// 6. CENTRAL DE NOTIFICAÇÕES EM TEMPO REAL
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
