import { FinancialTransaction, GroupRole, MembershipType, TransactionCategory } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID, getStored, setStored, withTimeout } from './storage-helpers';
import { UserService } from './user-service';
import { GroupService } from './group-service';
import { NotificationService } from './notification-service';

// Categorias aceitas pelo enum 'transaction_category' no banco PostgreSQL
const VALID_DB_CATEGORIES = new Set([
  'mensalidade',
  'diaria',
  'aluguel_campo',
  'material',
  'churrasco',
  'ajuda_custo_goleiro',
  'arbitragem',
  'agua_gelo',
  'outros',
]);

function sanitizeCategoryForDb(category: string): string {
  if (VALID_DB_CATEGORIES.has(category)) return category;
  if (category === 'quadra') return 'aluguel_campo';
  if (category === 'juiz') return 'arbitragem';
  if (category === 'agua') return 'agua_gelo';
  return 'outros';
}

// ---------------------------------------------------------------------------
// Helper para gerar lançamentos padrão/demo para grupos sem transações
// ---------------------------------------------------------------------------
function getSeedTransactionsForGroup(groupId: string): FinancialTransaction[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthPad = String(currentMonth).padStart(2, '0');
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonthPad = String(prevMonth).padStart(2, '0');

  const members = GroupService.getMembers(groupId);
  const m1 = members[0]?.user?.name || 'Leandro Teixeira do Amaral';
  const m1Id = members[0]?.userId || 'c5a2cc7c-0658-44f4-be73-bb427baca751';
  const m2 = members[1]?.user?.name || 'Gabriela Oliveira';
  const m2Id = members[1]?.userId || '7c4be42d-745c-4908-a687-6a808b220429';

  return [
    {
      id: generateUUID(),
      groupId,
      userId: m1Id,
      userName: m1,
      type: 'income',
      category: 'mensalidade',
      description: `Mensalidade ${currentMonthPad}/${currentYear} (${m1})`,
      amount: 80.00,
      dueDate: `${currentYear}-${currentMonthPad}-10`,
      paidAt: `${currentYear}-${currentMonthPad}-05T14:00:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${currentYear}-${currentMonthPad}-01T10:00:00Z`,
    },
    {
      id: generateUUID(),
      groupId,
      userId: m2Id,
      userName: m2,
      type: 'income',
      category: 'mensalidade',
      description: `Mensalidade ${currentMonthPad}/${currentYear} (${m2})`,
      amount: 80.00,
      dueDate: `${currentYear}-${currentMonthPad}-10`,
      paidAt: `${currentYear}-${currentMonthPad}-08T10:00:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${currentYear}-${currentMonthPad}-01T10:00:00Z`,
    },
    {
      id: generateUUID(),
      groupId,
      type: 'expense',
      category: 'aluguel_campo',
      description: `Aluguel Campo / Quadra ${currentMonthPad}/${currentYear}`,
      amount: 450.00,
      dueDate: `${currentYear}-${currentMonthPad}-05`,
      paidAt: `${currentYear}-${currentMonthPad}-05T19:00:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${currentYear}-${currentMonthPad}-01T10:00:00Z`,
    },
    {
      id: generateUUID(),
      groupId,
      type: 'expense',
      category: 'material',
      description: `Compra de Bolas e Coletes`,
      amount: 220.00,
      dueDate: `${currentYear}-${currentMonthPad}-12`,
      paidAt: `${currentYear}-${currentMonthPad}-12T16:30:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${currentYear}-${currentMonthPad}-12T10:00:00Z`,
    },
    {
      id: generateUUID(),
      groupId,
      userId: m1Id,
      userName: m1,
      type: 'income',
      category: 'mensalidade',
      description: `Mensalidade ${prevMonthPad}/${prevYear} (${m1})`,
      amount: 80.00,
      dueDate: `${prevYear}-${prevMonthPad}-10`,
      paidAt: `${prevYear}-${prevMonthPad}-07T14:00:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${prevYear}-${prevMonthPad}-01T10:00:00Z`,
    },
    {
      id: generateUUID(),
      groupId,
      type: 'expense',
      category: 'aluguel_campo',
      description: `Aluguel Campo / Quadra ${prevMonthPad}/${prevYear}`,
      amount: 450.00,
      dueDate: `${prevYear}-${prevMonthPad}-05`,
      paidAt: `${prevYear}-${prevMonthPad}-05T19:00:00Z`,
      status: 'paid',
      recordedBy: m1Id,
      createdAt: `${prevYear}-${prevMonthPad}-01T10:00:00Z`,
    }
  ];
}

