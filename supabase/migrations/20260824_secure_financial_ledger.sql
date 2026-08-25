-- Financial ledger hardening: authenticated access, complete categories and audit trail.

ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'cartao_azul';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'cartao_vermelho';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'cartao_amarelo';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'multa_atraso';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'multa_falta';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'uniforme';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'patrocinio';
ALTER TYPE public.transaction_category ADD VALUE IF NOT EXISTS 'saldo_inicial';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM public.users AS u
  WHERE lower(u.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  ORDER BY u.created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members AS gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = private.current_profile_id()
      AND gm.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_group_director(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members AS gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = private.current_profile_id()
      AND gm.status = 'active'
      AND gm.role IN ('presidente', 'adm', 'tesoureiro')
  )
$$;

REVOKE ALL ON FUNCTION private.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_director(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_director(uuid) TO authenticated;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_select" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_insert" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_update" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_delete" ON public.financial_transactions;

REVOKE ALL ON TABLE public.financial_transactions FROM anon;
REVOKE ALL ON TABLE public.financial_transactions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_transactions TO authenticated;

CREATE POLICY "financial_transactions_select"
ON public.financial_transactions FOR SELECT TO authenticated
USING (
  private.is_group_director(group_id)
  OR (
    private.is_group_member(group_id)
    AND user_id = private.current_profile_id()
  )
);

CREATE POLICY "financial_transactions_insert"
ON public.financial_transactions FOR INSERT TO authenticated
WITH CHECK (
  private.is_group_director(group_id)
  AND recorded_by = private.current_profile_id()
);

CREATE POLICY "financial_transactions_update"
ON public.financial_transactions FOR UPDATE TO authenticated
USING (private.is_group_director(group_id))
WITH CHECK (private.is_group_director(group_id));

CREATE POLICY "financial_transactions_delete"
ON public.financial_transactions FOR DELETE TO authenticated
USING (private.is_group_director(group_id));

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_amount_positive;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_amount_positive CHECK (amount > 0);

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_monthly_charge
  ON public.financial_transactions(group_id, user_id, description)
  WHERE category = 'mensalidade';

CREATE TABLE IF NOT EXISTS public.financial_transaction_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id uuid NOT NULL,
  group_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_profile_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_transaction_audit_group_occurred
  ON public.financial_transaction_audit(group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS financial_transaction_audit_transaction
  ON public.financial_transaction_audit(transaction_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION private.audit_financial_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.financial_transaction_audit (
    transaction_id, group_id, action, old_data, new_data, actor_profile_id
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.group_id, OLD.group_id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    private.current_profile_id()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_financial_transaction ON public.financial_transactions;
CREATE TRIGGER audit_financial_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION private.audit_financial_transaction();

ALTER TABLE public.financial_transaction_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transaction_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_transaction_audit FROM anon, authenticated;
GRANT SELECT ON TABLE public.financial_transaction_audit TO authenticated;
CREATE POLICY "financial_audit_select"
ON public.financial_transaction_audit FOR SELECT TO authenticated
USING (private.is_group_director(group_id));

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  group_name text,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON public.notifications(group_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.notifications FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;

CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT TO authenticated
USING (recipient_user_id = private.current_profile_id());

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = private.current_profile_id()
  AND private.is_group_member(group_id)
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = notifications.group_id
      AND gm.user_id = notifications.recipient_user_id
      AND gm.status = 'active'
  )
);

CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE TO authenticated
USING (recipient_user_id = private.current_profile_id())
WITH CHECK (recipient_user_id = private.current_profile_id());

CREATE POLICY "notifications_delete"
ON public.notifications FOR DELETE TO authenticated
USING (recipient_user_id = private.current_profile_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financial_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_transactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
