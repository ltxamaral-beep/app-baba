'use client';

import React, { useState, useEffect } from 'react';
import { mockAttendances } from '@/lib/mock-data';
import { drawBalancedTeams } from '@/lib/utils/draw-algorithm';
import { MatchAttendance, MatchTeam } from '@/types';
import { 
  Trophy, 
  Shuffle, 
  Lock, 
  Unlock, 
  Shield, 
  Star, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Users,
  Sliders,
  Share2
} from 'lucide-react';

export default function SorteioPage() {
  const [attendees, setAttendees] = useState<MatchAttendance[]>(mockAttendances);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<MatchTeam[]>([]);
  const [lockedAssignments, setLockedAssignments] = useState<Record<string, number>>({});
  const [isDrawing, setIsDrawing] = useState(false);

  // Executa o sorteio
  const handleDraw = () => {
    setIsDrawing(true);
    setTimeout(() => {
      const generated = drawBalancedTeams(attendees, {
        teamCount,
        playersPerTeam: 6,
        lockedAssignments,
      });
      setTeams(generated);
      setIsDrawing(false);
    }, 400);
  };

  // Roda uma vez ao inicializar
  useEffect(() => {
    handleDraw();
  }, [teamCount]);

  // Alterna a trava manual de um jogador em um time
  const toggleLockPlayer = (userId: string, targetTeamIndex: number) => {
    setLockedAssignments((prev) => {
      const copy = { ...prev };
      if (copy[userId] === targetTeamIndex) {
        delete copy[userId];
      } else {
        copy[userId] = targetTeamIndex;
      }
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Algoritmo de Balanceamento Tático
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-400" />
            Sorteio Inteligente de Equipes
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cruza ordem de chegada, média de notas de habilidade e posições em campo com suporte a travas manuais.
          </p>
        </div>

        {/* Controles do ADM */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <span className="text-slate-400 px-2 font-medium">Times:</span>
            {[2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => setTeamCount(num)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  teamCount === num
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            onClick={handleDraw}
            disabled={isDrawing}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
            Sortear Novamente
          </button>
        </div>
      </div>

      {/* Grid de Times Gerados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, teamIndex) => (
          <div
            key={team.id}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col"
          >
            {/* Header do Time */}
            <div
              className="p-4 border-b border-slate-800 flex items-center justify-between"
              style={{
                background: `linear-gradient(135deg, ${team.color}15, rgba(15, 23, 42, 0.6))`,
                borderTop: `3px solid ${team.color}`,
              }}
            >
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  {team.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {team.players.length} atletas escalados
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Média do Time</span>
                <span className="text-sm font-black text-amber-400 flex items-center gap-1 justify-end">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {team.averageRating.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Lista de Atletas do Time */}
            <div className="p-4 flex-1 space-y-2 divide-y divide-slate-800/40">
              {team.players.map((player) => {
                const isLocked = lockedAssignments[player.userId] === teamIndex;

                return (
                  <div
                    key={player.userId}
                    className="pt-2 first:pt-0 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-800">
                        {player.positionAssigned.substring(0, 3).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          {player.user.name}
                          {isLocked && (
                            <span className="text-[10px] text-emerald-400 font-normal">
                              🔒 Fixado
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {player.user.dominantFoot} • Nota: <strong className="text-slate-200">{player.user.overallRating.toFixed(1)}</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleLockPlayer(player.userId, teamIndex)}
                      title={isLocked ? 'Desbloquear do time' : 'Fixar neste time (trava manual)'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isLocked
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer do Card */}
            <div className="p-3 bg-slate-950/60 border-t border-slate-800/60 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Posições balanceadas</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Regras do Algoritmo */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 space-y-2">
        <h4 className="font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Como o algoritmo equilibra a pelada:
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-slate-400">
          <li className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-slate-200 block mb-1">1. Balanceamento Tático</strong>
            Distribui primeiro os goleiros e defensores entre os times para não acumular jogadores da mesma posição.
          </li>
          <li className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-slate-200 block mb-1">2. Média Ponderada</strong>
            Calcula o rating individual de cada atleta e equilibra a soma de notas de todas as equipes.
          </li>
          <li className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-slate-200 block mb-1">3. Travas Manuais pelo ADM</strong>
            Permite clicar no cadeado para fixar atletas ou duplas em um time específico sem desbalancear o resto.
          </li>
        </ul>
      </div>
    </div>
  );
}
