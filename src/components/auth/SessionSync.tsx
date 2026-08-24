'use client';

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AuthService } from '@/lib/services/auth-service';
import { GroupService } from '@/lib/services/group-service';

export function SessionSync() {
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // 1. Sincroniza sessão do Supabase Auth no carregamento inicial
    AuthService.syncSupabaseSession().catch((e) => {
      console.warn('Erro ao sincronizar sessão inicial:', e);
    });

    // 2. Sincroniza grupos com a nuvem
    GroupService.syncAllWithCloud().catch((e) => {
      console.warn('Erro ao sincronizar grupos:', e);
    });

    // 3. Ouve mudanças de estado de autenticação (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await AuthService.syncSupabaseSession();
        await GroupService.syncAllWithCloud();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
