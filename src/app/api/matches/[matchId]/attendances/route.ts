import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado');
  return createClient(url, key, { auth: { persistSession: false } });
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

async function authorize(request: NextRequest, matchId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: response({ error: 'Nao autorizado' }, 401) };
  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return { error: response({ error: 'Sessao invalida' }, 401) };
  let profileId = authData.user.id;
  if (authData.user.email) {
    const { data: profile } = await client.from('users').select('id')
      .eq('email', authData.user.email.toLowerCase()).maybeSingle();
    if (profile?.id) profileId = profile.id;
  }
  const { data: match } = await client.from('matches').select('group_id').eq('id', matchId).maybeSingle();
  if (!match) return { error: response({ error: 'Lista nao encontrada' }, 404) };
  const { data: member } = await client.from('group_members').select('role,status')
    .eq('group_id', match.group_id).eq('user_id', profileId).eq('status', 'active').maybeSingle();
  if (!member) return { error: response({ error: 'Usuario nao pertence ao grupo' }, 403) };
  return { client, user: authData.user, member, profileId };
}

const selection = `
  id, match_id, user_id, status, arrival_order, is_financial_blocked,
  confirmed_at, checked_in_at,
  users (id, name, email, phone, cpf, address, avatar_url, main_position,
    secondary_position, dominant_foot, overall_rating, created_at)
`;

export async function GET(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client!.from('match_attendances').select(selection)
    .eq('match_id', params.matchId).neq('status', 'cancelled');
  if (error) return response({ error: error.message }, 500);
  return response({ data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorize(request, params.matchId);
  if (auth.error) return auth.error;
  const body = await request.json();
  const client = auth.client!;
  const isDirector = ['presidente', 'adm', 'tesoureiro'].includes(auth.member!.role);
  let resolvedUserId = isDirector ? body.user_id : auth.profileId!;

  if (body.user) {
    const user = body.user;
    if (user.email) {
      const { data: existing } = await client.from('users').select('id')
        .eq('email', String(user.email).trim().toLowerCase()).maybeSingle();
      if (existing?.id) resolvedUserId = existing.id;
    }
    const { error: userError } = await client.from('users').upsert([{
      id: resolvedUserId,
      name: user.name || 'Atleta',
      email: user.email,
      phone: user.phone || '(00) 00000-0000',
      cpf: user.cpf,
      address: user.address || 'Nao informado',
      avatar_url: user.avatarUrl || null,
      main_position: user.mainPosition || 'meia',
      secondary_position: user.secondaryPosition || null,
      dominant_foot: user.dominantFoot || 'destro',
      overall_rating: user.overallRating || 6.5,
    }], { onConflict: 'id' });
    if (userError) return response({ error: userError.message }, 500);
  }

  const { user: _user, ...attendance } = body;
  const { data, error } = await client.from('match_attendances').upsert([{
    ...attendance,
    match_id: params.matchId,
    user_id: resolvedUserId,
  }], { onConflict: 'match_id,user_id' }).select('*').single();
  if (error) return response({ error: error.message }, 500);
  return response({ data });
}
