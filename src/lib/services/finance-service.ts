import { FinancialTransaction, TransactionCategory } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { getStored, setStored } from './storage-helpers';
import { GroupService } from './group-service';

type CloudTransaction = {
  id: string;
  group_id: string;
  user_id?: string | null;
  username?: string | null;
  type: FinancialTransaction['type'];
  category: FinancialTransaction['category'];
  description: string;
  amount: number | string;
  due_date: string;
  paid_at?: string | null;
  status: FinancialTransaction['status'];
  recorded_by: string;
  created_at: string;
};

function mapCloudTransaction(row: CloudTransaction): FinancialTransaction {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id || undefined,
    userName: row.username || undefined,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paidAt: row.paid_at || undefined,
    status: row.status,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

async function apiRequest<T>(groupId: string, init?: RequestInit): Promise<T> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nao configurado');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Sua sessao expirou. Entre novamente no aplicativo.');
  }
  const response = await fetch(`/api/groups/${groupId}/financial-transactions`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha na operacao financeira');
  return payload.data as T;
}

function storeTransactions(groupId: string, transactions: FinancialTransaction[]) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  setStored(`transactions_${groupId}`, sorted);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('transactions_updated', { detail: { groupId } }));
    window.dispatchEvent(new Event('storage'));
  }
  return sorted;
}

function transactionPayload(data: Partial<FinancialTransaction>, partial = false) {
  const payload: Record<string, unknown> = {};
  const has = (key: keyof FinancialTransaction) => !partial || Object.prototype.hasOwnProperty.call(data, key);
  if (has('userId')) payload.user_id = data.userId || null;
  if (has('userName')) payload.username = data.userName || null;
  if (has('type')) payload.type = data.type;
  if (has('category')) payload.category = data.category;
  if (has('description')) payload.description = data.description;
  if (has('amount')) payload.amount = data.amount;
  if (has('dueDate')) payload.due_date = data.dueDate?.split('T')[0];
  if (has('paidAt')) payload.paid_at = data.paidAt || null;
  if (has('status')) payload.status = data.status;
  return payload;
}

