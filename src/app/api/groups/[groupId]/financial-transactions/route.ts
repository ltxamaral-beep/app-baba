import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DIRECTOR_ROLES = ['presidente', 'adm', 'tesoureiro'];
const TYPES = ['income', 'expense'];
const STATUSES = ['paid', 'pending', 'overdue', 'cancelled'];
const CATEGORIES = [
  'mensalidade', 'diaria', 'cartao_azul', 'cartao_vermelho', 'cartao_amarelo',
  'multa_atraso', 'multa_falta', 'uniforme', 'patrocinio', 'aluguel_campo',
  'material', 'churrasco', 'ajuda_custo_goleiro', 'arbitragem', 'agua_gelo',
  'saldo_inicial', 'outros',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function db(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function apiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return response({ error: message || fallback }, 500);
}

async function authorize(request: NextRequest, groupId: string, directorOnly = false) {
  if (!UUID_PATTERN.test(groupId)) return { error: response({ error: 'Grupo invalido' }, 400) };
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: response({ error: 'Nao autorizado' }, 401) };

  const client = db(token);
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user?.email) {
    return { error: response({ error: 'Sessao invalida. Entre novamente no aplicativo.' }, 401) };
  }

  const { data: profile, error: profileError } = await client.from('users').select('id,name,email')
    .ilike('email', authData.user.email).maybeSingle();
  if (profileError) return { error: apiError(profileError, 'Falha ao identificar o usuario') };
  if (!profile) return { error: response({ error: 'Perfil do usuario nao encontrado' }, 403) };

  const { data: member, error: memberError } = await client.from('group_members')
    .select('role,status').eq('group_id', groupId).eq('user_id', profile.id)
    .eq('status', 'active').maybeSingle();
  if (memberError) return { error: apiError(memberError, 'Falha ao validar o cargo') };
  if (!member) return { error: response({ error: 'Usuario nao pertence ao grupo' }, 403) };

  const isDirector = DIRECTOR_ROLES.includes(member.role);
  if (directorOnly && !isDirector) {
    return { error: response({ error: 'Apenas a diretoria pode alterar o financeiro' }, 403) };
  }
  return { client, profile, isDirector };
}

function validateTransaction(body: any, partial = false) {
  if (!partial || body.type !== undefined) {
    if (!TYPES.includes(body.type)) return 'Tipo de lancamento invalido';
  }
  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return 'Categoria financeira invalida';
  }
  if (!partial || body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return 'Status financeiro invalido';
  }
  if (!partial || body.description !== undefined) {
    if (typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 250) {
      return 'Informe uma descricao valida';
    }
  }
  if (!partial || body.amount !== undefined) {
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return 'Informe um valor maior que zero';
  }
  if (!partial || body.due_date !== undefined) {
    if (!DATE_PATTERN.test(body.due_date || '')) return 'Data de vencimento invalida';
  }
  if (body.user_id !== undefined && body.user_id !== null && body.user_id !== '' && !UUID_PATTERN.test(body.user_id)) {
    return 'Membro invalido';
  }
  if (body.paid_at !== undefined && body.paid_at !== null && Number.isNaN(Date.parse(body.paid_at))) {
    return 'Data de pagamento invalida';
  }
  return null;
}

