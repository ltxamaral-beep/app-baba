CREATE UNIQUE INDEX IF NOT EXISTS match_attendances_unique_arrival_order
  ON public.match_attendances(match_id, arrival_order)
  WHERE status = 'present' AND arrival_order IS NOT NULL;

CREATE OR REPLACE FUNCTION public.manage_match_arrival(
  p_match_id uuid,
  p_attendance_id uuid,
  p_action text DEFAULT 'check_in'
)
RETURNS public.match_attendances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group_id uuid;
  v_target public.match_attendances%ROWTYPE;
  v_next_order integer;
  v_removed_order integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao nao autenticada' USING ERRCODE = '42501';
  END IF;

  SELECT m.group_id INTO v_group_id
  FROM public.matches AS m
  WHERE m.id = p_match_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Partida nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT private.is_group_director(v_group_id) THEN
    RAISE EXCEPTION 'Apenas a diretoria pode registrar chegadas' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  SELECT attendance.* INTO v_target
  FROM public.match_attendances AS attendance
  WHERE attendance.id = p_attendance_id
    AND attendance.match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presenca nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'check_in' THEN
    IF v_target.status = 'present' THEN
      RETURN v_target;
    END IF;
    IF v_target.status <> 'confirmed' THEN
      RAISE EXCEPTION 'Somente atletas confirmados podem ter chegada registrada';
    END IF;

    SELECT COALESCE(MAX(attendance.arrival_order), 0) + 1 INTO v_next_order
    FROM public.match_attendances AS attendance
    WHERE attendance.match_id = p_match_id
      AND attendance.status = 'present';

    UPDATE public.match_attendances
    SET status = 'present',
        arrival_order = v_next_order,
        checked_in_at = now()
    WHERE id = p_attendance_id
    RETURNING * INTO v_target;
  ELSIF p_action = 'undo_check_in' THEN
    IF v_target.status <> 'present' THEN
      RETURN v_target;
    END IF;
    v_removed_order := v_target.arrival_order;

    UPDATE public.match_attendances
    SET status = 'confirmed',
        arrival_order = NULL,
        checked_in_at = NULL
    WHERE id = p_attendance_id
    RETURNING * INTO v_target;

    IF v_removed_order IS NOT NULL THEN
      UPDATE public.match_attendances
      SET arrival_order = arrival_order - 1
      WHERE match_id = p_match_id
        AND status = 'present'
        AND arrival_order > v_removed_order;
    END IF;
  ELSE
    RAISE EXCEPTION 'Acao de chegada invalida';
  END IF;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_match_arrival(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_match_arrival(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.manage_match_arrival(uuid, uuid, text) TO authenticated;
