'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MatchService, GroupService } from '@/lib/services/storage-service';
import { mockUsers } from '@/lib/mock-data';
import { Match, MatchAttendance, UserProfile, UserPosition, DominantFoot } from '@/types';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  Trophy, 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  Unlock,
  ShieldCheck,
  UserPlus,
  Trash2,
  Ticket,
  X,
  Share2,
  Copy,
  MessageCircle,
  Check
} from 'lucide-react';

export default function AttendancePage({ params }: { params: { groupId: string; matchId: string } }) {
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [attendances, setAttendances] = useState<MatchAttendance[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile>(mockUsers[0]);
  const [notification, setNotification] = useState<string | null>(null);
  const [copiedList, setCopiedList] = useState(false);

  // Convidados
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState({
    name: '',
    position: 'meia' as UserPosition,
    dominantFoot: 'destro' as DominantFoot,
    overallRating: 6.5,
    phone: '',
  });

  useEffect(() => {
    setMatch(MatchService.getMatchById(params.matchId) || null);
    setGroup(GroupService.getGroupById(params.groupId) || null);
    setAttendances(MatchService.getAttendances(params.matchId));
  }, [params.matchId, params.groupId]);

  if (!match) return <div className="p-8 text-center text-slate-400">Carregando lista...</div>;

  const confirmedList = attendances.filter((a) => a.status === 'confirmed' || a.status === 'present');
  const waitlist = attendances.filter((a) => a.status === 'waitlist');
  const guestList = attendances.filter((a) => a.isGuest && a.status !== 'cancelled');
  const isFull = confirmedList.length >= match.maxPlayers;

  const myAttendance = attendances.find((a) => a.userId === activeUser.id);
  const isMyAttendanceConfirmed = myAttendance?.status === 'confirmed' || myAttendance?.status === 'present';
  const isMyAttendanceWaitlist = myAttendance?.status === 'waitlist';

  // Verifica se o usuário ativo é inadimplente ou está pendente de aprovação da diretoria
  const members = GroupService.getMembers(params.groupId || 'group-1');
  const myMemberInfo = members.find((m) => m.userId === activeUser.id);
  const isBlocked = myMemberInfo?.isBlockedFinancial || false;
  const isPendingApproval = myMemberInfo?.status === 'pending_approval';
  const isDirector = myMemberInfo?.role === 'presidente' || myMemberInfo?.role === 'adm' || myMemberInfo?.role === 'tesoureiro';

  const handleConfirm = () => {
    if (isPendingApproval) {
      setNotification('Sua entrada no grupo ainda está em análise pela diretoria (Presidente, ADM ou Tesoureiro).');
      return;
    }
    try {
      const res = MatchService.confirmAttendance(match.id, activeUser, match.maxPlayers, params.groupId);
      setAttendances(MatchService.getAttendances(match.id));
      const isWait = res.status === 'waitlist';
      setNotification(isWait ? 'Vagas principais esgotadas. Você entrou na Fila de Espera!' : 'Presença confirmada com sucesso!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Erro ao confirmar presença');
    }
  };

  const handleCancel = () => {
    const res = MatchService.cancelAttendance(match.id, activeUser.id);
    setAttendances(MatchService.getAttendances(match.id));
    if (res.promotedUser) {
      setNotification(`Sua presença foi cancelada. O atleta ${res.promotedUser.name} foi promovido da fila de espera!`);
    } else {
      setNotification('Sua presença foi cancelada.');
    }
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;

    MatchService.addGuestAttendance(
      match.id,
      activeUser,
      {
        name: guestForm.name,
        position: guestForm.position,
        overallRating: Number(guestForm.overallRating) || 6.5,
        dominantFoot: guestForm.dominantFoot,
        phone: guestForm.phone,
      },
      match.maxPlayers,
      params.groupId
    );

    setGuestModalOpen(false);
    setGuestForm({
      name: '',
      position: 'meia',
      dominantFoot: 'destro',
      overallRating: 6.5,
      phone: '',
    });
    setAttendances(MatchService.getAttendances(match.id));
    setNotification(`Convidado ${guestForm.name} adicionado com sucesso! 🎟️`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRemoveGuest = (attendanceId: string, guestName: string) => {
    if (confirm(`Deseja remover o convidado ${guestName} da lista?`)) {
      MatchService.removeGuestAttendance(match.id, attendanceId);
      setAttendances(MatchService.getAttendances(match.id));
      setNotification(`Convidado ${guestName} removido da lista.`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleCheckInOrder = (userId: string) => {
    const currentCheckedIn = attendances.filter((a) => a.status === 'present').length;
    MatchService.checkInArrival(match.id, userId, currentCheckedIn + 1, params.groupId);
    setAttendances(MatchService.getAttendances(match.id));
  };

  const handlePromoteToConfirmed = (attendanceId: string, athleteName: string) => {
    if (!match) return;
    MatchService.promoteWaitlistToConfirmed(match.id, attendanceId);
    setAttendances(MatchService.getAttendances(match.id));
    setNotification(`⚽ ${athleteName} foi promovido para a lista de confirmados pela diretoria!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDemoteToWaitlist = (attendanceId: string, athleteName: string) => {
    if (!match) return;
    MatchService.demoteConfirmedToWaitlist(match.id, attendanceId);
    setAttendances(MatchService.getAttendances(match.id));
    setNotification(`${athleteName} foi movido para a fila de espera.`);
    setTimeout(() => setNotification(null), 4000);
  };

  const isDeadlinePassed = match.confirmationDeadline
    ? new Date() > new Date(match.confirmationDeadline)
    : false;

  const formattedDeadline = match.confirmationDeadline
    ? (() => {
        try {
          const d = new Date(match.confirmationDeadline);
          return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          return match.confirmationDeadline;
        }
      })()
    : null;

  const getWhatsAppListText = () => {
    if (!match) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gestao-pelada-one.vercel.app';
    const groupName = group?.name || 'PELADA';
    
    let deadlineText = '';
    if (match.confirmationDeadline) {
      try {
        const d = new Date(match.confirmationDeadline);
        deadlineText = `\n⏰ *Prazo Limite:* ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      } catch {
        deadlineText = `\n⏰ *Prazo Limite:* ${match.confirmationDeadline}`;
      }
    }

    let text = `⚽ *PARCIAL DA LISTA - ${groupName.toUpperCase()}*\n`;
    text += `📅 *Data:* ${match.matchDate} às ${match.startTime}\n`;
    if (group?.fieldAddress) text += `📍 *Local:* ${group.fieldAddress}\n`;
    text += `📊 *Vagas:* ${confirmedList.length}/${match.maxPlayers}${deadlineText}\n\n`;

    text += `📋 *CONFIRMADOS (${confirmedList.length}/${match.maxPlayers}):*\n`;
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

    if (waitlist.length > 0) {
      text += `\n⏳ *FILA DE ESPERA (${waitlist.length}):*\n`;
      waitlist.forEach((att, idx) => {
        const pos = att.user.mainPosition ? ` (${att.user.mainPosition.toUpperCase()})` : '';
        const guestTag = att.isGuest ? ` _[Conv. de ${att.invitedByName || 'Associado'}]_` : '';
        text += `${idx + 1}º. ${att.user.name}${pos}${guestTag}\n`;
      });
    }

    text += `\n👉 *Confirme sua presença no app:*\n${origin}/grupos/${params.groupId}/pelada\n`;
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
    setNotification('Parcial da lista copiada com sucesso! 📋');
    setTimeout(() => {
      setCopiedList(false);
      setNotification(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              Chamada Oficial
            </div>
            <h1 className="text-2xl font-black text-white">Lista de Presença & Fila de Espera</h1>
            <p className="text-xs text-slate-400">Partida de {match.matchDate} às {match.startTime}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botões de Compartilhar Parcial */}
          <button
            type="button"
            onClick={handleShareWhatsAppList}
            className="inline-flex items-center gap-1.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
            title="Compartilhar lista parcial formatada no WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-[#25D366]" /> WhatsApp Parcial
          </button>

          <button
            type="button"
            onClick={handleCopyList}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-colors"
            title="Copiar texto da lista"
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

          <Link
            href={`/grupos/${params.groupId}/peladas/${match.id}/sorteio`}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Trophy className="w-4 h-4" /> Ir para o Sorteio
          </Link>
        </div>
      </div>

      {/* Notificação dinâmica */}
      {notification && (
        <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          {notification}
        </div>
      )}

      {/* Card de Ação do Jogador (Simulação de Usuário) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Perfil Ativo para Confirmação:</span>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={activeUser.id}
                onChange={(e) => {
                  const selected = mockUsers.find((u) => u.id === e.target.value);
                  if (selected) setActiveUser(selected);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.mainPosition.toUpperCase()}) {u.id === 'user-6' ? '⚠️ INADIMPLENTE' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status do Jogador */}
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <span className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Bloqueado por Débito
              </span>
            ) : isMyAttendanceConfirmed ? (
              <span className="text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vaga Confirmada
              </span>
            ) : isMyAttendanceWaitlist ? (
              <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Na Fila de Espera
              </span>
            ) : (
              <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                Não confirmado
              </span>
            )}
          </div>
        </div>

        {/* Botão de Confirmação ou Cancelamento */}
        {isPendingApproval ? (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">Solicitação em Análise pela Diretoria!</p>
              <p className="text-[11px] text-amber-200/90 mt-0.5">
                Sua entrada no grupo ainda está pendente de aprovação do Presidente, Tesoureiro ou ADM. Assim que for aprovado, você poderá confirmar presença na lista.
              </p>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-300">Você está bloqueado de jogar nesta pelada!</p>
              <p className="text-[11px] text-rose-400/90 mt-0.5">
                Identificamos mensalidade ou diária em atraso. Entre na aba <Link href={`/grupos/${params.groupId}/financas`} className="underline font-bold">Finanças</Link> ou procure um ADM para dar a baixa e liberar sua vaga.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {isMyAttendanceConfirmed || isMyAttendanceWaitlist ? (
              <button
                onClick={handleCancel}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <UserX className="w-4 h-4" /> Cancelar Minha Presença (Abrir Vaga)
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> {isFull ? 'Entrar na Fila de Espera' : 'Confirmar Minha Vaga'}
              </button>
            )}

            {(isMyAttendanceConfirmed || isDirector) && (
              <button
                onClick={() => setGuestModalOpen(true)}
                className="bg-[#00b49f]/15 hover:bg-[#00b49f]/25 border border-[#00b49f]/40 text-[#00b49f] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" /> + Adicionar Convidado
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid: Lista Principal vs Fila de Espera */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LISTA PRINCIPAL */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Vagas Garantidas ({confirmedList.length} / {match.maxPlayers})
              </h2>
              <p className="text-[11px] text-slate-400">Atletas escalados para o jogo</p>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {confirmedList.map((att, idx) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-[10px]">
                    {idx + 1}º
                  </span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                      {att.user.name}
                      {att.isGuest && (
                        <span className="text-[9px] bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded font-bold">
                          🎟️ Convidado de {att.invitedByName}
                        </span>
                      )}
                      {att.status === 'present' && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded font-bold">
                          PRESENTE (Chegada #{att.arrivalOrder})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {att.user.mainPosition} • Nota {att.user.overallRating.toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isDirector && (
                    <button
                      type="button"
                      onClick={() => handleDemoteToWaitlist(att.id, att.user.name)}
                      className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                      title="Mover atleta para a fila de espera"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {att.isGuest && (att.invitedByUserId === activeUser.id || isDirector) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGuest(att.id, att.user.name)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remover convidado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {att.status !== 'present' && (
                    <button
                      type="button"
                      onClick={() => handleCheckInOrder(att.userId)}
                      title="Marcar presença no campo (ordem de chegada)"
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      Chegou no Campo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FILA DE ESPERA */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Fila de Espera Automática ({waitlist.length})
              </h2>
              <p className="text-[11px] text-slate-400">Promovidos automaticamente ou manualmente pela comissão</p>
            </div>
          </div>

          {waitlist.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              Nenhum jogador na fila de espera no momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {waitlist.map((att, idx) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-xs gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}º
                    </span>
                    <div>
                      <p className="font-bold text-amber-200">{att.user.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {att.user.mainPosition} • Suplente #{idx + 1}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isDirector && (
                      <button
                        type="button"
                        onClick={() => handlePromoteToConfirmed(att.id, att.user.name)}
                        className="inline-flex items-center gap-1 bg-[#00b49f]/15 hover:bg-[#00b49f]/30 border border-[#00b49f]/40 text-[#00b49f] font-bold px-2 py-1 rounded-lg text-[10px] transition-all active:scale-95 shadow-sm"
                        title="Promover para a lista de confirmados"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Confirmar
                      </button>
                    )}
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-900/40 px-2 py-0.5 rounded">
                      Na Fila
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LISTA A PARTE: CONVIDADOS DA PELADA */}
      <div className="bg-[#121e2b] border border-[#1e3247] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182737] pb-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#00b49f]" />
              Lista de Convidados dos Associados ({guestList.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Convidados indicados pelos associados para a partida.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setGuestModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-[#00b49f]/20 self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" /> + Adicionar Convidado
          </button>
        </div>

        {guestList.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs italic bg-[#0d1721]/60 rounded-xl border border-dashed border-[#182737] p-4">
            Nenhum convidado adicionado até o momento. Como associado confirmado, você pode convidar amigos para a pelada!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {guestList.map((att) => (
              <div
                key={att.id}
                className="p-4 rounded-xl bg-[#0d1721] border border-[#182737] flex flex-col justify-between gap-3 text-xs shadow-sm hover:border-[#00b49f]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white text-sm">{att.user.name}</p>
                    <span className="inline-block mt-1 text-[10px] text-[#00b49f] font-bold bg-[#00b49f]/10 border border-[#00b49f]/20 px-2 py-0.5 rounded-full">
                      👤 Convidado por {att.invitedByName || 'Associado'}
                    </span>
                  </div>

                  {(att.invitedByUserId === activeUser.id || isDirector) && (
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

            <form onSubmit={handleAddGuest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome do Convidado *
                </label>
                <input
                  type="text"
                  value={guestForm.name}
                  onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                  placeholder="Ex: Carlos Silva"
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
                👤 <strong className="text-slate-200">Responsável pelo convite:</strong> {activeUser.name}
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
