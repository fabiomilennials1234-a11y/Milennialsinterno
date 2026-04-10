import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: isCeo } = await supabaseAdmin.rpc('is_ceo', { _user_id: requestingUser.id })
    if (!isCeo) {
      return new Response(
        JSON.stringify({ error: 'Apenas o CEO pode remover usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if trying to delete CEO
    const { data: targetIsCeo } = await supabaseAdmin.rpc('is_ceo', { _user_id: userId })
    if (targetIsCeo) {
      return new Response(
        JSON.stringify({ error: 'Não é possível remover o CEO' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Dynamically fix ALL foreign keys referencing auth.users that lack ON DELETE behavior,
    // then delete the user. This runs as a single SQL transaction via service role.
    const { error: cleanupError } = await supabaseAdmin.rpc('force_delete_user_cleanup', { target_user_id: userId })
    if (cleanupError) {
      console.error('Cleanup RPC error:', cleanupError)
      // Fallback: try direct table cleanup
      const tables_nullable = [
        { table: 'kanban_boards', col: 'created_by' },
        { table: 'kanban_boards', col: 'owner_user_id' },
        { table: 'kanban_cards', col: 'assigned_to' },
        { table: 'kanban_cards', col: 'created_by' },
        { table: 'cs_insights', col: 'created_by' },
        { table: 'cs_insights', col: 'assigned_to' },
        { table: 'cs_action_manuals', col: 'created_by' },
        { table: 'clients', col: 'assigned_outbound_manager' },
        { table: 'clients', col: 'cx_validated_by' },
        { table: 'clients', col: 'assigned_ads_manager' },
        { table: 'clients', col: 'created_by' },
        { table: 'clients', col: 'assigned_crm' },
        { table: 'clients', col: 'assigned_rh' },
        { table: 'strategy_funnel_templates', col: 'created_by' },
        { table: 'meeting_folders', col: 'created_by' },
        { table: 'recorded_meetings', col: 'created_by' },
        { table: 'design_demands', col: 'assigned_to' },
        { table: 'design_demands', col: 'created_by' },
        { table: 'comercial_tasks', col: 'assigned_to' },
        { table: 'comercial_tasks', col: 'created_by' },
        { table: 'okrs', col: 'assigned_to' },
        { table: 'upsells', col: 'sold_by' },
        { table: 'ads_tasks', col: 'assigned_to' },
        { table: 'ads_tasks', col: 'created_by' },
        { table: 'ads_daily_documentation', col: 'ads_manager_id' },
        { table: 'strategy_requests', col: 'created_by' },
        { table: 'strategy_requests', col: 'assigned_to' },
        { table: 'client_strategies', col: 'created_by' },
        { table: 'produtora_briefings', col: 'created_by' },
        { table: 'video_briefings', col: 'created_by' },
        { table: 'dev_briefings', col: 'created_by' },
        { table: 'atrizes_briefings', col: 'created_by' },
        { table: 'design_briefings', col: 'created_by' },
        { table: 'financeiro_kanban_tasks', col: 'created_by' },
        { table: 'mrr_changes', col: 'changed_by' },
      ]

      for (const { table, col } of tables_nullable) {
        try {
          await supabaseAdmin.from(table).update({ [col]: null } as any).eq(col, userId)
        } catch (e) {
          console.log(`Skipped ${table}.${col}:`, e)
        }
      }

      const tables_delete = [
        { table: 'card_comments', col: 'user_id' },
        { table: 'card_activities', col: 'user_id' },
        { table: 'cs_contact_history', col: 'user_id' },
        { table: 'department_tasks', col: 'user_id' },
        { table: 'system_notifications', col: 'user_id' },
        { table: 'churn_notification_dismissals', col: 'user_id' },
        { table: 'meetings_one_on_one', col: 'user_id' },
        { table: 'weekly_problems', col: 'user_id' },
        { table: 'weekly_summaries', col: 'user_id' },
        { table: 'upsell_commissions', col: 'user_id' },
        { table: 'commission_records', col: 'user_id' },
        { table: 'ads_justifications', col: 'ads_manager_id' },
        { table: 'ads_task_comments', col: 'user_id' },
        { table: 'ads_note_notifications', col: 'user_id' },
        { table: 'comercial_daily_documentation', col: 'user_id' },
        { table: 'comercial_tracking', col: 'user_id' },
        { table: 'rh_atividades', col: 'user_id' },
        { table: 'rh_comentarios', col: 'user_id' },
        { table: 'rh_justificativas', col: 'user_id' },
        { table: 'rh_tarefas', col: 'user_id' },
        { table: 'onboarding_tasks', col: 'assigned_to' },
        { table: 'onboarding_checklists', col: 'user_id' },
        { table: 'task_delay_justifications', col: 'user_id' },
        { table: 'task_delay_notifications', col: 'user_id' },
        { table: 'trainings', col: 'created_by' },
        { table: 'nps_surveys', col: 'created_by' },
      ]

      for (const { table, col } of tables_delete) {
        try {
          await supabaseAdmin.from(table).delete().eq(col, userId)
        } catch (e) {
          console.log(`Skipped delete ${table}.${col}:`, e)
        }
      }
    }

    // Delete user (cascade will handle profiles and roles)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(
        JSON.stringify({ error: `Falha ao deletar: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message || 'desconhecido'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
