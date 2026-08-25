import { UserProfile } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { parseAddressString } from '@/lib/utils/cep-service';
import { generateUUID, isValidUUID, getStored, setStored, withTimeout } from './storage-helpers';

// ---------------------------------------------------------------------------
// 0. GESTÃO DE USUÁRIO LOGADO & PERFIL
// ---------------------------------------------------------------------------
export const UserService = {
  async getAuthenticatedUser(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        { data: { session: null } } as any
      );
      const authUser = session?.user;
      if (!authUser) return null;

      const email = authUser.email?.trim().toLowerCase() || '';
      let query = supabase.from('users').select('*').eq('id', authUser.id);
      let { data: dbUser } = await withTimeout(query.maybeSingle(), 4000, { data: null } as any);
      if (!dbUser && email) {
        const result = await withTimeout(
          supabase.from('users').select('*').eq('email', email).maybeSingle(),
          4000,
          { data: null } as any
        );
        dbUser = result.data;
      }

      const profile: UserProfile = dbUser ? {
        id: dbUser.id,
        name: dbUser.name || authUser.user_metadata?.full_name || email.split('@')[0] || 'Atleta',
        nickname: dbUser.nickname || undefined,
        email: dbUser.email || email,
        phone: dbUser.phone || '',
        cpf: dbUser.cpf || '',
        address: dbUser.address || '',
        avatarUrl: dbUser.avatar_url || authUser.user_metadata?.avatar_url,
        mainPosition: dbUser.main_position || 'meia',
        secondaryPosition: dbUser.secondary_position || undefined,
        dominantFoot: dbUser.dominant_foot || 'destro',
        heightCm: dbUser.height_cm || undefined,
        weightKg: dbUser.weight_kg || undefined,
        overallRating: dbUser.overall_rating || 6.5,
        createdAt: dbUser.created_at || new Date().toISOString(),
      } : {
        id: authUser.id,
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0] || 'Atleta',
        email,
        phone: authUser.user_metadata?.phone || '',
        cpf: '',
        address: '',
        avatarUrl: authUser.user_metadata?.avatar_url,
        mainPosition: 'meia',
        dominantFoot: 'destro',
        overallRating: 6.5,
        createdAt: new Date().toISOString(),
      };
      this.setCurrentUser(profile);
      return profile;
    } catch (err) {
      console.warn('Erro ao validar usuario autenticado:', err);
      return null;
    }
  },

  getCurrentUser(): UserProfile {
    const defaultUser: UserProfile = {
      id: 'c5a2cc7c-0658-44f4-be73-bb427baca751',
      name: 'Leandro Teixeira do Amaral',
      email: 'ltxamaral@gmail.com',
      phone: '(71) 98718-6286',
      cpf: '031.868.265-60',
      address: 'Salvador, BA',
      mainPosition: 'volante',
      secondaryPosition: 'meia',
      dominantFoot: 'destro',
      heightCm: 178,
      weightKg: 76,
      overallRating: 6.5,
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

    // Se o usuário possui endereço em texto mas não tem os campos desmembrados
    if (resolvedUser.address && (!resolvedUser.cep || !resolvedUser.street)) {
      const parsed = parseAddressString(resolvedUser.address);
      resolvedUser = {
        ...resolvedUser,
        cep: resolvedUser.cep || parsed.cep || undefined,
        street: resolvedUser.street || parsed.street || undefined,
        number: resolvedUser.number || parsed.number || undefined,
        neighborhood: resolvedUser.neighborhood || parsed.neighborhood || undefined,
        city: resolvedUser.city || parsed.city || undefined,
        state: resolvedUser.state || parsed.state || undefined,
      };
    }

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
      const userEmail = (user.email || '').trim().toLowerCase();

      // 1. Tenta buscar por ID se for UUID válido
      if (isValidUUID(user.id)) {
        const { data: byId } = await withTimeout(
          supabase.from('users').select('id, name, email, cpf').eq('id', user.id).maybeSingle(),
          3000,
          { data: null }
        );
        if (byId && byId.id) return byId.id;
      }

      // 2. Tenta buscar por email se houver
      if (userEmail && userEmail.includes('@') && !userEmail.startsWith('atleta_')) {
        const { data: byEmail } = await withTimeout(
          supabase.from('users').select('id, name, email, cpf').eq('email', userEmail).maybeSingle(),
          3000,
          { data: null }
        );
        if (byEmail && byEmail.id) {
          if (user.id !== byEmail.id) {
            user.id = byEmail.id;
            this.setCurrentUser(user);
          }
          return byEmail.id;
        }
      }

      // 3. Tenta buscar por CPF se houver
      if (cleanCpf && cleanCpf.length >= 11) {
        const { data: byCpf } = await withTimeout(
          supabase.from('users').select('id, name, email, cpf').or(`cpf.eq.${user.cpf},cpf.eq.${cleanCpf}`).maybeSingle(),
          3000,
          { data: null }
        );
        if (byCpf && byCpf.id) {
          if (user.id !== byCpf.id) {
            user.id = byCpf.id;
            this.setCurrentUser(user);
          }
          return byCpf.id;
        }
      }

      // 4. Se não existe no banco, insere o usuário no PostgreSQL.
      // Nunca vincula identidades apenas pelo nome: pessoas diferentes podem ter nomes iguais.
      const newUserId = isValidUUID(user.id) ? user.id : generateUUID();
      user.id = newUserId;
      const safeEmail = userEmail && userEmail.includes('@') ? userEmail : `atleta_${newUserId.slice(0, 8)}@gestaopelada.com`;
      const safeCpf = cleanCpf && cleanCpf.length >= 11 ? user.cpf : `000.${Math.floor(100+Math.random()*900)}.${Math.floor(100+Math.random()*900)}-00`;

      const { data: inserted, error: insertError } = await withTimeout(
        supabase.from('users').insert([{
          id: newUserId,
          name: user.name || 'Atleta',
          email: safeEmail,
          phone: user.phone || '(11) 99999-9999',
          cpf: safeCpf,
          address: user.address || 'Endereço Padrão',
          avatar_url: user.avatarUrl || null,
          main_position: user.mainPosition || 'meia',
          secondary_position: user.secondaryPosition || null,
          dominant_foot: user.dominantFoot || 'destro',
          height_cm: user.heightCm || null,
          weight_kg: user.weightKg || null,
          overall_rating: user.overallRating || 6.5,
        }]).select('id').single(),
        4000,
        { data: null, error: null }
      );

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

    // Atualiza o objeto do atleta dentro de todos os grupos locais no localStorage
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('pelada_members_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const members = JSON.parse(raw);
              if (Array.isArray(members)) {
                let changed = false;
                const newMembers = members.map((m: any) => {
                  if (m.userId === updated.id || m.user?.cpf === updated.cpf || m.user?.id === updated.id) {
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
                  localStorage.setItem(key, JSON.stringify(newMembers));
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar atleta nos grupos locais:', err);
      }
    }

    if (isSupabaseConfigured && supabase && isValidUUID(targetUserId)) {
      try {
        await supabase.from('users').update({
          name: updated.name,
          avatar_url: updated.avatarUrl || null,
          phone: updated.phone,
          address: updated.address,
          main_position: updated.mainPosition,
          secondary_position: updated.secondaryPosition || null,
          dominant_foot: updated.dominantFoot,
          height_cm: updated.heightCm || null,
          weight_kg: updated.weightKg || null,
        }).eq('id', targetUserId);
      } catch (err) {
        console.warn('Erro ao atualizar perfil no Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile_updated', { detail: updated }));
      window.dispatchEvent(new Event('storage'));
    }

    return updated;
  }
};
