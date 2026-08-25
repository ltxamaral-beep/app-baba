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

async function authorizeDirector(request: NextRequest, matchId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: response({ error: 'Nao autorizado' }, 401) };
  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return { error: response({ error: 'Sessao invalida' }, 401) };
  const { data: match } = await client.from('matches').select('group_id').eq('id', matchId).maybeSingle();
  if (!match) return { error: response({ error: 'Lista nao encontrada' }, 404) };
  const { data: member } = await client.from('group_members').select('role,status')
    .eq('group_id', match.group_id).eq('user_id', authData.user.id).eq('status', 'active').maybeSingle();
  if (!member || !['presidente', 'adm', 'tesoureiro'].includes(member.role)) {
    return { error: response({ error: 'Apenas a diretoria pode alterar listas' }, 403) };
  }
  return { client };
}

export async function PATCH(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorizeDirector(request, params.matchId);
  if (auth.error) return auth.error;
  const payload = await request.json();
  const { data, error } = await auth.client!.from('matches').update(payload)
    .eq('id', params.matchId).select('*').maybeSingle();
  if (error) return response({ error: error.message }, 500);
  if (!data) return response({ error: 'Lista nao encontrada' }, 404);
  return response({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { matchId: string } }) {
  const auth = await authorizeDirector(request, params.matchId);
  if (auth.error) return auth.error;
  const { error } = await auth.client!.from('matches').delete().eq('id', params.matchId);
  if (error) return response({ error: error.message }, 500);
  return response({ success: true });
}
