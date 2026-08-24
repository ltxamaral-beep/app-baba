'use client';

import React, { useState } from 'react';
import { AuthService } from '@/lib/services/auth-service';
import { useRouter } from 'next/navigation';

interface GoogleAuthButtonProps {
  label?: string;
  onSuccess?: () => void;
  className?: string;
}

export function GoogleAuthButton({
  label = 'Continuar com o Google',
  onSuccess,
  className = '',
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await AuthService.signInWithGoogle();
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao conectar');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleClick}
        className={`w-full py-3 px-4 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800/90 text-slate-100 font-semibold text-sm flex items-center justify-center gap-3 shadow-md transition-all active:scale-[0.99] disabled:opacity-60 ${className}`}
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.7c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
            />
          </svg>
        )}
        <span>{label}</span>
      </button>

      {errorMsg && (
        <p className="text-rose-400 text-xs text-center">{errorMsg}</p>
      )}
    </div>
  );
}