async function validateTargetMember(client: ReturnType<typeof db>, groupId: string, userId?: string | null) {
  if (!userId) return true;
  const { data, error } = await client.from('group_members').select('id')
    .eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function reconcileFinancialBlock(client: ReturnType<typeof db>, groupId: string, userId?: string | null) {
  if (!userId) return;
  const { count, error: countError } = await client.from('financial_transactions')
    .select('id', { count: 'exact', head: true }).eq('group_id', groupId)
    .eq('user_id', userId).eq('type', 'income').in('status', ['pending', 'overdue']);
  if (countError) throw countError;
  const blocked = Boolean(count);
  const { error: memberError } = await client.from('group_members').update({
    is_blocked_financial: blocked,
    blocked_reason: blocked ? 'Debito financeiro pendente' : null,
  }).eq('group_id', groupId).eq('user_id', userId);
  if (memberError) throw memberError;
}

async function notifyChargedMember(
  client: ReturnType<typeof db>,
  groupId: string,
  actorUserId: string,
  transaction: any,
  kind: 'created' | 'paid',
) {
  if (transaction.type !== 'income' || !transaction.user_id) return;
  const amount = Number(transaction.amount).toFixed(2).replace('.', ',');
  const paid = kind === 'paid' || transaction.status === 'paid';
  const { data: group } = await client.from('groups').select('name').eq('id', groupId).maybeSingle();
  const { error } = await client.from('notifications').insert({
    group_id: groupId,
    group_name: group?.name || null,
    recipient_user_id: transaction.user_id,
    actor_user_id: actorUserId,
    type: 'financial_alert',
    title: paid ? 'Pagamento confirmado' : 'Nova cobranca gerada',
    message: paid
      ? `Seu pagamento de R$ ${amount} referente a ${transaction.description} foi confirmado.`
      : `${transaction.description}, no valor de R$ ${amount}, foi gerada com vencimento em ${transaction.due_date}.`,
    data: {
      transactionId: transaction.id,
      userId: transaction.user_id,
      userName: transaction.username,
      amount: Number(transaction.amount),
      category: transaction.category,
    },
  });
  if (error) console.warn('Falha ao registrar notificacao financeira:', error.message);
}

export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client!.from('financial_transactions').select('*')
    .eq('group_id', params.groupId).order('created_at', { ascending: false });
  if (error) return apiError(error, 'Nao foi possivel carregar o financeiro');
  return response({ data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId, true);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const validationError = validateTransaction(body);
    if (validationError) return response({ error: validationError }, 400);
    if (!(await validateTargetMember(auth.client!, params.groupId, body.user_id))) {
      return response({ error: 'O usuario selecionado nao pertence ao grupo' }, 400);
    }

    if (body.category === 'mensalidade' && body.user_id) {
      const { data: duplicate, error: duplicateError } = await auth.client!.from('financial_transactions')
        .select('id').eq('group_id', params.groupId).eq('user_id', body.user_id)
        .eq('category', 'mensalidade').eq('description', body.description.trim()).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) return response({ error: 'Esta mensalidade ja foi gerada para o membro' }, 409);
    }

    const status = body.status;
    const payload = {
      group_id: params.groupId,
      user_id: body.user_id || null,
      username: body.username?.trim() || null,
      type: body.type,
      category: body.category,
      description: body.description.trim(),
      amount: Number(body.amount),
      due_date: body.due_date,
      paid_at: status === 'paid' ? (body.paid_at || new Date().toISOString()) : null,
      status,
      recorded_by: auth.profile!.id,
    };
    const { data, error } = await auth.client!.from('financial_transactions')
      .insert(payload).select('*').single();
    if (error) throw error;
    await reconcileFinancialBlock(auth.client!, params.groupId, data.user_id);
    await notifyChargedMember(auth.client!, params.groupId, auth.profile!.id, data, 'created');
    return response({ data }, 201);
  } catch (error) {
    return apiError(error, 'Nao foi possivel salvar o lancamento');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId, true);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!UUID_PATTERN.test(body.id || '')) return response({ error: 'Lancamento invalido' }, 400);
    const validationError = validateTransaction(body, true);
    if (validationError) return response({ error: validationError }, 400);

    const { data: before, error: beforeError } = await auth.client!.from('financial_transactions')
      .select('*').eq('id', body.id).eq('group_id', params.groupId).maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) return response({ error: 'Lancamento nao encontrado' }, 404);
    if (body.user_id !== undefined && !(await validateTargetMember(auth.client!, params.groupId, body.user_id))) {
      return response({ error: 'O usuario selecionado nao pertence ao grupo' }, 400);
    }

    const allowed: Record<string, unknown> = {};
    for (const key of ['type', 'category', 'description', 'amount', 'due_date', 'user_id', 'username', 'status']) {
      if (body[key] !== undefined) allowed[key] = body[key];
    }
    if (typeof allowed.description === 'string') allowed.description = allowed.description.trim();
    if (allowed.amount !== undefined) allowed.amount = Number(allowed.amount);
    if (allowed.user_id === '') allowed.user_id = null;
    if (allowed.username === '') allowed.username = null;
    if (body.status !== undefined) {
      allowed.paid_at = body.status === 'paid' ? (body.paid_at || before.paid_at || new Date().toISOString()) : null;
    }

    const { data, error } = await auth.client!.from('financial_transactions').update(allowed)
      .eq('id', body.id).eq('group_id', params.groupId).select('*').single();
    if (error) throw error;
    await reconcileFinancialBlock(auth.client!, params.groupId, before.user_id);
    if (data.user_id !== before.user_id) await reconcileFinancialBlock(auth.client!, params.groupId, data.user_id);
    if (before.status !== 'paid' && data.status === 'paid') {
      await notifyChargedMember(auth.client!, params.groupId, auth.profile!.id, data, 'paid');
    }
    return response({ data });
  } catch (error) {
    return apiError(error, 'Nao foi possivel atualizar o lancamento');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId, true);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!UUID_PATTERN.test(body.id || '')) return response({ error: 'Lancamento invalido' }, 400);
    const { data, error } = await auth.client!.from('financial_transactions').delete()
      .eq('id', body.id).eq('group_id', params.groupId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: 'Lancamento nao encontrado' }, 404);
    await reconcileFinancialBlock(auth.client!, params.groupId, data.user_id);
    return response({ data: { removed: data.id } });
  } catch (error) {
    return apiError(error, 'Nao foi possivel excluir o lancamento');
  }
}
