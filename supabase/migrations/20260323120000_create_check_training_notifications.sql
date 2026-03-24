-- Função RPC para enviar notificações de treinamento nos tempos corretos
-- Chamada periodicamente pela edge function check-scheduled-notifications
-- Intervalos: 60min, 30min, 10min, 5min, 1min antes + início + em andamento (15min depois)
-- Apenas INSERE notificações, nunca deleta nada
CREATE OR REPLACE FUNCTION public.check_training_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_training RECORD;
  v_user RECORD;
  v_now TIMESTAMPTZ;
  v_training_start TIMESTAMPTZ;
  v_diff_minutes INTEGER;
  v_label TEXT;
  v_notif_key TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  v_now := now() AT TIME ZONE 'America/Sao_Paulo';

  FOR v_training IN
    SELECT t.id, t.title, t.class_date, t.class_time, t.allowed_roles,
           t.is_recurring, t.recurrence_days
    FROM trainings t
    WHERE t.archived = false
      AND t.class_time IS NOT NULL
      AND (
        (t.class_date = (v_now)::date)
        OR
        (t.is_recurring = true AND t.recurrence_days IS NOT NULL AND (
          CASE EXTRACT(DOW FROM v_now)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda'
            WHEN 2 THEN 'terca'
            WHEN 3 THEN 'quarta'
            WHEN 4 THEN 'quinta'
            WHEN 5 THEN 'sexta'
            WHEN 6 THEN 'sabado'
          END
        ) = ANY(t.recurrence_days))
      )
  LOOP
    v_training_start := ((v_now)::date + v_training.class_time)::timestamptz;
    v_diff_minutes := EXTRACT(EPOCH FROM (v_training_start - v_now))::integer / 60;

    FOREACH v_label IN ARRAY ARRAY['60', '30', '10', '5', '1', '0', '-15']
    LOOP
      DECLARE
        v_target INTEGER;
        v_in_window BOOLEAN;
      BEGIN
        v_target := v_label::integer;
        v_in_window := (v_diff_minutes >= v_target - 2 AND v_diff_minutes <= v_target + 2);

        IF NOT v_in_window THEN
          CONTINUE;
        END IF;

        v_notif_key := 'training_reminder_' || v_training.id || '_' || v_label || '_' || (v_now)::date;

        CASE v_target
          WHEN 60 THEN
            v_title := '🎓 Treinamento em 1 hora';
            v_message := '"' || v_training.title || '" começa em 1 hora';
          WHEN 30 THEN
            v_title := '🎓 Treinamento em 30 minutos';
            v_message := '"' || v_training.title || '" começa em 30 minutos';
          WHEN 10 THEN
            v_title := '🎓 Treinamento em 10 minutos';
            v_message := '"' || v_training.title || '" começa em 10 minutos';
          WHEN 5 THEN
            v_title := '⚡ Treinamento em 5 minutos';
            v_message := '"' || v_training.title || '" está prestes a começar!';
          WHEN 1 THEN
            v_title := '🔔 Treinamento em 1 minuto!';
            v_message := '"' || v_training.title || '" vai começar agora!';
          WHEN 0 THEN
            v_title := '🚀 Treinamento começando!';
            v_message := '"' || v_training.title || '" está começando agora!';
          WHEN -15 THEN
            v_title := '📺 Treinamento em andamento';
            v_message := '"' || v_training.title || '" já está acontecendo. Entre agora!';
        END CASE;

        FOR v_user IN
          SELECT DISTINCT p.user_id, ur.role
          FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.user_id
          WHERE (
            array_length(v_training.allowed_roles, 1) IS NULL
            OR ur.role::text = ANY(v_training.allowed_roles)
          )
        LOOP
          -- Inserir apenas se não existe notificação duplicada
          INSERT INTO system_notifications (
            recipient_id, recipient_role, notification_type, title, message, priority, metadata
          )
          SELECT
            v_user.user_id,
            v_user.role,
            'training_reminder',
            v_title,
            v_message,
            CASE WHEN v_target <= 5 THEN 'high' ELSE 'medium' END,
            jsonb_build_object(
              'training_id', v_training.id,
              'training_title', v_training.title,
              'reminder_key', v_notif_key,
              'minutes_before', v_target
            )
          WHERE NOT EXISTS (
            SELECT 1 FROM system_notifications sn
            WHERE sn.recipient_id = v_user.user_id
              AND sn.notification_type = 'training_reminder'
              AND sn.metadata->>'reminder_key' = v_notif_key
          );
        END LOOP;
      END;
    END LOOP;
  END LOOP;
END;
$$;
