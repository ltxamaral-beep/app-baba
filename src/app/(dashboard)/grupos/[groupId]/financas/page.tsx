'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FinanceService, 
  GroupService 
} from '@/lib/services/storage-service';
import { formatCurrency } from '@/lib/utils/masks';
import { 
  FinancialTransaction, 
  GroupMember, 
  TransactionCategory,
  TransactionType,
  PaymentStatus
} from '@/types';
import { 
  matchTransactionPeriod, 
  MONTH_NAMES, 
  FinancePeriodType, 
  getAvailableYears 
} from '@/lib/utils/finance-utils';
import { showToast } from '@/components/ui/Toast';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Unlock, 
  Calendar,
  Filter,
  Sparkles,
  Zap,
  X,
  User,
  Check,
  Tag,
  ShieldAlert,
  Coins,
  Shirt,
  Flame,
  Award,
  History,
  Archive,
  Edit3,
  Trash2,
  Save,
  BarChart3
} from 'lucide-react';

const CATEGORY_LABELS: Record<TransactionCategory, { label: string; icon: string; badgeColor: string }> = {
  mensalidade: { label: 'Mensalidade', icon: '⭐', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  diaria: { label: 'Diária de Jogo', icon: '🎟️', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  cartao_azul: { label: 'Cartão Azul', icon: '🟦', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  cartao_vermelho: { label: 'Cartão Vermelho', icon: '🟥', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  cartao_amarelo: { label: 'Cartão Amarelo', icon: '🟨', badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  multa_atraso: { label: 'Multa por Atraso', icon: '⏰', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  multa_falta: { label: 'Multa por Falta / W.O.', icon: '⏳', badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40' },
  uniforme: { label: 'Uniforme / Colete', icon: '👕', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  patrocinio: { label: 'Patrocínio / Doação', icon: '🤝', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  saldo_inicial: { label: 'Saldo Inicial / Migração', icon: '🏦', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  ajuda_custo_goleiro: { label: 'Pagamento Goleiro', icon: '🧤', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  arbitragem: { label: 'Arbitragem / Juiz', icon: '⚖️', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  agua_gelo: { label: 'Água / Gelo', icon: '💧', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  aluguel_campo: { label: 'Aluguel Quadra/Campo', icon: '🏟️', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  material: { label: 'Bolas & Material', icon: '⚽', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  churrasco: { label: 'Churrasco & Resenha', icon: '🍖', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  outros: { label: 'Outros Custos/Entradas', icon: '📦', badgeColor: 'bg-slate-800 text-slate-300 border-slate-700' },
};

export default function FinancesPage({ params }: { params: { groupId: string } }) {
  const groupId = params.groupId || 'group-1';
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'inadimplentes' | 'cartoes' | 'mensalidades' | 'diarias' | 'saldo_inicial' | 'expenses'>('all');
  
  // ---------------------------------------------------------------------------
  // Filtro Temporal de Período (Mensal / Anual / Geral)
  // ---------------------------------------------------------------------------
  const [periodType, setPeriodType] = useState<FinancePeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // Modal de Criação
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'mensalidade' | 'lancamento_geral'>('mensalidade');
  const [notification, setNotification] = useState<string | null>(null);

  // Modal de Edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    description: string;
    category: TransactionCategory;
    type: TransactionType;
    amount: number;
    dueDate: string;
    status: PaymentStatus;
    userId: string;
  }>({
    id: '',
    description: '',
    category: 'mensalidade',
    type: 'income',
    amount: 0,
    dueDate: '',
    status: 'pending',
    userId: '',
  });

  // ---------------------------------------------------------------------------
  // 1. Mensalidade (Lote ou Individual com suporte a Meses Antigos / Retroativos)
  // ---------------------------------------------------------------------------
  const [monthlyMode, setMonthlyMode] = useState<'batch' | 'single'>('batch');
  const [singleMonthlyUserId, setSingleMonthlyUserId] = useState('');
  const [monthRef, setMonthRef] = useState(`${MONTH_NAMES[selectedMonth - 1]}/${selectedYear}`);
  const [monthlyAmount, setMonthlyAmount] = useState(80.00);
  const [monthlyDueDate, setMonthlyDueDate] = useState(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-10`);
  const [monthlyIsPaid, setMonthlyIsPaid] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. Lançamento Universal / Personalizado (Receita ou Despesa com Categoria Livre)
  // ---------------------------------------------------------------------------
  const [customType, setCustomType] = useState<'income' | 'expense'>('income');
  const [customCategory, setCustomCategory] = useState<TransactionCategory>('saldo_inicial');
  const [customUserId, setCustomUserId] = useState('');
  const [customDesc, setCustomDesc] = useState('Saldo Anterior em Caixa (Migração de Grupo)');
  const [customAmount, setCustomAmount] = useState(500.00);
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [customIsPaid, setCustomIsPaid] = useState(true);

  const [currentMember, setCurrentMember] = useState<GroupMember | undefined>(undefined);

  const loadData = () => {
    const tList = FinanceService.getTransactions(groupId);
    const mList = GroupService.getMembers(groupId);
    const member = GroupService.getMemberInGroup(groupId);
    setTransactions(tList);
    setMembers(mList);
    setCurrentMember(member);

    // Pré-seleciona primeiro membro ativo
    const activeM = mList.find((m) => m.status !== 'pending_approval');
    if (activeM) {
      setSingleMonthlyUserId(activeM.userId);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  const isDirector = currentMember?.role === 'presidente' || currentMember?.role === 'adm' || currentMember?.role === 'tesoureiro';

  // Anos disponíveis
  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);

  // Transações filtradas pelo período selecionado (Mensal / Anual / Geral)
  const periodFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => matchTransactionPeriod(t, periodType, selectedYear, selectedMonth));
  }, [transactions, periodType, selectedYear, selectedMonth]);

  // Cálculos Financeiros do Período Selecionado
  const periodIncome = periodFilteredTransactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const periodPending = periodFilteredTransactions
    .filter((t) => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc, t) => acc + t.amount, 0);

  const periodExpenses = periodFilteredTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const periodNetBalance = periodIncome - periodExpenses;

  // Saldo Acumulado Total em Caixa (Geral)
  const totalAllTimeIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAllTimeExpenses = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const allTimeNetBalance = totalAllTimeIncome - totalAllTimeExpenses;

  const delinquentMembers = members.filter((m) => m.isBlockedFinancial);

  const handleSettle = (transactionId: string) => {
    FinanceService.settleTransaction(groupId, transactionId);
    loadData();
    const msg = 'Pagamento registrado com sucesso! Débito quitado e atleta liberado. ✅';
    setNotification(msg);
    showToast(msg, 'success');
    setTimeout(() => setNotification(null), 4000);
  };

  // Abrir Modal de Edição
  const handleStartEdit = (t: FinancialTransaction) => {
    setEditForm({
      id: t.id,
      description: t.description,
      category: t.category,
      type: t.type,
      amount: t.amount,
      dueDate: t.dueDate || new Date().toISOString().split('T')[0],
      status: t.status,
      userId: t.userId || '',
    });
    setEditModalOpen(true);
  };

  // Salvar Edição
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUserName: string | undefined;
    if (editForm.userId) {
      const u = members.find((m) => m.userId === editForm.userId);
      if (u) targetUserName = u.user.name;
    }

    const updated = FinanceService.updateTransaction(groupId, editForm.id, {
      description: editForm.description,
      category: editForm.category,
      type: editForm.type,
      amount: editForm.amount,
      dueDate: editForm.dueDate,
      status: editForm.status,
      userId: editForm.userId || undefined,
      userName: targetUserName,
    });

    if (updated) {
      loadData();
      setEditModalOpen(false);
      const msg = 'Lançamento financeiro atualizado com sucesso! ✅';
      setNotification(msg);
      showToast(msg, 'success');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Excluir Lançamento
  const handleDelete = (t: FinancialTransaction) => {
    const confirmDelete = window.confirm(
      `Deseja realmente excluir o lançamento "${t.description}" no valor de ${formatCurrency(t.amount)}?`
    );
    if (!confirmDelete) return;

    const ok = FinanceService.deleteTransaction(groupId, t.id);
    if (ok) {
      loadData();
      const msg = 'Lançamento excluído do extrato financeiro. 🗑️';
      setNotification(msg);
      showToast(msg, 'info');
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // 1. Submit Mensalidades (Lote ou Individual / Retroativa)
  const handleSubmitMonthly = (e: React.FormEvent) => {
    e.preventDefault();
    if (monthlyMode === 'batch') {
      const result = FinanceService.generateMonthlyDuesBatch(
        groupId,
        monthRef,
        monthlyAmount,
        monthlyDueDate,
        monthlyIsPaid
      );
      loadData();
      setModalOpen(false);
      const msg = `⚡ Mensalidade de ${monthRef} registrada para ${result.generatedCount} associados (${monthlyIsPaid ? 'PAGO NO CAIXA' : 'COBRANÇA PENDENTE'})!`;
      setNotification(msg);
      showToast(msg, 'success');
    } else {
      const targetM = members.find((m) => m.userId === singleMonthlyUserId);
      if (!targetM) {
        alert('Selecione um atleta.');
        return;
      }
      FinanceService.generateSingleMonthlyDue(
        groupId,
        targetM.userId,
        targetM.user.name,
        monthRef,
        monthlyAmount,
        monthlyDueDate,
        monthlyIsPaid
      );
      loadData();
      setModalOpen(false);
      const msg = `Mensalidade de ${monthRef} (${formatCurrency(monthlyAmount)}) lançada para ${targetM.user.name} (${monthlyIsPaid ? 'PAGO' : 'PENDENTE'}).`;
      setNotification(msg);
      showToast(msg, 'success');
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // 2. Submit Lançamento Universal / Personalizado (Receita ou Despesa Livre)
  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUserName: string | undefined;
    let targetUserId: string | undefined;

    if (customUserId) {
      const u = members.find((m) => m.userId === customUserId);
      if (u) {
        targetUserName = u.user.name;
        targetUserId = u.userId;
      }
    }

    if (customType === 'income') {
      FinanceService.generateCustomIncome(
        groupId,
        customCategory,
        customDesc,
        customAmount,
        customDate,
        targetUserId,
        targetUserName,
        customIsPaid
      );
      const msg = `🟢 Receita de ${formatCurrency(customAmount)} (${CATEGORY_LABELS[customCategory]?.label}) registrada com sucesso.`;
      setNotification(msg);
      showToast(msg, 'success');
    } else {
      FinanceService.createExpense(
        groupId,
        customCategory,
        targetUserName ? `${customDesc} (${targetUserName})` : customDesc,
        customAmount,
        customDate,
        targetUserId,
        targetUserName,
        customIsPaid
      );
      const msg = `🔴 Despesa de ${formatCurrency(customAmount)} (${CATEGORY_LABELS[customCategory]?.label}) registrada no caixa.`;
      setNotification(msg);
      showToast(msg, 'success');
    }

    loadData();
    setModalOpen(false);
    setTimeout(() => setNotification(null), 4000);
  };

  // Rótulo amigável do período atual
  const currentPeriodLabel = useMemo(() => {
    if (periodType === 'all') return 'Todo o Histórico (Geral)';
    if (periodType === 'yearly') return `Ano de ${selectedYear}`;
    return `${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}`;
  }, [periodType, selectedMonth, selectedYear]);

  // Se o usuário não for da diretoria (Presidente, ADM, Tesoureiro), bloqueia a visualização detalhada
  if (currentMember && !isDirector) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mx-auto">
          🔒
        </div>
        <h1 className="text-2xl font-black text-white">Acesso Restrito à Diretoria</h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          O módulo financeiro detalhado e lançamentos de caixa são visíveis apenas para o <strong>Presidente</strong>, <strong>ADM</strong> ou <strong>Tesoureiro</strong> do grupo.
        </p>
        <div className="pt-2">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs"
          >
            Voltar ao Painel Geral
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto select-none">
      
      {/* Cabeçalho Moderno do Painel Financeiro */}
      <div className="bg-[#121e2b] border border-[#1e3247] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00b49f]/15 text-[#00b49f] text-[10px] font-bold uppercase tracking-wider mb-2">
            <Coins className="w-3.5 h-3.5" /> Módulo Financeiro
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Controle de Caixa & Mensalidades
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            Gestão transparente de mensalidades, registro de pagamentos, multas disciplinares e controle de despesas do Baba.
          </p>
        </div>

        {/* Botões Rápidos de Ação */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => {
              setActiveTab('mensalidade');
              setModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 fill-slate-950" /> Mensalidades
          </button>

          <button
            onClick={() => {
              setActiveTab('lancamento_geral');
              setModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-[#182737] hover:bg-[#1e3247] border border-[#22384f] text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-[#00b49f]" /> Nova Entrada/Saída
          </button>
        </div>
      </div>

      {/* Alerta / Notificação */}
      {notification && (
        <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-300 p-4 rounded-2xl text-xs flex items-center gap-3 font-semibold shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          {notification}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SELETOR DE PERÍODO (MENSAL COM ESCOLHA DE MÊS, ANUAL COM ANO OU GERAL) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00b49f]" />
          <div>
            <span className="text-xs font-bold text-white block">Período de Análise</span>
            <span className="text-[11px] text-slate-400">
              Visualizando: <strong className="text-[#00b49f] font-semibold">{currentPeriodLabel}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botões do Tipo de Período */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPeriodType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodType === 'monthly'
                  ? 'bg-[#00b49f] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodType === 'yearly'
                  ? 'bg-[#00b49f] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Anual
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodType === 'all'
                  ? 'bg-[#00b49f] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Geral
            </button>
          </div>

          {/* Seletores Dinâmicos de Mês e Ano */}
          {periodType === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-[#00b49f]"
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          )}

          {(periodType === 'monthly' || periodType === 'yearly') && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold font-mono focus:outline-none focus:border-[#00b49f]"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards do Período */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        {/* Saldo Líquido do Período */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase">Saldo no Período</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className={`text-xl sm:text-2xl font-black ${periodNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(periodNetBalance)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Entradas - Saídas ({periodType === 'all' ? 'Geral' : currentPeriodLabel})
          </p>
        </div>

        {/* Receitas do Período */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase text-emerald-400">Receitas Pagas</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {formatCurrency(periodIncome)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Mensalidades, diárias e entradas</p>
        </div>

        {/* Despesas do Período */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase text-rose-400">Despesas Pagas</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-400">
            {formatCurrency(periodExpenses)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Quadra, juiz, água e custos</p>
        </div>

        {/* Total a Receber no Período */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase text-amber-400">A Receber / Pendente</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-400">
            {formatCurrency(periodPending)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Débitos em aberto no período</p>
        </div>
      </div>

      {/* Membros Bloqueados por Inadimplência */}
      {delinquentMembers.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Atletas Bloqueados por Débito ({delinquentMembers.length})</span>
          </div>
          <p className="text-xs text-slate-400">
            Estes atletas possuem pendências em aberto e estão impedidos de confirmar presença na pelada até a baixa do pagamento.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {delinquentMembers.map((m) => {
              const pendingTrans = transactions.find((t) => t.userId === m.userId && (t.status === 'pending' || t.status === 'overdue'));
              return (
                <div key={m.id} className="bg-slate-900/90 border border-rose-900/40 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">{m.user.name}</p>
                    <p className="text-[11px] text-rose-400 font-semibold">{m.blockedReason || 'Débito em aberto'}</p>
                    <p className="text-[10px] text-slate-500">Valor: {pendingTrans ? formatCurrency(pendingTrans.amount) : 'R$ 80,00'}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (pendingTrans) handleSettle(pendingTrans.id);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Dar Baixa
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela de Extrato Financeiro */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00b49f]" /> Extrato & Histórico ({currentPeriodLabel})
            </h2>
            <p className="text-xs text-slate-400">
              Mostrando <strong>{periodFilteredTransactions.length}</strong> lançamentos correspondentes
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'inadimplentes', label: 'Pendentes' },
              { id: 'mensalidades', label: '⭐ Mensalidades' },
              { id: 'cartoes', label: '🟦🟥 Multas' },
              { id: 'diarias', label: '🎟️ Diárias' },
              { id: 'saldo_inicial', label: '🏦 Saldo Inicial' },
              { id: 'expenses', label: '📉 Despesas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-[#00b49f] text-slate-950 font-bold'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="pb-3 font-semibold">Descrição / Beneficiário</th>
                <th className="pb-3 font-semibold">Categoria</th>
                <th className="pb-3 font-semibold">Data / Vencimento</th>
                <th className="pb-3 font-semibold">Valor</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {periodFilteredTransactions
                .filter((t) => {
                  if (activeFilter === 'inadimplentes') return t.status === 'pending' || t.status === 'overdue';
                  if (activeFilter === 'cartoes') return ['cartao_azul', 'cartao_vermelho', 'multa_atraso', 'multa_falta', 'cartao_amarelo'].includes(t.category);
                  if (activeFilter === 'mensalidades') return t.category === 'mensalidade';
                  if (activeFilter === 'diarias') return t.category === 'diaria';
                  if (activeFilter === 'saldo_inicial') return t.category === 'saldo_inicial';
                  if (activeFilter === 'expenses') return t.type === 'expense';
                  return true;
                })
                .map((t) => {
                  const isOverdue = t.status === 'overdue';
                  const isPaid = t.status === 'paid';
                  const catInfo = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.outros;

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="py-3 font-medium text-slate-200">
                        {t.description}
                        {t.userName && <span className="block text-[10px] text-slate-500 font-semibold">{t.userName}</span>}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-semibold ${catInfo.badgeColor}`}>
                          <span>{catInfo.icon}</span> {catInfo.label}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{t.dueDate}</td>
                      <td className={`py-3 font-bold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Pago
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40 font-bold">
                            <AlertTriangle className="w-3 h-3" /> Em Atraso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40 font-semibold">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => handleSettle(t.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2 py-1 rounded text-[10px] transition-colors shadow-sm inline-flex items-center gap-1"
                              title="Dar baixa / Quitar"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Baixar
                            </button>
                          )}

                          <button
                            onClick={() => handleStartEdit(t)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#00b49f] transition-all border border-slate-700/80"
                            title="Editar lançamento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(t)}
                            className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 transition-all border border-rose-900/50"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {periodFilteredTransactions.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs italic">
              Nenhuma movimentação financeira encontrada para o período <strong>{currentPeriodLabel}</strong>.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE CRIAÇÃO DE LANÇAMENTOS FINANCEIROS */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Central de Lançamentos & Histórico
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas do Modal */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('mensalidade')}
                className={`py-2 rounded-lg text-xs font-bold text-center transition-all ${
                  activeTab === 'mensalidade'
                    ? 'bg-emerald-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⭐ Mensalidades
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lancamento_geral')}
                className={`py-2 rounded-lg text-xs font-bold text-center transition-all ${
                  activeTab === 'lancamento_geral'
                    ? 'bg-[#00b49f] text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ➕ Nova Entrada / Saída
              </button>
            </div>

            {/* ABA 1: MENSALIDADES */}
            {activeTab === 'mensalidade' && (
              <form onSubmit={handleSubmitMonthly} className="space-y-4">
                <div className="bg-indigo-950/30 border border-indigo-500/30 p-3.5 rounded-xl text-xs text-indigo-200 space-y-1.5">
                  <span className="font-bold block text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-400" /> Cobrança de Mensalidades (Atuais ou Antigas)
                  </span>
                  <p className="text-[11px] text-indigo-300/90 leading-relaxed">
                    Permite gerar cobranças para o mês atual ou <strong>meses antigos</strong> (retroativos) para migrar o histórico da sua pelada perfeitamente.
                  </p>
                </div>

                {/* Seletor de Modo: Em Lote ou Individual */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Modo de Lançamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyMode('batch')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        monthlyMode === 'batch'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      👥 Em Lote (Todos os Associados)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthlyMode('single')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        monthlyMode === 'single'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      👤 Individual (1 Atleta Específico)
                    </button>
                  </div>
                </div>

                {/* Se for individual, seleciona o atleta */}
                {monthlyMode === 'single' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                      Selecionar Atleta
                    </label>
                    <select
                      value={singleMonthlyUserId}
                      onChange={(e) => setSingleMonthlyUserId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                      {members
                        .filter((m) => m.status !== 'pending_approval')
                        .map((m) => (
                          <option key={m.id} value={m.userId}>
                            {m.user.name} ({m.role.toUpperCase()})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                      Mês de Referência
                    </label>
                    <input
                      type="text"
                      value={monthRef}
                      onChange={(e) => setMonthRef(e.target.value)}
                      placeholder="Ex: Janeiro/2026, Fevereiro/2026..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {['Janeiro/2026', 'Fevereiro/2026', 'Março/2026', 'Abril/2026'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMonthRef(m)}
                          className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded-lg"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                      Valor da Mensalidade (R$)
                    </label>
                    <input
                      type="number"
                      step="5.00"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Data de Vencimento / Competência
                  </label>
                  <input
                    type="date"
                    value={monthlyDueDate}
                    onChange={(e) => setMonthlyDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="monthlyPaid"
                      checked={monthlyIsPaid}
                      onChange={(e) => setMonthlyIsPaid(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="monthlyPaid" className="text-xs text-white font-bold cursor-pointer">
                      Esta mensalidade JÁ FOI PAGA no passado (histórico já quitado)
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-6">
                    {monthlyIsPaid 
                      ? '✓ Os pagamentos entrarão creditados diretamente no saldo acumulado do caixa.' 
                      : '⏳ Ficará registrado como débito em aberto (inadimplência pendente) até o atleta pagar.'}
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Zap className="w-4 h-4 fill-slate-950" /> 
                  {monthlyMode === 'batch' 
                    ? `Gerar Mensalidades de ${monthRef} em Lote` 
                    : `Lançar Mensalidade de ${monthRef} para o Atleta`}
                </button>
              </form>
            )}

            {/* ABA 2: LANÇAMENTO UNIVERSAL */}
            {activeTab === 'lancamento_geral' && (
              <form onSubmit={handleSubmitCustom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Tipo do Lançamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomType('income');
                        if (customCategory === 'ajuda_custo_goleiro' || customCategory === 'aluguel_campo' || customCategory === 'arbitragem') {
                          setCustomCategory('saldo_inicial');
                          setCustomDesc('Saldo Inicial do Grupo');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                        customType === 'income'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> 🟢 Receita (Entrada)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomType('expense');
                        if (customCategory === 'saldo_inicial' || customCategory === 'mensalidade' || customCategory === 'patrocinio') {
                          setCustomCategory('aluguel_campo');
                          setCustomDesc('Aluguel Quadra/Campo');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                        customType === 'expense'
                          ? 'bg-rose-500 text-white border-rose-400 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" /> 🔴 Despesa (Saída)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => {
                      const cat = e.target.value as TransactionCategory;
                      setCustomCategory(cat);
                      if (cat === 'saldo_inicial') setCustomDesc('Saldo Anterior em Caixa (Migração)');
                      else if (cat === 'uniforme') setCustomDesc('Venda de Uniforme / Colete');
                      else if (cat === 'patrocinio') setCustomDesc('Patrocínio / Doação Financeira');
                      else if (cat === 'churrasco') setCustomDesc('Rateio / Gastos do Churrasco');
                      else if (cat === 'aluguel_campo') setCustomDesc('Aluguel Quadra / Campo');
                      else if (cat === 'ajuda_custo_goleiro') setCustomDesc('Ajuda de Custo - Goleiro');
                      else if (cat === 'arbitragem') setCustomDesc('Arbitragem / Juiz');
                      else if (cat === 'agua_gelo') setCustomDesc('Água e Gelo');
                      else if (cat === 'material') setCustomDesc('Bolas e Coletes');
                      else if (cat === 'diaria') setCustomDesc('Diária de Jogo Avulso');
                      else if (cat === 'mensalidade') setCustomDesc('Mensalidade Avulsa');
                      else if (cat === 'cartao_azul') setCustomDesc('Multa - Cartão Azul');
                      else if (cat === 'cartao_vermelho') setCustomDesc('Multa - Cartão Vermelho');
                      else if (cat === 'cartao_amarelo') setCustomDesc('Multa - Cartão Amarelo');
                      else if (cat === 'multa_falta') setCustomDesc('Multa por Falta sem Aviso');
                      else if (cat === 'multa_atraso') setCustomDesc('Multa por Atraso');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {customType === 'income' ? (
                      <>
                        <option value="saldo_inicial">🏦 Saldo Inicial / Ajuste de Migração de Grupo</option>
                        <option value="mensalidade">⭐ Mensalidade de Atleta</option>
                        <option value="diaria">🎟️ Diária de Jogo / Convidado</option>
                        <option value="cartao_azul">🟦 Multa por Cartão Azul</option>
                        <option value="cartao_vermelho">🟥 Multa por Cartão Vermelho</option>
                        <option value="cartao_amarelo">🟨 Multa por Cartão Amarelo</option>
                        <option value="multa_falta">⏳ Multa por Falta sem Aviso</option>
                        <option value="multa_atraso">⏰ Multa por Atraso</option>
                        <option value="uniforme">👕 Venda de Uniforme / Colete</option>
                        <option value="patrocinio">🤝 Patrocínio / Doação</option>
                        <option value="churrasco">🍖 Churrasco / Resenha</option>
                        <option value="outros">📦 Outras Entradas Gerais</option>
                      </>
                    ) : (
                      <>
                        <option value="aluguel_campo">🏟️ Aluguel do Campo / Quadra</option>
                        <option value="ajuda_custo_goleiro">🧤 Pagamento / Ajuda de Custo Goleiro</option>
                        <option value="arbitragem">⚖️ Arbitragem / Juiz da Partida</option>
                        <option value="agua_gelo">💧 Água / Gelo / Bebidas</option>
                        <option value="material">⚽ Bolas / Coletes / Equipamentos</option>
                        <option value="churrasco">🍖 Custos de Churrasco & Confraternização</option>
                        <option value="uniforme">👕 Confecção de Uniformes</option>
                        <option value="outros">📦 Outras Despesas Gerais</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Atleta Vinculado (Opcional)
                  </label>
                  <select
                    value={customUserId}
                    onChange={(e) => setCustomUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Entrada/Despesa Geral da Pelada (Sem atleta específico) --</option>
                    {members
                      .filter((m) => m.status !== 'pending_approval')
                      .map((m) => (
                        <option key={m.id} value={m.userId}>
                          {m.user.name} ({m.role.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Descrição do Lançamento
                  </label>
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    required
                    placeholder="Ex: Pagamento de diária, multa por atraso, água, etc."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(parseFloat(e.target.value))}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-black text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                      Data do Lançamento
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="customPaid"
                    checked={customIsPaid}
                    onChange={(e) => setCustomIsPaid(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="customPaid" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Lançamento já está <strong>PAGO / EFETIVADO</strong> (movimenta o caixa imediatamente)
                  </label>
                </div>

                <button
                  type="submit"
                  className={`w-full mt-2 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                    customType === 'income'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                  }`}
                >
                  <Plus className="w-4 h-4" /> 
                  {customType === 'income' ? 'Registrar Receita no Caixa' : 'Registrar Despesa no Caixa'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE EDIÇÃO DE LANÇAMENTO */}
      {/* ========================================================================= */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#00b49f]" /> Editar Lançamento Financeiro
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Tipo do Lançamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, type: 'income' }))}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      editForm.type === 'income'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" /> 🟢 Receita (Entrada)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, type: 'expense' }))}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      editForm.type === 'expense'
                        ? 'bg-rose-500 text-white border-rose-400 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" /> 🔴 Despesa (Saída)
                  </button>
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Categoria
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value as TransactionCategory }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="saldo_inicial">🏦 Saldo Inicial / Ajuste de Migração</option>
                  <option value="mensalidade">⭐ Mensalidade</option>
                  <option value="diaria">🎟️ Diária de Jogo</option>
                  <option value="cartao_azul">🟦 Multa Cartão Azul</option>
                  <option value="cartao_vermelho">🟥 Multa Cartão Vermelho</option>
                  <option value="cartao_amarelo">🟨 Multa Cartão Amarelo</option>
                  <option value="multa_falta">⏳ Multa Falta sem Aviso</option>
                  <option value="multa_atraso">⏰ Multa por Atraso</option>
                  <option value="uniforme">👕 Uniforme / Coletes</option>
                  <option value="patrocinio">🤝 Patrocínio / Doação</option>
                  <option value="aluguel_campo">🏟️ Aluguel Quadra / Campo</option>
                  <option value="ajuda_custo_goleiro">🧤 Pagamento Goleiro</option>
                  <option value="arbitragem">⚖️ Arbitragem / Juiz</option>
                  <option value="agua_gelo">💧 Água / Gelo / Bebidas</option>
                  <option value="material">⚽ Bolas / Equipamentos</option>
                  <option value="churrasco">🍖 Churrasco / Resenha</option>
                  <option value="outros">📦 Outros</option>
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* Atleta Vinculado */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Atleta Vinculado (Opcional)
                </label>
                <select
                  value={editForm.userId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, userId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Sem atleta específico / Geral da Pelada --</option>
                  {members
                    .filter((m) => m.status !== 'pending_approval')
                    .map((m) => (
                      <option key={m.id} value={m.userId}>
                        {m.user.name} ({m.role.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              {/* Valor & Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Data / Vencimento
                  </label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Status do Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'paid' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      editForm.status === 'paid'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ✓ Pago
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'pending' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      editForm.status === 'pending'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⏳ Pendente
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'overdue' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      editForm.status === 'overdue'
                        ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⚠️ Em Atraso
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="w-1/3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Save className="w-4 h-4" /> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
