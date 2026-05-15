-- Paddock state machine: consolidate 11 steps into 4 steps.
-- Old steps: alinhamento_inicial_marcado, alinhamento_inicial_realizado, war1_marcada,
--            diagnostico_crm_criado, diagnostico_crm_enviado, tarefa_gestor_crm_gerada,
--            crm_solicitado, war2_marcada, gerar_novo_diagnostico, marcar_war3, war3_marcada
-- New steps: diagnostico_marcado, diagnostico_apresentado, diagnostico_enviado, data_treinamentos_enviada

-- 1. Migrate client paddock_onboarding_step values
UPDATE clients SET paddock_onboarding_step = 'diagnostico_marcado'
WHERE paddock_onboarding_step IN ('alinhamento_inicial_marcado');

UPDATE clients SET paddock_onboarding_step = 'diagnostico_apresentado'
WHERE paddock_onboarding_step IN ('alinhamento_inicial_realizado');

UPDATE clients SET paddock_onboarding_step = 'diagnostico_enviado'
WHERE paddock_onboarding_step IN ('war1_marcada', 'diagnostico_crm_criado', 'diagnostico_crm_enviado');

UPDATE clients SET paddock_onboarding_step = 'data_treinamentos_enviada'
WHERE paddock_onboarding_step IN (
  'tarefa_gestor_crm_gerada', 'crm_solicitado', 'war2_marcada',
  'gerar_novo_diagnostico', 'marcar_war3', 'war3_marcada'
);

-- 2. Archive pending tasks with old auto_task_type values that no longer exist
UPDATE comercial_tasks
SET archived = true, archived_at = now()
WHERE status IN ('todo', 'doing')
  AND auto_task_type IN (
    'realizar_alinhamento_inicial',
    'marcar_war1',
    'realizar_war1',
    'gerar_tarefa_crm',
    'marcar_war2',
    'conscientizar_crm',
    'realizar_war2',
    'gerar_novo_diagnostico',
    'marcar_war3',
    'realizar_war3'
  );