export const FinanceService = {
  getTransactions(groupId: string): FinancialTransaction[] {
    if (!groupId) return [];
    return getStored<FinancialTransaction[]>(`transactions_${groupId}`, []);
  },

  async syncTransactionsFromCloud(groupId: string): Promise<FinancialTransaction[]> {
    const local = this.getTransactions(groupId);
    if (!isSupabaseConfigured || !supabase || !groupId) return local;
    try {
      const rows = await apiRequest<CloudTransaction[]>(groupId);
      return storeTransactions(groupId, rows.map(mapCloudTransaction));
    } catch (error) {
      console.warn('Erro ao sincronizar o financeiro:', error);
      return local;
    }
  },

  async createTransaction(
    groupId: string,
    data: Omit<FinancialTransaction, 'id' | 'createdAt' | 'groupId' | 'recordedBy'> & { recordedBy?: string },
  ): Promise<FinancialTransaction> {
    const row = await apiRequest<CloudTransaction>(groupId, {
      method: 'POST',
      body: JSON.stringify(transactionPayload(data)),
    });
    const created = mapCloudTransaction(row);
    const current = this.getTransactions(groupId).filter((item) => item.id !== created.id);
    storeTransactions(groupId, [created, ...current]);
    return created;
  },

  async generateMonthlyDuesBatch(
    groupId: string,
    monthRef: string,
    amount: number,
    dueDate: string,
    isPaid = false,
    _recordedBy?: string,
  ): Promise<{ generatedCount: number; transactions: FinancialTransaction[] }> {
    const members = GroupService.getMembers(groupId);
    const transactions = await this.syncTransactionsFromCloud(groupId);
    const createdList: FinancialTransaction[] = [];
    const payingMembers = members.filter((member) => {
      const goalkeeper = member.role === 'goleiro' || member.membershipType === 'goleiro';
      return !goalkeeper && member.status === 'active' && (
        member.membershipType === 'associado' ||
        ['presidente', 'adm', 'tesoureiro', 'associado'].includes(member.role)
      );
    });

    for (const member of payingMembers) {
      const description = `Mensalidade ${monthRef} (${member.user.name})`;
      const exists = transactions.some((item) =>
        item.userId === member.userId && item.category === 'mensalidade' && item.description === description
      );
      if (exists) continue;
      const created = await this.createTransaction(groupId, {
        userId: member.userId,
        userName: member.user.name,
        type: 'income',
        category: 'mensalidade',
        description,
        amount,
        dueDate,
        status: isPaid ? 'paid' : 'pending',
        paidAt: isPaid ? new Date().toISOString() : undefined,
      });
      createdList.push(created);
    }
    return { generatedCount: createdList.length, transactions: createdList };
  },

  async generateSingleMonthlyDue(
    groupId: string,
    userId: string,
    userName: string,
    monthRef: string,
    amount: number,
    dueDate: string,
    isPaid = false,
    _recordedBy?: string,
  ): Promise<FinancialTransaction> {
    return this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'mensalidade',
      description: `Mensalidade ${monthRef} (${userName})`,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
    });
  },

  async createCost(
    groupId: string,
    category: TransactionCategory,
    description: string,
    amount: number,
    dueDate: string,
    isPaid = true,
    _recordedBy?: string,
  ): Promise<FinancialTransaction> {
    return this.createTransaction(groupId, {
      type: 'expense',
      category,
      description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
    });
  },

  async applyYellowCardFine(groupId: string, userId: string, userName: string, matchDate?: string) {
    const amount = GroupService.getGroupById(groupId)?.rulesFineYellowCard || 10;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'cartao_amarelo',
      description: `Multa Cartao Amarelo (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'pending',
    });
  },

  async applyRedCardFine(groupId: string, userId: string, userName: string, matchDate?: string) {
    const amount = GroupService.getGroupById(groupId)?.rulesFineRedCard || 20;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'cartao_vermelho',
      description: `Multa Cartao Vermelho (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'pending',
    });
  },

  async applyBlueCardFine(groupId: string, userId: string, userName: string, matchDate?: string) {
    const amount = GroupService.getGroupById(groupId)?.rulesFineBlueCard || 15;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'cartao_azul',
      description: `Multa Cartao Azul (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'pending',
    });
  },

  async applyLateFine(groupId: string, userId: string, userName: string, matchDate?: string) {
    const amount = GroupService.getGroupById(groupId)?.rulesFineLateArrival || 10;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'multa_atraso',
      description: `Multa por Atraso (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'pending',
    });
  },

  async applyAbsenceFine(groupId: string, userId: string, userName: string, matchDate?: string) {
    const amount = GroupService.getGroupById(groupId)?.rulesFineUnexcusedAbsence || 25;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'multa_falta',
      description: `Multa por Falta Nao Justificada (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'pending',
    });
  },

  async applyDailyFee(groupId: string, userId: string, userName: string, matchDate: string, isPaid = false) {
    const amount = GroupService.getGroupById(groupId)?.dailyFee || 25;
    return this.createTransaction(groupId, {
      userId, userName, type: 'income', category: 'diaria',
      description: `Diaria Pelada ${matchDate} (${userName})`, amount, dueDate: matchDate,
      status: isPaid ? 'paid' : 'pending', paidAt: isPaid ? new Date().toISOString() : undefined,
    });
  },

  async settleTransaction(groupId: string, transactionId: string): Promise<void> {
    const row = await apiRequest<CloudTransaction>(groupId, {
      method: 'PATCH',
      body: JSON.stringify({ id: transactionId, status: 'paid', paid_at: new Date().toISOString() }),
    });
    const settled = mapCloudTransaction(row);
    const updated = this.getTransactions(groupId).map((item) => item.id === settled.id ? settled : item);
    storeTransactions(groupId, updated);
  },

  async updateTransaction(
    groupId: string,
    transactionId: string,
    patch: Partial<FinancialTransaction>,
  ): Promise<FinancialTransaction | null> {
    const row = await apiRequest<CloudTransaction>(groupId, {
      method: 'PATCH',
      body: JSON.stringify({ id: transactionId, ...transactionPayload(patch, true) }),
    });
    const saved = mapCloudTransaction(row);
    const updated = this.getTransactions(groupId).map((item) => item.id === saved.id ? saved : item);
    storeTransactions(groupId, updated);
    return saved;
  },

  async deleteTransaction(groupId: string, transactionId: string): Promise<boolean> {
    await apiRequest<{ removed: string }>(groupId, {
      method: 'DELETE',
      body: JSON.stringify({ id: transactionId }),
    });
    storeTransactions(groupId, this.getTransactions(groupId).filter((item) => item.id !== transactionId));
    return true;
  },
};
