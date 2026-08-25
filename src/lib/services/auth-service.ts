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

// Helper seguro de timeout para chamadas assíncronas
async function withTimeout<T>(promise: PromiseLike<T>, ms: number = 6000, errorMsg: string = 'Tempo limite esgotado.'): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export const AuthService = {
  /**
   * Converte um registro da tabela `users` do banco para o tipo UserProfile
   */
  mapDbUserToProfile(dbUser: any): UserProfile {
    return {
      id: dbUser.id,
      name: dbUser.name || 'Atleta',
      nickname: dbUser.nickname || undefined,
      email: dbUser.email || '',
      phone: dbUser.phone || '',
      cpf: dbUser.cpf || '',
      cep: dbUser.cep || undefined,
      street: dbUser.street || undefined,
      number: dbUser.number || undefined,
      neighborhood: dbUser.neighborhood || undefined,
      city: dbUser.city || undefined,
      state: dbUser.state || undefined,
      address: dbUser.address || '',
      avatarUrl: dbUser.avatar_url || undefined,
      mainPosition: dbUser.main_position || 'meia',
      secondaryPosition: dbUser.secondary_position || undefined,
      dominantFoot: dbUser.dominant_foot || 'destro',
      heightCm: dbUser.height_cm || undefined,
      weightKg: dbUser.weight_kg || undefined,
      overallRating: dbUser.overall_rating || 6.5,
      createdAt: dbUser.created_at || new Date().toISOString(),
    };
  },

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

      const { error } = await supabase.auth.signInWithOAuth({
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
   * Login por CPF e Senha
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
        // 1. Busca o usuário no banco pelo CPF com timeout
        let dbUser: any = null;
        try {
          const dbRes = await withTimeout(
            supabase
              .from('users')
              .select('*')
              .or(`cpf.eq.${cpf},cpf.eq.${cleanCpf}`)
              .maybeSingle(),
            5000
          );
          dbUser = dbRes.data;
        } catch (e) {
          console.warn('Timeout na busca por CPF na tabela users:', e);
        }

        const emailToAuth = dbUser?.email || `cpf_${cleanCpf}@gestaopelada.com`;

        // 2. Tenta autenticar na Auth com timeout
        let authData: any = null;
        let authError: any = null;
        try {
          const authRes = await withTimeout(
            supabase.auth.signInWithPassword({
              email: emailToAuth,
              password: password,
            }),
            5000
          );
          authData = authRes.data;
          authError = authRes.error;
        } catch (e: any) {
          authError = { message: e?.message || 'Timeout' };
        }

        if (authData?.user && dbUser) {
          const profile = this.mapDbUserToProfile(dbUser);
          UserService.setCurrentUser(profile);
          return { success: true, user: profile };
        }

        if (authData?.user) {
          const newProfile: UserProfile = {
            id: authData.user.id,
            name: `Atleta ${cleanCpf.slice(-4)}`,
            nickname: 'Craque',
            email: emailToAuth,
            phone: '(11) 99999-8888',
            cpf: cpf,
            address: 'São Paulo, SP',
            mainPosition: 'meia',
            dominantFoot: 'destro',
            overallRating: 6.5,
            createdAt: new Date().toISOString(),
          };
          UserService.setCurrentUser(newProfile);
          return { success: true, user: newProfile };
        }

        if (authError?.message?.toLowerCase().includes('email not confirmed')) {
          return { success: false, error: 'E-mail nao confirmado. Ative o acesso usando seu e-mail.' };
        }

        return { success: false, error: 'CPF ou senha incorretos. Solicite ao diretor a criação ou redefinição do acesso.' };
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

      // Se nenhum usuário foi localizado
      return { success: false, error: 'CPF não encontrado. Crie uma conta grátis para começar.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao autenticar com CPF.' };
    }
  },

  /**
   * Login com Email e Senha
   */
  async signInWithEmail(email: string, password?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const cleanEmail = email.trim().toLowerCase();

    // Se for CPF passado no campo de email
    if (/^\d+$/.test(cleanEmail.replace(/\D/g, '')) && !cleanEmail.includes('@')) {
      return this.signInWithCpf(cleanEmail, password);
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Informe um e-mail válido.' };
    }

    if (!password) {
      return { success: false, error: 'Informe sua senha de acesso.' };
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Tenta autenticar no Supabase Auth com timeout
        let authData: any = null;
        let authError: any = null;

        try {
          const authRes = await withTimeout(
            supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: password,
            }),
            5000
          );
          authData = authRes.data;
          authError = authRes.error;
        } catch (authTimeoutErr: any) {
          console.warn('Timeout no Supabase Auth:', authTimeoutErr);
          authError = { message: authTimeoutErr?.message || 'Timeout' };
        }

        // Se autenticou no Supabase Auth com sucesso
        if (authData?.user) {
          const authUser = authData.user;
          // Busca o perfil do atleta na tabela `users`
          let dbUser: any = null;
          try {
            const dbRes = await withTimeout(
              supabase
                .from('users')
                .select('*')
                .or(`id.eq.${authUser.id},email.eq.${cleanEmail}`)
                .maybeSingle(),
              5000
            );
            dbUser = dbRes.data;
          } catch (dbErr) {
            console.warn('Erro ao consultar tabela users:', dbErr);
          }

          if (dbUser) {
            const profile = this.mapDbUserToProfile(dbUser);
            UserService.setCurrentUser(profile);
            return { success: true, user: profile };
          } else {
            // Cria registro na tabela users caso ainda não exista
            const newProfile: UserProfile = {
              id: authUser.id,
              name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || cleanEmail.split('@')[0],
              nickname: authUser.user_metadata?.nickname || undefined,
              email: cleanEmail,
              phone: authUser.user_metadata?.phone || '(11) 99999-8888',
              cpf: authUser.user_metadata?.cpf || '000.000.000-00',
              address: 'São Paulo, SP',
              avatarUrl: authUser.user_metadata?.avatar_url,
              mainPosition: 'meia',
              dominantFoot: 'destro',
              overallRating: 6.5,
              createdAt: new Date().toISOString(),
            };

            try {
              await withTimeout(
                supabase.from('users').insert([{
                  id: newProfile.id,
                  name: newProfile.name,
                  email: newProfile.email,
                  phone: newProfile.phone,
                  cpf: newProfile.cpf,
                  address: newProfile.address,
                  main_position: 'meia',
                  dominant_foot: 'destro',
                  overall_rating: 6.5,
                }]),
                4000
              );
            } catch (e) {
              console.warn('Aviso ao criar linha em users:', e);
            }

            UserService.setCurrentUser(newProfile);
            return { success: true, user: newProfile };
          }
        }

        if (authError?.message === 'Invalid login credentials' || authError?.code === 'invalid_credentials') {
          return { success: false, error: 'E-mail ou senha incorretos. Solicite ao diretor a criação ou redefinição do acesso.' };
        }
        if (authError?.message?.toLowerCase().includes('email not confirmed')) {
          return { success: false, error: 'Conta ainda não confirmada. Solicite a liberação ao diretor.' };
        }
        return { success: false, error: authError?.message || 'Não foi possível criar uma sessão segura.' };

      }

      // Fallback local caso offline ou cadastrado na sessão
      const current = UserService.getCurrentUser();
      if (current && (current.email.toLowerCase() === cleanEmail || !current.email)) {
        current.email = cleanEmail;
        UserService.setCurrentUser(current);
        return { success: true, user: current };
      }

      const foundMock = mockUsers.find(
        (u) => (u.email || '').toLowerCase() === cleanEmail
      );
      if (foundMock) {
        UserService.setCurrentUser(foundMock);
        return { success: true, user: foundMock };
      }

      return { success: false, error: 'E-mail ou senha incorretos. Caso ainda não tenha conta, cadastre-se.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao autenticar. Tente novamente.' };
    }
  },

  /**
   * Cadastro completo de atleta (com foto e apelido)
   */
  async registerAthlete(data: RegisterAthletePayload): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    try {
      let userId = generateUUID();
      let hasAuthenticatedSession = !isSupabaseConfigured;
      let requiresDirectorConfirmation = false;

      if (isSupabaseConfigured && supabase) {
        // Se tiver senha informada, cadastra no Supabase Auth com timeout
        if (data.password && data.password.length >= 6) {
          try {
            const { data: authRes, error: authError } = await withTimeout(
              supabase.auth.signUp({
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
              }),
              6000
            );

            if (authError) {
              return { success: false, error: authError.message || 'Não foi possível criar o acesso seguro.' };
            }

            if (authRes?.user?.id) {
              userId = authRes.user.id;
            }
            hasAuthenticatedSession = Boolean(authRes?.session);
            requiresDirectorConfirmation = Boolean(authRes?.user && !authRes?.session);
          } catch (authErr) {
            console.warn('Aviso ao registrar no Supabase Auth:', authErr);
            return { success: false, error: 'Não foi possível criar o acesso seguro. Tente novamente.' };
          }
        } else {
          return { success: false, error: 'Cadastre uma senha com pelo menos 6 caracteres.' };
        }

        // Salva na tabela pública de usuários
        try {
          const { data: inserted, error: insertErr } = await withTimeout(
            supabase.from('users').insert([{
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
            }]).select().single(),
            6000
          );

          if (insertErr) {
            if (insertErr.code === '23505') {
              return { success: false, error: 'E-mail ou CPF já cadastrado no sistema.' };
            }
            console.warn('Aviso ao inserir no Postgres:', insertErr);
          } else if (inserted) {
            userId = inserted.id;
          }
        } catch (insertErr: any) {
          console.warn('Aviso ao inserir usuário:', insertErr);
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

      if (requiresDirectorConfirmation || !hasAuthenticatedSession) {
        return {
          success: false,
          error: 'Cadastro criado, mas ainda precisa ser liberado pelo diretor antes do primeiro acesso.',
        };
      }

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
      const { data: { session } } = await withTimeout(supabase.auth.getSession(), 4000);
      if (!session || !session.user) return null;

      const authUser = session.user;
      const verifiedEmail = authUser.email?.trim().toLowerCase();
      const profileFilter = verifiedEmail
        ? `id.eq.${authUser.id},email.eq.${verifiedEmail}`
        : `id.eq.${authUser.id}`;
      const { data: dbUser } = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .or(profileFilter)
          .maybeSingle(),
        4000
      );

      if (dbUser) {
        const profile = this.mapDbUserToProfile(dbUser);
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

        try {
          await withTimeout(
            supabase.from('users').insert([{
              id: newProfile.id,
              name: newProfile.name,
              email: newProfile.email,
              phone: newProfile.phone || '(00) 00000-0000',
              cpf: `oauth_${Date.now()}`,
              address: 'Não informado',
              main_position: 'meia',
              dominant_foot: 'destro',
              overall_rating: 6.5
            }]),
            4000
          );
        } catch (e) {
          console.warn('Aviso ao inserir usuário oauth:', e);
        }

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
        await withTimeout(supabase.auth.signOut(), 3000);
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
