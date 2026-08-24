'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', title?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('show_toast', {
        detail: {
          id: Math.random().toString(36).substring(2, 9),
          message,
          type,
          title,
        },
      })
    );
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: CustomEvent<ToastMessage>) => {
      const newToast = e.detail;
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    window.addEventListener('show_toast' as any, handleToast);
    return () => window.removeEventListener('show_toast' as any, handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-top-4 duration-200 ${
              isSuccess
                ? 'bg-slate-900/95 border-emerald-500/60 text-white shadow-emerald-950/40'
                : isError
                ? 'bg-slate-900/95 border-rose-500/60 text-white shadow-rose-950/40'
                : isWarning
                ? 'bg-slate-900/95 border-amber-500/60 text-white shadow-amber-950/40'
                : 'bg-slate-900/95 border-blue-500/60 text-white shadow-blue-950/40'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isError && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-400" />}
            </div>

            <div className="flex-1 text-xs">
              {toast.title && <h5 className="font-bold text-sm mb-0.5 text-white">{toast.title}</h5>}
              <p className="text-slate-200 font-medium leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
