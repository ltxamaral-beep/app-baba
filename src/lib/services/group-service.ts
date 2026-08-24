import { 
  Group, 
  GroupMember, 
  GroupRole, 
  MembershipType, 
  MemberStatus, 
  SoccerType, 
  UserPosition, 
  DominantFoot, 
  UserProfile 
} from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID, getStored, setStored, withTimeout } from './storage-helpers';
import { UserService } from './user-service';
import { NotificationService } from './notification-service';

// ---------------------------------------------------------------------------
// 1. GESTÃO DE GRUPOS & MEMBROS
// ---------------------------------------------------------------------------
export const GroupService = {
  getGroups(): Group[] {
    return getStored<Group[]>('groups', []);
  },

  getGroupById(id: string): Group | undefined {
    const groups = this.getGroups();
    if (!id || id === 'group-1') {
      const activeId = getStored<string | null>('active_group_id', null);
      if (activeId && activeId !== 'group-1') {
        const foundActive = groups.find((g) => g.id === activeId);
        if (foundActive) return foundActive;
      }
      const canonical = groups.find((g) => g.id === '0cae6a08-5cf3-466e-840a-0f6cf3a8f3ac');
      if (canonical) return canonical;
      if (groups.length > 0) return groups[0];
    }
    const found = groups.find((g) => g.id === id);
    if (found) return found;
    const canonical = groups.find((g) => g.id === '0cae6a08-5cf3-466e-840a-0f6cf3a8f3ac');
    if (canonical) return canonical;
    return groups[0];
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
          const { data } = await withTimeout(query.eq('id', rawTrim).maybeSingle(), 3000, { data: null, error: null });
          if (data) return this.mapCloudGroup(data);
        }

        // Tenta query específica por invite_code ou por nome
        const { data } = await withTimeout(
          supabase
            .from('groups')
            .select('*')
            .or(`invite_code.ilike.${cleanRaw},invite_code.ilike.${cleanNoSpaces},name.ilike.%${rawTrim}%`)
            .limit(1)
            .maybeSingle(),
          3000,
          { data: null, error: null }
        );

        let matched = data;

        // Se não achou na query exata, busca todos os grupos e compara por caracteres alfanuméricos
        if (!matched) {
          const { data: allGroups } = await withTimeout(
            supabase.from('groups').select('*').limit(100),
            3000,
            { data: null, error: null }
          );
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
    if (matched.max_slots && Number(matched.max_slots) > 0) {
      resolvedMaxSlots = Number(matched.max_slots);
    } else if (existingLocal && existingLocal.maxSlots && Number(existingLocal.maxSlots) > 0) {
      resolvedMaxSlots = Number(existingLocal.maxSlots);
    } else if (matched.players_per_team && Number(matched.players_per_team) > 0) {
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
        const { data } = await withTimeout(
          supabase
            .from('groups')
            .select('*')
            .or(`name.ilike.%${rawTrim}%,invite_code.ilike.%${rawTrim}%,field_address.ilike.%${rawTrim}%`)
            .limit(30),
          3000,
          { data: null, error: null }
        );

        if (data && data.length > 0) {
          const cloudList = data.map((d: any) => this.mapCloudGroup(d));
          const merged = [...localMatches];
          cloudList.forEach((cg: Group) => {
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
        const { data } = await withTimeout(
          supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(30),
          3000,
          { data: null, error: null }
        );
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

      // 1. Puxa todos os grupos da nuvem com timeout
      const { data: cloudGroups } = await withTimeout(
        supabase.from('groups').select('*').order('created_at', { ascending: false }),
        4000,
        { data: null, error: null }
      );
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
            await withTimeout(
              supabase.from('groups').insert([{
                ...groupPayload,
                max_slots: lg.maxSlots || 18,
              }]),
              3000,
              { data: null, error: null }
            );
          } catch {}

          const memberId = generateUUID();
          try {
            await withTimeout(
              supabase.from('group_members').insert([{
                id: memberId,
                group_id: newGroupId,
                user_id: validUserId,
                role: 'presidente',
                membership_type: 'associado',
                status: 'active',
              }]),
              3000,
              { data: null, error: null }
            );
          } catch {}
        }
      }

      // 3. Atualiza os grupos locais com a lista completa do Supabase
      if (cloudGroups && cloudGroups.length > 0) {
        const merged: Group[] = cloudGroups.map((d: any) => this.mapCloudGroup(d));
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
    const allGroups = this.getGroups();
    const stored = getStored<string | null>('active_group_id', null);

    if (stored && stored !== 'group-1') {
      if (userGroups.some((ug) => ug.group.id === stored) || allGroups.some((g) => g.id === stored)) {
        return stored;
      }
    }
    if (userGroups.length > 0 && userGroups[0].group.id !== 'group-1') {
      setStored('active_group_id', userGroups[0].group.id);
      return userGroups[0].group.id;
    }
    if (allGroups.length > 0 && allGroups[0].id !== 'group-1') {
      setStored('active_group_id', allGroups[0].id);
      return allGroups[0].id;
    }
    const fallbackId = '0cae6a08-5cf3-466e-840a-0f6cf3a8f3ac';
    setStored('active_group_id', fallbackId);
    return fallbackId;
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
      const { data } = await withTimeout(
        supabase
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
          .eq('group_id', groupId),
        4000,
        { data: null, error: null }
      );

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

  async blockMemberFinancial(groupId: string, userId: string, reason: string): Promise<void> {
    const members = this.getMembers(groupId);
    const target = members.find((member) => member.userId === userId);
    if (!target) return;

    target.isBlockedFinancial = true;
    target.blockedReason = reason;
    setStored(`members_${groupId}`, members);

    if (isSupabaseConfigured && supabase && isValidUUID(target.id)) {
      const { error } = await supabase
        .from('group_members')
        .update({ is_blocked_financial: true, blocked_reason: reason })
        .eq('id', target.id);
      if (error) console.warn('Erro ao bloquear membro no Supabase:', error);
    }
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
