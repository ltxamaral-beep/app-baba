'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Activity, 
  Users, 
  DollarSign, 
  Trophy, 
  User, 
  PlusCircle, 
  Settings,
  Award,
  CheckCircle2,
  ChevronDown,
  Search,
  Sparkles,
  Shield,
  Bell,
  CheckCheck,
  Check,
  X,
  UserPlus,
  MapPin,
  Clock
} from 'lucide-react';
import { GroupService, UserService, MatchService, NotificationService } from '@/lib/services/storage-service';
import { Group, GroupMember, AppNotification, UserProfile } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userGroups, setUserGroups] = useState<Array<{ group: Group; member: GroupMember }>>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [nextMatchId, setNextMatchId] = useState<string>('match-1');

  // Estado da Central de Notificações
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'requests' | 'presence' | 'arrival'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadNavData = async () => {
    const user = UserService.getCurrentUser();
    setCurrentUser(user);
    const groups = GroupService.getUserGroups();
    const activeId = GroupService.getActiveGroupId();
    setUserGroups(groups);
    setActiveGroupId(activeId);

    if (activeId) {
      const member = GroupService.getMemberInGroup(activeId);
      setCurrentMember(member);

      const matches = MatchService.getMatches(activeId);
      if (matches.length > 0) {
        setNextMatchId(matches[0].id);
      }
    }

    // Carrega notificações
    loadNotifications(activeId);

    try {
      const cloudGroups = await GroupService.syncAllWithCloud();
      setUserGroups(cloudGroups);
      const newActiveId = GroupService.getActiveGroupId();
      setActiveGroupId(newActiveId);
      if (newActiveId) {
        setCurrentMember(GroupService.getMemberInGroup(newActiveId));
        loadNotifications(newActiveId);
      }
    } catch (e) {
      console.warn('Erro ao sincronizar Navbar com nuvem:', e);
    }
  };

  const loadNotifications = (groupId?: string | null) => {
    const list = NotificationService.getNotifications(groupId || undefined);
    setNotifications(list);
  };

  useEffect(() => {
    loadNavData();
    // Atualização em tempo real das notificações a cada 5 segundos
    const interval = setInterval(() => {
      const activeId = GroupService.getActiveGroupId();
      loadNotifications(activeId);
    }, 5000);

    const handleGroupChanged = (e: any) => {
      const gid = e?.detail?.groupId || GroupService.getActiveGroupId();
      setActiveGroupId(gid);
      if (gid) {
        setCurrentMember(GroupService.getMemberInGroup(gid));
        loadNotifications(gid);
      }
    };

    window.addEventListener('active_group_changed', handleGroupChanged);
    window.addEventListener('storage', handleGroupChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('active_group_changed', handleGroupChanged);
      window.removeEventListener('storage', handleGroupChanged);
    };
  }, [pathname]);

  const activeGroupItem = userGroups.find((ug) => ug.group.id === activeGroupId);
  const isDirector = currentMember?.role === 'presidente' || currentMember?.role === 'adm' || currentMember?.role === 'tesoureiro';

  const handleSelectGroup = (groupId: string) => {
    GroupService.setActiveGroupId(groupId);
    setActiveGroupId(groupId);
    setDropdownOpen(false);
    loadNotifications(groupId);
    setCurrentMember(GroupService.getMemberInGroup(groupId));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('active_group_changed', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    if (pathname.includes('/grupos/')) {
      router.push(`/grupos/${groupId}/pelada`);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  const handleApproveMember = async (notifId: string, memberId?: string) => {
    if (!activeGroupId || !memberId) return;
    setActionLoadingId(notifId);
    await NotificationService.approveMemberRequest(activeGroupId, memberId);
    NotificationService.markAsRead(notifId);
    setActionLoadingId(null);
    loadNotifications(activeGroupId);
    loadNavData();
  };

  const handleRejectMember = async (notifId: string, memberId?: string) => {
    if (!activeGroupId || !memberId) return;
    setActionLoadingId(notifId);
    await NotificationService.rejectMemberRequest(activeGroupId, memberId);
    NotificationService.markAsRead(notifId);
    setActionLoadingId(null);
    loadNotifications(activeGroupId);
    loadNavData();
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead(activeGroupId || undefined);
    loadNotifications(activeGroupId);
  };

  const handleMarkRead = (notifId: string) => {
    NotificationService.markAsRead(notifId);
    loadNotifications(activeGroupId);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifs = notifications.filter((n) => {
    if (notifFilter === 'requests') return n.type === 'member_request' || n.type === 'member_approved';
    if (notifFilter === 'presence') return n.type === 'attendance_confirmed';
    if (notifFilter === 'arrival') return n.type === 'player_arrived';
    return true;
  });

  // Nav Items dinâmicos com proteção de cargo
  const navItems = [
    { href: '/dashboard', label: 'Painel', icon: Activity, publicAccess: true },
    ...(activeGroupId ? [
      { href: `/grupos/${activeGroupId}/pelada`, label: '⚽ Pelada & Rankings', icon: Trophy, publicAccess: true },
    ] : []),
    ...(activeGroupId && isDirector ? [
      { href: `/grupos/${activeGroupId}/financas`, label: 'Finanças', icon: DollarSign, publicAccess: false },
      { href: `/grupos/${activeGroupId}/configuracoes`, label: 'Editar Grupo', icon: Settings, publicAccess: false },
    ] : [])
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo & Seletor Multi-Grupos */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
            <img
              src="/logo.png"
              alt="Reis da Pelada"
              className="w-9 h-9 rounded-xl object-cover border border-amber-500/40 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform"
            />
            <div className="hidden sm:block">
              <span className="font-black text-sm tracking-tight text-white block leading-none">
                Reis da Pelada
              </span>
              <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider block mt-0.5">
                Oficial
              </span>
            </div>
          </Link>

          {/* Group Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotifOpen(false);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs text-white font-bold transition-all"
            >
              <span className="truncate max-w-[120px] sm:max-w-[160px]">
                {activeGroupItem ? activeGroupItem.group.name : 'Selecionar Grupo'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  Meus Grupos ({userGroups.length})
                </div>

                {userGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 italic text-center">Nenhum grupo ativo.</p>
                ) : (
                  userGroups.map((ug) => (
                    <button
                      key={ug.group.id}
                      onClick={() => handleSelectGroup(ug.group.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        ug.group.id === activeGroupId
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{ug.group.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 uppercase font-semibold">
                        {ug.member.role}
                      </span>
                    </button>
                  ))
                )}

                <div className="pt-2 border-t border-slate-800 space-y-1">
                  {activeGroupId && isDirector && (
                    <Link
                      href={`/grupos/${activeGroupId}/configuracoes`}
                      onClick={() => setDropdownOpen(false)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5" /> Editar Parâmetros do Grupo
                    </Link>
                  )}
                  <Link
                    href="/grupos/novo"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Criar Novo Grupo
                  </Link>
                  <Link
                    href="/grupos/buscar"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" /> Entrar com Código
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User / Notificações / Perfil */}
        <div className="flex items-center gap-2">
          {/* Balão de Notificações com Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen(!notifOpen);
                setDropdownOpen(false);
              }}
              title="Central de Notificações"
              className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Popover da Central de Notificações */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-white uppercase tracking-wider">Notificações</span>
                    {unreadCount > 0 && (
                      <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 font-bold flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Ler todas
                    </button>
                  )}
                </div>

                {/* Filtros da Central */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('all')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      notifFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('requests')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      notifFilter === 'requests' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Solicitações
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('presence')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      notifFilter === 'presence' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Presença
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('arrival')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      notifFilter === 'arrival' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Chegada ao Campo
                  </button>
                </div>

                {/* Lista de Alertas */}
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {filteredNotifs.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs italic">
                      Nenhuma notificação por enquanto.
                    </div>
                  ) : (
                    filteredNotifs.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className={`p-3 rounded-2xl border transition-all text-left ${
                          n.read
                            ? 'bg-slate-950/60 border-slate-800/60 opacity-70'
                            : 'bg-slate-800/90 border-slate-700 shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 p-1.5 rounded-xl bg-slate-950 flex-shrink-0">
                            {n.type === 'member_request' ? (
                              <UserPlus className="w-4 h-4 text-amber-400" />
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
                              <h4 className="text-xs font-bold text-white truncate">{n.title}</h4>
                              <span className="text-[9px] text-slate-500 flex-shrink-0">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 leading-tight">{n.message}</p>

                            {/* Ações Rápidas de Aprovação/Recusa para Gestores */}
                            {n.type === 'member_request' && isDirector && n.data?.memberId && (
                              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-700/60">
                                <button
                                  type="button"
                                  disabled={actionLoadingId === n.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveMember(n.id, n.data?.memberId);
                                  }}
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-[10px] font-black py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                >
                                  <Check className="w-3 h-3" /> {actionLoadingId === n.id ? 'Processando...' : 'Aprovar'}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoadingId === n.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectMember(n.id, n.data?.memberId);
                                  }}
                                  className="flex-1 bg-rose-950/60 hover:bg-rose-900 disabled:opacity-50 text-rose-300 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-rose-800/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                                >
                                  <X className="w-3 h-3" /> Recusar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/perfil"
            title="Meu Perfil de Atleta"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs text-slate-200 font-bold transition-colors"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover border border-emerald-500/60 shadow-sm"
              />
            ) : (
              <User className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline truncate max-w-[120px]">
              {currentUser?.nickname || currentUser?.name?.split(' ')[0] || 'Meu Perfil'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);

  useEffect(() => {
    const activeId = GroupService.getActiveGroupId();
    setActiveGroupId(activeId);
    if (activeId) {
      const member = GroupService.getMemberInGroup(activeId);
      setIsDirector(member?.role === 'presidente' || member?.role === 'adm' || member?.role === 'tesoureiro');
    }
  }, [pathname]);

  const navItems = [
    { href: '/dashboard', label: 'Painel', icon: Activity },
    ...(activeGroupId ? [
      { href: `/grupos/${activeGroupId}/pelada`, label: 'Pelada', icon: Trophy },
    ] : []),
    ...(activeGroupId && isDirector ? [
      { href: `/grupos/${activeGroupId}/financas`, label: 'Finanças', icon: DollarSign },
    ] : []),
    { href: '/perfil', label: 'Perfil', icon: User }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[9px]">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
