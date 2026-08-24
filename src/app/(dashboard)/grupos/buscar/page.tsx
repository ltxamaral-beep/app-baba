'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GroupService } from '@/lib/services/storage-service';
import { Group, MembershipType } from '@/types';
import { 
  Search, 
  Key, 
  ArrowRight, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Trophy,
  ShieldCheck,
  MapPin,
  Sparkles,
  Share2,
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  DollarSign,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';

export default function SearchGroupPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [membershipType, setMembershipType] = useState<MembershipType>('associado');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Carrega grupos no início
  useEffect(() => {
    async function loadInitial() {
      setSearching(true);
      try {
        const list = await GroupService.getAllPublicGroups();
        setSearchResults(list);
        if (list.length > 0) {
          setSelectedGroup(list[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }
    loadInitial();
  }, []);

  // Busca em tempo real conforme o usuário digita
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setError(null);
    setSearching(true);
    try {
      const results = await GroupService.searchGroups(term);
      setSearchResults(results);
      if (results.length > 0 && !selectedGroup) {
        setSelectedGroup(results[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleJoinDirect = async (groupToJoin: Group) => {
    setLoading(true);
    setError(null);

    const result = await GroupService.joinGroupByCode(groupToJoin.id, membershipType);
    if (result.success && result.group) {
      router.push(`/dashboard`);
    } else {
      setError(result.error || 'Não foi possível entrar neste grupo.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchTerm.trim();
    if (!clean) {
      setError('Por favor, digite o nome do grupo ou código de convite.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await GroupService.joinGroupByCode(clean, membershipType);
    if (result.success && result.group) {
      router.push(`/dashboard`);
    } else {
      setError(result.error || 'Nenhum grupo encontrado com este nome ou código.');
      setLoading(false);
    }
  };

  const copyInviteLink = (group: Group) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
    const link = `${origin}/convite/${group.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(group.id);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const shareOnWhatsApp = (group: Group) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
    const link = `${origin}/convite/${group.inviteCode}`;
    const text = `⚽ *Convite para a Pelada: ${group.name}*\n📅 Toda ${group.matchDay} às ${group.matchTime}\n📍 Local: ${group.fieldAddress}\n\nEntre no grupo pelo link abaixo:\n👉 ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Search className="w-3.5 h-3.5" /> Encontrar Grupo
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Buscar Pelada por Nome ou Código
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Digite o <strong>Nome do Grupo</strong> ou o <strong>Código de Convite</strong> recebido no WhatsApp para ingressar na lista.
        </p>
      </div>

      {/* Barra de Pesquisa Principal */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-emerald-400" /> Nome da Pelada ou Código de Convite
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ex: 'Pelada dos Amigos', 'Quinta' ou 'GRUP-LLXD'"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-2 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Como você deseja participar do grupo?
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMembershipType('associado')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  membershipType === 'associado'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-base mb-1">⭐</span>
                Associado (Mensalista)
              </button>

              <button
                type="button"
                onClick={() => setMembershipType('diarista')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  membershipType === 'diarista'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-base mb-1">🎟️</span>
                Diarista (Por jogo)
              </button>

              <button
                type="button"
                onClick={() => setMembershipType('goleiro')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  membershipType === 'goleiro'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-base mb-1">🧤</span>
                Goleiro (Isento)
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              {error}
            </div>
          )}

          {searchTerm && searchResults.length === 0 && !searching && (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-slate-400">
                Nenhum grupo encontrado com o termo <strong className="text-white">"{searchTerm}"</strong>.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs"
              >
                Tentar Ingressar Direto pelo Código
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Lista de Grupos Encontrados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> 
            {searchTerm ? `Resultados da Pesquisa (${searchResults.length})` : `Peladas Disponíveis no Sistema (${searchResults.length})`}
          </h2>
          {searching && <span className="text-[11px] text-emerald-400 animate-pulse">Buscando na nuvem...</span>}
        </div>

        {searchResults.length === 0 && !searching ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
            <p className="text-xs text-slate-400">Nenhuma pelada pública cadastrada no momento.</p>
            <Link
              href="/grupos/novo"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline"
            >
              <Plus className="w-4 h-4" /> Seja o primeiro a criar um grupo!
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {searchResults.map((g) => (
              <div
                key={g.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 sm:p-6 transition-all shadow-lg space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-black text-white">{g.name}</h3>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        {g.soccerType}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      {g.fieldAddress}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-300 mt-2">
                      <span className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Calendar className="w-3 h-3 text-slate-500" /> {g.matchDay}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Clock className="w-3 h-3 text-slate-500" /> {g.matchTime}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400 font-bold">
                        <DollarSign className="w-3 h-3" /> R$ {g.monthlyFee?.toFixed(2)}/mês
                      </span>
                    </div>
                  </div>

                  {/* Código e Botões de Compartilhamento WhatsApp */}
                  <div className="flex sm:flex-col items-end gap-2 text-right">
                    <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Código</span>
                      <span className="text-xs font-mono font-black text-emerald-400 tracking-wider">
                        {g.inviteCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {g.whatsappGroupUrl && (
                        <a
                          href={g.whatsappGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Acessar Grupo do WhatsApp do Baba"
                          className="bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]" /> Grupo Zap
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => shareOnWhatsApp(g)}
                        title="Enviar convite no WhatsApp"
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Convite
                      </button>

                      <button
                        type="button"
                        onClick={() => copyInviteLink(g)}
                        title="Copiar Link de Convite"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs flex items-center gap-1 transition-all"
                      >
                        {copiedCode === g.id ? (
                          <span className="text-emerald-400 text-[10px] font-bold">Copiado!</span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botão Entrar Neste Grupo */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    Entrar como: <strong className="text-white capitalize">{membershipType}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleJoinDirect(g)}
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-2.5 px-5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    Entrar Nesta Pelada <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Não tem grupo? Criar um novo */}
      <div className="text-center pt-4">
        <p className="text-xs text-slate-400">
          Quer ser o organizador e criar o seu próprio grupo de futebol?
        </p>
        <Link
          href="/grupos/novo"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 mt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Criar Meu Grupo de Pelada
        </Link>
      </div>
    </div>
  );
}
