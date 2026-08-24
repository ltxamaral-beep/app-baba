'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ClipboardList, 
  Coins, 
  Settings, 
  Beer,
  Award
} from 'lucide-react';
import { GroupService } from '@/lib/services/storage-service';

// Ícone SVG de Campo de Futebol para fidelidade total ao print
function SoccerPitchIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="3" />
      <path d="M2 9a3 3 0 0 1 3 3 3 3 0 0 1-3 3" />
      <path d="M22 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3" />
    </svg>
  );
}

export function BottomNavigation() {
  const pathname = usePathname();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const loadActiveGroup = () => {
    const activeId = GroupService.getActiveGroupId();
    if (activeId) {
      setActiveGroupId(activeId);
    } else {
      const groups = GroupService.getUserGroups();
      if (groups.length > 0) {
        setActiveGroupId(groups[0].group.id);
      }
    }
  };

  useEffect(() => {
    loadActiveGroup();
    const handleGroupChanged = () => loadActiveGroup();
    window.addEventListener('active_group_changed', handleGroupChanged);
    window.addEventListener('storage', handleGroupChanged);
    return () => {
      window.removeEventListener('active_group_changed', handleGroupChanged);
      window.removeEventListener('storage', handleGroupChanged);
    };
  }, [pathname]);

  const targetGroupId = activeGroupId || 'group-1';

  const tabs = [
    {
      id: 'lista',
      label: 'Lista',
      href: `/dashboard`,
      icon: ClipboardList,
      isActive: pathname === '/dashboard' || pathname.includes('/presenca'),
    },
    {
      id: 'financas',
      label: 'Financeiro',
      href: `/grupos/${targetGroupId}/financas`,
      icon: Coins,
      isActive: pathname.includes('/financas'),
    },
    {
      id: 'pelada',
      label: 'Pelada',
      href: `/grupos/${targetGroupId}/pelada`,
      icon: SoccerPitchIcon,
      isActive: pathname.includes('/pelada') && !pathname.includes('/configuracoes') && !pathname.includes('/resenha') && !pathname.includes('/financas'),
    },
    {
      id: 'resenha',
      label: 'Resenha',
      href: `/grupos/${targetGroupId}/resenha`,
      icon: Beer,
      isActive: pathname.includes('/resenha'),
    },
    {
      id: 'ajustes',
      label: 'Ajustes',
      href: `/grupos/${targetGroupId}/configuracoes`,
      icon: Settings,
      isActive: pathname.includes('/configuracoes'),
    },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a1118] border-t border-[#182737] select-none h-16 sm:h-18 px-2 max-w-md mx-auto sm:max-w-none shadow-2xl"
      aria-label="Navegação Principal"
    >
      <div className="flex items-center justify-around h-full relative">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center group"
            >
              {active ? (
                <div className="relative -top-3.5 flex flex-col items-center animate-in zoom-in-75 duration-200">
                  {/* Arched Background Bulb Glow */}
                  <div className="w-14 h-14 rounded-full bg-[#00b49f] flex items-center justify-center text-white shadow-lg shadow-[#00b49f]/40 border-4 border-[#0a1118]">
                    <Icon className="w-7 h-7" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-slate-200 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
