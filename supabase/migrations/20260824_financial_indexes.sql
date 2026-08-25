CREATE INDEX IF NOT EXISTS financial_transactions_user_id_idx
  ON public.financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS financial_transactions_recorded_by_idx
  ON public.financial_transactions(recorded_by);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx
  ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS notifications_actor_user_id_idx
  ON public.notifications(actor_user_id);
