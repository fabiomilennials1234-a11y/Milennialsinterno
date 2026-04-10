-- Função que limpa todas as referências a um usuário antes da deleção
CREATE OR REPLACE FUNCTION public.cleanup_user_references(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nullable FK columns → SET NULL
  UPDATE public.kanban_boards SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.kanban_boards SET owner_user_id = NULL WHERE owner_user_id = target_user_id;
  UPDATE public.kanban_cards SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.kanban_cards SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.cs_insights SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.cs_insights SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.cs_action_manuals SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.clients SET assigned_outbound_manager = NULL WHERE assigned_outbound_manager = target_user_id;
  UPDATE public.clients SET cx_validated_by = NULL WHERE cx_validated_by = target_user_id;
  UPDATE public.strategy_funnel_templates SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.meeting_folders SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.recorded_meetings SET created_by = NULL WHERE created_by = target_user_id;

  -- NOT NULL FK columns referencing auth.users → DELETE records
  DELETE FROM public.card_comments WHERE user_id = target_user_id;
  DELETE FROM public.card_activities WHERE user_id = target_user_id;
  DELETE FROM public.cs_contact_history WHERE user_id = target_user_id;
  DELETE FROM public.department_tasks WHERE user_id = target_user_id;
  DELETE FROM public.training_lessons WHERE training_id IN (SELECT id FROM public.trainings WHERE created_by = target_user_id);
  DELETE FROM public.trainings WHERE created_by = target_user_id;

  -- System notifications
  DELETE FROM public.system_notifications WHERE user_id = target_user_id;
  DELETE FROM public.system_notifications WHERE created_by = target_user_id;

  -- Churn notification dismissals
  DELETE FROM public.churn_notification_dismissals WHERE user_id = target_user_id;

  -- NPS
  DELETE FROM public.nps_surveys WHERE created_by = target_user_id;

  -- Meetings one on one
  DELETE FROM public.meetings_one_on_one WHERE user_id = target_user_id;

  -- Weekly problems/summaries
  DELETE FROM public.weekly_problems WHERE user_id = target_user_id;
  DELETE FROM public.weekly_summaries WHERE user_id = target_user_id;

  -- OKRs
  UPDATE public.okrs SET assigned_to = NULL WHERE assigned_to = target_user_id;

  -- Upsells
  UPDATE public.upsells SET sold_by = NULL WHERE sold_by = target_user_id;
  DELETE FROM public.upsell_commissions WHERE user_id = target_user_id;

  -- Commission records
  DELETE FROM public.commission_records WHERE user_id = target_user_id;

  -- Ads related
  UPDATE public.ads_daily_documentation SET ads_manager_id = NULL WHERE ads_manager_id = target_user_id;
  DELETE FROM public.ads_justifications WHERE ads_manager_id = target_user_id;
  UPDATE public.ads_tasks SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.ads_tasks SET created_by = NULL WHERE created_by = target_user_id;
  DELETE FROM public.ads_task_comments WHERE user_id = target_user_id;
  DELETE FROM public.ads_note_notifications WHERE user_id = target_user_id;

  -- Design related
  UPDATE public.design_demands SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.design_demands SET created_by = NULL WHERE created_by = target_user_id;

  -- Comercial
  UPDATE public.comercial_tasks SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.comercial_tasks SET created_by = NULL WHERE created_by = target_user_id;
  DELETE FROM public.comercial_daily_documentation WHERE user_id = target_user_id;
  DELETE FROM public.comercial_tracking WHERE user_id = target_user_id;

  -- Clients
  UPDATE public.clients SET assigned_ads_manager = NULL WHERE assigned_ads_manager = target_user_id;
  UPDATE public.clients SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.clients SET assigned_crm = NULL WHERE assigned_crm = target_user_id;
  UPDATE public.clients SET assigned_rh = NULL WHERE assigned_rh = target_user_id;

  -- RH
  DELETE FROM public.rh_atividades WHERE user_id = target_user_id;
  DELETE FROM public.rh_comentarios WHERE user_id = target_user_id;
  DELETE FROM public.rh_justificativas WHERE user_id = target_user_id;
  DELETE FROM public.rh_tarefas WHERE user_id = target_user_id;

  -- Financeiro kanban tasks
  UPDATE public.financeiro_kanban_tasks SET created_by = NULL WHERE created_by = target_user_id;

  -- MRR changes
  UPDATE public.mrr_changes SET changed_by = NULL WHERE changed_by = target_user_id;

  -- Onboarding
  DELETE FROM public.onboarding_tasks WHERE assigned_to = target_user_id;
  DELETE FROM public.onboarding_checklists WHERE user_id = target_user_id;

  -- Strategy requests
  UPDATE public.strategy_requests SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.strategy_requests SET assigned_to = NULL WHERE assigned_to = target_user_id;

  -- Client strategies
  UPDATE public.client_strategies SET created_by = NULL WHERE created_by = target_user_id;

  -- Produtora/Video/Dev briefings
  UPDATE public.produtora_briefings SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.video_briefings SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.dev_briefings SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.atrizes_briefings SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.design_briefings SET created_by = NULL WHERE created_by = target_user_id;

  -- Task delay justifications/notifications (various departments)
  DELETE FROM public.task_delay_justifications WHERE user_id = target_user_id;
  DELETE FROM public.task_delay_notifications WHERE user_id = target_user_id;
END;
$$;