// ---------------------------------------------------------------------------
// GESTÃO FINANCEIRA (MENSALIDADES, DIÁRIAS, DESPESAS, MULTAS & BAIXAS)
// ---------------------------------------------------------------------------
export const FinanceService = {
  getTransactions(groupId: string): FinancialTransaction[] {
    if (!groupId) return [];

    const direct = getStored<FinancialTransaction[]>(`transactions_${groupId}`, []);
    // Somente a chave atual do app pode alimentar a UI. Chaves legadas nao
    // podem ressuscitar lancamentos removidos da nuvem.
    return direct;

    /* Migracao legada desativada definitivamente.

    // 1. Varredura exaustiva em chaves de transações salvas no LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const foundTransactions: FinancialTransaction[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key === `pelada_transactions_${groupId}` || key === `transactions_${groupId}`)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list: FinancialTransaction[] = JSON.parse(raw);
              if (Array.isArray(list) && list.length > 0) {
                list.forEach((t) => {
                  if (!foundTransactions.some((x) => x.id === t.id)) {
                    foundTransactions.push({ ...t, groupId });
                  }
                });
              }
            }
          }
        }
        if (foundTransactions.length > 0) {
          setStored(`transactions_${groupId}`, foundTransactions);
          return foundTransactions;
        }
      } catch (e) {
        console.warn('Erro ao varrer transações locais:', e);
      }
    }

    */
    return direct;
  },

  async syncTransactionsFromCloud(groupId: string): Promise<FinancialTransaction[]> {
    const local = this.getTransactions(groupId);
    if (!isSupabaseConfigured || !supabase || !groupId) return local;

    try {
      if (!isValidUUID(groupId)) {
        return local;
      }

      const currentUser = UserService.getCurrentUser();
      let validAdminUserId = currentUser.id;
      try {
        validAdminUserId = await UserService.ensureUserInCloud(currentUser);
      } catch {}

      // 1. Envia transações locais para o Supabase
      // O cache local nunca deve ser reenviado em massa. Isso recriava no
      // Supabase os registros que o usuario acabava de excluir.
      /* Reenvio legado desativado.
      if (false && local.length > 0) {
        for (const t of local) {
          if (isValidUUID(t.id)) {
            try {
              const safeDueDate = t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0];
              await withTimeout(
                supabase.from('financial_transactions').upsert([{
                  id: t.id,
                  group_id: groupId,
                  user_id: isValidUUID(t.userId || '') ? t.userId : null,
                  username: t.userName || null,
                  type: t.type,
                  category: sanitizeCategoryForDb(t.category),
                  description: t.description,
                  amount: Number(t.amount) || 0,
                  due_date: safeDueDate,
                  paid_at: t.paidAt || (t.status === 'paid' ? new Date().toISOString() : null),
                  status: t.status,
                  recorded_by: isValidUUID(t.recordedBy) ? t.recordedBy : validAdminUserId,
                }]),
                3000,
                { data: null, error: null }
              );
            } catch (e) {
              console.warn('Aviso ao subir transação local para Supabase:', e);
            }
          }
        }
      }

      // 2. Busca transações do grupo no Supabase
      */
      const { data, error } = await withTimeout(
        supabase
          .from('financial_transactions')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false }),
        4000,
        { data: null, error: new Error('Tempo limite ao consultar o financeiro') }
      );

      if (error) {
        return local;
        console.warn('Aviso ao consultar transações do Supabase:', error);
      }

      const remoteTrans: FinancialTransaction[] = (data || []).map((t: any) => ({
        id: t.id,
        groupId: t.group_id,
        userId: t.user_id || undefined,
        userName: t.username || t.userName || undefined,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: Number(t.amount) || 0,
        dueDate: t.due_date,
        paidAt: t.paid_at || undefined,
        status: t.status,
        recordedBy: t.recorded_by || validAdminUserId,
        createdAt: t.created_at || new Date().toISOString(),
      }));

      // Merge seguro: prioriza IDs remotos e preserva locais
      const map = new Map<string, FinancialTransaction>();
      remoteTrans.forEach((t) => map.set(t.id, t));
      // A nuvem e a fonte oficial; itens apenas locais nao voltam ao extrato.
      false && local.forEach((t) => {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        }
      });

      // Se nenhum registro existir nem local nem remoto, cria o seed e envia para a nuvem
      // Um extrato vazio e valido e nao deve receber dados demonstrativos.
      /* Dados demonstrativos desativados.
      if (false && map.size === 0) {
        const seed = getSeedTransactionsForGroup(groupId);
        for (const st of seed) {
          map.set(st.id, st);
          try {
            await withTimeout(
              supabase.from('financial_transactions').upsert([{
                id: st.id,
                group_id: groupId,
                user_id: isValidUUID(st.userId || '') ? st.userId : null,
                username: st.userName || null,
                type: st.type,
                category: sanitizeCategoryForDb(st.category),
                description: st.description,
                amount: Number(st.amount) || 0,
                due_date: st.dueDate,
                paid_at: st.paidAt || null,
                status: st.status,
                recorded_by: validAdminUserId,
              }]),
              3000,
              { data: null, error: null }
            );
          } catch {}
        }
      }

      */
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setStored(`transactions_${groupId}`, merged);
      return merged;
    } catch (err) {
      console.warn('Erro ao sincronizar transações do Supabase:', err);
      return local;
    }
  },

  async createTransaction(
    groupId: string,
    data: Omit<FinancialTransaction, 'id' | 'createdAt' | 'groupId' | 'recordedBy'> & { recordedBy?: string }
  ): Promise<FinancialTransaction> {
    const transactions = this.getTransactions(groupId);
    const newId = generateUUID();
    const newTrans: FinancialTransaction = {
      ...data,
      id: newId,
      groupId,
      recordedBy: data.recordedBy || UserService.getCurrentUser().id,
      createdAt: new Date().toISOString(),
    };

    // Sincroniza com o Supabase com await
    if (isSupabaseConfigured && supabase) {
      try {
        const currentUser = UserService.getCurrentUser();
        const validAdminUserId = await UserService.ensureUserInCloud(currentUser);
        const validRecordedBy = isValidUUID(data.recordedBy) ? data.recordedBy : validAdminUserId;

        if (isValidUUID(groupId)) {
          const safeDueDate = data.dueDate ? data.dueDate.split('T')[0] : new Date().toISOString().split('T')[0];
          const { error } = await withTimeout(
            supabase.from('financial_transactions').upsert([{
              id: newId,
              group_id: groupId,
              user_id: isValidUUID(data.userId || '') ? data.userId : null,
              username: data.userName || null,
              type: data.type,
              category: sanitizeCategoryForDb(data.category),
              description: data.description,
              amount: Number(data.amount) || 0,
              due_date: safeDueDate,
              paid_at: data.paidAt || (data.status === 'paid' ? new Date().toISOString() : null),
              status: data.status,
              recorded_by: validRecordedBy,
            }]),
            4000,
            { data: null, error: new Error('Tempo limite ao salvar o lancamento') }
          );
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Erro ao salvar transacao no Supabase:', err);
        throw new Error('Nao foi possivel salvar o lancamento financeiro na nuvem.');
        console.warn('Erro ao salvar transação no Supabase:', err);
      }
    }

    transactions.unshift(newTrans);
    setStored(`transactions_${groupId}`, transactions);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    if (data.type === 'income' && data.userId) {
      if (data.status === 'pending' || data.status === 'overdue') {
        await GroupService.blockMemberFinancial(groupId, data.userId, data.description);
      }

      const amount = Number(data.amount).toFixed(2).replace('.', ',');
      await NotificationService.notifyUser(groupId, data.userId, {
        type: 'financial_alert',
        title: data.status === 'paid' ? 'Cobranca registrada como paga' : 'Nova cobranca gerada',
        message: data.status === 'paid'
          ? `${data.description}, no valor de R$ ${amount}, foi registrada como paga.`
          : `${data.description}, no valor de R$ ${amount}, foi gerada com vencimento em ${data.dueDate}.`,
        data: {
          userId: data.userId,
          userName: data.userName,
          amount: data.amount,
          category: data.category,
        },
      });
    }

    return newTrans;
  },

  async generateMonthlyDuesBatch(
    groupId: string, 
    monthRef: string, 
    amount: number, 
    dueDate: string, 
    isPaid: boolean = false,
    recordedBy?: string
  ): Promise<{ generatedCount: number; transactions: FinancialTransaction[] }> {
    const members = GroupService.getMembers(groupId);
    const transactions = this.getTransactions(groupId);
    const createdList: FinancialTransaction[] = [];

    const payingMembers = members.filter((m) => {
      const isGoleiro = m.role === 'goleiro' || m.membershipType === 'goleiro';
      if (isGoleiro) return false;
      return m.membershipType === 'associado' || ['presidente', 'adm', 'tesoureiro', 'associado'].includes(m.role);
    });

    for (const member of payingMembers) {
      const description = `Mensalidade ${monthRef}`;
      const alreadyExists = transactions.some(
        (t) => t.userId === member.userId && t.description.toLowerCase().includes(monthRef.toLowerCase()) && t.category === 'mensalidade'
      );

      if (!alreadyExists) {
        const newTrans = await this.createTransaction(groupId, {
          userId: member.userId,
          userName: member.user.name,
          type: 'income',
          category: 'mensalidade',
          description: `${description} (${member.user.name})`,
          amount,
          dueDate,
          status: isPaid ? 'paid' : 'pending',
          paidAt: isPaid ? new Date().toISOString() : undefined,
          recordedBy: recordedBy || member.userId,
        });
        createdList.push(newTrans);
      }
    }

    // Dispara notificação financeira
    try {
      NotificationService.addNotification(groupId, {
        type: 'financial_alert',
        title: 'Mensalidades Geradas em Lote ⭐',
        message: `A cobrança de mensalidade de ${monthRef} (R$ ${amount.toFixed(2).replace('.', ',')}) foi lançada para ${createdList.length} associados (${isPaid ? 'Registrado como Pago' : 'Pendente de Pagamento'}).`,
        data: {
          category: 'mensalidade',
          amount,
          count: createdList.length,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação financeira:', e);
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
    isPaid: boolean = false,
    recordedBy?: string
  ): Promise<FinancialTransaction> {
    const description = `Mensalidade ${monthRef} (${userName})`;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'mensalidade',
      description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy: recordedBy || userId,
    });

    try {
      NotificationService.addNotification(groupId, {
        type: 'financial_alert',
        title: isPaid ? 'Mensalidade Registrada como Paga ✅' : 'Cobrança de Mensalidade 💳',
        message: isPaid 
          ? `Mensalidade de ${monthRef} de ${userName} no valor de R$ ${amount.toFixed(2).replace('.', ',')} foi registrada como paga.`
          : `Mensalidade de ${monthRef} para ${userName} no valor de R$ ${amount.toFixed(2).replace('.', ',')} lançada com vencimento em ${dueDate}.`,
        data: {
          userId,
          userName,
          category: 'mensalidade',
          amount,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de mensalidade avulsa:', e);
    }

    return trans;
  },

  async createCost(
    groupId: string,
    category: TransactionCategory,
    description: string,
    amount: number,
    dueDate: string,
    isPaid: boolean = true,
    recordedBy?: string
  ): Promise<FinancialTransaction> {
    const trans = await this.createTransaction(groupId, {
      type: 'expense',
      category,
      description,
      amount,
      dueDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
      recordedBy: recordedBy || '00000000-0000-4000-8000-000000000001',
    });

    try {
      NotificationService.addNotification(groupId, {
        type: 'financial_alert',
        title: 'Nova Despesa Registrada 📉',
        message: `Despesa registrada: ${description} (R$ ${amount.toFixed(2).replace('.', ',')}) - ${isPaid ? 'Pago' : 'Pendente'}.`,
        data: {
          category,
          amount,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de despesa:', e);
    }

    return trans;
  },

  async applyYellowCardFine(groupId: string, userId: string, userName: string, matchDate?: string): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.rulesFineYellowCard || 10;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'cartao_amarelo',
      description: `Multa Cartão Amarelo (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    GroupService.blockMemberFinancial(groupId, userId, 'Multa de Cartão Amarelo Pendente');
    return trans;
  },

  async applyRedCardFine(groupId: string, userId: string, userName: string, matchDate?: string): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.rulesFineRedCard || 20;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'cartao_vermelho',
      description: `Multa Cartão Vermelho (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    GroupService.blockMemberFinancial(groupId, userId, 'Multa de Cartão Vermelho Pendente');
    return trans;
  },

  async applyBlueCardFine(groupId: string, userId: string, userName: string, matchDate?: string): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.rulesFineBlueCard || 15;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'cartao_azul',
      description: `Multa Cartão Azul (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    GroupService.blockMemberFinancial(groupId, userId, 'Multa de Cartão Azul Pendente');
    return trans;
  },

  async applyLateFine(groupId: string, userId: string, userName: string, matchDate?: string): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.rulesFineLateArrival || 10;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'multa_atraso',
      description: `Multa por Atraso (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    GroupService.blockMemberFinancial(groupId, userId, 'Multa por Atraso Pendente');
    return trans;
  },

  async applyAbsenceFine(groupId: string, userId: string, userName: string, matchDate?: string): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.rulesFineUnexcusedAbsence || 25;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'multa_falta',
      description: `Multa por Falta Não Justificada (${userName})${matchDate ? ` - Jogo ${matchDate}` : ''}`,
      amount,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    GroupService.blockMemberFinancial(groupId, userId, 'Multa por Falta Pendente');
    return trans;
  },

  async applyDailyFee(groupId: string, userId: string, userName: string, matchDate: string, isPaid: boolean = false): Promise<FinancialTransaction> {
    const group = GroupService.getGroupById(groupId);
    const amount = group?.dailyFee || 25;
    const trans = await this.createTransaction(groupId, {
      userId,
      userName,
      type: 'income',
      category: 'diaria',
      description: `Diária Pelada ${matchDate} (${userName})`,
      amount,
      dueDate: matchDate,
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? new Date().toISOString() : undefined,
    });

    if (!isPaid) {
      GroupService.blockMemberFinancial(groupId, userId, 'Diária Pendente de Pagamento');
    }
    return trans;
  },

  async settleTransaction(groupId: string, transactionId: string): Promise<void> {
    const transactions = this.getTransactions(groupId);
    let settledUserId: string | undefined;
    let settledUserName: string | undefined;
    let settledAmount = 0;
    let settledDesc = '';

    const updated = transactions.map((t) => {
      if (t.id === transactionId) {
        settledUserId = t.userId;
        settledUserName = t.userName;
        settledAmount = t.amount;
        settledDesc = t.description;
        return {
          ...t,
          status: 'paid' as const,
          paidAt: new Date().toISOString(),
        };
      }
      return t;
    });

    setStored(`transactions_${groupId}`, updated);

    if (isSupabaseConfigured && supabase && isValidUUID(transactionId)) {
      try {
        await withTimeout(
          supabase.from('financial_transactions').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          }).eq('id', transactionId),
          3000,
          { data: null, error: null }
        );
      } catch (err) {
        console.warn('Erro ao dar baixa no Supabase:', err);
      }
    }

    if (settledUserId) {
      const remainingDebts = updated.some(
        (t) => t.userId === settledUserId && (t.status === 'overdue' || t.status === 'pending')
      );
      if (!remainingDebts) {
        const members = GroupService.getMembers(groupId);
        const updatedMembers = members.map((m) =>
          m.userId === settledUserId ? { ...m, isBlockedFinancial: false, blockedReason: undefined } : m
        );
        setStored(`members_${groupId}`, updatedMembers);

        if (isSupabaseConfigured && supabase && isValidUUID(groupId) && isValidUUID(settledUserId)) {
          const { error } = await supabase
            .from('group_members')
            .update({ is_blocked_financial: false, blocked_reason: null })
            .eq('group_id', groupId)
            .eq('user_id', settledUserId);
          if (error) console.warn('Erro ao liberar membro no Supabase:', error);
        }
      }
    }

    // Dispara notificação de quitação
    try {
      NotificationService.addNotification(groupId, {
        type: 'financial_alert',
        title: 'Pagamento Confirmado & Baixa Realizada ✅',
        message: `O pagamento de ${settledUserName || 'atleta'} (R$ ${settledAmount.toFixed(2).replace('.', ',')} - ${settledDesc}) foi registrado e baixado no caixa.`,
        data: {
          userId: settledUserId,
          userName: settledUserName,
          amount: settledAmount,
        }
      });
    } catch (e) {
      console.warn('Erro ao disparar notificação de baixa:', e);
    }

    if (settledUserId) {
      await NotificationService.notifyUser(groupId, settledUserId, {
        type: 'financial_alert',
        title: 'Pagamento confirmado',
        message: `Seu pagamento de R$ ${settledAmount.toFixed(2).replace('.', ',')} referente a ${settledDesc} foi confirmado.`,
        data: {
          userId: settledUserId,
          userName: settledUserName,
          amount: settledAmount,
        },
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  async updateTransaction(groupId: string, transactionId: string, patch: Partial<FinancialTransaction>): Promise<FinancialTransaction | null> {
    const transactions = this.getTransactions(groupId);
    let targetUserId: string | undefined;
    let updatedTrans: FinancialTransaction | null = null;

    const updated = transactions.map((t) => {
      if (t.id === transactionId) {
        updatedTrans = {
          ...t,
          ...patch,
          amount: patch.amount !== undefined ? Number(patch.amount) : t.amount,
          paidAt: patch.status === 'paid' ? (patch.paidAt || t.paidAt || new Date().toISOString()) : undefined,
        };
        targetUserId = updatedTrans.userId || t.userId;
        return updatedTrans;
      }
      return t;
    });

    if (!updatedTrans) return null;

    setStored(`transactions_${groupId}`, updated);

    if (isSupabaseConfigured && supabase && isValidUUID(transactionId)) {
      try {
        const safeDueDate = patch.dueDate ? patch.dueDate.split('T')[0] : undefined;
        await withTimeout(
          supabase.from('financial_transactions').update({
            description: patch.description,
            amount: patch.amount !== undefined ? Number(patch.amount) : undefined,
            due_date: safeDueDate,
            status: patch.status,
            paid_at: patch.status === 'paid' ? new Date().toISOString() : null,
          }).eq('id', transactionId),
          3000,
          { data: null, error: null }
        );
      } catch (err) {
        console.warn('Erro ao atualizar transação no Supabase:', err);
      }
    }

    if (targetUserId) {
      const remainingDebts = updated.some(
        (t) => t.userId === targetUserId && (t.status === 'overdue' || t.status === 'pending')
      );
      const members = GroupService.getMembers(groupId);
      const updatedMembers = members.map((m) =>
        m.userId === targetUserId 
          ? { 
              ...m, 
              isBlockedFinancial: remainingDebts, 
              blockedReason: remainingDebts ? (m.blockedReason || 'Débito pendente em aberto') : undefined 
            } 
          : m
      );
      setStored(`members_${groupId}`, updatedMembers);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    return updatedTrans;
  },

  async deleteTransaction(groupId: string, transactionId: string): Promise<boolean> {
    const transactions = this.getTransactions(groupId);
    const target = transactions.find((t) => t.id === transactionId);
    if (!target) return false;

    const filtered = transactions.filter((t) => t.id !== transactionId);

    if (isSupabaseConfigured && supabase && isValidUUID(transactionId)) {
      try {
        const { data, error } = await supabase
          .from('financial_transactions')
          .delete()
          .eq('id', transactionId)
          .eq('group_id', groupId)
          .select('id');
        if (error || !data?.length) return false;
      } catch (err) {
        return false;
        console.warn('Erro ao excluir transação no Supabase:', err);
      }
    }

    setStored(`transactions_${groupId}`, filtered);

    if (target.userId) {
      const remainingDebts = filtered.some(
        (t) => t.userId === target.userId && (t.status === 'overdue' || t.status === 'pending')
      );
      const members = GroupService.getMembers(groupId);
      const updatedMembers = members.map((m) =>
        m.userId === target.userId 
          ? { 
              ...m, 
              isBlockedFinancial: remainingDebts, 
              blockedReason: remainingDebts ? (m.blockedReason || 'Débito pendente em aberto') : undefined 
            } 
          : m
      );
      setStored(`members_${groupId}`, updatedMembers);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions_updated', { detail: { groupId } }));
      window.dispatchEvent(new Event('storage'));
    }

    return true;
  }
};
