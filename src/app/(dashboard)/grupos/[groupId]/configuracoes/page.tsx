'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  GroupService, 
  UserService, 
  NotificationService 
} from '@/lib/services/storage-service';
import { Group, GroupMember, GroupRole, UserPosition, DominantFoot } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ProBadge } from '@/components/group/ProBadge';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  ChevronRight, 
  History, 
  User, 
  Bell, 
  Edit3, 
  Star, 
  Calendar, 
  BarChart3, 
  Sliders, 
  DollarSign, 
  ArrowLeftRight, 
  Sparkles, 
  Hourglass, 
  Repeat, 
  LogOut, 
  Share2, 
  Copy, 
  Check, 
  X, 
  Save, 
  Trash2, 
  AlertTriangle,
  Crown,
  Lock,
  Plus
} from 'lucide-react';

export default function GroupSettingsPage({ params }: { params: { groupId: string } }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Modais de Edição e Ações
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [groupDataModalOpen, setGroupDataModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [ratingsModalOpen, setRatingsModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proFeatureTitle, setProFeatureTitle] = useState('');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [manualPlayerModalOpen, setManualPlayerModalOpen] = useState(false);

  // Formulário do Grupo
  const [groupForm, setGroupForm] = useState({
    name: '',
    maxSlots: 18,
    fieldAddress: '',
    matchDay: 'Quarta-feira',
    matchTime: '20:00',
    matchDurationMinutes: 90,
    monthlyFee: 80,
    dailyFee: 25,
    whatsappGroupUrl: '',
    rules: '',
  });

  // Formulário de Adição Manual de Atleta
  const [newPlayerForm, setNewPlayerForm] = useState({
    name: '',
    phone: '',
    mainPosition: 'meia' as UserPosition,
    dominantFoot: 'destro' as DominantFoot,
    overallRating: 7.0,
    role: 'associado' as GroupRole,
  });

  const loadData = () => {
    const targetGroupId = params.groupId || GroupService.getActiveGroupId() || '';
    const g = GroupService.getGroupById(targetGroupId) || GroupService.getGroups()[0];
    if (g) {
      setGroup(g);
      setGroupForm({
        name: g.name,
        maxSlots: g.maxSlots || 18,
        fieldAddress: g.fieldAddress || '',
        matchDay: g.matchDay || 'Quarta-feira',
        matchTime: g.matchTime || '20:00',
        matchDurationMinutes: g.matchDurationMinutes || 90,
        monthlyFee: g.monthlyFee || 80,
        dailyFee: g.dailyFee || 25,
        whatsappGroupUrl: g.whatsappGroupUrl || '',
        rules: g.rules || '',
      });

      const mList = GroupService.getMembers(g.id);
      setMembers(mList);
      
      const pending = mList.filter((m) => m.status === 'pending_approval');
      setPendingRequestsCount(pending.length);

      const myMem = GroupService.getMemberInGroup(g.id);
      setCurrentMember(myMem || null);
    }
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

  const isDirector = currentMember?.role === 'presidente' || currentMember?.role === 'adm' || currentMember?.role === 'tesoureiro';

  const handleSaveGroupData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    const updated = await GroupService.updateGroup(group.id, {
      name: groupForm.name,
      maxSlots: Number(groupForm.maxSlots),
      fieldAddress: groupForm.fieldAddress,
      monthlyFee: Number(groupForm.monthlyFee),
      dailyFee: Number(groupForm.dailyFee),
      whatsappGroupUrl: groupForm.whatsappGroupUrl.trim(),
      rules: groupForm.rules,
    });
    if (updated) {
      setGroup(updated);
      setGroupDataModalOpen(false);
      showToast('Dados do grupo atualizados com sucesso!', 'success');
      loadData();
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    const updated = await GroupService.updateGroup(group.id, {
      matchDay: groupForm.matchDay,
      matchTime: groupForm.matchTime,
      matchDurationMinutes: Number(groupForm.matchDurationMinutes),
    });
    if (updated) {
      setGroup(updated);
      setScheduleModalOpen(false);
      showToast('Horário dos jogos atualizado!', 'success');
      loadData();
    }
  };

  const handleAddManualPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !newPlayerForm.name.trim()) return;
    await GroupService.addMember(group.id, {
      name: newPlayerForm.name.trim(),
      phone: newPlayerForm.phone,
      mainPosition: newPlayerForm.mainPosition,
      dominantFoot: newPlayerForm.dominantFoot,
      overallRating: Number(newPlayerForm.overallRating),
      role: newPlayerForm.role,
    });
    setNewPlayerForm({
      name: '',
      phone: '',
      mainPosition: 'meia',
      dominantFoot: 'destro',
      overallRating: 7.0,
      role: 'associado',
    });
    setManualPlayerModalOpen(false);
    showToast('Jogador adicionado ao Baba!', 'success');
    loadData();
  };

  const handleCopyLink = () => {
    if (!group) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${origin}/convite/${group.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    showToast('Link de convite copiado!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedCode(true);
    showToast('Código de convite copiado!', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const [smartRatingModalOpen, setSmartRatingModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);

  const handleOpenProFeature = (featureName: string, targetRoute?: string) => {
    if (targetRoute && group) {
      router.push(targetRoute.replace('[groupId]', group.id));
      return;
    }
    if (featureName.includes('Classifica')) {
      setSmartRatingModalOpen(true);
    } else if (featureName.includes('Fila')) {
      setWaitlistModalOpen(true);
    } else if (featureName.includes('Recorr')) {
      setRecurrenceModalOpen(true);
    } else if (group) {
      router.push(`/grupos/${group.id}/pelada`);
    }
  };

  const handleLeaveGroup = () => {
    showToast('Você saiu do grupo com sucesso.', 'info');
    setLeaveModalOpen(false);
    router.push('/dashboard');
  };

  const activePlayersCount = members.filter((m) => m.status === 'active').length || members.length || 25;

  return (
    <div className="space-y-4 pb-12 max-w-lg mx-auto select-none">
      
      {/* 1. Banner Superior: Gestão do Baba */}
      <Link
        href={group ? `/grupos/${group.id}/pelada` : '/dashboard'}
        className="w-full bg-[#0d4f48] hover:bg-[#105d55] border border-[#147067] rounded-2xl p-3.5 flex items-center justify-between transition-all shadow-md active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <ProBadge size="md" />
          <span className="font-bold text-white text-base tracking-wide">Painel Oficial do Baba</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300" />
      </Link>

      {/* 2. Banner: Histórico de Atividades */}
      <button
        onClick={() => setHistoryModalOpen(true)}
        className="w-full bg-[#341d24] hover:bg-[#42242d] border border-[#4d2935] rounded-xl p-3.5 flex items-center justify-between transition-all shadow-md active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-slate-300" />
          <span className="font-semibold text-white text-sm">Histórico de atividades</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300" />
      </button>

      {/* 3. Bloco: Jogadores */}
      <div className="pt-2">
        <h3 className="text-xs font-semibold text-slate-400 px-1 mb-2">Jogadores</h3>
        <div className="bg-[#121e2b] border border-[#182737] rounded-2xl overflow-hidden divide-y divide-[#182737] shadow-sm">
          
          {/* Linha Jogadores */}
          <Link
            href={group ? `/grupos/${group.id}/pelada` : '#'}
            className="p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Jogadores</span>
            </div>
            <span className="text-sm font-bold text-slate-300">{activePlayersCount}</span>
          </Link>

          {/* Linha Solicitações */}
          <button
            onClick={() => setInviteModalOpen(true)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Solicitações</span>
            </div>
            <span className="text-sm font-bold text-slate-300">{pendingRequestsCount}</span>
          </button>
        </div>

        {/* Botão + ADICIONAR JOGADOR */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 text-[#00b49f] hover:text-[#00cba9] font-black text-xs tracking-wider uppercase py-2 px-4 rounded-xl hover:bg-[#00b49f]/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> ADICIONAR JOGADOR
          </button>
        </div>
      </div>

      {/* 4. Bloco: Meus dados no grupo */}
      <div className="pt-2">
        <h3 className="text-xs font-semibold text-slate-400 px-1 mb-2">Meus dados no grupo</h3>
        <div className="bg-[#121e2b] border border-[#182737] rounded-2xl overflow-hidden divide-y divide-[#182737] shadow-sm">
          
          <Link
            href="/perfil"
            className="p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Dados do jogador</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Link>

          <button
            onClick={() => showToast('Suas notificações estão sincronizadas.', 'info')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Notificações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 5. Bloco: Configurações */}
      <div className="pt-2">
        <h3 className="text-xs font-semibold text-slate-400 px-1 mb-2">Configurações</h3>
        <div className="bg-[#121e2b] border border-[#182737] rounded-2xl overflow-hidden divide-y divide-[#182737] shadow-sm">
          
          <button
            onClick={() => setGroupDataModalOpen(true)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Edit3 className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Dados do grupo</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            onClick={() => setRatingsModalOpen(true)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Avaliações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            onClick={() => setScheduleModalOpen(true)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Horário dos jogos</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 6. Bloco: Ferramentas & Recursos do Baba */}
      <div className="pt-2">
        <h3 className="text-xs font-semibold text-slate-400 px-1 mb-2">Ferramentas & Inteligência</h3>
        <div className="bg-[#121e2b] border border-[#182737] rounded-2xl overflow-hidden divide-y divide-[#182737] shadow-sm">
          
          {/* Ranking */}
          <button
            onClick={() => handleOpenProFeature('Ranking', group ? `/grupos/${group.id}/resenha` : undefined)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Rankings & Artilharia</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Destaques */}
          <button
            onClick={() => handleOpenProFeature('Destaques', group ? `/grupos/${group.id}/resenha` : undefined)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Destaques da Rodada</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Financeiro */}
          <button
            onClick={() => handleOpenProFeature('Financeiro', group ? `/grupos/${group.id}/financas` : undefined)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Painel Financeiro</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Sorteio */}
          <button
            onClick={() => handleOpenProFeature('Sorteio Equilibrado', group ? `/grupos/${group.id}/pelada` : undefined)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Sorteio de Times</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Classificar jogadores */}
          <button
            onClick={() => handleOpenProFeature('Classificação Inteligente')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Classificar Jogadores</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Fila de espera */}
          <button
            onClick={() => handleOpenProFeature('Fila de Espera Inteligente')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Hourglass className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Fila de Espera Automática</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Recorrência */}
          <button
            onClick={() => handleOpenProFeature('Recorrência e Automação')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#182737]/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Repeat className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-semibold text-white">Recorrência de Peladas</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 7. Botão Sair do Grupo */}
      <div className="pt-4 text-center">
        <button
          onClick={() => setLeaveModalOpen(true)}
          className="inline-flex items-center gap-2 text-[#e06b6b] hover:text-[#f87171] font-bold text-xs tracking-wider uppercase py-2 px-4 rounded-xl hover:bg-rose-500/10 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" /> SAIR DO GRUPO
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAIS INTERATIVOS */}
      {/* ========================================================================= */}

      {/* Modal: Adicionar Jogador / Convites */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#00b49f]" />
                <h3 className="text-base font-bold text-white">Adicionar Jogador ao Baba</h3>
              </div>
              <button onClick={() => setInviteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Compartilhe o código ou o link de convite oficial para os atletas entrarem automaticamente.
            </p>

            {/* Código de Convite */}
            <div className="bg-[#0d1721] p-3.5 rounded-xl border border-[#182737] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Código do Baba</span>
                <p className="text-lg font-black text-[#00b49f] font-mono tracking-wider">
                  {group?.inviteCode || 'BABA2026'}
                </p>
              </div>
              <button
                onClick={handleCopyCode}
                className="bg-[#182737] hover:bg-[#1e3247] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            {/* Link Direto */}
            <button
              onClick={handleCopyLink}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              {copiedLink ? 'Link Copiado!' : 'Copiar Link de Convite'}
            </button>

            {/* Adicionar Manualmente */}
            <div className="pt-2 border-t border-[#182737] text-center">
              <button
                onClick={() => {
                  setInviteModalOpen(false);
                  setManualPlayerModalOpen(true);
                }}
                className="text-xs text-slate-300 hover:text-[#00b49f] font-semibold underline"
              >
                Ou cadastrar atleta manualmente na lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastro Manual de Atleta */}
      {manualPlayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <h3 className="text-base font-bold text-white">Cadastrar Atleta Manual</h3>
              <button onClick={() => setManualPlayerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualPlayer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newPlayerForm.name}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, name: e.target.value })}
                  placeholder="Ex: Gabriel Barbosa"
                  className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Posição</label>
                  <select
                    value={newPlayerForm.mainPosition}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, mainPosition: e.target.value as UserPosition })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  >
                    <option value="goleiro">Goleiro</option>
                    <option value="zagueiro">Zagueiro</option>
                    <option value="lateral">Lateral</option>
                    <option value="volante">Volante</option>
                    <option value="meia">Meia</option>
                    <option value="atacante">Atacante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pé Dominante</label>
                  <select
                    value={newPlayerForm.dominantFoot}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, dominantFoot: e.target.value as DominantFoot })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  >
                    <option value="destro">Destro</option>
                    <option value="canhoto">Canhoto</option>
                    <option value="ambidestro">Ambidestro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nota Inicial (1 a 10)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={newPlayerForm.overallRating}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, overallRating: parseFloat(e.target.value) })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tipo de Membro</label>
                  <select
                    value={newPlayerForm.role}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, role: e.target.value as GroupRole })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  >
                    <option value="associado">Mensalista</option>
                    <option value="diarista">Diarista / Convidado</option>
                    <option value="goleiro">Goleiro Fixo</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Atleta no Baba
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dados do Grupo */}
      {groupDataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <h3 className="text-base font-bold text-white">Dados do Grupo</h3>
              <button onClick={() => setGroupDataModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroupData} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Baba</label>
                <input
                  type="text"
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Endereço / Quadra</label>
                  <input
                    type="text"
                    value={groupForm.fieldAddress}
                    onChange={(e) => setGroupForm({ ...groupForm, fieldAddress: e.target.value })}
                    placeholder="Ex: Arena Society Park, Campo 2"
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
                <div>
                  <label className="block text-[#00b49f] font-bold mb-1">Limite de Vagas na Pelada</label>
                  <input
                    type="number"
                    min="6"
                    max="60"
                    value={groupForm.maxSlots}
                    onChange={(e) => setGroupForm({ ...groupForm, maxSlots: parseInt(e.target.value, 10) || 24 })}
                    className="w-full bg-[#0d1721] border border-[#00b49f]/50 rounded-xl px-3 py-2 text-[#00b49f] font-black focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valor Mensalidade (R$)</label>
                  <input
                    type="number"
                    value={groupForm.monthlyFee}
                    onChange={(e) => setGroupForm({ ...groupForm, monthlyFee: parseFloat(e.target.value) })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valor Diária (R$)</label>
                  <input
                    type="number"
                    value={groupForm.dailyFee}
                    onChange={(e) => setGroupForm({ ...groupForm, dailyFee: parseFloat(e.target.value) })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Regras / Estatuto do Grupo</label>
                <textarea
                  rows={3}
                  value={groupForm.rules}
                  onChange={(e) => setGroupForm({ ...groupForm, rules: e.target.value })}
                  placeholder="Regras de faltas, cartões e convivência..."
                  className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Horário dos Jogos */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <h3 className="text-base font-bold text-white">Horário dos Jogos</h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dia da Semana</label>
                <select
                  value={groupForm.matchDay}
                  onChange={(e) => setGroupForm({ ...groupForm, matchDay: e.target.value })}
                  className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Horário de Início</label>
                  <input
                    type="time"
                    value={groupForm.matchTime}
                    onChange={(e) => setGroupForm({ ...groupForm, matchTime: e.target.value })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Duração (minutos)</label>
                  <input
                    type="number"
                    step="15"
                    value={groupForm.matchDurationMinutes}
                    onChange={(e) => setGroupForm({ ...groupForm, matchDurationMinutes: parseInt(e.target.value) })}
                    className="w-full bg-[#0d1721] border border-[#182737] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00b49f]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Horário
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Avaliações */}
      {ratingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Configurações de Avaliação</h3>
              </div>
              <button onClick={() => setRatingsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O sistema calcula as médias dos atletas após cada pelada com algoritmo ponderado anti-panela, equilibrando o nível técnico dos sorteios.
            </p>

            <div className="bg-[#0d1721] p-3.5 rounded-xl border border-[#182737] space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Votação de Craque / Perna de Pau</span>
                <span className="text-[#00b49f] font-bold">Ativa</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Ponderação nos Sorteios</span>
                <span className="text-[#00b49f] font-bold">Automática</span>
              </div>
            </div>

            <button
              onClick={() => {
                setRatingsModalOpen(false);
                showToast('Configurações de avaliação salvas!', 'success');
              }}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl transition-all"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Atividades */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-300" />
                <h3 className="text-base font-bold text-white">Histórico de Atividades</h3>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              <div className="p-3 bg-[#0d1721] rounded-xl border border-[#182737]">
                <span className="text-[10px] text-slate-500">Hoje às 19:45</span>
                <p className="font-bold text-white mt-0.5">Lista de presença aberta</p>
                <p className="text-slate-400">18 vagas liberadas para a próxima pelada.</p>
              </div>

              <div className="p-3 bg-[#0d1721] rounded-xl border border-[#182737]">
                <span className="text-[10px] text-slate-500">Ontem às 21:30</span>
                <p className="font-bold text-white mt-0.5">Pelada Finalizada • Time Preto 5 x 4 Time Branco</p>
                <p className="text-slate-400">MVP da rodada eleito pela comissão.</p>
              </div>

              <div className="p-3 bg-[#0d1721] rounded-xl border border-[#182737]">
                <span className="text-[10px] text-slate-500">Há 3 dias</span>
                <p className="font-bold text-white mt-0.5">Fechamento Financeiro Mensal</p>
                <p className="text-slate-400">Mensalidades confirmadas pelo tesoureiro.</p>
              </div>
            </div>

            <button
              onClick={() => setHistoryModalOpen(false)}
              className="w-full bg-[#182737] hover:bg-[#1e3247] text-white font-bold py-2.5 rounded-xl transition-all text-xs"
            >
              Fechar Histórico
            </button>
          </div>
        </div>
      )}

      {/* Modal: Classificação Inteligente de Atletas */}
      {smartRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00b49f]" />
                <h3 className="text-base font-bold text-white">Classificação Inteligente</h3>
              </div>
              <button onClick={() => setSmartRatingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              O algoritmo equilibra os times considerando posições específicas (goleiros, zagueiros, meias e atacantes) e as notas técnicas dos atletas.
            </p>

            <div className="bg-[#0d1721] p-3.5 rounded-xl border border-[#182737] space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Distribuição de Goleiros</span>
                <span className="text-[#00b49f] font-bold">1 por time (Automático)</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Ponderação de Nível Técnico</span>
                <span className="text-[#00b49f] font-bold">Ativa</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Trava Anti-Panela</span>
                <span className="text-[#00b49f] font-bold">Ligada</span>
              </div>
            </div>

            <button
              onClick={() => {
                showToast('Configurações de sorteio atualizadas!', 'success');
                setSmartRatingModalOpen(false);
              }}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all text-xs"
            >
              Salvar Parâmetros
            </button>
          </div>
        </div>
      )}

      {/* Modal: Fila de Espera Inteligente */}
      {waitlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-[#00b49f]" />
                <h3 className="text-base font-bold text-white">Fila de Espera Automática</h3>
              </div>
              <button onClick={() => setWaitlistModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Quando a lista atinge o limite de vagas ({group?.maxSlots || 18} atletas), os novos confirmados entram na fila por ordem de chegada e são promovidos automaticamente se houver desistência.
            </p>

            <div className="bg-[#0d1721] p-3.5 rounded-xl border border-[#182737] space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Limite da Pelada:</span>
                <span className="font-bold text-white">{group?.maxSlots || 18} atletas</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Prioridade de Mensalistas:</span>
                <span className="font-bold text-[#00b49f]">Ativa</span>
              </div>
            </div>

            <button
              onClick={() => {
                showToast('Fila de espera configurada!', 'success');
                setWaitlistModalOpen(false);
              }}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all text-xs"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal: Recorrência Automática */}
      {recurrenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-[#1e3247] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182737]">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-[#00b49f]" />
                <h3 className="text-base font-bold text-white">Recorrência Semanal</h3>
              </div>
              <button onClick={() => setRecurrenceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Abre a lista de presença semanalmente no horário configurado e notifica todos os membros via painel e WhatsApp.
            </p>

            <div className="bg-[#0d1721] p-3.5 rounded-xl border border-[#182737] space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Dia de Jogo:</span>
                <span className="font-bold text-white">{group?.matchDay || 'Quarta-feira'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Horário:</span>
                <span className="font-bold text-white">{group?.matchTime || '20:00'}</span>
              </div>
            </div>

            <button
              onClick={() => {
                showToast('Recorrência de peladas ativa!', 'success');
                setRecurrenceModalOpen(false);
              }}
              className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold py-2.5 rounded-xl shadow-md transition-all text-xs"
            >
              Confirmar Recorrência
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Sair do Grupo */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121e2b] border border-rose-900/40 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Sair do Baba?</h3>
              <p className="text-xs text-slate-400">
                Você deixará de receber convites e notificações deste grupo. Você poderá retornar através do código de convite.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="flex-1 bg-[#182737] hover:bg-[#1e3247] text-slate-300 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeaveGroup}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
