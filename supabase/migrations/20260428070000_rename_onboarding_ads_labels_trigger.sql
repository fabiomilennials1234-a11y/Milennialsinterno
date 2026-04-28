-- Rename onboarding ADS labels in create_ads_task_for_onboarding_task trigger.
-- Frontend labels renamed in TS (AdsOnboardingSection, AdsTarefasSection, useOnboardingAutomation).
-- This migration aligns the parallel DB-trigger fluxo (task_type=certificar_consultoria,
-- without _realizada) so the title surfaced in ads_tasks matches the new copy.
--
-- Idempotent via pg_proc surgery — skip if already patched.

DO $migration$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname = 'create_ads_task_for_onboarding_task' LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'create_ads_task_for_onboarding_task not found';
  END IF;

  IF v_def ILIKE '%Confirmar se toda a produção está pronta%' THEN
    RAISE NOTICE 'create_ads_task_for_onboarding_task already patched, skipping';
    RETURN;
  END IF;

  v_new := v_def;
  v_new := replace(v_new,
    E'''Certificar se a consultoria do(a) '' || COALESCE(v_name, ''Cliente'') || '' já foi realizada''',
    E'''Confirmar se toda a produção está pronta '' || COALESCE(v_name, ''Cliente'')');
  v_new := replace(v_new,
    'Ao concluir, o cliente será movido para Esperando Criativos',
    'Ao concluir, o cliente será movido para Publicar campanha');

  EXECUTE v_new;
END
$migration$;
