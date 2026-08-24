'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  GroupService, 
  MatchService, 
  UserService, 
  RatingService,
  MatchStatsService
} from '@/lib/services/storage-service';
import { 
  Group, 
  GroupMember, 
  Match, 
  MatchAttendance, 
  UserProfile, 
  PlayerMatchStat,
  MatchTeam,
  UserPosition,
  DominantFoot
} from '@/types';
import { balanceTeams } from '@/lib/utils/draw-algorithm';
import { showToast } from '@/components/ui/Toast';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Trophy, 
  Award, 
  BarChart3, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Unlock, 
  Plus, 
  Play, 
  RefreshCw, 
  Star, 
  Zap,
  Save,
  Check,
  X,
  Footprints,
  Medal,
  Flame,
  ArrowRight,
  Settings,
  Sliders,
  UserPlus,
  Trash2,
  Ticket,
  Share2,
  Copy,
  MessageCircle
} from 'lucide-react';

export default function PeladaHubPage({ params }: { params: { groupId: string } }) {
  const groupId = params.groupId || 'group-1';
  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [attendances, setAttendances] = useState<MatchAttendance[]>([]);
  
  // Abas
  const [activeTab, setActiveTab] = useState<'presenca' | 'sorteio' | 'votacao' | 'sumula' | 'rankings'>('presenca');
  
  // Sorteio
  const [teams, setTeams] = useState<MatchTeam[]>([]);
  
  // Modal de Abertura de Presença (Comissão)
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [openMatchData, setOpenMatchData] = useState({
    matchDate: new Date().toISOString().split('T')[0],
    startTime: '20:00',
    maxPlayers: 24,
    deadlineDate: new Date().toISOString().split('T')[0],
    deadlineTime: '12:00',
    hasDeadline: true,
  });

  // Estatísticas / Súmula da Partida
  const [playerStats, setPlayerStats] = useState<PlayerMatchStat[]>([]);
  const [statsSaved, setStatsSaved] = useState(false);

  // Votação Pós-Jogo
  const [ratingVotes, setRatingVotes] = useState<Record<string, { rating: number; tag?: string }>>({});
  const [votesSubmitted, setVotesSubmitted] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  const loadData = async () => {
    const user = UserService.getCurrentUser();
    setCurrentUser(user);

    const g = GroupService.getGroupById(groupId) || GroupService.getGroups()[0];
    if (g) {
      setGroup(g);
      const member = GroupService.getMemberInGroup(g.id, user.id);
      setCurrentMember(member || null);

      const mList = MatchService.getMatches(g.id);
      setMatches(mList);

      if (mList.length > 0) {
        const latest = mList[0];
        setActiveMatch(latest);
        const attList = MatchService.getAttendances(latest.id);
        setAttendances(attList);

        // Carrega ou inicializa súmula
        const savedStats = MatchStatsService.getMatchStats(latest.id);
        if (savedStats.length > 0) {
          setPlayerStats(savedStats);
        } else {
          // Preenche com os confirmados
          const initialStats: PlayerMatchStat[] = attList
            .filter((a) => a.status === 'confirmed' || a.status === 'present')
            .map((a) => ({
              id: `stat-${a.userId}-${latest.id}`,
              matchId: latest.id,
              groupId: g.id,
              userId: a.userId,
              userName: a.user.name,
              userPosition: a.user.mainPosition,
              goals: 0,
              assists: 0,
              tackles: 0,
              saves: 0,
              yellowCards: 0,
              redCards: 0,
              isMvp: false,
              createdAt: new Date().toISOString(),
            }));
          setPlayerStats(initialStats);
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        setOpenMatchData((prev) => ({
          ...prev,
          matchDate: today,
          startTime: g.matchTime || '20:00',
          maxPlayers: g.maxSlots || 24,
          deadlineDate: today,
          deadlineTime: '12:00',
          hasDeadline: true,
        }));
      }

      // Sincroniza em segundo plano com a nuvem (Supabase)
      try {
        const cloudMatches = await MatchService.syncMatchesFromCloud(g.id);
        if (cloudMatches && cloudMatches.length > 0) {
          setMatches(cloudMatches);
          const latest = cloudMatches[0];
          setActiveMatch(latest);

          const cloudAtts = await MatchService.syncAttendancesFromCloud(latest.id);
          setAttendances(cloudAtts);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar partidas e presenças com Supabase:', err);
      }
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [groupId]);

  const [editSlotsModalOpen, setEditSlotsModalOpen] = useState(false);
  const [newSlotsValue, setNewSlotsValue] = useState(24);

  // Convidados
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState({
    name: '',
    position: 'meia' as UserPosition,
    dominantFoot: 'destro' as DominantFoot,
    overallRating: 6.5,
    phone: '',
  });

  if (!group) return <div className="p-8 text-center text-slate-400">Carregando pelada...</div>;

  const isDirector = currentMember?.role === 'presidente' || currentMember?.role === 'adm' || currentMember?.role === 'tesoureiro';
  const confirmedList = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present');
  const waitlistList = attendances.filter((a) => a.status === 'waitlist');
  const guestList = attendances.filter((a) => a.isGuest && a.status !== 'cancelled');
  const userAttendance = attendances.find((a) => a.userId === currentUser?.id);
  const maxSlots = activeMatch?.maxPlayers || group.maxSlots || 24;

  const isDeadlinePassed = activeMatch?.confirmationDeadline
    ? new Date() > new Date(activeMatch.confirmationDeadline)
    : false;

  const formattedDeadline = activeMatch?.confirmationDeadline
    ? (() => {
        try {
          const d = new Date(activeMatch.confirmationDeadline);
          return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          return activeMatch.confirmationDeadline;
        }
      })()
    : null;

  // Abertura manual da lista pela comissão
  const handleOpenAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const newSlots = Number(openMatchData.maxPlayers) || 24;
    GroupService.updateGroup(group.id, { maxSlots: newSlots });

    let confirmationDeadline: string | undefined = undefined;
    if (openMatchData.hasDeadline && openMatchData.deadlineDate) {
      confirmationDeadline = `${openMatchData.deadlineDate}T${openMatchData.deadlineTime || '12:00'}:00`;
    }

    const newMatch = MatchService.openMatchAttendance(
      group.id,
      openMatchData.matchDate,
      openMatchData.startTime,
      newSlots,
      group.dailyFee || 25,
      confirmationDeadline
    );
    setOpenModalOpen(false);
    showToast('Lista de presença da pelada aberta com sucesso! ⚽', 'success');
    loadData();
  };

  const handlePromoteToConfirmed = (attendanceId: string, athleteName: string) => {
    if (!activeMatch) return;
    MatchService.promoteWaitlistToConfirmed(activeMatch.id, attendanceId);
    showToast(`⚽ ${athleteName} foi promovido para os confirmados!`, 'success');
    loadData();
  };

  const handleDemoteToWaitlist = (attendanceId: string, athleteName: string) => {
    if (!activeMatch) return;
    MatchService.demoteConfirmedToWaitlist(activeMatch.id, attendanceId);
    showToast(`${athleteName} foi movido para a fila de espera.`, 'info');
    loadData();
  };

  const handleUpdateSlotsDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    const slots = Number(newSlotsValue) || 24;
    if (activeMatch) {
      MatchService.updateMatchMaxPlayers(group.id, activeMatch.id, slots);
    } else {
      GroupService.updateGroup(group.id, { maxSlots: slots });
    }
    setEditSlotsModalOpen(false);
    showToast(`Limite atualizado para ${slots} vagas! ⚽`, 'success');
    loadData();
  };

  const handleAddGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || !currentUser) return;
    if (!guestForm.name.trim()) {
      showToast('Informe o nome do convidado.', 'error');
      return;
    }

    MatchService.addGuestAttendance(
      activeMatch.id,
      currentUser,
      {
        name: guestForm.name,
        position: guestForm.position,
        overallRating: Number(guestForm.overallRating) || 6.5,
        dominantFoot: guestForm.dominantFoot,
        phone: guestForm.phone,
      },
      maxSlots,
      group.id
    );

    setGuestModalOpen(false);
    setGuestForm({
      name: '',
      position: 'meia',
      dominantFoot: 'destro',
      overallRating: 6.5,
      phone: '',
    });
    showToast(`Convidado ${guestForm.name} adicionado à lista! 🎟️`, 'success');
    loadData();
  };

  const handleRemoveGuest = (attendanceId: string, guestName: string) => {
    if (!activeMatch) return;
    if (confirm(`Deseja remover o convidado ${guestName} da lista?`)) {
      MatchService.removeGuestAttendance(activeMatch.id, attendanceId);
      showToast(`Convidado ${guestName} removido da lista.`, 'info');
      loadData();
    }
  };

  const handleCloseAttendance = () => {
    if (!activeMatch) return;
    if (confirm('Deseja encerrar a lista de presença e avançar para o Sorteio de Times?')) {
      MatchService.closeMatchAttendance(group.id, activeMatch.id);
      showToast('Lista encerrada! Pronto para sortear os times. 🔒', 'info');
      loadData();
      setActiveTab('sorteio');
    }
  };

  const handleConfirmPresence = () => {
    if (!activeMatch || !currentUser) return;
    MatchService.confirmAttendance(activeMatch.id, currentUser, maxSlots);
    showToast('Sua presença foi confirmada na pelada! ⚽', 'success');
    loadData();
  };

  const handleCancelPresence = () => {
    if (!activeMatch || !currentUser) return;
    MatchService.cancelAttendance(activeMatch.id, currentUser.id);
    showToast('Sua presença foi cancelada na pelada.', 'info');
    loadData();
  };

  const handleDrawTeams = () => {
    if (!activeMatch) return;
    const numTeams = Math.max(2, Math.ceil(confirmedList.length / (group.playersPerTeam || 6)));
    const drawnTeams = balanceTeams(confirmedList, {
      teamCount: numTeams,
      playersPerTeam: group.playersPerTeam || 6,
    });
    setTeams(drawnTeams);
    showToast('Times sorteados e equilibrados com sucesso! 🎲', 'success');
  };

  const handleSaveStats = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    MatchStatsService.savePlayerMatchStats(activeMatch.id, playerStats);
    setStatsSaved(true);
    showToast('Súmula e estatísticas da partida salvas com sucesso! 🏆', 'success');
    setTimeout(() => setStatsSaved(false), 3500);
  };

  const handleVoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || !currentUser) return;
    const voteArray = Object.entries(ratingVotes).map(([ratedUserId, data]) => ({
      ratedUserId,
      rating: data.rating,
      tag: data.tag,
    }));
    RatingService.submitRatings(activeMatch.id, currentUser.id, voteArray);
    setVotesSubmitted(true);
    showToast('Suas notas e votos de MVP foram registrados! 🌟', 'success');
    setTimeout(() => setVotesSubmitted(false), 4000);
  };

  const getWhatsAppListText = () => {
    if (!activeMatch || !group) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
    
    let deadlineText = '';
    if (activeMatch.confirmationDeadline) {
      try {
        const d = new Date(activeMatch.confirmationDeadline);
        deadlineText = `\n⏰ *Prazo Limite:* ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      } catch {
        deadlineText = `\n⏰ *Prazo Limite:* ${activeMatch.confirmationDeadline}`;
      }
    }

    let text = `⚽ *PARCIAL DA LISTA - ${group.name.toUpperCase()}*\n`;
    text += `📅 *Data:* Toda ${group.matchDay} (${activeMatch.matchDate}) às ${activeMatch.startTime}\n`;
    if (group.fieldAddress) text += `📍 *Local:* ${group.fieldAddress}\n`;
    text += `📊 *Vagas:* ${confirmedList.length}/${maxSlots}${deadlineText}\n\n`;

    text += `📋 *CONFIRMADOS (${confirmedList.length}/${maxSlots}):*\n`;
    if (confirmedList.length === 0) {
      text += `_Nenhum atleta confirmou presença ainda._\n`;
    } else {
      confirmedList.forEach((att, idx) => {
        const pos = att.user.mainPosition ? ` (${att.user.mainPosition.toUpperCase()})` : '';
        const isGoleiro = (att.user.mainPosition || '').toLowerCase() === 'goleiro' ? ' 🧤' : '';
        const guestTag = att.isGuest ? ` _[Conv. de ${att.invitedByName || 'Associado'}]_` : '';
        text += `${idx + 1}. ${att.user.name}${pos}${isGoleiro}${guestTag}\n`;
      });
    }

    if (waitlistList.length > 0) {
      text += `\n⏳ *FILA DE ESPERA (${waitlistList.length}):*\n`;
      waitlistList.forEach((att, idx) => {
        const pos = att.user.mainPosition ? ` (${att.user.mainPosition.toUpperCase()})` : '';
        const guestTag = att.isGuest ? ` _[Conv. de ${att.invitedByName || 'Associado'}]_` : '';
        text += `${idx + 1}º. ${att.user.name}${pos}${guestTag}\n`;
      });
    }

    text += `\n👉 *Confirme sua presença no app:*\n${origin}/grupos/${group.id}/pelada\n`;
    return text;
  };

  const handleShareWhatsAppList = () => {
    const text = getWhatsAppListText();
    if (!text) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyList = () => {
    const text = getWhatsAppListText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedList(true);
    showToast('Parcial da lista copiada para a área de transferência! 📋', 'success');
    setTimeout(() => setCopiedList(false), 3000);
  };

  const rankings = MatchStatsService.getGroupRankings(group.id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header da Pelada & Status da Lista */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 uppercase">
              {group.soccerType} • {group.matchDay} às {group.matchTime}
            </span>
            {group.isOpenAttendance && activeMatch ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black uppercase flex items-center gap-1 shadow-sm">
                <Unlock className="w-3.5 h-3.5" /> Lista Aberta ({confirmedList.length}/{maxSlots} Vagas)
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Lista Fechada
              </span>
            )}

            {group.isOpenAttendance && activeMatch && formattedDeadline && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                isDeadlinePassed
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {isDeadlinePassed ? `Prazo Expirado (${formattedDeadline})` : `Confirmações até: ${formattedDeadline}`}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white">{group.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {activeMatch ? `Próximo jogo: ${activeMatch.matchDate} às ${activeMatch.startTime}` : 'Nenhuma lista de jogo aberta no momento.'}
          </p>
        </div>

          {/* Ações da Comissão / Atleta */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão da Comissão: Abrir ou Encerrar Lista */}
            {isDirector && (
              <>
                {!group.isOpenAttendance ? (
                  <button
                    type="button"
                    onClick={() => setOpenModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" /> Abrir Lista de Presença
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseAttendance}
                    className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-colors"
                  >
                    <Lock className="w-4 h-4" /> Encerrar Lista
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNewSlotsValue(maxSlots);
                    setEditSlotsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#121e2b] hover:bg-[#182737] border border-[#1e3247] text-slate-200 font-bold px-3 py-2.5 rounded-xl text-xs transition-colors"
                  title="Alterar limite de vagas da pelada"
                >
                  <Settings className="w-3.5 h-3.5 text-[#00b49f]" /> {maxSlots} Vagas
                </button>
              </>
            )}

            {/* Botão de Convidado: Disponível para associados confirmados ou diretoria */}
            {group.isOpenAttendance && activeMatch && (userAttendance?.status === 'confirmed' || isDirector) && (
              <button
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#00b49f]/15 hover:bg-[#00b49f]/25 border border-[#00b49f]/40 text-[#00b49f] font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> + Convidado
              </button>
            )}

            {/* Botão do Atleta: Confirmar ou Cancelar Presença */}
          {group.isOpenAttendance && activeMatch && (
            <>
              {userAttendance && userAttendance.status !== 'cancelled' ? (
                <button
                  type="button"
                  onClick={handleCancelPresence}
                  className="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors"
                >
                  ✕ Cancelar Minha Presença
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmPresence}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" /> Confirmar Minha Presença
                </button>
              )}
            </>
          )}

          {/* Botões de WhatsApp: Compartilhar Parcial & Copiar Lista */}
          {activeMatch && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleShareWhatsAppList}
                className="inline-flex items-center gap-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
                title="Compartilhar lista parcial formatada no WhatsApp"
              >
                <MessageCircle className="w-4 h-4 fill-[#25D366]" /> WhatsApp Parcial
              </button>

              <button
                type="button"
                onClick={handleCopyList}
                className="inline-flex items-center gap-1.5 bg-[#121e2b] hover:bg-[#182737] border border-[#1e3247] text-slate-200 font-bold px-3 py-2.5 rounded-xl text-xs transition-colors"
                title="Copiar texto da parcial da lista para a área de transferência"
              >
                {copiedList ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Check className="w-3.5 h-3.5" /> Copiado!
                  </span>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Copiar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navegação por Abas do Hub da Pelada */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
        {[
          { key: 'presenca', label: '📋 Lista & Presença', badge: confirmedList.length },
          { key: 'sorteio', label: '🏆 Sorteio de Times', badge: teams.length > 0 ? `${teams.length} Times` : undefined },
          { key: 'votacao', label: '⭐ Votação Pós-Jogo' },
          { key: 'sumula', label: '📊 Súmula & Estatísticas', directorOnly: true },
          { key: 'rankings', label: '🏅 Rankings & Hall da Fama' },
        ].map((tab) => {
          if (tab.directorOnly && !isDirector) return null;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-slate-950 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* ABA 1: LISTA & PRESENÇA */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'presenca' && (
        <div className="space-y-6">
          {!group.isOpenAttendance && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
              <Lock className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Lista de Presença Fechada</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                A comissão do grupo (Presidente, ADM ou Tesoureiro) abrirá a lista para a próxima pelada.
              </p>
            </div>
          )}

          {/* Banner de Ação Rápida WhatsApp Parcial */}
          {activeMatch && (
            <div className="bg-gradient-to-r from-[#121e2b] via-slate-900 to-[#121e2b] border border-[#1e3247] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] flex items-center justify-center font-bold flex-shrink-0">
                  <MessageCircle className="w-5 h-5 fill-[#25D366]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Parcial da Lista para WhatsApp
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Envie a lista atualizada com confirmados ({confirmedList.length}/{maxSlots}), fila e link do baba no grupo do WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleShareWhatsAppList}
                  className="flex-1 sm:flex-none bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#25D366]/20 transition-all active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </button>

                <button
                  type="button"
                  onClick={handleCopyList}
                  className="flex-1 sm:flex-none bg-[#0d1721] hover:bg-slate-800 border border-[#182737] text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedList ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> Copiado!
                    </span>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" /> Copiar Texto
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {isDeadlinePassed && group.isOpenAttendance && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 text-xs text-amber-300 flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Prazo de confirmação antecipada encerrado:</strong> Novos atletas que confirmarem presença entrarão automaticamente na <strong>Fila de Espera</strong>.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Confirmados */}
            <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Atletas Confirmados ({confirmedList.length} / {maxSlots})
                </h3>
                <span className="text-[11px] text-emerald-400 font-bold">
                  {maxSlots - confirmedList.length} vagas restantes
                </span>
              </div>

              {confirmedList.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center italic">
                  Nenhum atleta confirmou presença ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {confirmedList.map((att, idx) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            {att.user.name}
                            {att.user.mainPosition === 'goleiro' && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                🧤 Goleiro
                              </span>
                            )}
                            {att.isGuest && (
                              <span className="text-[10px] bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold">
                                🎟️ Convidado de {att.invitedByName || 'Associado'}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {att.user.mainPosition} • Perna: {att.user.dominantFoot} • Nota: {att.user.overallRating?.toFixed(1) || '7.0'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isDirector && (
                          <button
                            type="button"
                            onClick={() => handleDemoteToWaitlist(att.id, att.user.name)}
                            className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                            title="Mover para a fila de espera"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {att.isGuest && (att.invitedByUserId === currentUser?.id || isDirector) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuest(att.id, att.user.name)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remover convidado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
                          Confirmado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fila de Espera */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Fila de Espera ({waitlistList.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Promovidos automaticamente ou pela comissão.
                </p>
              </div>

              {waitlistList.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center italic">
                  Fila de espera vazia.
                </p>
              ) : (
                <div className="space-y-2">
                  {waitlistList.map((att, idx) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-300">
                          {idx + 1}º {att.user.name}
                        </span>
                        {att.isGuest && (
                          <span className="block text-[9px] text-[#00b49f]">
                            Convidado de {att.invitedByName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isDirector && (
                          <button
                            type="button"
                            onClick={() => handlePromoteToConfirmed(att.id, att.user.name)}
                            className="inline-flex items-center gap-1 bg-[#00b49f]/15 hover:bg-[#00b49f]/30 border border-[#00b49f]/40 text-[#00b49f] font-bold px-2 py-1 rounded-lg text-[10px] transition-all active:scale-95 shadow-sm"
                            title="Promover para a lista de confirmados"
                          >
                            <Check className="w-3 h-3" /> Confirmar
                          </button>
                        )}
                        {att.isGuest && (att.invitedByUserId === currentUser?.id || isDirector) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuest(att.id, att.user.name)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Remover convidado da fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                          Na Fila
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LISTA A PARTE: CONVIDADOS DA PELADA */}
            <div className="md:col-span-3 bg-[#121e2b] border border-[#1e3247] rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182737] pb-3">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-[#00b49f]" />
                    Lista de Convidados dos Associados ({guestList.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Convidados indicados pelos mensalistas para completar as vagas da pelada.
                  </p>
                </div>

                {group.isOpenAttendance && activeMatch && (
                  <button
                    type="button"
                    onClick={() => setGuestModalOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-[#00b49f]/20 self-start sm:self-auto"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> + Adicionar Convidado
                  </button>
                )}
              </div>

              {guestList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic bg-[#0d1721]/60 rounded-2xl border border-dashed border-[#182737] p-4">
                  Nenhum convidado adicionado até o momento. Como associado confirmado, você pode convidar amigos para a pelada!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {guestList.map((att) => (
                    <div
                      key={att.id}
                      className="p-4 rounded-2xl bg-[#0d1721] border border-[#182737] flex flex-col justify-between gap-3 text-xs shadow-sm hover:border-[#00b49f]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white text-sm">{att.user.name}</p>
                          <span className="inline-block mt-1 text-[10px] text-[#00b49f] font-bold bg-[#00b49f]/10 border border-[#00b49f]/20 px-2 py-0.5 rounded-full">
                            👤 Convidado por {att.invitedByName || 'Associado'}
                          </span>
                        </div>

                        {(att.invitedByUserId === currentUser?.id || isDirector) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuest(att.id, att.user.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remover convidado da lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-[#182737] pt-2">
                        <span className="capitalize font-semibold text-slate-300">
                          {att.user.mainPosition} • Nota {att.user.overallRating?.toFixed(1) || '6.5'}
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                            att.status === 'confirmed'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {att.status === 'confirmed' ? 'Confirmado na Pelada' : 'Fila de Espera'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* ABA 2: SORTEIO DE TIMES */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'sorteio' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Sorteio Inteligente com Balanceamento
              </h3>
              <p className="text-xs text-slate-400">
                Gera equipes equilibradas com base nas notas, distribuição de goleiros e zagueiros.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDrawTeams}
              disabled={confirmedList.length < 4}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Sortear Times Agora
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 space-y-2">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs">Clique em &ldquo;Sortear Times Agora&rdquo; para gerar a divisão equilibrada das equipes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teams.map((team, tIdx) => (
                <div
                  key={team.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-black text-white flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || '#10b981' }} />
                      {team.name}
                    </span>
                    <span className="text-xs bg-slate-950 px-2 py-0.5 rounded-md text-amber-400 font-bold">
                      Média: {team.averageRating.toFixed(1)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {team.players.map((p, pIdx) => (
                      <div
                        key={p.userId}
                        className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-mono">{pIdx + 1}.</span>
                          {p.user.name}
                          {p.user.mainPosition === 'goleiro' && ' 🧤'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.user.overallRating?.toFixed(1) || '7.0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* ABA 3: VOTAÇÃO PÓS-JOGO */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'votacao' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> Avaliação & Votação de Notas dos Boleiros
            </h3>
            <p className="text-xs text-slate-400">
              Dê nota de 1.0 a 10.0 e marque quem foi o Craque, Muralha ou Bagre da rodada.
            </p>
          </div>

          {votesSubmitted && (
            <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4" /> Votos computados com sucesso!
            </div>
          )}

          <form onSubmit={handleVoteSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {confirmedList.map((att) => (
                <div key={att.userId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <p className="font-bold text-white">{att.user.name}</p>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Nota (1 a 10):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="10.0"
                      defaultValue={7.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRatingVotes((prev) => ({
                          ...prev,
                          [att.userId]: { ...prev[att.userId], rating: val },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-amber-400 font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tag / Selo:</label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        setRatingVotes((prev) => ({
                          ...prev,
                          [att.userId]: { ...prev[att.userId], rating: prev[att.userId]?.rating || 7.0, tag: val },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-[11px]"
                    >
                      <option value="">Nenhum selo</option>
                      <option value="craque">👑 Craque da Rodada</option>
                      <option value="paredao">🧤 Muralha / Paredão</option>
                      <option value="garcom">👟 Garçom / Assistente</option>
                      <option value="xerife">🛡️ Xerife / Raça</option>
                      <option value="bagre">🐟 Bagre da Semana</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/20"
              >
                Enviar Meus Votos
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* ABA 4: SÚMULA & ESTATÍSTICAS (PREENCHIMENTO PELA COMISSÃO) */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'sumula' && isDirector && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" /> Súmula & Estatísticas Oficiais da Pelada
              </h3>
              <p className="text-xs text-slate-400">
                Preenchimento exclusivo da Comissão (Presidente, ADM e Tesoureiro) para alimentar os rankings.
              </p>
            </div>

            {statsSaved && (
              <span className="bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Súmula salva com sucesso!
              </span>
            )}
          </div>

          {playerStats.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center italic">
              Nenhum atleta confirmado na súmula desta partida.
            </p>
          ) : (
            <form onSubmit={handleSaveStats} className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Atleta</th>
                      <th className="py-2.5 px-2 text-center">⚽ Gols</th>
                      <th className="py-2.5 px-2 text-center">👟 Assist.</th>
                      <th className="py-2.5 px-2 text-center">🛡️ Xerife</th>
                      <th className="py-2.5 px-2 text-center">🧤 Defesas</th>
                      <th className="py-2.5 px-2 text-center">🟦 Azul</th>
                      <th className="py-2.5 px-2 text-center">🟥 Vermelho</th>
                      <th className="py-2.5 px-2 text-center">👑 MVP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {playerStats.map((st, idx) => (
                      <tr key={st.userId} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-white">
                          {st.userName}
                          <span className="text-[10px] text-slate-500 block capitalize">{st.userPosition}</span>
                        </td>

                        {/* Gols */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={st.goals}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].goals = v;
                              setPlayerStats(updated);
                            }}
                            className="w-12 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-emerald-400 font-bold"
                          />
                        </td>

                        {/* Assistências */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={st.assists}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].assists = v;
                              setPlayerStats(updated);
                            }}
                            className="w-12 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-teal-400 font-bold"
                          />
                        </td>

                        {/* Xerife / Desarmes */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={st.tackles}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].tackles = v;
                              setPlayerStats(updated);
                            }}
                            className="w-12 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-indigo-400 font-bold"
                          />
                        </td>

                        {/* Paredão / Defesas */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={st.saves}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].saves = v;
                              setPlayerStats(updated);
                            }}
                            className="w-12 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-amber-400 font-bold"
                          />
                        </td>

                        {/* Cartões Azuis */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="2"
                            value={st.yellowCards}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].yellowCards = v;
                              setPlayerStats(updated);
                            }}
                            className="w-10 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-blue-400 font-bold"
                          />
                        </td>

                        {/* Cartões Vermelhos */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="1"
                            value={st.redCards}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              const updated = [...playerStats];
                              updated[idx].redCards = v;
                              setPlayerStats(updated);
                            }}
                            className="w-10 bg-slate-950 border border-slate-800 rounded-lg p-1 text-center text-rose-400 font-bold"
                          />
                        </td>

                        {/* MVP */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={st.isMvp}
                            onChange={(e) => {
                              const updated = [...playerStats];
                              updated[idx].isMvp = e.target.checked;
                              setPlayerStats(updated);
                            }}
                            className="w-4 h-4 accent-amber-500 rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <Save className="w-4 h-4" /> Salvar Súmula da Partida
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* ABA 5: RANKINGS & HALL DA FAMA */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'rankings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Artilheiro (Gols) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase">
                  ⚽ Artilheiro da Pelada
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Gols Feitos</span>
              </div>

              {rankings.topScorers.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum gol registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.topScorers.slice(0, 5).map((r, i) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="text-amber-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}</span>
                        {r.userName}
                      </span>
                      <span className="font-black text-emerald-400 font-mono">{r.count} gols</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Garçom / Assistente */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-teal-400 flex items-center gap-1.5 uppercase">
                  👟 Garçom / Assistências
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Passes pra Gol</span>
              </div>

              {rankings.topAssists.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhuma assistência.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.topAssists.slice(0, 5).map((r, i) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="text-teal-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}</span>
                        {r.userName}
                      </span>
                      <span className="font-black text-teal-400 font-mono">{r.count} assist.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Xerife (Desarmes / Raça) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-indigo-400 flex items-center gap-1.5 uppercase">
                  🛡️ Xerife da Zaga
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Desarmes / Raça</span>
              </div>

              {rankings.topTackles.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum desarme registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.topTackles.slice(0, 5).map((r, i) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="text-indigo-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}</span>
                        {r.userName}
                      </span>
                      <span className="font-black text-indigo-400 font-mono">{r.count} desarmes</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Paredão (Goleiro) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase">
                  🧤 Paredão / Goleiro
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Defesas Difíceis</span>
              </div>

              {rankings.topKeepers.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhuma defesa registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.topKeepers.slice(0, 5).map((r, i) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="text-amber-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}</span>
                        {r.userName}
                      </span>
                      <span className="font-black text-amber-400 font-mono">{r.count} defesas</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Craque / MVP */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
                  👑 Craque / MVP
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Eleito Melhor em Campo</span>
              </div>

              {rankings.topMvps.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum MVP eleito.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.topMvps.slice(0, 5).map((r, i) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="text-amber-300">👑</span>
                        {r.userName}
                      </span>
                      <span className="font-black text-amber-300 font-mono">{r.count}x Craque</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Cartões / Disciplina */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-blue-400 flex items-center gap-1.5 uppercase">
                  🟦🟥 Cartões & Disciplina
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Faltas e Punições</span>
              </div>

              {rankings.cardsSummary.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum cartão aplicado.</p>
              ) : (
                <div className="space-y-1.5">
                  {rankings.cardsSummary.slice(0, 5).map((r) => (
                    <div key={r.userId} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60">
                      <span className="font-bold text-white">{r.userName}</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {r.yellowCards > 0 && <span className="text-blue-400">🟦 {r.yellowCards}</span>}
                        {r.redCards > 0 && <span className="text-rose-400">🟥 {r.redCards}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ABRIR LISTA DE PRESENÇA PELA COMISSÃO */}
      {openModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Abrir Lista de Presença da Pelada
              </h3>
              <button onClick={() => setOpenModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Data da Pelada</label>
                <input
                  type="date"
                  value={openMatchData.matchDate}
                  onChange={(e) => setOpenMatchData({ ...openMatchData, matchDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Horário de Início</label>
                  <input
                    type="time"
                    value={openMatchData.startTime}
                    onChange={(e) => setOpenMatchData({ ...openMatchData, startTime: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-400 uppercase mb-1 font-bold">Limite de Vagas</label>
                  <input
                    type="number"
                    min="10"
                    max="50"
                    value={openMatchData.maxPlayers}
                    onChange={(e) => setOpenMatchData({ ...openMatchData, maxPlayers: parseInt(e.target.value, 10) || 24 })}
                    required
                    className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Prazo Limite de Confirmação */}
              <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Prazo Limite de Confirmação
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={openMatchData.hasDeadline}
                      onChange={(e) => setOpenMatchData({ ...openMatchData, hasDeadline: e.target.checked })}
                      className="rounded accent-amber-500"
                    />
                    Ativar Prazo
                  </label>
                </div>

                {openMatchData.hasDeadline && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Data Limite</label>
                      <input
                        type="date"
                        value={openMatchData.deadlineDate}
                        onChange={(e) => setOpenMatchData({ ...openMatchData, deadlineDate: e.target.value })}
                        required={openMatchData.hasDeadline}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Horário Limite</label>
                      <input
                        type="time"
                        value={openMatchData.deadlineTime}
                        onChange={(e) => setOpenMatchData({ ...openMatchData, deadlineTime: e.target.value })}
                        required={openMatchData.hasDeadline}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono font-semibold"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 leading-tight">
                  💡 Atletas que confirmarem <strong>após este prazo</strong> entrarão direto na <strong>fila de espera</strong>, mesmo que ainda restem vagas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20"
                >
                  Confirmar Abertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTAR LIMITE DE VAGAS PELA COMISSÃO */}
      {editSlotsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#121e2b] border border-[#1e3247] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#182737] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#00b49f]" /> Limite de Vagas
              </h3>
              <button onClick={() => setEditSlotsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSlotsDirect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Quantidade Total de Vagas
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSlotsValue((v) => Math.max(6, v - 2))}
                    className="w-10 h-10 rounded-xl bg-[#0d1721] border border-[#182737] text-white font-bold text-lg hover:border-[#00b49f] transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="6"
                    max="60"
                    value={newSlotsValue}
                    onChange={(e) => setNewSlotsValue(parseInt(e.target.value, 10) || 24)}
                    required
                    className="flex-1 bg-[#0d1721] border border-[#00b49f]/60 rounded-xl px-3 py-2 text-center text-lg font-black text-[#00b49f] focus:outline-none focus:border-[#00b49f]"
                  />
                  <button
                    type="button"
                    onClick={() => setNewSlotsValue((v) => Math.min(60, v + 2))}
                    className="w-10 h-10 rounded-xl bg-[#0d1721] border border-[#182737] text-white font-bold text-lg hover:border-[#00b49f] transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Define o total de vagas principais ({newSlotsValue} vagas). Os atletas seguintes entrarão automaticamente na fila de espera.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#182737]">
                <button
                  type="button"
                  onClick={() => setEditSlotsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95"
                >
                  Salvar Vagas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR CONVIDADO */}
      {guestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#121e2b] border border-[#1e3247] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#182737] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#00b49f]" /> Adicionar Convidado
                </h3>
                <p className="text-[11px] text-slate-400">
                  Cadastre o convidado do associado para a lista da pelada.
                </p>
              </div>
              <button onClick={() => setGuestModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddGuestSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome do Convidado *
                </label>
                <input
                  type="text"
                  value={guestForm.name}
                  onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                  placeholder="Ex: Matheus Oliveira"
                  required
                  className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Posição Principal
                  </label>
                  <select
                    value={guestForm.position}
                    onChange={(e) => setGuestForm({ ...guestForm, position: e.target.value as UserPosition })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00b49f]"
                  >
                    <option value="goleiro">🧤 Goleiro</option>
                    <option value="zagueiro">🛡️ Zagueiro</option>
                    <option value="lateral">🏃 Lateral</option>
                    <option value="volante">⚓ Volante</option>
                    <option value="meia">🎯 Meia</option>
                    <option value="atacante">⚡ Atacante</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Pé Dominante
                  </label>
                  <select
                    value={guestForm.dominantFoot}
                    onChange={(e) => setGuestForm({ ...guestForm, dominantFoot: e.target.value as DominantFoot })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00b49f]"
                  >
                    <option value="destro">Destro</option>
                    <option value="canhoto">Canhoto</option>
                    <option value="ambidestro">Ambidestro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Nota Técnica (1 - 10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={guestForm.overallRating}
                    onChange={(e) => setGuestForm({ ...guestForm, overallRating: parseFloat(e.target.value) || 6.5 })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    WhatsApp (Opcional)
                  </label>
                  <input
                    type="text"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
              </div>

              <div className="bg-[#0d1721]/80 border border-[#182737] rounded-xl p-2.5 text-[11px] text-slate-400">
                👤 <strong className="text-slate-200">Responsável pelo convite:</strong> {currentUser?.name}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#182737]">
                <button
                  type="button"
                  onClick={() => setGuestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-[#00b49f]/20 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Adicionar na Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
