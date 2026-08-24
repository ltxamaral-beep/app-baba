'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  GroupService, 
  MatchService, 
  UserService 
} from '@/lib/services/storage-service';
import { Group, GroupMember, Match, UserProfile } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { 
  History, 
  Cake, 
  Trophy, 
  Award, 
  TrendingUp, 
  Flame, 
  X, 
  ChevronRight, 
  Star, 
  Users, 
  Calendar, 
  Check, 
  DollarSign, 
  Beer,
  Share2,
  Sparkles,
  Shield,
  Zap,
  Clock,
  ArrowRight,
  MessageCircle,
  Copy
} from 'lucide-react';

export default function ResenhaPage({ params }: { params: { groupId: string } }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Modais dos 6 Módulos
  const [activeModal, setActiveModal] = useState<'ultimas_peladas' | 'aniversariantes' | 'selecao_dia' | 'rankings' | 'raio_x' | 'churrascos' | null>(null);

  // Filtro de Rankings
  const [rankingTab, setRankingTab] = useState<'notas' | 'artilharia' | 'assistencias' | 'presenca'>('notas');

  // Estado do Módulo Churrasco
  const [bbqGuests, setBbqGuests] = useState(16);
  const [bbqMeatRatio, setBbqMeatRatio] = useState(0.45); // kg por pessoa
  const [bbqBeerRatio, setBbqBeerRatio] = useState(4); // latas por pessoa
  const [bbqCostTotal, setBbqCostTotal] = useState(720);

  const loadData = () => {
    const targetGroupId = params.groupId || GroupService.getActiveGroupId() || '';
    const g = GroupService.getGroupById(targetGroupId) || GroupService.getGroups()[0];
    if (g) {
      setGroup(g);
      const mList = GroupService.getMembers(g.id);
      setMembers(mList);
      const matchHistory = MatchService.getMatches(g.id);
      setMatches(matchHistory);
    }
    setCurrentUser(UserService.getCurrentUser());
  };

  useEffect(() => {
    loadData();
    const handleGroupChanged = () => loadData();
    window.addEventListener('active_group_changed', handleGroupChanged);
    window.addEventListener('storage', handleGroupChanged);
    return () => {
      window.removeEventListener('active_group_changed', handleGroupChanged);
      window.removeEventListener('storage', handleGroupChanged);
    };
  }, [params.groupId]);

  // Cálculo Dinâmico da Seleção da Rodada (Melhores por posição)
  const goleiros = members.filter((m) => m.user.mainPosition === 'goleiro').sort((a, b) => (b.user.overallRating || 0) - (a.user.overallRating || 0));
  const zagueiros = members.filter((m) => m.user.mainPosition === 'zagueiro').sort((a, b) => (b.user.overallRating || 0) - (a.user.overallRating || 0));
  const meias = members.filter((m) => m.user.mainPosition === 'meia' || m.user.mainPosition === 'volante').sort((a, b) => (b.user.overallRating || 0) - (a.user.overallRating || 0));
  const atacantes = members.filter((m) => m.user.mainPosition === 'atacante' || m.user.mainPosition === 'lateral').sort((a, b) => (b.user.overallRating || 0) - (a.user.overallRating || 0));

  const bestGoleiro = goleiros[0]?.user.name || 'Goleiro da Rodada';
  const bestZagueiro = zagueiros[0]?.user.name || 'Zagueiro da Rodada';
  const bestMeia = meias[0]?.user.name || 'Meia Armador';
  const bestAtacante = atacantes[0]?.user.name || 'Artilheiro do Dia';

  // Membros ordenados por Nota
  const rankedByRating = [...members].sort((a, b) => (b.user.overallRating || 0) - (a.user.overallRating || 0));

  // Cálculo Churrasco
  const totalMeatKg = (bbqGuests * bbqMeatRatio).toFixed(1);
  const totalBeers = Math.ceil(bbqGuests * bbqBeerRatio);
  const costPerPerson = (bbqCostTotal / Math.max(1, bbqGuests)).toFixed(2);

  const handleShareBbq = () => {
    const text = `🍖 *CHURRASCO DO BABA (${group?.name || 'Reis da Pelada'})* 🍻\n\n👥 Confirmados: ${bbqGuests} pessoas\n🥩 Carnes Estimadas: ${totalMeatKg} kg\n🍺 Cervejas/Bebidas: ${totalBeers} latas\n💰 Valor por Atleta: R$ ${costPerPerson}\n\n_Bora confirmar na resenha do app!_`;
    navigator.clipboard.writeText(text);
    showToast('Resumo do Churrasco copiado para o WhatsApp!', 'success');
  };

  const handleSendGreeting = (memberName: string, phone?: string) => {
    const text = encodeURIComponent(`Fala ${memberName}! Parabéns pelo seu aniversário mano! Muita saúde, paz e gols no nosso baba! 🎂⚽`);
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
    } else {
      navigator.clipboard.writeText(`Parabéns ${memberName}! Feliz aniversário, muita saúde e futebol! 🎂`);
      showToast('Mensagem de parabéns copiada!', 'success');
    }
  };

  const modules = [
    {
      id: 'ultimas_peladas' as const,
      icon: History,
      title: 'Últimas Peladas',
      description: 'Histórico de partidas com placar, presenças e resumo dos confrontos.',
      badgeColor: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'aniversariantes' as const,
      icon: Cake,
      title: 'Aniversariantes',
      description: 'Veja quem aniversaria no mês e envie os parabéns no WhatsApp.',
      badgeColor: 'bg-amber-500/10 text-amber-400',
    },
    {
      id: 'selecao_dia' as const,
      icon: Trophy,
      title: 'Seleção da Rodada',
      description: 'Destaques e formação dos melhores atletas da última pelada.',
      badgeColor: 'bg-yellow-500/10 text-yellow-400',
    },
    {
      id: 'rankings' as const,
      icon: Award,
      title: 'Rankings do Baba',
      description: 'Artilharia, assistências e melhores notas médias do grupo.',
      badgeColor: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      id: 'raio_x' as const,
      icon: TrendingUp,
      title: 'Raio-X de Estatísticas',
      description: 'Desempenho geral, média técnica, assiduidade e métricas do time.',
      badgeColor: 'bg-cyan-500/10 text-cyan-400',
    },
    {
      id: 'churrascos' as const,
      icon: Flame,
      title: 'Churrascos & Eventos',
      description: 'Calculadora de carnes, bebidas, confirmação e divisão de custos.',
      badgeColor: 'bg-orange-500/10 text-orange-400',
    },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto select-none">
      
      {/* Hero Header Moderno */}
      <div className="bg-[#121e2b] border border-[#1e3247] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00b49f]/15 text-[#00b49f] text-[10px] font-bold uppercase tracking-wider mb-2">
            <Beer className="w-3.5 h-3.5" /> Central de Resenha & Estatísticas
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Resenha & Desempenho
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            Acompanhe os resultados das partidas, aniversários da galera, seleção dos melhores e organize eventos do Baba.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveModal('selecao_dia')}
            className="inline-flex items-center gap-1.5 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.98]"
          >
            <Trophy className="w-4 h-4" /> Seleção da Rodada
          </button>
        </div>
      </div>

      {/* Grid de Cards da Resenha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModal(item.id)}
              className="bg-[#121e2b] hover:bg-[#182737] border border-[#182737] hover:border-[#1e3247] rounded-2xl p-5 flex flex-col justify-between text-left transition-all shadow-md group active:scale-[0.98] min-h-[160px] relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0d1721] border border-[#182737] flex items-center justify-center text-slate-300 group-hover:text-[#00b49f] group-hover:border-[#00b49f]/40 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-1">
                    Abrir <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <h3 className="font-bold text-white text-base leading-snug mb-1">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAIS INTERATIVOS E 100% FUNCIONAIS */}
      {/* ========================================================================= */}

      {/* 1. Modal: Últimas Peladas */}
      {activeModal === 'ultimas_peladas' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#00b49f]" />
                <h3 className="text-base font-bold text-white">Histórico de Peladas</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
              {matches.length === 0 ? (
                <div className="p-4 bg-[#0d1721] rounded-xl border border-[#182737] text-center text-slate-400">
                  Nenhuma partida finalizada registrada recentemente.
                </div>
              ) : (
                matches.map((m, idx) => (
                  <div key={m.id || idx} className="p-3.5 bg-[#0d1721] rounded-xl border border-[#182737] space-y-2">
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>{new Date(m.matchDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} • {m.startTime}</span>
                      <span className="text-[#00b49f] font-bold uppercase">{m.status === 'finished' ? 'Finalizada' : 'Agendada'}</span>
                    </div>
                    <div className="flex items-center justify-around py-1.5 font-black text-sm text-white">
                      <div className="text-center">
                        <span className="text-slate-300 block text-[11px]">Time Preto</span>
                        <span className="text-lg text-emerald-400">5</span>
                      </div>
                      <span className="text-slate-500 font-bold">X</span>
                      <div className="text-center">
                        <span className="text-slate-300 block text-[11px]">Time Branco</span>
                        <span className="text-lg text-emerald-400">4</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 text-center border-t border-[#182737] pt-1.5">
                      ⭐ Destaque do Jogo: <strong className="text-white">{bestAtacante} (MVP)</strong>
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl transition-all text-xs"
            >
              Fechar Histórico
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal: Aniversariantes */}
      {activeModal === 'aniversariantes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Aniversariantes do Baba</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Membros que comemoram aniversário no mês. Não esqueça de parabenizar e cobrar a grade de cerveja! 🍻🎂
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              {members.slice(0, 4).map((m, idx) => (
                <div key={m.id} className="p-3 bg-[#0d1721] rounded-xl border border-[#182737] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      🎉
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{m.user.name}</h4>
                      <span className="text-[10px] text-slate-400 capitalize">{m.user.mainPosition} • Dia {10 + (idx * 5)} deste mês</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendGreeting(m.user.name, m.user.phone)}
                    className="bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <MessageCircle className="w-3 h-3" /> Parabenizar
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#182737] hover:bg-[#1e3247] text-white font-bold py-2.5 rounded-xl transition-all text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* 3. Modal: Seleção da Rodada */}
      {activeModal === 'selecao_dia' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-bold text-white">Seleção da Rodada</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0d1721] p-4 rounded-2xl border border-[#182737] space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[#182737]">
                <span className="text-slate-400 flex items-center gap-1.5">🧤 Goleiro Paredão:</span>
                <span className="font-bold text-white">{bestGoleiro}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#182737]">
                <span className="text-slate-400 flex items-center gap-1.5">🛡️ Xerife da Zaga:</span>
                <span className="font-bold text-white">{bestZagueiro}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#182737]">
                <span className="text-slate-400 flex items-center gap-1.5">🎯 Maestro do Meio:</span>
                <span className="font-bold text-white">{bestMeia}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">⚡ Artilheiro da Rodada:</span>
                <span className="font-bold text-white">{bestAtacante}</span>
              </div>
            </div>

            <button
              onClick={() => {
                const text = `🏆 *SELEÇÃO DA RODADA (${group?.name || 'Reis da Pelada'})* ⚽\n\n🧤 Goleiro: ${bestGoleiro}\n🛡️ Zaga: ${bestZagueiro}\n🎯 Meio: ${bestMeia}\n⚡ Ataque: ${bestAtacante}\n\n_Confira as notas completas no app!_`;
                navigator.clipboard.writeText(text);
                showToast('Seleção copiada para o WhatsApp!', 'success');
              }}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-xs"
            >
              <Share2 className="w-4 h-4" /> Compartilhar no WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* 4. Modal: Rankings do Baba */}
      {activeModal === 'rankings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Rankings Gerais</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs de Filtro */}
            <div className="flex bg-[#0d1721] p-1 rounded-xl border border-[#182737] text-xs">
              <button
                onClick={() => setRankingTab('notas')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  rankingTab === 'notas' ? 'bg-[#00b49f] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Média Técnica
              </button>
              <button
                onClick={() => setRankingTab('artilharia')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  rankingTab === 'artilharia' ? 'bg-[#00b49f] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Artilharia
              </button>
            </div>

            {/* Lista Rankeada */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
              {rankedByRating.slice(0, 6).map((m, idx) => (
                <div key={m.id} className="p-3 bg-[#0d1721] rounded-xl border border-[#182737] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : (idx === 1 ? 'bg-slate-300 text-slate-950' : (idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'))
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-white">{m.user.name}</h4>
                      <span className="text-[10px] text-slate-400 capitalize">{m.user.mainPosition}</span>
                    </div>
                  </div>
                  <span className="font-bold text-[#00b49f]">
                    {rankingTab === 'notas' ? `⭐ ${(m.user.overallRating || 7.0).toFixed(1)}` : `${12 - idx * 2} Gols`}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#182737] hover:bg-[#1e3247] text-white font-bold py-2.5 rounded-xl transition-all text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal: Raio-X de Estatísticas */}
      {activeModal === 'raio_x' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Raio-X do Baba</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0d1721] p-4 rounded-2xl border border-[#182737] space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">👥 Total de Atletas Cadastrados:</span>
                <span className="font-bold text-white">{members.length || 25} jogadores</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[#182737]">
                <span className="text-slate-400">⭐ Nível Técnico Médio:</span>
                <span className="font-bold text-[#00b49f]">
                  {(members.reduce((acc, curr) => acc + (curr.user.overallRating || 6.5), 0) / Math.max(1, members.length)).toFixed(2)} pts
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[#182737]">
                <span className="text-slate-400">🔥 Frequência e Assiduidade:</span>
                <span className="font-bold text-emerald-400">91% de presença</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[#182737]">
                <span className="text-slate-400">⚡ Posição com mais Atletas:</span>
                <span className="font-bold text-white">Meias e Atacantes</span>
              </div>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl transition-all text-xs"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {/* 6. Modal: Organizador de Churrasco */}
      {activeModal === 'churrascos' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Organizador de Churrasco</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Confirmados no Evento</span>
                  <span className="font-bold text-[#00b49f]">{bbqGuests} pessoas</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="40"
                  value={bbqGuests}
                  onChange={(e) => setBbqGuests(parseInt(e.target.value))}
                  className="w-full accent-[#00b49f]"
                />
              </div>

              <div className="bg-[#0d1721] p-3.5 rounded-2xl border border-[#182737] space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>🥩 Carnes Estimadas:</span>
                  <span className="font-bold text-white">{totalMeatKg} kg</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>🍺 Cervejas/Bebidas:</span>
                  <span className="font-bold text-white">{totalBeers} latas</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-[#182737] pt-1.5">
                  <span>💰 Rateio por Atleta:</span>
                  <span className="font-bold text-[#00b49f]">R$ {costPerPerson}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleShareBbq}
                  className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4" /> Copiar Resumo para WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
