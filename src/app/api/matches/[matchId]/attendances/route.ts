import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DIRECTOR_ROLES = ['presidente', 'adm', 'tesoureiro'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_EMAIL_SUFFIX = '@convidado.gestao-pelada.local';

function db(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function isGuestEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith(GUEST_EMAIL_SUFFIX));
}

function guestHostId(address?: string | null) {
  return address?.match(/\[host:([0-9a-f-]{36})\]/i)?.[1] || null;
}

async function authorize(request: NextRequest, matchId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: response({ error: 'Nao autorizado' }, 401) };
  const client = db(token);
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return { error: response({ error: 'Sessao invalida' }, 401) };

  let profileId = authData.user.id;
  if (authData.user.email) {
    const { data: profile } = await client.from('users').select('id')
      .eq('email', authData.user.email.toLowerCase()).maybeSingle();
    if (profile?.id) profileId = profile.id;
  }

  const { data: match } = await client.from('matches')
    .select('group_id,max_players,confirmation_deadline').eq('id', matchId).maybeSingle();
  if (!match) return { error: response({ error: 'Lista nao encontrada' }, 404) };

  const { data: member } = await client.from('group_members').select('role,status,is_blocked_financial')
    .eq('group_id', match.group_id).eq('user_id', profileId).eq('status', 'active').maybeSingle();
  if (!member) return { error: response({ error: 'Usuario nao pertence ao grupo' }, 403) };

  return {
    client,
    user: authData.user,
    member,
    match,
    profileId,
    isDirector: DIRECTOR_ROLES.includes(member.role),
  };
}

const selection = `
  id, match_id, user_id, status, arrival_order, is_financial_blocked,
  confirmed_at, checked_in_at,
  users (id, name, email, phone, cpf, address, avatar_url, main_position,
    secondary_position, dominant_foot, overall_rating, created_at)
`;

async function nextWaitlistOrder(client: ReturnType<typeof db>, matchId: string) {
  const { data } = await client.from('match_attendances').select('arrival_order')
    .eq('match_id', matchId).eq('status', 'waitlist')
    .order('arrival_order', { ascending: false }).limit(1);
  return Number(data?.[0]?.arrival_order || 0) + 1;
}

async function confirmedCount(client: ReturnType<typeof db>, matchId: string, exceptAttendanceId?: string) {
  let query = client.from('match_attendances').select('id', { count: 'exact', head: true })
    .eq('match_id', matchId).in('status', ['confirmed', 'present']);
  if (exceptAttendanceId) query = query.neq('id', exceptAttendanceId);
  const { count } = await query;
  return count || 0;
}

async function promoteNextWaitlisted(client: ReturnType<typeof db>, matchId: string) {
  const { data: candidates } = await client.from('match_attendances')
    .select('id,user_id,status,arrival_order,is_financial_blocked,confirmed_at')
    .eq('match_id', matchId).eq('status', 'waitlist').eq('is_financial_blocked', false)
    .order('arrival_order', { ascending: true, nullsFirst: false })
    .order('confirmed_at', { ascending: true }).limit(1);
  const candidate = candidates?.[0];
  if (!candidate) return null;
  const { data, error } = await client.from('match_attendances')
    .update({ status: 'confirmed', arrival_order: null }).eq('id', candidate.id)
    .select('id,user_id').single();
  return error ? null : data;
}

