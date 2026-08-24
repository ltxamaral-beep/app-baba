-- ========================================================================
-- SCHEMA OFICIAL: GESTÃO DE PELADAS (POSTGRESQL / SUPABASE)
-- ========================================================================

-- Limpeza prévia para garantir execução limpa sem conflitos
DROP TABLE IF EXISTS player_ratings CASCADE;
DROP TABLE IF EXISTS match_team_players CASCADE;
DROP TABLE IF EXISTS match_teams CASCADE;
DROP TABLE IF EXISTS match_attendances CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS financial_transactions CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS match_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS transaction_category CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS member_status CASCADE;
DROP TYPE IF EXISTS membership_type CASCADE;
DROP TYPE IF EXISTS group_role CASCADE;
DROP TYPE IF EXISTS soccer_type CASCADE;
DROP TYPE IF EXISTS dominant_foot CASCADE;
DROP TYPE IF EXISTS user_position CASCADE;

-- Extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- 1. ENUMS
-- ========================================================================
CREATE TYPE user_position AS ENUM ('goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'atacante');
CREATE TYPE dominant_foot AS ENUM ('destro', 'canhoto', 'ambidestro');
CREATE TYPE soccer_type AS ENUM ('society', 'campo', 'futsal', 'barro');
CREATE TYPE group_role AS ENUM ('presidente', 'adm', 'tesoureiro', 'associado', 'diarista', 'goleiro');
CREATE TYPE membership_type AS ENUM ('associado', 'diarista', 'goleiro', 'convidado');
CREATE TYPE member_status AS ENUM ('active', 'pending_approval', 'rejected', 'banned');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_category AS ENUM (
    'mensalidade', 
    'diaria', 
    'aluguel_campo', 
    'material', 
    'churrasco', 
    'ajuda_custo_goleiro', 
    'arbitragem', 
    'agua_gelo', 
    'outros'
);
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue', 'cancelled');
CREATE TYPE match_status AS ENUM ('scheduled', 'in_progress', 'finished', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('confirmed', 'waitlist', 'cancelled', 'present', 'absent');

-- ========================================================================
-- 2. TABELA DE USUÁRIOS & PERFIL DE ATLETA
-- ========================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    nickname VARCHAR(60),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    avatar_url TEXT,
    main_position user_position NOT NULL DEFAULT 'meia',
    secondary_position user_position,
    dominant_foot dominant_foot NOT NULL DEFAULT 'destro',
    height_cm INT,
    weight_kg NUMERIC(5,2),
    overall_rating NUMERIC(4,2) DEFAULT 6.50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 3. TABELA DE GRUPOS DE PELADA
-- ========================================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    soccer_type soccer_type NOT NULL DEFAULT 'society',
    players_per_team INT NOT NULL DEFAULT 6,
    max_slots INT NOT NULL DEFAULT 24,
    field_address TEXT NOT NULL,
    match_day VARCHAR(30) NOT NULL,
    match_time TIME NOT NULL,
    match_duration_minutes INT NOT NULL DEFAULT 90,
    rules TEXT,
    monthly_fee NUMERIC(10,2) DEFAULT 80.00,
    daily_fee NUMERIC(10,2) DEFAULT 25.00,
    invite_code VARCHAR(16) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    whatsapp_group_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 4. TABELA DE MEMBROS DO GRUPO (HIERARQUIA & CARGOS)
-- ========================================================================
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role group_role NOT NULL DEFAULT 'associado',
    membership_type membership_type NOT NULL DEFAULT 'associado',
    status member_status NOT NULL DEFAULT 'active',
    is_blocked_financial BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- ========================================================================
-- 5. TABELA DE TRANSAÇÕES FINANCEIRAS
-- ========================================================================
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    userName VARCHAR(150),
    type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    status payment_status NOT NULL DEFAULT 'pending',
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 6. TABELA DE PELADAS (PARTIDAS)
-- ========================================================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    start_time TIME NOT NULL,
    confirmation_deadline TIMESTAMP WITH TIME ZONE,
    max_players INT NOT NULL DEFAULT 24,
    cost_diarista NUMERIC(8,2) DEFAULT 25.00,
    status match_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 7. TABELA DE CHAMADA & PRESENÇA (COM FILA DE ESPERA)
-- ========================================================================
CREATE TABLE match_attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'confirmed',
    arrival_order INT,
    is_financial_blocked BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(match_id, user_id)
);

-- ========================================================================
-- 8. TABELAS DE TIMES DO SORTEIO
-- ========================================================================
CREATE TABLE match_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE match_team_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES match_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_locked BOOLEAN DEFAULT FALSE,
    position_assigned user_position NOT NULL,
    UNIQUE(team_id, user_id)
);

-- ========================================================================
-- 9. TABELA DE AVALIAÇÃO DE NOTAS PÓS-PELADA
-- ========================================================================
CREATE TABLE player_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(3,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 10.0),
    tags TEXT[],
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, rater_user_id, rated_user_id)
);

-- ========================================================================
-- 10. ÍNDICES DE ALTA PERFORMANCE
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON financial_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_attendance_match ON match_attendances(match_id);
CREATE INDEX IF NOT EXISTS idx_ratings_player ON player_ratings(rated_user_id);

-- ========================================================================
-- 11. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ========================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso aberto e autenticado para funcionamento imediato
DROP POLICY IF EXISTS "Permitir tudo users" ON users;
DROP POLICY IF EXISTS "Permitir tudo groups" ON groups;
DROP POLICY IF EXISTS "Permitir tudo group_members" ON group_members;
DROP POLICY IF EXISTS "Permitir tudo financial_transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Permitir tudo matches" ON matches;
DROP POLICY IF EXISTS "Permitir tudo match_attendances" ON match_attendances;
DROP POLICY IF EXISTS "Permitir tudo match_teams" ON match_teams;
DROP POLICY IF EXISTS "Permitir tudo match_team_players" ON match_team_players;
DROP POLICY IF EXISTS "Permitir tudo player_ratings" ON player_ratings;

CREATE POLICY "Permitir tudo users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo financial_transactions" ON financial_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo match_attendances" ON match_attendances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo match_teams" ON match_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo match_team_players" ON match_team_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo player_ratings" ON player_ratings FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 12. TRIGGER DE SINCRONIZAÇÃO AUTOMÁTICA DE AUTH (GOOGLE & EMAIL)
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id, 
        name, 
        email, 
        phone, 
        cpf, 
        address, 
        avatar_url, 
        main_position, 
        dominant_foot, 
        overall_rating
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        COALESCE(new.raw_user_meta_data->>'phone', '(00) 00000-0000'),
        COALESCE(new.raw_user_meta_data->>'cpf', 'oauth_' || substr(md5(random()::text), 1, 10)),
        COALESCE(new.raw_user_meta_data->>'address', 'Não informado'),
        new.raw_user_meta_data->>'avatar_url',
        'meia',
        'destro',
        6.50
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para capturar novos cadastros via Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

