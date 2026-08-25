import { 
  Match, 
  MatchAttendance, 
  PlayerMatchStat, 
  UserProfile, 
  UserPosition, 
  DominantFoot 
} from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID, getStored, setStored, withTimeout } from './storage-helpers';
import { UserService } from './user-service';
import { GroupService } from './group-service';
import { NotificationService } from './notification-service';

// ---------------------------------------------------------------------------
// GESTÃO DE PELADAS & PRESENÇA (ABERTURA MANUAL PELA COMISSÃO)
// ---------------------------------------------------------------------------
export const MatchService = {
  getMatches(groupId: string): Match[] {
    if (!groupId) return [];
    const direct = getStored<Match[]>(`matches_${groupId}`, []);
    if (direct.length > 0) return direct;

    // Varredura em chaves de partidas salvas no LocalStorage para o grupo
    if (typeof window !== 'undefined') {
      try {
        const foundMatches: Match[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key === `pelada_matches_${groupId}` || key === `matches_${groupId}`)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list: Match[] = JSON.parse(raw);
              if (Array.isArray(list) && list.length > 0) {
                list.forEach((m) => {
                  if (!foundMatches.some((x) => x.id === m.id)) {
                    foundMatches.push({ ...m, groupId });
                  }
                });
              }
            }
          }
        }
        if (foundMatches.length > 0) {
          setStored(`matches_${groupId}`, foundMatches);
          return foundMatches;
        }
      } catch (e) {
        console.warn('Erro ao varrer partidas locais:', e);
      }
    }

    return direct;
  },

  getMatchById(matchId: string): Match | undefined {
    if (!matchId) return undefined;
    const allGroups = GroupService.getGroups();
    for (const g of allGroups) {
      const matches = this.getMatches(g.id);
      const target = matches.find((m) => m.id === matchId);
      if (target) return target;
    }
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('pelada_matches_')) {
            const list: Match[] = JSON.parse(localStorage.getItem(k) || '[]');
            const found = list.find((m) => m.id === matchId);
            if (found) return found;
          }
        }
      } catch {}
    }
    return undefined;
  },

  async syncMatchesFromCloud(groupId: string): Promise<Match[]> {
    const local = this.getMatches(groupId);
    if (!isSupabaseConfigured || !supabase || !groupId) return local;

    try {
      // O Supabase é a fonte oficial. Dados locais nunca são reenviados
      // automaticamente, pois podem estar desatualizados em outro navegador.
      if (!isValidUUID(groupId)) return local;

      // Busca a fotografia atual das partidas do grupo.
      const { data, error } = await withTimeout(
        supabase.from('matches').select('*').eq('group_id', groupId)
          .order('match_date', { ascending: false }),
        6000,
        { data: null, error: new Error('Tempo limite ao buscar listas') }
      );

      if (error) {
        console.warn('Aviso ao consultar partidas do Supabase:', error);
        return local;
      }

      const remoteMatches: Match[] = (data || []).map((m: any) => ({
        id: m.id,
        groupId: m.group_id,
        matchDate: m.match_date,
        startTime: m.start_time ? m.start_time.substring(0, 5) : '20:00',
        confirmationDeadline: m.confirmation_deadline || undefined,
        maxPlayers: m.max_players || 24,
        costDiarista: m.cost_diarista ? Number(m.cost_diarista) : 25,
        status: m.status || 'scheduled',
        createdAt: m.created_at || new Date().toISOString(),
      }));

      const authoritative = remoteMatches.sort(
        (a, b) => new Date(b.matchDate + 'T' + (b.startTime || '00:00')).getTime() - new Date(a.matchDate + 'T' + (a.startTime || '00:00')).getTime()
      );

      setStored(`matches_${groupId}`, authoritative);

      const hasOpenMatch = authoritative.some((m) => m.status === 'scheduled');
      const g = GroupService.getGroupById(groupId);
      if (g && g.isOpenAttendance !== hasOpenMatch) {
        GroupService.updateGroup(groupId, { isOpenAttendance: hasOpenMatch });
      }

      return authoritative;
    } catch (err) {
      console.warn('Erro ao sincronizar partidas do Supabase:', err);
      return local;
    }
  },

  async openMatchAttendance(
    groupId: string, 
    matchDate: string, 
    startTime: string, 
    maxPlayers: number, 
    costDiarista: number = 25,
    confirmationDeadline?: string
  ): Promise<Match> {
    const matches = this.getMatches(groupId);
    const newMatchId = generateUUID();
    const newMatch: Match = {
      id: newMatchId,
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

    // Marca o grupo como lista aberta localmente
    await GroupService.updateGroup(groupId, { isOpenAttendance: true, maxSlots: maxPlayers });

    // Sincroniza partida no Supabase com segurança
    if (isSupabaseConfigured && supabase) {
      try {
        const targetG = GroupService.getGroupById(groupId);
        if (targetG && !isValidUUID(targetG.id)) {
          await GroupService.syncAllWithCloud();
        }

        const targetGroupIdInCloud = isValidUUID(groupId) ? groupId : (targetG && isValidUUID(targetG.id) ? targetG.id : null);
        if (targetGroupIdInCloud) {
          const rawTime = (startTime || '20:00').trim();
          const formattedTime = rawTime.includes(':')
            ? (rawTime.split(':').length === 2 ? `${rawTime}:00` : rawTime)
            : '20:00:00';

          const formattedDeadline = confirmationDeadline
            ? new Date(confirmationDeadline).toISOString()
            : null;

          const { error: upsertError } = await withTimeout(
            supabase.from('matches').upsert([{
              id: newMatch.id,
              group_id: targetGroupIdInCloud,
              match_date: matchDate,
              start_time: formattedTime,
              confirmation_deadline: formattedDeadline,
              max_players: maxPlayers,
              cost_diarista: costDiarista,
              status: 'scheduled',
            }]),
            5000,
            { error: null }
          );

          if (upsertError) {
            console.warn('Aviso ao salvar partida no Supabase:', upsertError.message);
          }
        }
      } catch (err) {
        console.warn('Erro ao salvar partida no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('match_opened', { detail: newMatch }));
      window.dispatchEvent(new Event('storage'));
    }

    // Dispara notificação oficial para todos os associados do grupo
    try {
      let deadlineText = '';
      if (confirmationDeadline) {
        try {
          const d = new Date(confirmationDeadline);
          deadlineText = ` • Prazo limite: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          deadlineText = ` • Prazo: ${confirmationDeadline}`;
        }
      }

      await NotificationService.notifyGroup(groupId, {
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

  async updateMatch(
    groupId: string,
    matchId: string,
    data: {
      matchDate?: string;
      startTime?: string;
      maxPlayers?: number;
      confirmationDeadline?: string | null;
      costDiarista?: number;
    }
  ): Promise<Match | null> {
    const matches = this.getMatches(groupId);
    const target = matches.find((m) => m.id === matchId);
    if (!target) return null;

    if (data.matchDate) target.matchDate = data.matchDate;
    if (data.startTime) target.startTime = data.startTime.substring(0, 5);
    if (data.maxPlayers !== undefined) target.maxPlayers = data.maxPlayers;
    if (data.confirmationDeadline !== undefined) target.confirmationDeadline = data.confirmationDeadline || undefined;
    if (data.costDiarista !== undefined) target.costDiarista = data.costDiarista;

    setStored(`matches_${groupId}`, matches);

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        const updatePayload: any = {};
        if (data.matchDate) updatePayload.match_date = data.matchDate;
        if (data.startTime) {
          const raw = data.startTime.trim();
          updatePayload.start_time = raw.includes(':') ? (raw.split(':').length === 2 ? `${raw}:00` : raw) : '20:00:00';
        }
        if (data.maxPlayers !== undefined) updatePayload.max_players = data.maxPlayers;
        if (data.confirmationDeadline !== undefined) {
          updatePayload.confirmation_deadline = data.confirmationDeadline ? new Date(data.confirmationDeadline).toISOString() : null;
        }
        if (data.costDiarista !== undefined) updatePayload.cost_diarista = data.costDiarista;

        const result = await withTimeout(
          supabase.from('matches').update(updatePayload).eq('id', matchId).select('id'),
          4000,
          { error: new Error('Tempo limite ao atualizar a lista') }
        );
        if (result.error || !result.data?.length) throw result.error || new Error('Lista nao encontrada');
      } catch (err) {
        console.warn('Erro ao atualizar partida no Supabase:', err);
        await this.syncMatchesFromCloud(groupId);
        throw new Error('Nao foi possivel editar a lista na nuvem. Tente novamente.');
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('match_updated', { detail: target }));
      window.dispatchEvent(new Event('storage'));
    }

    await NotificationService.notifyGroup(groupId, {
      type: 'match_updated',
      title: 'Lista de presenca atualizada',
      message: `A diretoria atualizou a lista da pelada de ${target.matchDate} as ${target.startTime}.`,
      data: { matchId: target.id, slotNumber: target.maxPlayers },
    });
    return target;
  },

  async deleteMatch(groupId: string, matchId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      if (!isValidUUID(matchId)) return false;
      const result = await withTimeout(
        supabase.from('matches').delete().eq('id', matchId).select('id'),
        6000,
        { data: null, error: new Error('Tempo limite ao excluir a lista') }
      );
      if (result.error) {
        console.warn('Erro ao excluir partida no Supabase:', result.error);
        throw new Error('Nao foi possivel excluir a lista na nuvem. Tente novamente.');
      }
    }

    const matches = this.getMatches(groupId);
    const filtered = matches.filter((m) => m.id !== matchId);
    setStored(`matches_${groupId}`, filtered);

    // Remove presenças locais da partida
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`pelada_attendances_${matchId}`);
      localStorage.removeItem(`attendances_${matchId}`);
    }

    // Fecha a presença se não houver outras partidas agendadas
    const hasRemainingScheduled = filtered.some((m) => m.status === 'scheduled');
    await GroupService.updateGroup(groupId, { isOpenAttendance: hasRemainingScheduled });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('match_deleted', { detail: { matchId, groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    await NotificationService.notifyGroup(groupId, {
      type: 'match_updated',
      title: 'Lista de presenca encerrada',
      message: 'A lista desta pelada foi removida pela diretoria.',
      data: { matchId },
    });

    return true;
  },

  closeMatchAttendance(groupId: string, matchId: string): void {
    const matches = this.getMatches(groupId);
    const target = matches.find((m) => m.id === matchId);
    if (target) {
      target.status = 'in_progress';
      setStored(`matches_${groupId}`, matches);
    }
    GroupService.updateGroup(groupId, { isOpenAttendance: false });

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      (async () => {
        try {
          await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId);
        } catch (err) {
          console.warn('Erro ao fechar presença no Supabase:', err);
        }
      })();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('match_closed', { detail: { matchId, groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    void NotificationService.notifyGroup(groupId, {
      type: 'match_updated',
      title: 'Lista de presenca fechada',
      message: 'A diretoria encerrou as confirmacoes para esta pelada.',
      data: { matchId },
    });
  },

  async updateMatchMaxPlayers(groupId: string, matchId: string, maxPlayers: number): Promise<void> {
    const matches = this.getMatches(groupId);
    const target = matches.find((m) => m.id === matchId);
    if (target) {
      target.maxPlayers = maxPlayers;
      setStored(`matches_${groupId}`, matches);
    }
    await GroupService.updateGroup(groupId, { maxSlots: maxPlayers });

    if (isSupabaseConfigured && supabase) {
      try {
        if (isValidUUID(matchId)) {
          await supabase.from('matches').update({ max_players: maxPlayers }).eq('id', matchId);
        }
        if (isValidUUID(groupId)) {
          await supabase.from('groups').update({ 
            max_slots: maxPlayers, 
            players_per_team: Math.max(1, Math.round(maxPlayers / 3)) 
          }).eq('id', groupId);
        }
      } catch (err) {
        console.warn('Erro ao atualizar max_players no Supabase:', err);
      }
    }

    await NotificationService.notifyGroup(groupId, {
      type: 'match_updated',
      title: 'Limite de vagas atualizado',
      message: `A lista agora possui ${maxPlayers} vagas.`,
      data: { matchId, slotNumber: maxPlayers },
    });
  },

  getAttendances(matchId: string): MatchAttendance[] {
    if (!matchId) return [];
    return getStored<MatchAttendance[]>(`attendances_${matchId}`, []);
  },

  async syncAttendancesFromCloud(matchId: string): Promise<MatchAttendance[]> {
    const local = this.getAttendances(matchId);
    if (!isSupabaseConfigured || !supabase || !matchId) return local;

    try {
      if (!isValidUUID(matchId)) return local;

      // 1. Busca presenças atualizadas do Supabase (com join seguro em users)
      const { data, error } = await withTimeout(
        supabase
          .from('match_attendances')
          .select(`
            id,
            match_id,
            user_id,
            status,
            arrival_order,
            is_financial_blocked,
            confirmed_at,
            checked_in_at,
            users (
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
              overall_rating,
              created_at
            )
          `)
          .eq('match_id', matchId)
          .neq('status', 'cancelled'),
        15000,
        { data: null, error: new Error('Tempo limite ao sincronizar presencas') }
      );

      if (error) {
        console.warn('Aviso ao consultar presenças do Supabase:', error);
        return local;
      }

      if (!data) return local;

      const remoteAttendances: MatchAttendance[] = data.map((row: any) => {
        const u = Array.isArray(row.users) ? row.users[0] : row.users;
        const fallbackUser: UserProfile = {
          id: row.user_id,
          name: u?.name || 'Atleta',
          email: u?.email || '',
          phone: u?.phone || '',
          cpf: u?.cpf || '',
          address: u?.address || '',
          avatarUrl: u?.avatar_url || undefined,
          mainPosition: (u?.main_position as any) || 'meia',
          secondaryPosition: (u?.secondary_position as any) || undefined,
          dominantFoot: (u?.dominant_foot as any) || 'destro',
          overallRating: u?.overall_rating ? Number(u.overall_rating) : 6.5,
          createdAt: u?.created_at || new Date().toISOString(),
        };

        return {
          id: row.id,
          matchId: row.match_id,
          userId: row.user_id,
          user: fallbackUser,
          status: row.status as any,
          arrivalOrder: row.arrival_order || undefined,
          isFinancialBlocked: row.is_financial_blocked || false,
          isGuest: typeof row.user_id === 'string' && row.user_id.startsWith('guest_'),
          confirmedAt: row.confirmed_at || new Date().toISOString(),
          checkedInAt: row.checked_in_at || undefined,
        };
      });

      setStored(`attendances_${matchId}`, remoteAttendances);
      return remoteAttendances;
    } catch (err) {
      console.warn('Erro ao sincronizar presenças do Supabase:', err);
      return local;
    }
  },

  async confirmAttendance(matchId: string, user: UserProfile, maxPlayers: number, groupId?: string): Promise<MatchAttendance> {
    const validUserId = await UserService.ensureUserInCloud(user);
    const validUser: UserProfile = { ...user, id: validUserId };

    const attendances = this.getAttendances(matchId);
    const existing = attendances.find((a) => 
      a.userId === validUserId || 
      a.userId === user.id ||
      (user.cpf && a.user?.cpf && a.user.cpf.replace(/\D/g, '') === user.cpf.replace(/\D/g, '')) ||
      (user.email && a.user?.email && a.user.email.toLowerCase() === user.email.toLowerCase())
    );

    if (existing && existing.status !== 'cancelled') return existing;

    const match = this.getMatchById(matchId);
    let isExpiredDeadline = false;
    if (match?.confirmationDeadline) {
      const deadlineDate = new Date(match.confirmationDeadline);
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        isExpiredDeadline = true;
      }
    }

    const gid = groupId || match?.groupId || GroupService.getActiveGroupId() || '';
    let isFinancialBlocked = false;
    if (gid) {
      const members = await GroupService.syncGroupMembersFromCloud(gid);
      const member = members.find((item) =>
        item.userId === validUserId || item.userId === user.id ||
        (user.email && item.user?.email?.toLowerCase() === user.email.toLowerCase())
      );
      isFinancialBlocked = Boolean(member?.isBlockedFinancial);
      if (isSupabaseConfigured && supabase && isValidUUID(gid) && isValidUUID(validUserId)) {
        const { count } = await supabase.from('financial_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', gid).eq('user_id', validUserId).eq('type', 'income')
          .in('status', ['pending', 'overdue']);
        isFinancialBlocked = isFinancialBlocked || Boolean(count);
      }
    }

    const confirmedCount = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present').length;
    const isWaitlist = isFinancialBlocked || isExpiredDeadline || confirmedCount >= maxPlayers;

    const attendanceId = existing ? existing.id : generateUUID();
    const newAttendance: MatchAttendance = {
      id: attendanceId,
      matchId,
      userId: validUserId,
      user: validUser,
      status: isWaitlist ? 'waitlist' : 'confirmed',
      isFinancialBlocked,
      confirmedAt: new Date().toISOString(),
    };

    if (existing) {
      const idx = attendances.findIndex((a) => a.id === existing.id);
      attendances[idx] = newAttendance;
    } else {
      attendances.push(newAttendance);
    }
    setStored(`attendances_${matchId}`, attendances);

    // Sincroniza presença no Supabase de forma confiável e com timeout
    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        const result = await withTimeout(
          supabase.from('match_attendances').upsert([{
            id: attendanceId,
            match_id: matchId,
            user_id: validUserId,
            status: newAttendance.status,
            is_financial_blocked: isFinancialBlocked,
            confirmed_at: newAttendance.confirmedAt,
          }], { onConflict: 'match_id,user_id' }),
          4000,
          { data: null, error: new Error('Tempo limite ao confirmar presenca') }
        );
        if (result.error) throw result.error;
      } catch (err) {
        console.warn('Erro ao salvar presença no Supabase:', err);
        await this.syncAttendancesFromCloud(matchId);
        throw new Error('Nao foi possivel confirmar sua presenca na nuvem. Tente novamente.');
      }
    }

    // Atualiza imediatamente a lista oficial a partir da nuvem
    await this.syncAttendancesFromCloud(matchId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    // Dispara notificação da lista de presença
    try {
      const gid = groupId || match?.groupId || GroupService.getActiveGroupId() || '';
      await NotificationService.notifyGroup(gid, {
        type: 'attendance_confirmed',
        title: isWaitlist ? (isExpiredDeadline ? 'Fila de Espera (Prazo Expirado) ⏳' : 'Fila de Espera ⏳') : 'Presença Confirmada ✅',
        message: isExpiredDeadline
          ? `${validUser.name} confirmou presença após o prazo limite e entrou na Fila de Espera.`
          : `${validUser.name} confirmou presença na lista (${isWaitlist ? 'Fila de Espera' : `Vaga #${confirmedCount + 1}`}).`,
        data: {
          userId: validUserId,
          userName: validUser.name,
          matchId,
          slotNumber: isWaitlist ? undefined : confirmedCount + 1,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de presença:', e);
    }

    if (isFinancialBlocked) {
      await NotificationService.notifyUser(gid, validUserId, {
        type: 'financial_alert',
        title: 'Presenca enviada para a fila de espera',
        message: 'Voce possui cobranca pendente. A diretoria podera liberar sua entrada na lista de confirmados.',
        data: { matchId, userId: validUserId, userName: validUser.name },
      });
    }

    return newAttendance;
  },

  async promoteWaitlistToConfirmed(matchId: string, attendanceIdOrUserId: string): Promise<MatchAttendance | null> {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId);
    if (!target) return null;

    const match = this.getMatchById(matchId);
    const gid = match?.groupId || GroupService.getActiveGroupId() || '';
    if (target.isFinancialBlocked) {
      const currentUser = UserService.getCurrentUser();
      const members = await GroupService.syncGroupMembersFromCloud(gid);
      const director = members.find((member) => member.userId === currentUser.id);
      if (!director || !['presidente', 'adm', 'tesoureiro'].includes(director.role)) return null;
    }

    target.status = 'confirmed';
    target.isFinancialBlocked = false;
    setStored(`attendances_${matchId}`, attendances);

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        await withTimeout(
          supabase.from('match_attendances').update({ status: 'confirmed', is_financial_blocked: false }).eq('id', target.id),
          3000,
          { data: null, error: null }
        );
      } catch (err) {
        console.warn('Erro ao promover presença no Supabase:', err);
      }
    }

    await this.syncAttendancesFromCloud(matchId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    try {
      await NotificationService.notifyGroup(gid, {
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

  async demoteConfirmedToWaitlist(matchId: string, attendanceIdOrUserId: string): Promise<MatchAttendance | null> {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId);
    if (!target) return null;

    target.status = 'waitlist';
    setStored(`attendances_${matchId}`, attendances);

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        await withTimeout(
          supabase.from('match_attendances').update({ status: 'waitlist' }).eq('id', target.id),
          3000,
          { data: null, error: null }
        );
      } catch (err) {
        console.warn('Erro ao rebaixar presença no Supabase:', err);
      }
    }

    await this.syncAttendancesFromCloud(matchId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    const match = this.getMatchById(matchId);
    const gid = match?.groupId || GroupService.getActiveGroupId() || '';
    await NotificationService.notifyGroup(gid, {
      type: 'match_updated',
      title: 'Lista de presenca atualizada',
      message: `${target.user.name} foi movido para a fila de espera pela diretoria.`,
      data: { matchId, userId: target.userId, userName: target.user.name },
    });
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

    const attendanceId = generateUUID();
    const newAttendance: MatchAttendance = {
      id: attendanceId,
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    try {
      const gid = groupId || GroupService.getActiveGroupId() || '';
      void NotificationService.notifyGroup(gid, {
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

  async removeAthleteAttendance(matchId: string, attendanceIdOrUserId: string): Promise<{ success: boolean; promotedUser?: UserProfile }> {
    const attendances = this.getAttendances(matchId);
    const target = attendances.find((a) => a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId);
    if (!target) return { success: false };

    const wasConfirmed = target.status === 'confirmed';
    const targetId = target.id;
    target.status = 'cancelled';

    let promotedUser: UserProfile | undefined;
    let promotedId: string | undefined;
    if (wasConfirmed) {
      const waitlistCandidate = attendances.find((a) => a.status === 'waitlist' && a.id !== targetId && !a.isFinancialBlocked);
      if (waitlistCandidate) {
        waitlistCandidate.status = 'confirmed';
        promotedUser = waitlistCandidate.user;
        promotedId = waitlistCandidate.id;
      }
    }

    setStored(`attendances_${matchId}`, attendances);

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        await withTimeout(
          supabase.from('match_attendances').delete().eq('id', targetId),
          3000,
          { error: null }
        );
        if (promotedId) {
          await withTimeout(
            supabase.from('match_attendances').update({ status: 'confirmed' }).eq('id', promotedId),
            3000,
            { error: null }
          );
        }
      } catch (err) {
        console.warn('Erro ao remover atleta do Supabase:', err);
      }
    }

    await this.syncAttendancesFromCloud(matchId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    const match = this.getMatchById(matchId);
    const gid = match?.groupId || GroupService.getActiveGroupId() || '';
    await NotificationService.notifyGroup(gid, {
      type: 'match_updated',
      title: 'Lista de presenca atualizada',
      message: promotedUser
        ? `${target.user.name} foi removido e ${promotedUser.name} entrou nos confirmados.`
        : `${target.user.name} foi removido da lista pela diretoria.`,
      data: { matchId, userId: target.userId, userName: target.user.name },
    });

    return { success: true, promotedUser };
  },

  removeGuestAttendance(matchId: string, attendanceIdOrUserId: string): { promotedUser?: UserProfile } {
    const attendances = this.getAttendances(matchId);
    const targetIdx = attendances.findIndex((a) => (a.id === attendanceIdOrUserId || a.userId === attendanceIdOrUserId) && a.status !== 'cancelled');
    if (targetIdx === -1) return {};

    const wasConfirmed = attendances[targetIdx].status === 'confirmed';
    attendances[targetIdx].status = 'cancelled';

    let promotedUser: UserProfile | undefined;
    if (wasConfirmed) {
      const waitlistCandidate = attendances.find((a) => a.status === 'waitlist' && !a.isFinancialBlocked);
      if (waitlistCandidate) {
        waitlistCandidate.status = 'confirmed';
        promotedUser = waitlistCandidate.user;
      }
    }

    setStored(`attendances_${matchId}`, attendances);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    return { promotedUser };
  },

  async cancelAttendance(matchId: string, userId: string): Promise<{ promotedUser?: UserProfile }> {
    const user = UserService.getCurrentUser();
    const validUserId = await UserService.ensureUserInCloud(user);
    const targetUserId = validUserId || userId;

    const attendances = this.getAttendances(matchId);
    const leavingIdx = attendances.findIndex((a) => 
      (a.userId === targetUserId || a.userId === userId || (user.email && a.user?.email && a.user.email.toLowerCase() === user.email.toLowerCase())) && 
      a.status !== 'cancelled'
    );
    if (leavingIdx === -1) return {};

    const wasConfirmed = attendances[leavingIdx].status === 'confirmed';
    const leavingId = attendances[leavingIdx].id;
    attendances[leavingIdx].status = 'cancelled';

    let promotedUser: UserProfile | undefined;
    let promotedId: string | undefined;
    if (wasConfirmed) {
      const waitlistCandidate = attendances.find((a) => a.status === 'waitlist' && !a.isFinancialBlocked);
      if (waitlistCandidate) {
        waitlistCandidate.status = 'confirmed';
        promotedUser = waitlistCandidate.user;
        promotedId = waitlistCandidate.id;
      }
    }

    setStored(`attendances_${matchId}`, attendances);

    if (isSupabaseConfigured && supabase && isValidUUID(matchId)) {
      try {
        await withTimeout(
          supabase.from('match_attendances').update({ status: 'cancelled' }).eq('id', leavingId),
          3000,
          { data: null, error: null }
        );
        if (promotedId) {
          await withTimeout(
            supabase.from('match_attendances').update({ status: 'confirmed' }).eq('id', promotedId),
            3000,
            { data: null, error: null }
          );
        }
      } catch (err) {
        console.warn('Erro ao cancelar presença no Supabase:', err);
      }
    }

    await this.syncAttendancesFromCloud(matchId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
      window.dispatchEvent(new Event('storage'));
    }

    const match = this.getMatchById(matchId);
    const gid = match?.groupId || GroupService.getActiveGroupId() || '';
    await NotificationService.notifyGroup(gid, {
      type: 'match_updated',
      title: 'Lista de presenca atualizada',
      message: promotedUser
        ? `${user.name} cancelou a presenca e ${promotedUser.name} foi promovido para os confirmados.`
        : `${user.name} cancelou a presenca.`,
      data: { matchId, userId: targetUserId, userName: user.name },
    });
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

      if (isSupabaseConfigured && supabase) {
        (async () => {
          try {
            await supabase.from('match_attendances').update({
              status: 'present',
              arrival_order: order,
              checked_in_at: target.checkedInAt
            }).eq('id', target.id);
          } catch (err) {
            console.warn('Erro ao registrar check-in no Supabase:', err);
          }
        })();
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { matchId } }));
        window.dispatchEvent(new Event('storage'));
      }

      try {
        const gid = groupId || GroupService.getActiveGroupId() || '';
        void NotificationService.notifyGroup(gid, {
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
// SÚMULA, ESTATÍSTICAS & RANKINGS
// ---------------------------------------------------------------------------
export const MatchStatsService = {
  getMatchStats(matchId: string): PlayerMatchStat[] {
    if (!matchId) return [];
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
