'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GroupService, UserService } from '@/lib/services/storage-service';
import { Group, MembershipType } from '@/types';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  AlertCircle,
  Activity,
  MessageCircle
} from 'lucide-react';

export default function InviteJoinPage({ params }: { params: { inviteCode: string } }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [membershipType, setMembershipType] = useState<MembershipType>('associado');
  const [joinedSuccess, setJoinedSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGroup() {
      setSearching(true);
      setError(null);
      try {
        const found = await GroupService.findGroupByInviteCodeAsync(params.inviteCode);
        if (found) {
          setGroup(found);
        } else {
          setError('Convite não encontrado ou expirado.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar convite.');
      } finally {
        setSearching(false);
      }
    }

    if (params.inviteCode) {
      loadGroup();
    }
  }, [params.inviteCode]);

  const handleJoin = async () => {
    if (!group) return;
    setLoading(true);
    setError(null);

    try {
      const result = await GroupService.joinGroupByCode(params.inviteCode, membershipType);
      if (result.success) {
        setJoinedSuccess(true);
      } else {
        setError(result.error || 'Não foi possível entrar no grupo.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao ingressar no grupo.');
    } finally {
      setLoading(false);
    }
  };

  if (searching) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Buscando informações da pelada na nuvem...</p>
        </div>
      </div>
    );
  }

  if (!group || error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3 bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Convite não encontrado</h1>
          <p className="text-xs text-slate-400">
            {error || 'Verifique se o código do convite está correto.'}
          </p>
          <Link
            href="/"
            className="inline-block mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Card */}
      <div className="w-full max-w-lg bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Convite Oficial para Pelada
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{group.name}</h1>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {group.fieldAddress}
          </p>
        </div>

        {joinedSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Solicitação Enviada à Diretoria!</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              Sua solicitação de entrada como <strong className="text-amber-400 capitalize">{membershipType}</strong> foi enviada e aguarda aprovação do <strong>Presidente, Tesoureiro ou ADM</strong> da pelada.
            </p>

            {/* Botão de Entrar no WhatsApp do Baba */}
            {group.whatsappGroupUrl && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <MessageCircle className="w-4 h-4" /> Grupo Oficial do WhatsApp
                </div>
                <p className="text-[11px] text-slate-300">
                  Enquanto aguarda a aprovação da diretoria, você já pode entrar no WhatsApp da turma:
                </p>
                <a
                  href={group.whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-slate-950" /> Entrar no Grupo do WhatsApp do Baba
                </a>
              </div>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all shadow-md"
            >
              Ir para o Painel <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Informações da Pelada */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Dia & Horário</span>
                <span className="font-bold text-slate-200">{group.matchDay}</span>
                <span className="text-slate-400 block text-[11px]">{group.matchTime} ({group.matchDurationMinutes} min)</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Formato</span>
                <span className="font-bold text-slate-200 capitalize">{group.soccerType}</span>
                <span className="text-slate-400 block text-[11px]">{group.playersPerTeam} atletas / time</span>
              </div>
            </div>

            {/* Seleção do Papel de Entrada */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase">
                Como você deseja participar?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'associado', title: 'Associado', desc: 'Mensalista fixo' },
                  { type: 'diarista', title: 'Diarista', desc: 'Paga por jogo' },
                  { type: 'goleiro', title: 'Goleiro', desc: 'Isento / Ajuda' },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setMembershipType(item.type as MembershipType)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      membershipType === item.type
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-bold text-xs text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Regras */}
            {group.rules && (
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Regras da Pelada:</span>
                <p className="line-clamp-2">{group.rules}</p>
              </div>
            )}

            {error && (
              <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Ação */}
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Confirmando Entrada...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Aceitar Convite & Entrar no Grupo
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
