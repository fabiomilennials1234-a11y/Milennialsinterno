-- 20260422150000_delay_notification_cleanup_trigger.sql
--
-- Auto-limpa task_delay_notifications quando a task de origem
-- eh arquivada ou marcada como done. Fecha race: cliente cria
-- notification, task eh arquivada/concluida em outra sessao,
-- notification fica orfa. Sem esse trigger, orfas acumulam em prod
-- (observado: 347 rows apontando para onboarding_tasks archived=true).
--
-- Cobre as 5 tabelas source usadas por src/hooks/useTaskDelayNotifications.ts:
--   onboarding_tasks, ads_tasks, comercial_tasks, department_tasks, kanban_cards
--
-- task_delay_notifications.task_id eh uuid. id de cada tabela source tambem
-- eh uuid, logo nao ha cast. task_table eh passado via TG_ARGV[0] no
-- CREATE TRIGGER para manter uma unica funcao reutilizavel.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_delay_notifications_on_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text := TG_ARGV[0];
BEGIN
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'delete_delay_notifications_on_archive: missing TG_ARGV[0] (task_table)';
  END IF;

  -- Arquivamento: OLD nao-arquivada -> NEW arquivada
  IF NEW.archived = true AND (OLD.archived IS DISTINCT FROM true) THEN
    DELETE FROM public.task_delay_notifications
    WHERE task_id = NEW.id
      AND task_table = v_table;
    RETURN NEW;
  END IF;

  -- Conclusao: OLD nao-done -> NEW done
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    DELETE FROM public.task_delay_notifications
    WHERE task_id = NEW.id
      AND task_table = v_table;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.delete_delay_notifications_on_archive() IS
  'Trigger fn: apaga task_delay_notifications orfas quando task source e arquivada ou marcada done. task_table via TG_ARGV[0].';

-- onboarding_tasks
DROP TRIGGER IF EXISTS trg_onboarding_tasks_cleanup_delay ON public.onboarding_tasks;
CREATE TRIGGER trg_onboarding_tasks_cleanup_delay
  AFTER UPDATE OF archived, status ON public.onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_delay_notifications_on_archive('onboarding_tasks');

-- ads_tasks
DROP TRIGGER IF EXISTS trg_ads_tasks_cleanup_delay ON public.ads_tasks;
CREATE TRIGGER trg_ads_tasks_cleanup_delay
  AFTER UPDATE OF archived, status ON public.ads_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_delay_notifications_on_archive('ads_tasks');

-- department_tasks
DROP TRIGGER IF EXISTS trg_department_tasks_cleanup_delay ON public.department_tasks;
CREATE TRIGGER trg_department_tasks_cleanup_delay
  AFTER UPDATE OF archived, status ON public.department_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_delay_notifications_on_archive('department_tasks');

-- comercial_tasks
DROP TRIGGER IF EXISTS trg_comercial_tasks_cleanup_delay ON public.comercial_tasks;
CREATE TRIGGER trg_comercial_tasks_cleanup_delay
  AFTER UPDATE OF archived, status ON public.comercial_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_delay_notifications_on_archive('comercial_tasks');

-- kanban_cards
DROP TRIGGER IF EXISTS trg_kanban_cards_cleanup_delay ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_cleanup_delay
  AFTER UPDATE OF archived, status ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_delay_notifications_on_archive('kanban_cards');

COMMIT;
