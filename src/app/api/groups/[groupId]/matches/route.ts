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

async function authorize(request: NextRequest, groupId: string, directorOnly = false) {
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
  const { data: member } = await client.from('group_members').select('role,status')
    .eq('group_id', groupId).eq('user_id', profileId).eq('status', 'active').maybeSingle();
  if (!member) return { error: response({ error: 'Usuario nao pertence ao grupo' }, 403) };
  if (directorOnly && !['presidente', 'adm', 'tesoureiro'].includes(member.role)) {
    return { error: response({ error: 'Apenas a diretoria pode alterar listas' }, 403) };
  }
  return { client, user: authData.user, profileId };
}

export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client!.from('matches').select('*')
    .eq('group_id', params.groupId).order('match_date', { ascending: false });
  if (error) return response({ error: error.message }, 500);
  return response({ data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { groupId: string } }) {
  const auth = await authorize(request, params.groupId, true);
  if (auth.error) return auth.error;
  const payload = await request.json();
  const { data, error } = await auth.client!.from('matches').upsert([{
    ...payload,
    group_id: params.groupId,
  }]).select('*').single();
  if (error) return response({ error: error.message }, 500);
  return response({ data });
}