export async function GET(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client!.from('match_attendances').select(selection)
    .eq('match_id', params.matchId).neq('status', 'cancelled')
    .order('arrival_order', { ascending: true, nullsFirst: false })
    .order('confirmed_at', { ascending: true });
  if (error) return response({ error: error.message }, 500);
  return response({ data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  const body = await request.json();
  const client = auth.client!;
  const payloadUser = body.user;
  const addingGuest = isGuestEmail(payloadUser?.email);

  let resolvedUserId = auth.profileId!;
  if (addingGuest) {
    if (!UUID_PATTERN.test(body.user_id || '') || guestHostId(payloadUser?.address) !== auth.profileId) {
      return response({ error: 'Dados do convidado invalidos' }, 400);
    }
    resolvedUserId = body.user_id;
  } else if (auth.isDirector && UUID_PATTERN.test(body.user_id || '')) {
    resolvedUserId = body.user_id;
  }

  if (payloadUser && (addingGuest || resolvedUserId === auth.profileId)) {
    const { error: userError } = await client.from('users').upsert([{
      id: resolvedUserId,
      name: payloadUser.name || 'Atleta',
      email: addingGuest ? payloadUser.email : auth.user!.email,
      phone: payloadUser.phone || '(00) 00000-0000',
      cpf: payloadUser.cpf || (addingGuest ? `guest_${resolvedUserId}` : null),
      address: payloadUser.address || 'Nao informado',
      avatar_url: payloadUser.avatarUrl || null,
      main_position: payloadUser.mainPosition || 'meia',
      secondary_position: payloadUser.secondaryPosition || null,
      dominant_foot: payloadUser.dominantFoot || 'destro',
      overall_rating: payloadUser.overallRating || 6.5,
    }], { onConflict: 'id' });
    if (userError) return response({ error: userError.message }, 500);
  }

  const { data: existing } = await client.from('match_attendances')
    .select('id,status,arrival_order').eq('match_id', params.matchId)
    .eq('user_id', resolvedUserId).maybeSingle();

  let status = body.status === 'waitlist' ? 'waitlist' : 'confirmed';
  let isFinancialBlocked = Boolean(body.is_financial_blocked);

  if (!addingGuest) {
    const { count: pendingCharges } = await client.from('financial_transactions')
      .select('id', { count: 'exact', head: true }).eq('group_id', auth.match!.group_id)
      .eq('user_id', resolvedUserId).eq('type', 'income').in('status', ['pending', 'overdue']);
    isFinancialBlocked = isFinancialBlocked || Boolean(auth.member!.is_blocked_financial) || Boolean(pendingCharges);
  }

  const deadlinePassed = auth.match!.confirmation_deadline
    ? new Date(auth.match!.confirmation_deadline).getTime() < Date.now()
    : false;
  const occupied = await confirmedCount(client, params.matchId, existing?.id);
  if (isFinancialBlocked || deadlinePassed || occupied >= Number(auth.match!.max_players || 20)) {
    status = 'waitlist';
  }

  const arrivalOrder = status === 'waitlist'
    ? (existing?.arrival_order || await nextWaitlistOrder(client, params.matchId))
    : null;
  const { user: _user, ...attendance } = body;
  const { data, error } = await client.from('match_attendances').upsert([{
    ...attendance,
    match_id: params.matchId,
    user_id: resolvedUserId,
    status,
    arrival_order: arrivalOrder,
    is_financial_blocked: isFinancialBlocked,
  }], { onConflict: 'match_id,user_id' }).select(selection).single();
  if (error) return response({ error: error.message }, 500);
  return response({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  if (!auth.isDirector) return response({ error: 'Apenas a diretoria pode alterar a fila' }, 403);

  const body = await request.json();
  if (body.action === 'check_in' || body.action === 'undo_check_in') {
    if (!UUID_PATTERN.test(body.attendance_id || '')) {
      return response({ error: 'Presenca invalida' }, 400);
    }
    const { error: arrivalError } = await auth.client!.rpc('manage_match_arrival', {
      p_match_id: params.matchId,
      p_attendance_id: body.attendance_id,
      p_action: body.action,
    });
    if (arrivalError) return response({ error: arrivalError.message }, 400);
    const { data: attendance, error: attendanceError } = await auth.client!
      .from('match_attendances').select(selection)
      .eq('id', body.attendance_id).eq('match_id', params.matchId).single();
    if (attendanceError) return response({ error: attendanceError.message }, 500);
    return response({ data: attendance });
  }

  if (!UUID_PATTERN.test(body.attendance_id || '') || !['confirmed', 'waitlist'].includes(body.status)) {
    return response({ error: 'Alteracao invalida' }, 400);
  }

  const client = auth.client!;
  const { data: target } = await client.from('match_attendances').select('id,status')
    .eq('id', body.attendance_id).eq('match_id', params.matchId).maybeSingle();
  if (!target) return response({ error: 'Presenca nao encontrada' }, 404);

  if (body.status === 'confirmed') {
    const occupied = await confirmedCount(client, params.matchId, target.id);
    if (occupied >= Number(auth.match!.max_players || 20)) {
      return response({ error: 'Nao ha vaga disponivel na lista de confirmados' }, 409);
    }
  }

  const arrivalOrder = body.status === 'waitlist'
    ? await nextWaitlistOrder(client, params.matchId)
    : null;
  const updatePayload: Record<string, unknown> = {
    status: body.status,
    arrival_order: arrivalOrder,
  };
  if (body.status === 'confirmed') updatePayload.is_financial_blocked = false;
  const { data, error } = await client.from('match_attendances').update(updatePayload)
    .eq('id', target.id).select(selection).single();
  if (error) return response({ error: error.message }, 500);
  return response({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  const body = await request.json();
  if (!UUID_PATTERN.test(body.attendance_id || '')) return response({ error: 'Presenca invalida' }, 400);

  const client = auth.client!;
  const { data: target } = await client.from('match_attendances').select(selection)
    .eq('id', body.attendance_id).eq('match_id', params.matchId).maybeSingle();
  if (!target) return response({ error: 'Presenca nao encontrada' }, 404);

  const userRow: any = Array.isArray((target as any).users) ? (target as any).users[0] : (target as any).users;
  const guest = isGuestEmail(userRow?.email);
  const canRemove = auth.isDirector || target.user_id === auth.profileId || (guest && guestHostId(userRow?.address) === auth.profileId);
  if (!canRemove) return response({ error: 'Sem permissao para remover esta presenca' }, 403);

  const wasConfirmed = ['confirmed', 'present'].includes(target.status);
  const { error } = await client.from('match_attendances').delete().eq('id', target.id);
  if (error) return response({ error: error.message }, 500);

  const promoted = wasConfirmed ? await promoteNextWaitlisted(client, params.matchId) : null;
  if (guest) await client.from('users').delete().eq('id', target.user_id);
  return response({ data: { removed: target.id, promoted } });
}
