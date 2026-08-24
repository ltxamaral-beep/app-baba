import { 
  UserProfile, 
  Group, 
  GroupMember, 
  FinancialTransaction, 
  Match, 
  MatchAttendance,
  GroupRole,
  MembershipType
} from '@/types';

export const mockUsers: UserProfile[] = [
  {
    id: 'user-1',
    name: 'Leandro Silva (Organizador)',
    email: 'leandro@pelada.com',
    phone: '(11) 98765-4321',
    cpf: '123.456.789-00',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    mainPosition: 'meia',
    secondaryPosition: 'atacante',
    dominantFoot: 'destro',
    heightCm: 178,
    weightKg: 76,
    overallRating: 8.5,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Bruno Goleiro',
    email: 'bruno@pelada.com',
    phone: '(11) 97777-1111',
    cpf: '234.567.890-11',
    address: 'Rua Augusta, 500 - São Paulo, SP',
    mainPosition: 'goleiro',
    dominantFoot: 'destro',
    heightCm: 188,
    weightKg: 85,
    overallRating: 8.8,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Marcos Paredão',
    email: 'marcos@pelada.com',
    phone: '(11) 96666-2222',
    cpf: '345.678.901-22',
    address: 'Vila Mariana - São Paulo, SP',
    mainPosition: 'goleiro',
    dominantFoot: 'canhoto',
    heightCm: 185,
    weightKg: 82,
    overallRating: 8.0,
    createdAt: '2026-01-12T10:00:00Z',
  },
  {
    id: 'user-4',
    name: 'Rodrigo Zaga',
    email: 'rodrigo@pelada.com',
    phone: '(11) 95555-3333',
    cpf: '456.789.012-33',
    address: 'Moema - São Paulo, SP',
    mainPosition: 'zagueiro',
    dominantFoot: 'destro',
    heightCm: 182,
    weightKg: 80,
    overallRating: 7.5,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'user-5',
    name: 'Thiago Xerife',
    email: 'thiago@pelada.com',
    phone: '(11) 94444-4444',
    cpf: '567.890.123-44',
    address: 'Santana - São Paulo, SP',
    mainPosition: 'zagueiro',
    dominantFoot: 'destro',
    heightCm: 180,
    weightKg: 78,
    overallRating: 7.2,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'user-6',
    name: 'Felipe Canhoto (Inadimplente)',
    email: 'felipe@pelada.com',
    phone: '(11) 93333-5555',
    cpf: '678.901.234-55',
    address: 'Tatuapé - São Paulo, SP',
    mainPosition: 'lateral',
    dominantFoot: 'canhoto',
    heightCm: 172,
    weightKg: 68,
    overallRating: 7.8,
    createdAt: '2026-01-18T10:00:00Z',
  },
  {
    id: 'user-7',
    name: 'Gabriel Volante',
    email: 'gabriel@pelada.com',
    phone: '(11) 92222-6666',
    cpf: '789.012.345-66',
    address: 'Pinheiros - São Paulo, SP',
    mainPosition: 'volante',
    dominantFoot: 'destro',
    heightCm: 176,
    weightKg: 74,
    overallRating: 8.0,
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'user-8',
    name: 'Diego 10',
    email: 'diego@pelada.com',
    phone: '(11) 91111-7777',
    cpf: '890.123.456-77',
    address: 'Perdizes - São Paulo, SP',
    mainPosition: 'meia',
    dominantFoot: 'destro',
    heightCm: 174,
    weightKg: 71,
    overallRating: 9.0,
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'user-9',
    name: 'Lucas Artilheiro',
    email: 'lucas@pelada.com',
    phone: '(11) 90000-8888',
    cpf: '901.234.567-88',
    address: 'Ipiranga - São Paulo, SP',
    mainPosition: 'atacante',
    dominantFoot: 'destro',
    heightCm: 181,
    weightKg: 77,
    overallRating: 8.7,
    createdAt: '2026-01-22T10:00:00Z',
  },
  {
    id: 'user-10',
    name: 'Matheus Ponta',
    email: 'matheus@pelada.com',
    phone: '(11) 98888-9999',
    cpf: '012.345.678-99',
    address: 'Lapa - São Paulo, SP',
    mainPosition: 'atacante',
    dominantFoot: 'canhoto',
    heightCm: 170,
    weightKg: 65,
    overallRating: 7.9,
    createdAt: '2026-01-22T10:00:00Z',
  }
];

