'use client';

import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, User, Loader2 } from 'lucide-react';
import { fileToCompressedBase64 } from '@/lib/utils/image-utils';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarChange: (avatarUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function AvatarUpload({
  currentAvatarUrl,
  onAvatarChange,
  size = 'md',
  label = 'Foto de Perfil do Atleta'
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be selected again if needed
    e.target.value = '';

    setLoading(true);
    setError(null);

    try {
      const base64 = await fileToCompressedBase64(file, 350, 0.85);
      onAvatarChange(base64);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro ao carregar a foto.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAvatarChange('');
  };

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  }[size];

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          {label}
        </span>
      )}

      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
        />

        <div
          className={`${sizeClasses} rounded-full bg-[#121e2b] border-2 ${
            currentAvatarUrl ? 'border-[#00b49f]/80 shadow-lg shadow-[#00b49f]/20' : 'border-[#182737] hover:border-[#00b49f]/50'
          } flex items-center justify-center overflow-hidden transition-all relative select-none`}
        >
          {loading ? (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-20">
              <Loader2 className="w-6 h-6 text-[#00b49f] animate-spin" />
            </div>
          ) : currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Foto do Atleta"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#00b49f] transition-colors">
              <User className="w-8 h-8 stroke-[1.5]" />
            </div>
          )}

          {/* Hover Overlay with Camera Icon */}
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 rounded-full backdrop-blur-[2px]">
            <Camera className="w-4 h-4 text-[#00b49f]" />
            <span>{currentAvatarUrl ? 'Alterar' : 'Adicionar'}</span>
          </div>
        </div>

        {/* Small floating badge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#00b49f] text-slate-950 flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all border-2 border-[#090f16]"
          title="Escolher Foto"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[11px] text-[#00b49f] hover:text-[#00cba9] font-bold transition-colors flex items-center gap-1"
        >
          <ImageIcon className="w-3 h-3" />
          {currentAvatarUrl ? 'Trocar foto' : 'Carregar foto do dispositivo'}
        </button>

        {currentAvatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold transition-colors flex items-center gap-1 ml-2"
          >
            <Trash2 className="w-3 h-3" /> Remover
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
}
