import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { UserService, generateUUID } from '@/lib/services/storage-service';
import { UserProfile, UserPosition, DominantFoot } from '@/types';

export interface RegisterAthletePayload {
  name: string;
  email: string;
  password?: string;
  phone: string;
  cpf: string;
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
   * Login com Email e Senha
   */
  async signInWithEmail(email: string, password?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanEmail = email.trim().toLowerCase();

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
          const profile: UserProfile = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            phone: dbUser.phone,
            cpf: dbUser.cpf,
            address: dbUser.address,
            avatarUrl: dbUser.avatar_url,
            mainPosition: dbUser.main_position,
            secondaryPosition: dbUser.secondary_position,
            dominantFoot: dbUser.dominant_foot,
            heightCm: dbUser.height_cm,
            weightKg: dbUser.weight_kg,
            overallRating: dbUser.overall_rating || 6.5,
            createdAt: dbUser.created_at,
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
   * Cadastro completo de atleta
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
                phone: data.phone,
                cpf: data.cpf,
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
          email: data.email,
          phone: data.phone,
          cpf: data.cpf,
          address: data.address,
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
          console.warn('Erro ao inserir no Postgres:', insertErr);
        } else if (inserted) {
          userId = inserted.id;
        }
      }

      const profile: UserProfile = {
        id: userId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        address: data.address,
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
        const profile: UserProfile = {
          id: dbUser.id,
          name: dbUser.name || authUser.user_metadata?.full_name || 'Atleta',
          email: dbUser.email || authUser.email || '',
          phone: dbUser.phone || '',
          cpf: dbUser.cpf || '',
          address: dbUser.address || '',
          avatarUrl: dbUser.avatar_url || authUser.user_metadata?.avatar_url,
          mainPosition: dbUser.main_position || 'meia',
          secondaryPosition: dbUser.secondary_position,
          dominantFoot: dbUser.dominant_foot || 'destro',
          heightCm: dbUser.height_cm,
          weightKg: dbUser.weight_kg,
          overallRating: dbUser.overall_rating || 6.5,
          createdAt: dbUser.created_at,
        };
        UserService.setCurrentUser(profile);
        return profile;
      } else {
        // Perfil novo vindo de OAuth (Google)
        const newProfile: UserProfile = {
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Atleta Google',
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
