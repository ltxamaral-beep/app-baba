export type UserPosition = 'goleiro' | 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'atacante';
export type DominantFoot = 'destro' | 'canhoto' | 'ambidestro';
export type SoccerType = 'society' | 'campo' | 'futsal' | 'barro';
export type GroupRole = 'presidente' | 'adm' | 'tesoureiro' | 'associado' | 'diarista' | 'goleiro';
export type MembershipType = 'associado' | 'diarista' | 'goleiro' | 'convidado';
export type MemberStatus = 'active' | 'pending_approval' | 'rejected' | 'banned';

export type TransactionType = 'income' | 'expense';
export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

export type TransactionCategory = 
  | 'mensalidade' 
  | 'diaria' 
  | 'cartao_azul'
  | 'cartao_vermelho'
  | 'cartao_amarelo'
  | 'multa_atraso'
  | 'multa_falta'
  | 'uniforme'
  | 'patrocinio'
  | 'aluguel_campo' 
  | 'material' 
  | 'churrasco' 
  | 'ajuda_custo_goleiro' 
  | 'arbitragem' 
  | 'agua_gelo' 
  | 'saldo_inicial'
  | 'outros';

export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled';
export type AttendanceStatus = 'confirmed' | 'waitlist' | 'cancelled' | 'present' | 'absent';

export interface UserProfile {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  phone: string;
  cpf: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  address: string;
  avatarUrl?: string;
  mainPosition: UserPosition;
  secondaryPosition?: UserPosition;
  dominantFoot: DominantFoot;
  heightCm?: number;
  weightKg?: number;
  overallRating: number; // 1.0 a 10.0
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  soccerType: SoccerType;
  playersPerTeam: number;
  maxSlots: number; // Quantidade de vagas na pelada
  fieldAddress: string;
  matchDay: string;
  matchTime: string;
  matchDurationMinutes: number;
  rules?: string;
  monthlyFee?: number;
  dailyFee?: number;
  inviteCode: string;
  isPublic: boolean;
  whatsappGroupUrl?: string; // Link direto para o grupo do WhatsApp do baba
  isOpenAttendance: boolean; // se a lista de presença está aberta
  createdBy: string;
  createdAt: string;
}

export interface PlayerMatchStat {
  id: string;
  matchId: string;
  groupId: string;
  userId: string;
  userName: string;
  userPosition: UserPosition;
  goals: number;
  assists: number;
  tackles: number; // xerife
  saves: number; // paredão (goleiro)
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  user: UserProfile;
  role: GroupRole;
  membershipType: MembershipType;
  status: MemberStatus;
  isBlockedFinancial: boolean;
  blockedReason?: string;
  joinedAt: string;
}

export interface FinancialTransaction {
  id: string;
  groupId: string;
  userId?: string;
  userName?: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: PaymentStatus;
  recordedBy: string;
  createdAt: string;
}

export interface Match {
  id: string;
  groupId: string;
  matchDate: string;
  startTime: string;
  confirmationDeadline?: string; // Data e horário limite para confirmação
  maxPlayers: number;
  costDiarista: number;
  status: MatchStatus;
  createdAt: string;
}

export interface MatchAttendance {
  id: string;
  matchId: string;
  userId: string;
  user: UserProfile;
  status: AttendanceStatus;
  arrivalOrder?: number;
  isFinancialBlocked: boolean;
  isGuest?: boolean;
  invitedByUserId?: string;
  invitedByName?: string;
  guestPhone?: string;
  confirmedAt: string;
  checkedInAt?: string;
}

export interface MatchTeamPlayer {
  userId: string;
  user: UserProfile;
  isLocked: boolean;
  positionAssigned: UserPosition;
}

export interface MatchTeam {
  id: string;
  name: string;
  color: string;
  averageRating: number;
  players: MatchTeamPlayer[];
}

export type NotificationType = 
  | 'member_request'        // Solicitação de entrada no grupo
  | 'member_approved'       // Solicitação aprovada
  | 'match_opened'          // Abertura de lista de presença da pelada
  | 'attendance_confirmed'  // Confirmação de presença na lista
  | 'player_arrived'        // Check-in de chegada ao campo
  | 'financial_alert'       // Alerta financeiro / pagamento
  | 'system';

export interface AppNotification {
  id: string;
  groupId: string;
  groupName?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data?: {
    memberId?: string;
    userId?: string;
    userName?: string;
    matchId?: string;
    role?: string;
    membershipType?: string;
    slotNumber?: number;
    arrivalOrder?: number;
  };
  createdAt: string;
}
