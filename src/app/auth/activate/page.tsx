'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, MailWarning } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AuthService } from '@/lib/services/auth-service';

export default function ActivateAccessPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const finishActivation = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError('A autenticacao por e-mail nao esta configurada.');
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error('O link expirou ou ja foi utilizado. Solicite um novo link de acesso.');
        }

        const profile = await AuthService.syncSupabaseSession();
        if (!profile) {
          throw new Error('A sessao foi criada, mas nao foi possivel carregar o perfil.');
        }

        if (active) {
          window.location.replace('/dashboard');
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Nao foi possivel ativar o acesso.');
        }
      }
    };

    finishActivation();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#090f16] text-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-[#0d1721] border border-[#182737] rounded-3xl p-8 text-center shadow-2xl">
        {error ? (
          <>
            <MailWarning className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-xl font-black text-white">Link nao ativado</h1>
            <p className="text-sm text-slate-400 mt-2">{error}</p>
            <Link
              href="/login"
              className="inline-flex mt-6 bg-[#00b49f] text-slate-950 font-black py-3 px-5 rounded-xl"
            >
              Solicitar novo link
            </Link>
          </>
        ) : (
          <>
            <div className="relative w-14 h-14 mx-auto mb-4">
              <CheckCircle2 className="w-14 h-14 text-[#00b49f]" />
              <LoaderCircle className="absolute inset-0 w-14 h-14 text-[#38e6cf] animate-spin opacity-40" />
            </div>
            <h1 className="text-xl font-black text-white">Ativando acesso seguro</h1>
            <p className="text-sm text-slate-400 mt-2">Estamos vinculando seu perfil e preparando a sincronizacao.</p>
          </>
        )}
      </section>
    </main>
  );
}
