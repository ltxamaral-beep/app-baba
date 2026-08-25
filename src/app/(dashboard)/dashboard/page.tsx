'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  GroupService, 
  UserService, 
  MatchService, 
  FinanceService,
  NotificationService 
} from '@/lib/services/storage-service';
import { 
  Group, 
  GroupMember, 
  Match, 
  MatchAttendance, 
  UserProfile, 
  FinancialTransaction,
  AppNotification 
} from '@/types';
import { formatCurrency } from '@/lib/utils/masks';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { 
  matchTransactionPeriod, 
  MONTH_NAMES, 
  FinancePeriodType, 
  getAvailableYears 
} from '@/lib/utils/finance-utils';
import { 
  Users, 
  Calendar, 
  Clock, 
  DollarSign, 
  Trophy, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  PlusCircle, 
  Search, 
  User, 
  Sparkles, 
  MapPin, 
  Award, 
  Zap, 
  Lock, 
  Unlock, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Check, 
  Share2, 
  Copy, 
  MessageCircle, 
  Settings, 
  Trash2, 
  AlertCircle,
  Bell,
  UserPlus
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userGroups, setUserGroups] = useState<Array<{ group: Group; member: GroupMember }>>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [dashboardNotifs, setDashboardNotifs] = useState<AppNotification[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [attendances, setAttendances] = useState<MatchAttendance[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // Modal de Exclusão de Grupo
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Modal para comissão abrir a lista de presença direto pelo painel
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [openMatchData, setOpenMatchData] = useState({
    matchDate: new Date().toISOString().split('T')[0],
    startTime: '20:00',
    maxPlayers: 24,
    deadlineDate: new Date().toISOString().split('T')[0],
    deadlineTime: '12:00',
    hasDeadline: true,
  });

  // Filtro de Período Financeiro no Dashboard
  const [financePeriodType, setFinancePeriodType] = useState<FinancePeriodType>('monthly');
  const [financeSelectedYear, setFinanceSelectedYear] = useState<number>(new Date().getFullYear());
  const [financeSelectedMonth, setFinanceSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const loadInFlight = useRef(false);

  const loadDashboardData = async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
    const currentUser = UserService.getCurrentUser();
    setUser(currentUser);

    // Renderiza o estado local imediatamente
    let groups = GroupService.getUserGroups(currentUser.id);
    setUserGroups(groups);

    let activeId = GroupService.getActiveGroupId();
    let currentActive: Group | null = null;
    let currentMem: GroupMember | null = null;

    if (activeId && groups.some((g) => g.group.id === activeId)) {
      const activeObj = groups.find((g) => g.group.id === activeId);
      if (activeObj) {
        currentActive = activeObj.group;
        currentMem = activeObj.member;
      }
    } else if (groups.length > 0) {
      currentActive = groups[0].group;
      currentMem = groups[0].member;
      GroupService.setActiveGroupId(groups[0].group.id);
    }

    if (currentActive) {
      setActiveGroup(currentActive);
      setCurrentMember(currentMem);

      if (!isSupabaseConfigured) {
        const matches = MatchService.getMatches(currentActive.id);
        if (matches.length > 0) {
          setNextMatch(matches[0]);
          setAttendances(MatchService.getAttendances(matches[0].id));
        } else {
          setNextMatch(null);
          setAttendances([]);
        }
      }

      setTransactions(FinanceService.getTransactions(currentActive.id));
      setOpenMatchData((prev) => ({
        ...prev,
        startTime: currentActive?.matchTime || '20:00',
        maxPlayers: currentActive?.maxSlots || (currentActive?.playersPerTeam ? currentActive.playersPerTeam * 3 : 18),
      }));
    }

    // Carrega notificações em tempo real
    setDashboardNotifs(NotificationService.getNotifications(currentActive?.id || activeId || undefined));

    // Sincroniza em segundo plano com a nuvem
    try {
      const cloudGroups = await GroupService.syncAllWithCloud();
      setUserGroups(cloudGroups);

      const newActiveId = GroupService.getActiveGroupId();
      let targetG = currentActive;
      if (newActiveId && cloudGroups.some((g) => g.group.id === newActiveId)) {
        const found = cloudGroups.find((g) => g.group.id === newActiveId);
        if (found) {
          targetG = found.group;
          setActiveGroup(found.group);
          setCurrentMember(found.member);
        }
      }

      if (targetG) {
        const cloudMatches = await MatchService.syncMatchesFromCloud(targetG.id);
        if (cloudMatches && cloudMatches.length > 0) {
          const openMatch = cloudMatches.find((m) => m.status === 'scheduled') || cloudMatches[0];
          setNextMatch(openMatch);
          const cloudAtts = await MatchService.syncAttendancesFromCloud(openMatch.id);
          setAttendances(cloudAtts);
        } else {
          setNextMatch(null);
          setAttendances([]);
        }

        const cloudTrans = await FinanceService.syncTransactionsFromCloud(targetG.id);
        if (cloudTrans && cloudTrans.length > 0) {
          setTransactions(cloudTrans);
        }
      }
    } catch (e) {
      console.warn('Erro ao sincronizar dashboard com nuvem:', e);
    }
    } finally {
      loadInFlight.current = false;
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000);

    const handleGroupChanged = () => {
      loadDashboardData();
    };

    window.addEventListener('active_group_changed', handleGroupChanged);
    window.addEventListener('user_profile_updated', handleGroupChanged);
    window.addEventListener('storage', handleGroupChanged);

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('dashboard_realtime_stream')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_attendances' }, () => {
          loadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
          loadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => {
          loadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
          loadDashboardData();
        })
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('active_group_changed', handleGroupChanged);
      window.removeEventListener('user_profile_updated', handleGroupChanged);
      window.removeEventListener('storage', handleGroupChanged);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Anos disponíveis (Hook chamado sempre no topo)
  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);

  // Transações filtradas pelo período selecionado no Dashboard (Hook chamado sempre no topo)
  const periodFilteredTransactions = useMemo(() => {
    return (transactions || []).filter((t) => matchTransactionPeriod(t, financePeriodType, financeSelectedYear, financeSelectedMonth));
  }, [transactions, financePeriodType, financeSelectedYear, financeSelectedMonth]);

  const currentPeriodLabel = useMemo(() => {
    if (financePeriodType === 'all') return 'Todo o Histórico (Geral)';
    if (financePeriodType === 'yearly') return `Ano de ${financeSelectedYear}`;
    const mName = MONTH_NAMES[(financeSelectedMonth || 1) - 1] || 'Mês';
    return `${mName} de ${financeSelectedYear}`;
  }, [financePeriodType, financeSelectedMonth, financeSelectedYear]);

  // -------------------------------------------------------------
  // ESTADO 1: NOVO USUÁRIO COM 0 GRUPOS (ONBOARDING)
  // -------------------------------------------------------------
  if (userGroups.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-4">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
          
          <div className="max-w-xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Bem-vindo, {user?.name?.split(' ')[0] || 'Atleta'}!
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
              Tudo pronto para a sua pelada subir de nível.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Você ainda não faz parte de nenhum grupo. Escolha uma das opções abaixo para começar agora mesmo:
            </p>
          </div>
        </div>

        {/* 3 Opções de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Opção 1: Procurar / Entrar em Grupo */}
          <Link
            href="/grupos/buscar"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xl font-bold border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <Search className="w-6 h-6" />
              </div>
              <h2 className="text-base font-black text-white">Entrar com Código</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Já tem o código de convite enviado pelo organizador no WhatsApp? Digite aqui e entre direto na lista.
              </p>
            </div>

            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              Entrar em um Grupo <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Opção 2: Criar Meu Próprio Grupo */}
          <Link
            href="/grupos/novo"
            className="group bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center text-xl font-bold border border-teal-500/30 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-black text-white">Criar Meu Grupo</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Você é o organizador? Crie o grupo da sua pelada, seja o <strong>Presidente</strong> e defina regras e mensalidades.
              </p>
            </div>

            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-teal-400">
              Criar Novo Grupo <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Opção 3: Meu Perfil de Atleta */}
          <Link
            href="/perfil"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-xl font-bold border border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-slate-950 transition-colors">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-base font-black text-white">Meu Perfil</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Confira sua posição em campo (<strong>{user?.mainPosition || 'Meia'}</strong>), perna dominante e dados para o algoritmo de sorteio.
              </p>
            </div>

            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-400">
              Ver e Editar Perfil <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ESTADO 2: USUÁRIO COM GRUPO SELECIONADO
  // -------------------------------------------------------------
  const isDirector = currentMember?.role === 'presidente' || currentMember?.role === 'adm' || currentMember?.role === 'tesoureiro';
  const confirmedCount = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present').length;
  const guestCount = attendances.filter((a) => a.isGuest && (a.status === 'confirmed' || a.status === 'present')).length;
  const maxSlots = nextMatch?.maxPlayers || activeGroup?.maxSlots || 24;
  const isAttendanceOpen = !!((nextMatch && nextMatch.status === 'scheduled') || activeGroup?.isOpenAttendance);

  // Cálculos Financeiros do Período Selecionado
  const periodIncome = periodFilteredTransactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((a, b) => a + b.amount, 0);

  const periodExpenses = periodFilteredTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((a, b) => a + b.amount, 0);

  const periodNet = periodIncome - periodExpenses;

  // Saldo Total Geral Acumulado no Caixa
  const totalAllTimeIncome = (transactions || []).filter((t) => t.type === 'income' && t.status === 'paid').reduce((a, b) => a + b.amount, 0);
  const totalAllTimeExpenses = (transactions || []).filter((t) => t.type === 'expense' && t.status === 'paid').reduce((a, b) => a + b.amount, 0);
  const netBalance = totalAllTimeIncome - totalAllTimeExpenses;

  // Membros Inadimplentes / Débitos Pendentes
  const overdueTransactions = periodFilteredTransactions.filter((t) => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'));
  const userPendingTransaction = (transactions || []).find((t) => 
    t.status !== 'paid' && (
      (t.userId && (t.userId === user?.id || t.userId === currentMember?.userId)) ||
      (user?.name && t.userName && t.userName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
      (user?.name && user.name.trim().length > 3 && t.description && t.description.toLowerCase().includes(user.name.trim().toLowerCase()))
    )
  );

  const isPresident = currentMember?.role === 'presidente' || activeGroup?.createdBy === user?.id;

  const handleDeleteGroupDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      setDeleteError('Digite exatamente a palavra EXCLUIR para confirmar.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    const result = await GroupService.deleteGroup(activeGroup.id);
    if (result.success) {
      setDeleteModalOpen(false);
      setDeleteLoading(false);
      loadDashboardData();
    } else {
      setDeleteError(result.error || 'Erro ao excluir grupo.');
      setDeleteLoading(false);
    }
  };

  const handleOpenAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;

    const newSlots = Number(openMatchData.maxPlayers) || 24;
    await GroupService.updateGroup(activeGroup.id, { maxSlots: newSlots, isOpenAttendance: true });

    let confirmationDeadline: string | undefined = undefined;
    if (openMatchData.hasDeadline && openMatchData.deadlineDate) {
      confirmationDeadline = `${openMatchData.deadlineDate}T${openMatchData.deadlineTime || '12:00'}:00`;
    }

    await MatchService.openMatchAttendance(
      activeGroup.id,
      openMatchData.matchDate,
      openMatchData.startTime,
      newSlots,
      activeGroup.dailyFee || 25,
      confirmationDeadline
    );

    setOpenModalOpen(false);
    await loadDashboardData();
  };

  return (
    <div className="space-y-6">
      {/* Header do Grupo Ativo & Cargo */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 uppercase">
              {activeGroup?.soccerType}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-300 font-bold border border-slate-800">
              {activeGroup?.matchDay} às {activeGroup?.matchTime}
            </span>
            {currentMember && currentMember.status === 'pending_approval' ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 uppercase flex items-center gap-1 animate-pulse">
                ⏳ AGUARDANDO APROVAÇÃO DA DIRETORIA
              </span>
            ) : currentMember ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 uppercase flex items-center gap-1">
                👑 Seu Cargo: {currentMember.role.toUpperCase()}
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{activeGroup?.name}</h1>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500" /> {activeGroup?.fieldAddress}
          </p>

          {/* Seletor Rápido de Grupos no Painel */}
          {userGroups.length > 1 && (
            <div className="pt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold">Alternar Pelada:</span>
              {userGroups.map((ug) => (
                <button
                  key={ug.group.id}
                  type="button"
                  onClick={() => {
                    GroupService.setActiveGroupId(ug.group.id);
                    loadDashboardData();
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    ug.group.id === activeGroup?.id
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-300'
                  }`}
                >
                  ⚽ {ug.group.name}
                </button>
              ))}
            </div>
          )}

          {/* Botões de Ação Rápida do Grupo (Editar Parâmetros & Excluir) */}
          {isDirector && activeGroup && (
            <div className="flex items-center gap-2 pt-3 flex-wrap">
              <Link
                href={`/grupos/${activeGroup.id}/configuracoes`}
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" /> Editar Parâmetros & Vagas
              </Link>

              {isPresident && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmText('');
                    setDeleteError(null);
                    setDeleteModalOpen(true);
                  }}
                  className="bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 hover:border-rose-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Excluir Grupo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Código de Convite & Compartilhamento WhatsApp */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:items-end gap-2.5">
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Código de Convite</span>
            <span className="text-xs font-black font-mono text-emerald-400 tracking-wider bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40">
              {activeGroup?.inviteCode}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                if (!activeGroup) return;
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
                const link = `${origin}/convite/${activeGroup.inviteCode}`;
                const text = `⚽ *Convite para a Pelada: ${activeGroup.name}*\n📅 Toda ${activeGroup.matchDay} às ${activeGroup.matchTime}\n📍 Local: ${activeGroup.fieldAddress}\n\nEntre no grupo pelo link abaixo para confirmar presença:\n👉 ${link}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              title="Compartilhar Convite no WhatsApp"
              className="flex-1 sm:flex-none bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" /> Convite
            </button>

            <button
              type="button"
              onClick={() => {
                if (!activeGroup) return;
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
                const link = `${origin}/convite/${activeGroup.inviteCode}`;
                navigator.clipboard.writeText(link);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 3000);
              }}
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              {copiedInvite ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Copiado!
                </span>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copiar Link
                </>
              )}
            </button>

            {activeGroup?.whatsappGroupUrl && (
              <a
                href={activeGroup.whatsappGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Acessar Grupo do WhatsApp do Baba"
                className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#25D366]/20"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-slate-950" /> WhatsApp do Baba
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Membro Pendente de Aprovação */}
      {currentMember?.status === 'pending_approval' && (
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xl font-bold flex-shrink-0">
              ⏳
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Solicitação de Entrada em Análise pela Diretoria
              </h2>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Você solicitou entrada no grupo <strong>{activeGroup?.name}</strong>. Para garantir a organização e segurança do baba, todo novo membro precisa da aprovação do <strong>Presidente, Tesoureiro ou ADM</strong>.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="font-bold text-amber-400">O que acontece agora?</div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>Os diretores já receberam sua solicitação na Central de Notificações e no Quadro de Membros.</li>
              <li>Assim que aprovado, sua presença nas listas de jogos e nos sorteios de times será liberada automaticamente.</li>
            </ul>
          </div>

          {activeGroup?.whatsappGroupUrl && (
            <div className="pt-1">
              <a
                href={activeGroup.whatsappGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-[#25D366]/20 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950" /> Falar com a Diretoria no WhatsApp do Baba
              </a>
            </div>
          )}
        </div>
      )}

      {/* ALERTA DE COBRANÇA DIRETA PARA O MEMBRO */}
      {userPendingTransaction && (
        <div className="bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border border-rose-500/50 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold flex-shrink-0 text-xl">
              💳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-slate-950">
                  Cobrança Pendente
                </span>
                <span className="text-xs text-slate-400">
                  Vencimento: {userPendingTransaction.dueDate ? new Date(userPendingTransaction.dueDate).toLocaleDateString('pt-BR') : 'A vencer'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                {userPendingTransaction.description || 'Mensalidade do Baba'}
              </h3>
              <p className="text-xs text-rose-300 mt-0.5">
                Valor a pagar: <strong className="text-white text-sm">{formatCurrency(userPendingTransaction.amount)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeGroup?.pixKey && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeGroup.pixKey || '');
                  alert(`Chave PIX copiada: ${activeGroup.pixKey}`);
                }}
                className="flex-1 sm:flex-none bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                Copiar PIX ({activeGroup.pixKeyType?.toUpperCase() || 'PIX'})
              </button>
            )}

            <Link
              href={`/grupos/${activeGroup?.id}/financas`}
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              Ver Detalhes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. MÓDULO FINANCEIRO (SALDO, RECEITA, DESPESA & DÉBITOS COM FILTRO DE PERÍODO) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              💰
            </div>
            <div>
              <h2 className="text-base font-black text-white">Resumo Financeiro & Caixa</h2>
              <p className="text-xs text-slate-400">
                Período: <strong className="text-[#00b49f]">{currentPeriodLabel}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Período (Mensal / Anual / Geral) */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFinancePeriodType('monthly')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  financePeriodType === 'monthly'
                    ? 'bg-[#00b49f] text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setFinancePeriodType('yearly')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  financePeriodType === 'yearly'
                    ? 'bg-[#00b49f] text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anual
              </button>
              <button
                type="button"
                onClick={() => setFinancePeriodType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  financePeriodType === 'all'
                    ? 'bg-[#00b49f] text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Geral
              </button>
            </div>

            {/* Seletores de Mês e Ano */}
            {financePeriodType === 'monthly' && (
              <select
                value={financeSelectedMonth}
                onChange={(e) => setFinanceSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white font-bold focus:outline-none focus:border-[#00b49f]"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>
            )}

            {(financePeriodType === 'monthly' || financePeriodType === 'yearly') && (
              <select
                value={financeSelectedYear}
                onChange={(e) => setFinanceSelectedYear(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white font-bold font-mono focus:outline-none focus:border-[#00b49f]"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            )}

            {isDirector && (
              <Link
                href={`/grupos/${activeGroup?.id}/financas`}
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 px-3 py-1 rounded-xl transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Detalhes & Extrato
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Saldo do Período */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> 
              {financePeriodType === 'all' ? 'Saldo Total em Caixa' : 'Saldo no Período'}
            </span>
            <p className={`text-2xl font-black ${(financePeriodType === 'all' ? netBalance : periodNet) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(financePeriodType === 'all' ? netBalance : periodNet)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {financePeriodType === 'all' ? 'Todo o histórico da pelada' : `Receitas - Despesas (${currentPeriodLabel})`}
            </p>
          </div>

          {/* Receitas do Período */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Receitas ({financePeriodType === 'all' ? 'Total' : 'Período'})
            </span>
            <p className="text-2xl font-black text-white">
              {formatCurrency(financePeriodType === 'all' ? totalAllTimeIncome : periodIncome)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Mensalidades, diárias & entradas pagas</p>
          </div>

          {/* Despesas do Período */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] text-rose-400 font-bold uppercase flex items-center gap-1 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Despesas ({financePeriodType === 'all' ? 'Total' : 'Período'})
            </span>
            <p className="text-2xl font-black text-rose-400">
              {formatCurrency(financePeriodType === 'all' ? totalAllTimeExpenses : periodExpenses)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Quadra, juiz, água e custos pagos</p>
          </div>
        </div>

        {/* Membros com Débito / Em Atraso */}
        <div className="pt-2">
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Membros com Débito ou em Atraso ({overdueTransactions.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Total pendente no período: <strong>{formatCurrency(overdueTransactions.reduce((a, b) => a + b.amount, 0))}</strong>
              </span>
            </div>

            {overdueTransactions.length === 0 ? (
              <p className="text-xs text-emerald-400 font-semibold py-2">
                ✓ Nenhum débito em aberto para o período ({currentPeriodLabel}).
              </p>
            ) : (
              <div className="divide-y divide-slate-900 max-h-40 overflow-y-auto pr-1">
                {overdueTransactions.map((tx) => {
                  const catEmoji = 
                    tx.category === 'cartao_azul' ? '🟦' :
                    tx.category === 'cartao_vermelho' ? '🟥' :
                    tx.category === 'cartao_amarelo' ? '🟨' :
                    tx.category === 'multa_atraso' ? '⏰' :
                    tx.category === 'multa_falta' ? '⏳' :
                    tx.category === 'diaria' ? '🎟️' :
                    tx.category === 'uniforme' ? '👕' : '⭐';

                  return (
                    <div key={tx.id} className="py-2 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{catEmoji}</span>
                        <span className="text-slate-200 font-medium truncate">
                          {tx.userName || 'Atleta'} <span className="text-slate-500 text-[10px]">({tx.description})</span>
                        </span>
                      </div>
                      <span className="text-rose-400 font-mono font-bold whitespace-nowrap">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CENTRAL DE NOTIFICAÇÕES & ATIVIDADES EM TEMPO REAL */}
      {/* ------------------------------------------------------------- */}
      {dashboardNotifs.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Central de Atividades & Notificações Recentes</h3>
                <p className="text-[11px] text-slate-400">Solicitações de entrada, presenças confirmadas e chegadas ao campo em tempo real.</p>
              </div>
            </div>

            {dashboardNotifs.filter((n) => !n.read).length > 0 && (
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {dashboardNotifs.filter((n) => !n.read).length} novo alerta
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dashboardNotifs.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className={`border rounded-2xl p-3.5 flex flex-col justify-between gap-2 transition-all ${
                  n.read ? 'bg-slate-950/60 border-slate-800/60 opacity-80' : 'bg-slate-950/90 border-slate-700 shadow-md'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-900 flex-shrink-0 mt-0.5">
                    {n.type === 'member_request' ? (
                      <UserPlus className="w-4 h-4 text-amber-400" />
                    ) : n.type === 'match_opened' ? (
                      <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    ) : n.type === 'attendance_confirmed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : n.type === 'player_arrived' ? (
                      <MapPin className="w-4 h-4 text-sky-400" />
                    ) : (
                      <Bell className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">{n.title}</span>
                      <span className="text-[9px] text-slate-500">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-snug">{n.message}</p>
                  </div>
                </div>

                {n.type === 'member_request' && isDirector && n.data?.memberId && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={async () => {
                        await NotificationService.approveMemberRequest(activeGroup!.id, n.data!.memberId!);
                        loadDashboardData();
                      }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black py-1 px-2 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <Check className="w-3 h-3" /> Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await NotificationService.rejectMemberRequest(activeGroup!.id, n.data!.memberId!);
                        loadDashboardData();
                      }}
                      className="flex-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[10px] font-bold py-1 px-2 rounded-lg border border-rose-800/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      <X className="w-3 h-3" /> Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. CARD DA PRÓXIMA PELADA & STATUS DA LISTA DE PRESENÇA */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status da Lista de Presença */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" /> Próxima Pelada
              </span>
              {isAttendanceOpen ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Lista Aberta
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Lista Fechada
                </span>
              )}
            </div>

            {isAttendanceOpen ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-black text-white">
                    {confirmedCount} <span className="text-sm font-medium text-slate-400">/ {maxSlots} Vagas</span>
                  </p>
                  {guestCount > 0 && (
                    <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                      🎟️ {guestCount} {guestCount === 1 ? 'Convidado' : 'Convidados'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-400 font-semibold">
                  {maxSlots - confirmedCount > 0 ? `${maxSlots - confirmedCount} vagas disponíveis para o jogo!` : 'Vagas esgotadas! Fila de espera ativa.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-300">Aguardando Abertura da Chamada</p>
                <p className="text-xs text-slate-400">
                  A comissão da pelada abrirá a lista para confirmação dos atletas.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {isDirector && !isAttendanceOpen && (
              <button
                type="button"
                onClick={() => setOpenModalOpen(true)}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Zap className="w-4 h-4 fill-slate-950" /> Abrir Lista de Presença da Pelada
              </button>
            )}

            <Link
              href={`/grupos/${activeGroup?.id}/pelada`}
              className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trophy className="w-4 h-4 text-amber-400" /> Acessar Pelada, Sorteio & Rankings
            </Link>
          </div>
        </div>

        {/* Card: Meu Status Pessoal & Posição */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" /> Minha Situação de Atleta
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold capitalize">
                {user?.mainPosition || 'Meia'}
              </span>
            </div>

            <h3 className="text-lg font-black text-white">{user?.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Perna: <strong>{user?.dominantFoot}</strong> • Nota de Sorteio: <strong>{user?.overallRating?.toFixed(1) || '7.0'}</strong>
            </p>

            <div className="mt-3 pt-3 border-t border-slate-800">
              {userPendingTransaction ? (
                <div className="text-rose-400 text-xs">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Mensalidade / Diária Pendente
                  </span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Valor em aberto: {formatCurrency(userPendingTransaction.amount)}
                  </p>
                </div>
              ) : (
                <div className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Pagamentos 100% em dia
                </div>
              )}
            </div>
          </div>

          <Link
            href="/perfil"
            className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <User className="w-4 h-4 text-emerald-400" /> Editar Meu Perfil
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SEÇÃO: RESUMO DE MEMBROS ATIVOS & SOLICITAÇÕES DO GRUPO */}
      {/* ------------------------------------------------------------- */}
      {activeGroup && (() => {
        const groupMembers = GroupService.getMembers(activeGroup.id);
        const pendingMembers = groupMembers.filter((m) => m.status === 'pending_approval');
        const activeMembersList = groupMembers.filter((m) => m.status !== 'pending_approval');
        const totalActive = activeMembersList.length;
        const associadosCount = activeMembersList.filter((m) => m.role === 'associado' || (!['presidente', 'adm', 'tesoureiro', 'goleiro'].includes(m.role) && m.membershipType === 'associado')).length;
        const diaristasCount = activeMembersList.filter((m) => m.role === 'diarista' || m.membershipType === 'diarista').length;
        const goleirosCount = activeMembersList.filter((m) => m.role === 'goleiro' || m.membershipType === 'goleiro' || m.user.mainPosition === 'goleiro').length;
        const directorsCount = activeMembersList.filter((m) => ['presidente', 'adm', 'tesoureiro'].includes(m.role)).length;

        return (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-base">
                  👥
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    Quadro de Membros da Pelada
                  </h2>
                  <p className="text-xs text-slate-400">
                    O grupo possui <strong>{totalActive} atletas ativos</strong> cadastrados {pendingMembers.length > 0 ? `e ${pendingMembers.length} solicitação pendente` : ''}.
                  </p>
                </div>
              </div>

              {isDirector && (
                <Link
                  href={`/grupos/${activeGroup.id}/configuracoes?gerenciar=membros`}
                  className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> Gerenciar Membros & Cargos
                </Link>
              )}
            </div>

            {/* Grid de Contadores por Categoria */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Associados */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  ⭐ Associados
                </span>
                <p className="text-2xl font-black text-indigo-400">{associadosCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Mensalistas fixos</p>
              </div>

              {/* Diaristas */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  🎟️ Diaristas
                </span>
                <p className="text-2xl font-black text-amber-400">{diaristasCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Atletas por jogo</p>
              </div>

              {/* Goleiros */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  🧤 Goleiros
                </span>
                <p className="text-2xl font-black text-emerald-400">{goleirosCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Isentos / Ajuda</p>
              </div>

              {/* Diretoria */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  👑 Diretoria
                </span>
                <p className="text-2xl font-black text-amber-300">{directorsCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Comissão gestora</p>
              </div>

              {/* Solicitações Pendentes */}
              <div className={`border rounded-2xl p-4 transition-all col-span-2 sm:col-span-1 ${
                pendingMembers.length > 0
                  ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1 flex items-center gap-1">
                  <UserPlus className="w-3 h-3" /> Solicitações
                </span>
                <p className={`text-2xl font-black ${pendingMembers.length > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                  {pendingMembers.length}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Pedidos de entrada</p>
              </div>
            </div>

            {/* QUADRO INTERATIVO: SOLICITAÇÃO PARA ENTRADA NO GRUPO */}
            {pendingMembers.length > 0 ? (
              <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-amber-400" /> Solicitações para Entrada no Grupo ({pendingMembers.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">Aguardando aprovação da diretoria</span>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {pendingMembers.map((pm) => (
                    <div key={pm.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-xs">
                          👤
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {pm.user.name}
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-amber-300 uppercase font-semibold">
                              {pm.membershipType.toUpperCase()}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Posição: <strong className="text-emerald-400 uppercase">{pm.user.mainPosition}</strong> • Nota: <strong>{pm.user.overallRating?.toFixed(1) || '6.5'}</strong> • Pé: <strong>{pm.user.dominantFoot}</strong>
                          </p>
                        </div>
                      </div>

                      {isDirector && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await NotificationService.approveMemberRequest(activeGroup.id, pm.id);
                              loadDashboardData();
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" /> Aprovar Entrada
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await NotificationService.rejectMemberRequest(activeGroup.id, pm.id);
                              loadDashboardData();
                            }}
                            className="bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95"
                          >
                            <X className="w-3.5 h-3.5" /> Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/50 border border-slate-800/60 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <strong>Solicitações para Entrada no Grupo:</strong> Nenhuma solicitação pendente no momento.
                </span>
                <span className="text-[11px] text-slate-500 italic">Novos pedidos aparecerão aqui</span>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* MODAL: EXCLUSÃO DEFINITIVA DO GRUPO (APENAS CRIADOR / PRESIDENTE) */}
      {deleteModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-800/60 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Confirmar Exclusão do Grupo
              </h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Você está prestes a excluir o grupo <strong className="text-white font-bold">{activeGroup.name}</strong>. Todos os dados de atletas, peladas e finanças serão perdidos permanentemente.
            </p>

            <form onSubmit={handleDeleteGroupDashboard} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Para confirmar, digite <span className="text-rose-400 font-mono font-bold">EXCLUIR</span> no campo abaixo:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => {
                    setDeleteConfirmText(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  placeholder="EXCLUIR"
                  className="w-full bg-slate-950 border border-rose-900/60 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold uppercase focus:outline-none tracking-widest"
                />
              </div>

              {deleteError && (
                <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
                >
                  {deleteLoading ? 'Excluindo Grupo...' : (
                    <>
                      <Trash2 className="w-4 h-4" /> Sim, Excluir Grupo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
