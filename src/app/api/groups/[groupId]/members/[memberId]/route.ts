import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DIRECTOR_ROLES = ['presidente', 'adm', 'tesoureiro'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function db(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } },
) {
  if (!UUID_PATTERN.test(params.groupId) || !UUID_PATTERN.test(params.memberId)) {
    return response({ error: 'Grupo ou membro invalido' }, 400);
  }
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return response({ error: 'Nao autorizado' }, 401);

  try {
    const client = db(token);
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user?.email) return response({ error: 'Sessao invalida' }, 401);
    const { data: profile, error: profileError } = await client.from('users').select('id')
      .ilike('email', authData.user.email).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return response({ error: 'Perfil nao encontrado' }, 403);

    const { data: director, error: directorError } = await client.from('group_members').select('role,status')
      .eq('group_id', params.groupId).eq('user_id', profile.id).eq('status', 'active').maybeSingle();
    if (directorError) throw directorError;
    if (!director || !DIRECTOR_ROLES.includes(director.role)) {
      return response({ error: 'Apenas a diretoria pode remover membros' }, 403);
    }

    const { data: target, error: targetError } = await client.from('group_members')
      .select('id,user_id,role,status').eq('group_id', params.groupId)
      .or(`id.eq.${params.memberId},user_id.eq.${params.memberId}`).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return response({ error: 'Membro nao encontrado' }, 404);
    if (target.role === 'presidente') {
      return response({ error: 'Transfira a presidencia antes de remover o presidente' }, 409);
    }
    if (target.user_id === profile.id) {
      return response({ error: 'Use a opcao Sair do grupo para remover o proprio acesso' }, 409);
    }

    const { data: upcomingMatches, error: matchesError } = await client.from('matches').select('id')
      .eq('group_id', params.groupId).in('status', ['scheduled', 'in_progress']);
    if (matchesError) throw matchesError;
    const matchIds = (upcomingMatches || []).map((match) => match.id);
    if (matchIds.length) {
      const { error: attendanceError } = await client.from('match_attendances').delete()
        .eq('user_id', target.user_id).in('match_id', matchIds);
      if (attendanceError) throw attendanceError;
    }

    const { data: removed, error: removeError } = await client.from('group_members').delete()
      .eq('id', target.id).eq('group_id', params.groupId).select('id,user_id').maybeSingle();
    if (removeError) throw removeError;
    if (!removed) return response({ error: 'A remocao nao foi confirmada pelo servidor' }, 409);
    return response({ data: removed });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Falha ao remover membro' }, 500);
  }
}
