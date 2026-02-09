import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results = {
      expiring_contracts: false,
      contract_renewals: false,
      action_plan_deadlines: false,
      stalled_cards: false,
      clients_without_contact: false,
      okr_deadlines: false,
      training_notifications: false,
      pending_ads_documentation: false,
      pending_comercial_documentation: false,
      no_clients_moved: false,
      stalled_onboarding: false,
      pending_approvals: false,
      creative_awaiting_approval: false,
      overdue_deliveries: false,
    }

    // 1. Check expiring contracts (30/15/7/3/1/0 days)
    try {
      await supabase.rpc('check_expiring_contracts')
      results.expiring_contracts = true
    } catch (e) {
      console.error('Error checking expiring contracts:', e)
    }

    // 2. Check contract renewals (60/30 days)
    try {
      await supabase.rpc('check_contract_renewals')
      results.contract_renewals = true
    } catch (e) {
      console.error('Error checking contract renewals:', e)
    }

    // 3. Check action plan deadlines (3/1/0 days)
    try {
      await supabase.rpc('check_action_plan_deadlines')
      results.action_plan_deadlines = true
    } catch (e) {
      console.error('Error checking action plan deadlines:', e)
    }

    // 4. Check stalled cards (3+ days without movement)
    try {
      await supabase.rpc('check_stalled_cards')
      results.stalled_cards = true
    } catch (e) {
      console.error('Error checking stalled cards:', e)
    }

    // 5. Check clients without contact (7+ days)
    try {
      await supabase.rpc('check_clients_without_contact')
      results.clients_without_contact = true
    } catch (e) {
      console.error('Error checking clients without contact:', e)
    }

    // 6. Check OKR deadlines (3 days)
    try {
      await supabase.rpc('check_okr_deadlines')
      results.okr_deadlines = true
    } catch (e) {
      console.error('Error checking OKR deadlines:', e)
    }

    // 7. Check training notifications (1 hour before)
    try {
      await supabase.rpc('check_training_notifications')
      results.training_notifications = true
    } catch (e) {
      console.error('Error checking training notifications:', e)
    }

    // 8. Check pending Ads documentation (after 15h BRT)
    try {
      await supabase.rpc('check_pending_ads_documentation')
      results.pending_ads_documentation = true
    } catch (e) {
      console.error('Error checking pending ads documentation:', e)
    }

    // 9. Check pending Comercial documentation (after 15h BRT)
    try {
      await supabase.rpc('check_pending_comercial_documentation')
      results.pending_comercial_documentation = true
    } catch (e) {
      console.error('Error checking pending comercial documentation:', e)
    }

    // 10. Check if no clients were moved today (after 17h BRT)
    try {
      await supabase.rpc('check_no_clients_moved_today')
      results.no_clients_moved = true
    } catch (e) {
      console.error('Error checking no clients moved:', e)
    }

    // 11. Check stalled onboarding (3+ days stuck)
    try {
      await supabase.rpc('check_stalled_onboarding')
      results.stalled_onboarding = true
    } catch (e) {
      console.error('Error checking stalled onboarding:', e)
    }

    // 12. Check pending approvals (2+ days)
    try {
      await supabase.rpc('check_pending_approvals')
      results.pending_approvals = true
    } catch (e) {
      console.error('Error checking pending approvals:', e)
    }

    // 13. Check creative awaiting approval (4+ hours)
    try {
      await supabase.rpc('check_creative_awaiting_approval')
      results.creative_awaiting_approval = true
    } catch (e) {
      console.error('Error checking creative awaiting approval:', e)
    }

    // 14. Check overdue deliveries
    try {
      await supabase.rpc('check_overdue_deliveries')
      results.overdue_deliveries = true
    } catch (e) {
      console.error('Error checking overdue deliveries:', e)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Scheduled notifications checked',
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in check-scheduled-notifications:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})