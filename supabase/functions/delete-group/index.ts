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
    
    // Only CEO can delete groups
    const { data: isCeo } = await supabaseAdmin.rpc('is_ceo', { _user_id: requestingUser.id })
    if (!isCeo) {
      return new Response(
        JSON.stringify({ error: 'Apenas o CEO pode remover grupos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { groupId, deleteUsers } = await req.json()
    
    if (!groupId) {
      return new Response(
        JSON.stringify({ error: 'ID do grupo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get all users in this group (excluding CEO)
    const { data: groupProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('group_id', groupId)
    
    if (profilesError) {
      console.error('Error fetching group profiles:', profilesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuários do grupo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Delete all users in the group if requested
    if (deleteUsers && groupProfiles && groupProfiles.length > 0) {
      for (const profile of groupProfiles) {
        // Skip CEO
        const { data: userIsCeo } = await supabaseAdmin.rpc('is_ceo', { _user_id: profile.user_id })
        if (userIsCeo) continue
        
        // Delete user from auth
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id)
        if (deleteUserError) {
          console.error('Error deleting user:', profile.user_id, deleteUserError)
        }
      }
    }
    
    // Delete the group (CASCADE will handle squads and role_limits)
    const { error: deleteError } = await supabaseAdmin
      .from('organization_groups')
      .delete()
      .eq('id', groupId)
    
    if (deleteError) {
      console.error('Error deleting group:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ success: true, deletedUsers: deleteUsers ? groupProfiles?.length || 0 : 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
