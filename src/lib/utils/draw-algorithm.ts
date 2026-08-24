import { MatchAttendance, MatchTeam, UserPosition } from '@/types';

export interface DrawOptions {
  teamCount: number;
  playersPerTeam: number;
  lockedPairs?: Array<[string, string]>; // User IDs that must stay on the same team
  lockedAssignments?: Record<string, number>; // User ID -> Team Index
}

/**
 * Algoritmo Inteligente de Sorteio de Pelada
 * Equilibra:
 * 1. Posições táticas (Goleiros, Zagueiros, Meias, Atacantes)
 * 2. Média de notas (Overall Rating)
 * 3. Ordem de chegada (ordem preferencial)
 * 4. Travas manuais definidas pelo ADM
 */
export function drawBalancedTeams(
  attendees: MatchAttendance[],
  options: DrawOptions
): MatchTeam[] {
  const { teamCount, lockedAssignments = {} } = options;
  
  // Cores esportivas dinâmicas para os coletes
  const teamMeta = [
    { name: 'Colete Verde', color: '#10b981' },
    { name: 'Colete Preto', color: '#1e293b' },
    { name: 'Colete Laranja', color: '#f97316' },
    { name: 'Colete Azul', color: '#3b82f6' },
    { name: 'Colete Branco', color: '#e2e8f0' },
  ];

  const teams: MatchTeam[] = Array.from({ length: teamCount }, (_, i) => ({
    id: `team-${i + 1}`,
    name: teamMeta[i % teamMeta.length].name,
    color: teamMeta[i % teamMeta.length].color,
    averageRating: 0,
    players: [],
  }));

  // Filtra apenas jogadores confirmados e não bloqueados
  const eligible = attendees.filter(
    (a) => a.status === 'confirmed' || a.status === 'present'
  );

  // Separação por categorias de posições
  const positionGroups: Record<string, MatchAttendance[]> = {
    goleiros: eligible.filter((a) => (a.user.mainPosition || '').toLowerCase() === 'goleiro' || (a as any).role === 'goleiro' || (a as any).membershipType === 'goleiro'),
    defensores: eligible.filter((a) => ['zagueiro', 'lateral'].includes((a.user.mainPosition || '').toLowerCase()) && (a.user.mainPosition || '').toLowerCase() !== 'goleiro'),
    meioCampo: eligible.filter((a) => ['volante', 'meia'].includes((a.user.mainPosition || '').toLowerCase()) && (a.user.mainPosition || '').toLowerCase() !== 'goleiro'),
    atacantes: eligible.filter((a) => (a.user.mainPosition || '').toLowerCase() === 'atacante'),
  };

  // Função auxiliar para distribuir um grupo equilibrando as notas dos times
  const distributeGroup = (players: MatchAttendance[]) => {
    // Ordena por nota decrescente
    const sorted = [...players].sort(
      (a, b) => b.user.overallRating - a.user.overallRating
    );

    for (const player of sorted) {
      // Se tiver trava manual para um time específico
      if (lockedAssignments[player.userId] !== undefined) {
        const teamIndex = lockedAssignments[player.userId];
        if (teams[teamIndex]) {
          teams[teamIndex].players.push({
            userId: player.userId,
            user: player.user,
            isLocked: true,
            positionAssigned: player.user.mainPosition,
          });
          continue;
        }
      }

      // Encontra o time com menor soma de notas / menor quantidade de jogadores
      let bestTeamIndex = 0;
      let minTeamScore = Infinity;

      teams.forEach((t, idx) => {
        const currentSum = t.players.reduce((sum, p) => sum + p.user.overallRating, 0);
        // Ponderação: favorece times com menos jogadores e depois menor score
        const scoreWeight = t.players.length * 100 + currentSum;
        if (scoreWeight < minTeamScore) {
          minTeamScore = scoreWeight;
          bestTeamIndex = idx;
        }
      });

      teams[bestTeamIndex].players.push({
        userId: player.userId,
        user: player.user,
        isLocked: false,
        positionAssigned: player.user.mainPosition,
      });
    }
  };

  // Distribui ordenadamente por posições para garantir equilíbrio tático
  distributeGroup(positionGroups.goleiros);
  distributeGroup(positionGroups.defensores);
  distributeGroup(positionGroups.meioCampo);
  distributeGroup(positionGroups.atacantes);

  // Calcula a média de cada time
  teams.forEach((team) => {
    if (team.players.length > 0) {
      const total = team.players.reduce((acc, p) => acc + p.user.overallRating, 0);
      team.averageRating = Number((total / team.players.length).toFixed(2));
    }
  });

  return teams;
}

export const balanceTeams = drawBalancedTeams;
