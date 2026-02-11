import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: string
  avatar?: string
  group_id?: string
  squad_id?: string
  category_id?: string
  is_coringa?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Verify the requesting user is CEO
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Extract JWT and validate - getUser(jwt) works more reliably than global headers in Edge Functions
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if requesting user is CEO
    const { data: isCeo } = await supabaseAdmin.rpc('is_ceo', { _user_id: requestingUser.id })
    if (!isCeo) {
      return new Response(
        JSON.stringify({ error: 'Apenas o CEO pode criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse request body
    const body: CreateUserRequest = await req.json()
    const { email, password, name, role, avatar, group_id, squad_id, category_id, is_coringa } = body
    
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, senha, nome e cargo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create user in auth.users using admin client
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    })
    
    if (createError) {
      console.error('Error creating auth user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = authData.user.id

    // Upsert profile (trigger on auth.users may have already created one)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          name,
          email,
          avatar: avatar || null,
          group_id: group_id || null,
          squad_id: squad_id || null,
          category_id: category_id || null,
          is_coringa: is_coringa || false
        },
        { onConflict: 'user_id' }
      )

    if (profileError) {
      console.error('Error creating profile:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Replace default role from trigger (if any) with the requested role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role
      })

    if (roleError) {
      console.error('Error assigning role:', roleError)
      await supabaseAdmin.from('profiles').delete().eq('user_id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Erro ao atribuir cargo ao usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          name,
          role,
          avatar,
          group_id,
          squad_id,
          category_id,
          is_coringa
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
