-- Paddock flow reduced from 5-task to 4-task: CONFIRMAR_TREINAMENTOS removed.
-- Clients stuck at data_treinamentos_enviada with no pending task must transition
-- to em_acompanhamento. Also archive any orphaned confirmar_treinamentos tasks.

-- 1. Transition clients at the removed step to acompanhamento
UPDATE clients
SET comercial_status = 'em_acompanhamento',
    paddock_onboarding_step = NULL
WHERE paddock_onboarding_step = 'data_treinamentos_enviada'
  AND comercial_status = 'onboarding_paddock';

-- 2. Archive any leftover confirmar_treinamentos tasks
UPDATE comercial_tasks
SET archived = true,
    archived_at = now()
WHERE auto_task_type = 'confirmar_treinamentos'
  AND status != 'done'
  AND (archived IS NULL OR archived = false);
