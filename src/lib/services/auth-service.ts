import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { UserService, generateUUID } from '@/lib/services/storage-service';
import { UserProfile, UserPosition, DominantFoot } from '@/types';
import { mockUsers } from '@/lib/mock-data';

export interface RegisterAthletePayload {
  name: string;
  nickname?: string;
  avatarUrl?: string;
  email: string;
  password?: string;
  phone: string;
  cpf: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  address: string;
  mainPosition?: UserPosition;
  secondaryPosition?: UserPosition | '';
  dominantFoot?: DominantFoot;
  heightCm?: number;
  weightKg?: number;
}

export const AuthService = {
  /**
   * Inicia o fluxo de login ou cadastro seguro com a conta do Google via Supabase OAuth
   */
  async signInWithGoogle(): Promise<{ error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      // Mock / Demonstração sem Supabase configurado
      const mockGoogleUser: UserProfile = {
        id: generateUUID(),
        name: 'Jogador Google',
        nickname: 'Goleador',
        email: 'jogador.google@gmail.com',
        phone: '(11) 98888-7777',
        cpf: '111.222.333-44',
        address: 'São Paulo, SP',
        mainPosition: 'meia',
        dominantFoot: 'destro',
        overallRating: 7.5,
        createdAt: new Date().toISOString(),
      };
      UserService.setCurrentUser(mockGoogleUser);
      return {};
    }

    try {
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (err: any) {
      return { error: err?.message || 'Erro ao conectar com o Google' };
    }
  },

  /**
   * Login exclusivo por CPF e Senha
   */
  async signInWithCpf(cpf: string, password?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanCpf = cpf.replace(/\D/g, '');

    if (!cleanCpf || cleanCpf.length < 11) {
      return { success: false, error: 'Informe um CPF válido com 11 dígitos.' };
    }

    if (!password) {
      return { success: false, error: 'Informe sua senha de acesso.' };
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Busca o usuário no banco pelo CPF
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .or(`cpf.eq.${cpf},cpf.eq.${cleanCpf}`)
          .maybeSingle();

        const emailToAuth = dbUser?.email || `cpf_${cleanCpf}@gestaopelada.com`;

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: password,
        });

        if (dbUser) {
          const currentLocal = UserService.getCurrentUser();
          const profile: UserProfile = {
            id: dbUser.id,
            name: dbUser.name || currentLocal.name,
            nickname: dbUser.nickname || currentLocal.nickname || undefined,
            email: dbUser.email || currentLocal.email,
            phone: dbUser.phone || currentLocal.phone,
            cpf: dbUser.cpf || currentLocal.cpf,
            cep: dbUser.cep || currentLocal.cep || undefined,
            street: dbUser.street || currentLocal.street || undefined,
            number: dbUser.number || currentLocal.number || undefined,
            neighborhood: dbUser.neighborhood || currentLocal.neighborhood || undefined,
            city: dbUser.city || currentLocal.city || undefined,
            state: dbUser.state || currentLocal.state || undefined,
            address: dbUser.address || currentLocal.address,
            avatarUrl: dbUser.avatar_url || currentLocal.avatarUrl,
            mainPosition: dbUser.main_position || currentLocal.mainPosition,
            secondaryPosition: dbUser.secondary_position || currentLocal.secondaryPosition,
            dominantFoot: dbUser.dominant_foot || currentLocal.dominantFoot,
            heightCm: dbUser.height_cm || currentLocal.heightCm,
            weightKg: dbUser.weight_kg || currentLocal.weightKg,
            overallRating: dbUser.overall_rating || currentLocal.overallRating || 6.5,
            createdAt: dbUser.created_at || currentLocal.createdAt,
          };
          UserService.setCurrentUser(profile);
          return { success: true, user: profile };
        }

        if (authError && !dbUser) {
          return { success: false, error: 'CPF ou senha incorretos.' };
        }
      }

      // Fallback local caso offline ou cadastrado na sessão / mock
      const current = UserService.getCurrentUser();
      const currentCleanCpf = (current?.cpf || '').replace(/\D/g, '');

      if (current && (currentCleanCpf === cleanCpf || !current.cpf)) {
        current.cpf = cpf;
        UserService.setCurrentUser(current);
        return { success: true, user: current };
      }

      // Busca na lista de mock
      const foundMock = mockUsers.find(
        (u) => (u.cpf || '').replace(/\D/g, '') === cleanCpf
      );

      if (foundMock) {
        UserService.setCurrentUser(foundMock);
        return { success: true, user: foundMock };
      }

      // Cria atleta padrão associado ao CPF
      const defaultUser: UserProfile = {
        id: generateUUID(),
        name: `Atleta ${cleanCpf.slice(-4)}`,
        nickname: 'Craque',
        email: `cpf_${cleanCpf}@gestaopelada.com`,
        phone: '(11) 99999-8888',
        cpf: cpf,
        address: 'São Paulo, SP',
        mainPosition: 'meia',
        dominantFoot: 'destro',
        overallRating: 6.5,
        createdAt: new Date().toISOString(),
      };
      UserService.setCurrentUser(defaultUser);
      return { success: true, user: defaultUser };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao autenticar com CPF.' };
    }
  },

  /**
   * Login com Email e Senha (Compatibilidade)
   */
  async signInWithEmail(email: string, password?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanEmail = email.trim().toLowerCase();

    // Se for CPF passado no campo de email
    if (/^\d+$/.test(cleanEmail.replace(/\D/g, '')) && !cleanEmail.includes('@')) {
      return this.signInWithCpf(cleanEmail, password);
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Informe um e-mail válido' };
    }

    if (!password) {
      return { success: false, error: 'Informe sua senha' };
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Tenta autenticar via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        // Busca o perfil do atleta na tabela `users`
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbUser) {
          const currentLocal = UserService.getCurrentUser();
          const profile: UserProfile = {
            id: dbUser.id,
            name: dbUser.name || currentLocal.name,
            nickname: dbUser.nickname || currentLocal.nickname || undefined,
            email: dbUser.email || currentLocal.email,
            phone: dbUser.phone || currentLocal.phone,
            cpf: dbUser.cpf || currentLocal.cpf,
            cep: dbUser.cep || currentLocal.cep || undefined,
            street: dbUser.street || currentLocal.street || undefined,
            number: dbUser.number || currentLocal.number || undefined,
            neighborhood: dbUser.neighborhood || currentLocal.neighborhood || undefined,
            city: dbUser.city || currentLocal.city || undefined,
            state: dbUser.state || currentLocal.state || undefined,
            address: dbUser.address || currentLocal.address,
            avatarUrl: dbUser.avatar_url || currentLocal.avatarUrl,
            mainPosition: dbUser.main_position || currentLocal.mainPosition,
            secondaryPosition: dbUser.secondary_position || currentLocal.secondaryPosition,
            dominantFoot: dbUser.dominant_foot || currentLocal.dominantFoot,
            heightCm: dbUser.height_cm || currentLocal.heightCm,
            weightKg: dbUser.weight_kg || currentLocal.weightKg,
            overallRating: dbUser.overall_rating || currentLocal.overallRating || 6.5,
            createdAt: dbUser.created_at || currentLocal.createdAt,
          };
          UserService.setCurrentUser(profile);
          return { success: true, user: profile };
        }

        if (authError && !dbUser) {
          return { success: false, error: 'E-mail ou senha incorretos' };
        }
      }

      // Fallback local caso offline ou cadastrado na sessão
      const current = UserService.getCurrentUser();
      if (current && (current.email.toLowerCase() === cleanEmail || !current.email)) {
        current.email = cleanEmail;
        UserService.setCurrentUser(current);
        return { success: true, user: current };
      }

      const defaultUser: UserProfile = {
        id: generateUUID(),
        name: cleanEmail.split('@')[0],
        nickname: 'Craque',
        email: cleanEmail,
        phone: '(11) 99999-8888',
        cpf: '000.000.000-00',
        address: 'São Paulo, SP',
        mainPosition: 'meia',
        dominantFoot: 'destro',
        overallRating: 6.5,
        createdAt: new Date().toISOString(),
      };
      UserService.setCurrentUser(defaultUser);
      return { success: true, user: defaultUser };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao autenticar' };
    }
  },

  /**
   * Cadastro completo de atleta (com foto e apelido)
   */
  async registerAthlete(data: RegisterAthletePayload): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    try {
      let userId = generateUUID();

      if (isSupabaseConfigured && supabase) {
        // Se tiver senha informada, cadastra no Supabase Auth
        if (data.password && data.password.length >= 6) {
          const { data: authRes, error: authErr } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              data: {
                name: data.name,
                nickname: data.nickname,
                phone: data.phone,
                cpf: data.cpf,
                avatar_url: data.avatarUrl,
              }
            }
          });

          if (authRes.user?.id) {
            userId = authRes.user.id;
          }
        }

        // Salva na tabela pública de usuários
        const { data: inserted, error: insertErr } = await supabase.from('users').insert([{
          id: userId,
          name: data.name,
          nickname: data.nickname || null,
          email: data.email,
          phone: data.phone,
          cpf: data.cpf,
          address: data.address,
          avatar_url: data.avatarUrl || null,
          main_position: data.mainPosition || 'meia',
          secondary_position: data.secondaryPosition || null,
          dominant_foot: data.dominantFoot || 'destro',
          height_cm: data.heightCm || null,
          weight_kg: data.weightKg || null,
          overall_rating: 6.50
        }]).select().single();

        if (insertErr) {
          if (insertErr.code === '23505') {
            return { success: false, error: 'E-mail ou CPF já cadastrado no sistema.' };
          }
          console.warn('Aviso ao inserir no Postgres:', insertErr);
        } else if (inserted) {
          userId = inserted.id;
        }
      }

      const profile: UserProfile = {
        id: userId,
        name: data.name,
        nickname: data.nickname || undefined,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        cep: data.cep || undefined,
        street: data.street || undefined,
        number: data.number || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        address: data.address,
        avatarUrl: data.avatarUrl || undefined,
        mainPosition: data.mainPosition || 'meia',
        secondaryPosition: data.secondaryPosition || undefined,
        dominantFoot: data.dominantFoot || 'destro',
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        overallRating: 6.5,
        createdAt: new Date().toISOString(),
      };

      UserService.setCurrentUser(profile);
      return { success: true, user: profile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao realizar cadastro.' };
    }
  },

  /**
   * Sincroniza usuário autenticado do Supabase para o estado local
   */
  async syncSupabaseSession(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return null;

      const authUser = session.user;
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (dbUser) {
        const currentLocal = UserService.getCurrentUser();
        const profile: UserProfile = {
          id: dbUser.id,
          name: dbUser.name || currentLocal.name || authUser.user_metadata?.full_name || 'Atleta',
          nickname: dbUser.nickname || currentLocal.nickname || authUser.user_metadata?.nickname || undefined,
          email: dbUser.email || currentLocal.email || authUser.email || '',
          phone: dbUser.phone || currentLocal.phone || '',
          cpf: dbUser.cpf || currentLocal.cpf || '',
          cep: dbUser.cep || currentLocal.cep || undefined,
          street: dbUser.street || currentLocal.street || undefined,
          number: dbUser.number || currentLocal.number || undefined,
          neighborhood: dbUser.neighborhood || currentLocal.neighborhood || undefined,
          city: dbUser.city || currentLocal.city || undefined,
          state: dbUser.state || currentLocal.state || undefined,
          address: dbUser.address || currentLocal.address || '',
          avatarUrl: dbUser.avatar_url || currentLocal.avatarUrl || authUser.user_metadata?.avatar_url,
          mainPosition: dbUser.main_position || currentLocal.mainPosition || 'meia',
          secondaryPosition: dbUser.secondary_position || currentLocal.secondaryPosition,
          dominantFoot: dbUser.dominant_foot || currentLocal.dominantFoot || 'destro',
          heightCm: dbUser.height_cm || currentLocal.heightCm,
          weightKg: dbUser.weight_kg || currentLocal.weightKg,
          overallRating: dbUser.overall_rating || currentLocal.overallRating || 6.5,
          createdAt: dbUser.created_at || currentLocal.createdAt,
        };
        UserService.setCurrentUser(profile);
        return profile;
      } else {
        // Perfil novo vindo de OAuth (Google)
        const newProfile: UserProfile = {
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Atleta Google',
          nickname: authUser.user_metadata?.nickname || undefined,
          email: authUser.email || '',
          phone: authUser.user_metadata?.phone || '',
          cpf: '',
          address: '',
          avatarUrl: authUser.user_metadata?.avatar_url,
          mainPosition: 'meia',
          dominantFoot: 'destro',
          overallRating: 6.5,
          createdAt: new Date().toISOString(),
        };

        await supabase.from('users').insert([{
          id: newProfile.id,
          name: newProfile.name,
          nickname: newProfile.nickname || null,
          email: newProfile.email,
          phone: newProfile.phone || '(00) 00000-0000',
          cpf: `oauth_${Date.now()}`,
          address: 'Não informado',
          main_position: 'meia',
          dominant_foot: 'destro',
          overall_rating: 6.5
        }]);

        UserService.setCurrentUser(newProfile);
        return newProfile;
      }
    } catch (e) {
      console.warn('Erro ao sincronizar sessão:', e);
      return null;
    }
  },

  /**
   * Desconectar
   */
  async signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Erro ao deslogar do Supabase:', e);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gestao_pelada_user');
      localStorage.removeItem('pelada_current_user');
    }
  }
};
