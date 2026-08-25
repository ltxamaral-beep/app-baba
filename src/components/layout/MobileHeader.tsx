'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, ArrowLeft, Bell, User, Check, X, Shield, PlusCircle, Trophy, DollarSign, Settings, Users, Sparkles, LogOut } from 'lucide-react';
import { GroupService, UserService, NotificationService } from '@/lib/services/storage-service';
import { AuthService } from '@/lib/services/auth-service';
import { Group, GroupMember, AppNotification } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function MobileHeader({ title, showBack = false, onBack }: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userGroups, setUserGroups] = useState<Array<{ group: Group; member: GroupMember }>>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadData = async () => {
    const groups = GroupService.getUserGroups();
    setUserGroups(groups);
    const activeId = GroupService.getActiveGroupId();
    if (activeId) {
      const g = GroupService.getGroupById(activeId);
      setActiveGroup(g || (groups.length > 0 ? groups[0].group : null));
    } else if (groups.length > 0) {
      setActiveGroup(groups[0].group);
    }
    const notifs = await NotificationService.syncFromCloud(activeId || undefined);
    setNotifications(notifs);
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 5000);
    const userId = UserService.getCurrentUser()?.id;
    const channel = userId ? NotificationService.subscribe(userId, loadData) : null;

    const handleGroupChanged = () => loadData();
    window.addEventListener('active_group_changed', handleGroupChanged);
    window.addEventListener('storage', handleGroupChanged);

    return () => {
      window.removeEventListener('active_group_changed', handleGroupChanged);
      window.removeEventListener('storage', handleGroupChanged);
      clearInterval(interval);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [pathname]);

  // Define dynamic title based on pathname if not provided
  let computedTitle = title;
  if (!computedTitle) {
    if (pathname.includes('/configuracoes')) computedTitle = 'Ajustes do grupo';
    else if (pathname.includes('/resenha')) computedTitle = 'Resenha';
    else if (pathname.includes('/financas')) computedTitle = 'Financeiro';
    else if (pathname.includes('/pelada') || pathname.includes('/peladas')) computedTitle = 'Pelada';
    else if (pathname.includes('/perfil')) computedTitle = 'Meu Perfil';
    else if (pathname.includes('/dashboard')) computedTitle = 'Painel do Baba';
    else computedTitle = activeGroup?.name || 'Gestão Pelada';
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSelectGroup = (groupId: string) => {
    GroupService.setActiveGroupId(groupId);
    setDrawerOpen(false);
    loadData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('active_group_changed', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
    router.refresh();
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await AuthService.signOut();
    setDrawerOpen(false);
    setNotifOpen(false);
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0d1721] border-b border-[#182737] px-4 py-3 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={onBack ? onBack : () => router.back()}
                className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
                aria-label="Menu principal"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight">
                {computedTitle}
              </h1>
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {activeGroup?.name || 'BABA DA IRMANDADE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Notificações */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors"
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00b49f] rounded-full animate-pulse" />
                )}
              </button>

              {/* Dropdown Notificações */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#121e2b] border border-[#1e3247] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e3247]">
                    <span className="text-xs font-bold text-white">Notificações</span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto mt-2 space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">Sem notificações no momento.</p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs ${
                            n.read
                              ? 'bg-[#0d1721] border-[#182737] text-slate-400'
                              : 'bg-[#182737] border-[#00b49f]/40 text-slate-200'
                          }`}
                        >
                          <p className="font-bold text-white text-[11px]">{n.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Perfil */}
            <Link
              href="/perfil"
              className="p-1.5 rounded-xl border border-[#1e3247] bg-[#121e2b] hover:bg-[#182737] text-slate-200 transition-colors"
              title="Meu Perfil"
            >
              <User className="w-5 h-5 text-[#00b49f]" />
            </Link>
          </div>
        </div>
      </header>

      {/* Drawer / Sidebar Lateral */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] bg-[#0d1721] border-r border-[#182737] h-full p-5 flex flex-col justify-between shadow-2xl z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#182737]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00b49f]/20 border border-[#00b49f]/40 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-[#00b49f]" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">Reis da Pelada</h3>
                    <p className="text-[9px] text-[#00b49f] font-bold uppercase">Gestão & Resenha</p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Seus Babas / Grupos */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Meus Babas
                  </span>
                  <Link
                    href="/grupos/novo"
                    onClick={() => setDrawerOpen(false)}
                    className="text-[10px] text-[#00b49f] hover:underline flex items-center gap-1 font-bold"
                  >
                    <PlusCircle className="w-3 h-3" /> Criar Baba
                  </Link>
                </div>

                <div className="space-y-1.5">
                  {userGroups.map(({ group, member }) => {
                    const isActive = group.id === activeGroup?.id;
                    return (
                      <button
                        key={group.id}
                        onClick={() => handleSelectGroup(group.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isActive
                            ? 'bg-[#182737] border-[#00b49f] text-white shadow-md'
                            : 'bg-[#121e2b] border-[#182737] text-slate-300 hover:bg-[#182737]'
                        }`}
                      >
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{group.name}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{group.soccerType} • {member.role}</p>
                        </div>
                        {isActive && <Check className="w-4 h-4 text-[#00b49f] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Atalhos Rápidos */}
              <div className="mt-6 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Navegação Rápida
                </span>
                {activeGroup && (
                  <>
                    <Link
                      href={`/grupos/${activeGroup.id}/pelada`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-slate-300 hover:bg-[#182737] hover:text-white"
                    >
                      <Trophy className="w-4 h-4 text-[#00b49f]" /> Próxima Pelada
                    </Link>
                    <Link
                      href={`/grupos/${activeGroup.id}/financas`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-slate-300 hover:bg-[#182737] hover:text-white"
                    >
                      <DollarSign className="w-4 h-4 text-[#00b49f]" /> Financeiro do Baba
                    </Link>
                    <Link
                      href={`/grupos/${activeGroup.id}/resenha`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-slate-300 hover:bg-[#182737] hover:text-white"
                    >
                      <Sparkles className="w-4 h-4 text-[#00b49f]" /> Resenha & Estatísticas
                    </Link>
                    <Link
                      href={`/grupos/${activeGroup.id}/configuracoes`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-slate-300 hover:bg-[#182737] hover:text-white"
                    >
                      <Settings className="w-4 h-4 text-[#00b49f]" /> Ajustes do Grupo
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#182737]">
              <Link
                href="/perfil"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#182737] hover:text-white"
              >
                {UserService.getCurrentUser()?.avatarUrl ? (
                  <img
                    src={UserService.getCurrentUser()?.avatarUrl}
                    alt="Perfil"
                    className="w-5 h-5 rounded-full object-cover border border-[#00b49f]"
                  />
                ) : (
                  <User className="w-4 h-4 text-[#00b49f]" />
                )}
                <span>
                  {UserService.getCurrentUser()?.name}
                  {UserService.getCurrentUser()?.nickname ? ` (${UserService.getCurrentUser()?.nickname})` : ''}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-rose-900/60 bg-rose-950/30 p-2 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-950/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" /> {signingOut ? 'Saindo...' : 'Sair do aplicativo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
