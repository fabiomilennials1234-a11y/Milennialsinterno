-- RESET: Limpar todos os dados do sistema (manter estrutura e usuários)
-- Executado em 2026-03-02

-- 1. Tabelas filhas que referenciam clients
TRUNCATE TABLE client_daily_tracking CASCADE;
TRUNCATE TABLE client_onboarding CASCADE;
TRUNCATE TABLE client_notes CASCADE;
TRUNCATE TABLE client_invoices CASCADE;
TRUNCATE TABLE client_sales CASCADE;
TRUNCATE TABLE client_call_forms CASCADE;
TRUNCATE TABLE client_strategies CASCADE;
TRUNCATE TABLE client_product_values CASCADE;
TRUNCATE TABLE client_product_churns CASCADE;

-- 2. Tarefas de onboarding
TRUNCATE TABLE onboarding_tasks CASCADE;

-- 3. Outbound
TRUNCATE TABLE outbound_tasks CASCADE;
TRUNCATE TABLE outbound_meetings CASCADE;
TRUNCATE TABLE outbound_daily_documentation CASCADE;
TRUNCATE TABLE outbound_justifications CASCADE;
TRUNCATE TABLE outbound_task_comments CASCADE;

-- 4. ADS Manager
TRUNCATE TABLE ads_tasks CASCADE;
TRUNCATE TABLE ads_meetings CASCADE;
TRUNCATE TABLE ads_daily_documentation CASCADE;
TRUNCATE TABLE ads_justifications CASCADE;
TRUNCATE TABLE ads_task_comments CASCADE;
TRUNCATE TABLE ads_task_delay_justifications CASCADE;
TRUNCATE TABLE ads_task_delay_notifications CASCADE;
TRUNCATE TABLE ads_new_client_notifications CASCADE;

-- 5. Kanban cards
TRUNCATE TABLE card_comments CASCADE;
TRUNCATE TABLE card_activities CASCADE;
TRUNCATE TABLE card_attachments CASCADE;
TRUNCATE TABLE kanban_cards CASCADE;

-- 6. Comercial
TRUNCATE TABLE comercial_tasks CASCADE;
TRUNCATE TABLE comercial_client_documentation CASCADE;
TRUNCATE TABLE comercial_tracking CASCADE;
TRUNCATE TABLE comercial_delay_notifications CASCADE;
TRUNCATE TABLE comercial_delay_justifications CASCADE;

-- 7. CS
TRUNCATE TABLE cs_action_plan_tasks CASCADE;
TRUNCATE TABLE cs_action_plans CASCADE;
TRUNCATE TABLE cs_contact_history CASCADE;
TRUNCATE TABLE cs_exit_reasons CASCADE;

-- 8. Notificações
TRUNCATE TABLE churn_notifications CASCADE;
TRUNCATE TABLE churn_notification_dismissals CASCADE;
TRUNCATE TABLE task_delay_justifications CASCADE;
TRUNCATE TABLE task_delay_notifications CASCADE;

-- 9. NPS
TRUNCATE TABLE nps_responses CASCADE;
TRUNCATE TABLE nps_surveys CASCADE;

-- 10. Commissions
TRUNCATE TABLE commission_records CASCADE;
TRUNCATE TABLE upsell_commissions CASCADE;
TRUNCATE TABLE upsells CASCADE;

-- 11. Clients (por último)
TRUNCATE TABLE clients CASCADE;
