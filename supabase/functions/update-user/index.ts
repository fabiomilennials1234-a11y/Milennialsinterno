import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'
import { buildCorsHeaders } from '../_shared/cors.ts'

interface UpdateUserRequest {
  userId: string
  email?: string
  password?: string
  name?: string
  role?: string
  department?: string
  avatar?: string
  group_id?: string | null
  squad_id?: string | null
  category_id?: string | null
  is_coringa?: boolean
  additional_pages?: string[]
  can_access_mtech?: boolean
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

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
        JSON.stringify({ error: 'Apenas o CEO pode editar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const body: UpdateUserRequest = await req.json()
    const { userId, email, password, name, role, department, avatar, group_id, squad_id, category_id, is_coringa, additional_pages, can_access_mtech } = body
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch current state for kanban board sync + page grants reconcile.
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, squad_id, additional_pages, can_access_mtech')
      .eq('user_id', userId)
      .single()
    const { data: currentRoleRow } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()
    const currentRole = currentRoleRow?.role ?? null
    const currentSquadId = currentProfile?.squad_id ?? null
    const currentAdditionalPages = currentProfile?.additional_pages ?? []
    const currentCanAccessMtech = currentProfile?.can_access_mtech ?? false
    
    // Update auth user if email or password changed
    if (email || password) {
      const updateData: { email?: string; password?: string } = {}
      if (email) updateData.email = email
      if (password) updateData.password = password
      
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      )
      
      if (authUpdateError) {
        console.error('Error updating auth user:', authUpdateError)
        return new Response(
          JSON.stringify({ error: authUpdateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // Update profile
    const profileUpdates: Record<string, unknown> = {}
    if (name) profileUpdates.name = name
    if (email) profileUpdates.email = email
    if (department !== undefined) profileUpdates.department = department
    if (avatar !== undefined) profileUpdates.avatar = avatar
    if (group_id !== undefined) profileUpdates.group_id = group_id
    if (squad_id !== undefined) profileUpdates.squad_id = squad_id
    if (category_id !== undefined) profileUpdates.category_id = category_id
    if (is_coringa !== undefined) profileUpdates.is_coringa = is_coringa
    if (additional_pages !== undefined) profileUpdates.additional_pages = additional_pages
    if (can_access_mtech !== undefined) profileUpdates.can_access_mtech = can_access_mtech

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', userId)
      
      if (profileError) {
        console.error('Error updating profile:', profileError)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar perfil' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // Update role if changed
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId)
      
      if (roleError) {
        console.error('Error updating role:', roleError)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar cargo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Sync kanban board for gestor_ads (sidebar)
    const finalRole = role ?? currentRole
    const finalSquadId = squad_id !== undefined ? squad_id : currentSquadId
    const finalName = name ?? currentProfile?.name ?? 'Gestor'

    const { data: existingBoard } = await supabaseAdmin
      .from('kanban_boards')
      .select('id')
      .eq('owner_user_id', userId)
      .single()

    if (finalRole === 'gestor_ads') {
      if (existingBoard) {
        const { error: updateBoardError } = await supabaseAdmin
          .from('kanban_boards')
          .update({ squad_id: finalSquadId })
          .eq('owner_user_id', userId)
        if (updateBoardError) {
          console.error('Error updating ads manager board:', updateBoardError)
        }
      } else if (finalSquadId) {
        const { error: insertBoardError } = await supabaseAdmin
          .from('kanban_boards')
          .insert({
            name: `Gestor de ADS (${finalName})`,
            slug: `ads-${userId}`,
            description: `Kanban individual do Gestor de ADS ${finalName}`,
            owner_user_id: userId,
            squad_id: finalSquadId,
          })
        if (insertBoardError) {
          console.error('Error creating ads manager board:', insertBoardError)
        }
      }
    } else if (currentRole === 'gestor_ads' && existingBoard) {
      const { error: clearBoardError } = await supabaseAdmin
        .from('kanban_boards')
        .update({ squad_id: null })
        .eq('owner_user_id', userId)
      if (clearBoardError) {
        console.error('Error clearing ads manager board squad:', clearBoardError)
      }
    }

    // Sync user_page_grants para refletir role final + additional_pages + mtech.
    // Substitui o dual-write client-side que ficava atras do FEATURE_FLAGS.USE_PAGE_GRANTS.
    // RPC e atomica e idempotente: grants role_default e direct sao reconciliados
    // (revoga slugs removidos no modal de edicao). Caller_id e o CEO autenticado.
    const finalAdditionalPages = additional_pages !== undefined ? additional_pages : currentAdditionalPages
    const finalCanAccessMtech = can_access_mtech !== undefined ? can_access_mtech : currentCanAccessMtech
    if (finalRole) {
      const { error: reconcileError } = await supabaseAdmin.rpc('admin_reconcile_user_page_grants', {
        _caller_id: requestingUser.id,
        _user_id: userId,
        _role: finalRole,
        _additional_pages: finalAdditionalPages ?? [],
        _can_access_mtech: finalCanAccessMtech === true,
        _reason: 'updated via update-user edge',
      })
      if (reconcileError) {
        console.error('Error reconciling page grants:', reconcileError)
        return new Response(
          JSON.stringify({ error: 'Falha ao sincronizar paginas: ' + reconcileError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
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
