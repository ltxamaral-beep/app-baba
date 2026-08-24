'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle,
  Trophy
} from 'lucide-react';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { AuthService } from '@/lib/services/auth-service';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Informe seu e-mail.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (!password) {
      setError('Informe sua senha de acesso.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await AuthService.signInWithEmail(cleanEmail, password);
      if (!result.success) {
        setError(result.error || 'Falha ao autenticar.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Erro no servidor ao tentar autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090f16] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00b49f]/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 relative z-10 flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2.5 mb-3 group">
          <div className="w-12 h-12 rounded-2xl bg-[#00b49f]/20 border border-[#00b49f]/40 flex items-center justify-center shadow-lg shadow-[#00b49f]/20 group-hover:scale-105 transition-transform">
            <Trophy className="w-6 h-6 text-[#00b49f]" />
          </div>
          <div className="text-left">
            <span className="font-black text-base text-white block leading-none">Reis da Pelada</span>
            <span className="text-[10px] text-[#00b49f] font-bold uppercase">Plataforma Oficial</span>
          </div>
        </Link>
        <h1 className="text-2xl font-black text-white">Acesse sua Conta</h1>
        <p className="text-slate-400 text-xs mt-1">"Organiza o baba, equilibra o time e coroa a resenha."</p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md bg-[#0d1721] border border-[#182737] rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-5">
        
        {/* Opção 1: Google OAuth */}
        <div>
          <GoogleAuthButton label="Continuar com o Google" />
        </div>

        {/* Divisor */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#182737]"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Ou acesse com seu E-mail
          </span>
          <div className="flex-grow border-t border-[#182737]"></div>
        </div>

        {/* Formulário Email + Senha */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f] focus:ring-1 focus:ring-[#00b49f] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f] focus:ring-1 focus:ring-[#00b49f] transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-rose-400 text-xs flex items-center gap-1.5 bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.99] disabled:opacity-50 text-sm tracking-wide"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Entrando...
              </span>
            ) : (
              <>
                Entrar no App <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[#182737] text-center">
          <p className="text-xs text-slate-400">
            Ainda não tem cadastro?{' '}
            <Link href="/register" className="text-[#00b49f] font-bold hover:underline">
              Criar Conta Grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