export const mockGroup: Group = {
  id: 'group-1',
  name: 'Pelada dos Amigos FC',
  soccerType: 'society',
  playersPerTeam: 6,
  maxSlots: 24,
  isOpenAttendance: false,
  fieldAddress: 'Arena Society Gol de Placa - Rua dos Esportes, 120',
  matchDay: 'Toda Terça-feira',
  matchTime: '20:00',
  matchDurationMinutes: 90,
  rules: 'Proibido carrinho. Faltas acumuladas geram shoot-out. Mensalidade vence dia 10.',
  inviteCode: 'PELADA-2026',
  isPublic: true,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
};

export const mockMembers: GroupMember[] = mockUsers.map((user, idx) => {
  let role: GroupRole = 'associado';
  let membershipType: MembershipType = 'associado';

  if (idx === 0) {
    role = 'presidente';
    membershipType = 'associado';
  } else if (idx === 1) {
    role = 'goleiro';
    membershipType = 'goleiro';
  } else if (idx === 2) {
    role = 'adm';
    membershipType = 'associado';
  } else if (idx === 3) {
    role = 'tesoureiro';
    membershipType = 'associado';
  } else if (idx === 6 || idx === 8 || idx === 9) {
    role = 'diarista';
    membershipType = 'diarista';
  } else {
    role = 'associado';
    membershipType = 'associado';
  }

  return {
    id: `member-${idx + 1}`,
    groupId: 'group-1',
    userId: user.id,
    user,
    role,
    membershipType,
    status: 'active',
    isBlockedFinancial: user.id === 'user-6', // Felipe inadimplente
    blockedReason: user.id === 'user-6' ? 'Mensalidade de Fevereiro em atraso' : undefined,
    joinedAt: user.createdAt,
  };
});

export const mockTransactions: FinancialTransaction[] = [
  {
    id: 'trans-1',
    groupId: 'group-1',
    userId: 'user-1',
    userName: 'Leandro Silva',
    type: 'income',
    category: 'mensalidade',
    description: 'Mensalidade Fev/2026',
    amount: 80.00,
    dueDate: '2026-02-10',
    paidAt: '2026-02-08T14:00:00Z',
    status: 'paid',
    recordedBy: 'user-1',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'trans-2',
    groupId: 'group-1',
    userId: 'user-2',
    userName: 'Bruno Goleiro',
    type: 'income',
    category: 'mensalidade',
    description: 'Mensalidade Fev/2026',
    amount: 80.00,
    dueDate: '2026-02-10',
    paidAt: '2026-02-10T10:00:00Z',
    status: 'paid',
    recordedBy: 'user-1',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'trans-3',
    groupId: 'group-1',
    userId: 'user-6',
    userName: 'Felipe Canhoto',
    type: 'income',
    category: 'mensalidade',
    description: 'Mensalidade Fev/2026 (Em Atraso)',
    amount: 80.00,
    dueDate: '2026-02-10',
    status: 'overdue',
    recordedBy: 'user-1',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'trans-4',
    groupId: 'group-1',
    type: 'expense',
    category: 'aluguel_campo',
    description: 'Pagamento Locação Quadra Society Fev/2026',
    amount: 600.00,
    dueDate: '2026-02-05',
    paidAt: '2026-02-05T19:00:00Z',
    status: 'paid',
    recordedBy: 'user-1',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'trans-5',
    groupId: 'group-1',
    type: 'expense',
    category: 'material',
    description: 'Compra de 2 Bolas Penalty Society + Bomba',
    amount: 280.00,
    dueDate: '2026-02-12',
    paidAt: '2026-02-12T16:30:00Z',
    status: 'paid',
    recordedBy: 'user-1',
    createdAt: '2026-02-12T00:00:00Z',
  }
];

export const mockMatch: Match = {
  id: 'match-1',
  groupId: 'group-1',
  matchDate: '2026-08-25',
  startTime: '20:00',
  maxPlayers: 12, // 2 times de 6
  costDiarista: 25.00,
  status: 'scheduled',
  createdAt: '2026-08-18T10:00:00Z',
};

export const mockAttendances: MatchAttendance[] = mockMembers.map((m, idx) => ({
  id: `att-${idx + 1}`,
  matchId: 'match-1',
  userId: m.userId,
  user: m.user,
  status: m.isBlockedFinancial ? 'cancelled' : (idx < 8 ? 'confirmed' : 'waitlist'),
  arrivalOrder: idx + 1,
  isFinancialBlocked: m.isBlockedFinancial,
  confirmedAt: new Date(Date.now() - (10 - idx) * 3600000).toISOString(),
}));
