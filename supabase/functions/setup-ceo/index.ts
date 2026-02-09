import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'
import { corsHeaders } from '../_shared/cors.ts'

// This function creates the initial CEO user - should only be called once
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
    
    // Check if CEO already exists
    const { data: existingCeo } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('role', 'ceo')
      .maybeSingle()
    
    if (existingCeo) {
      return new Response(
        JSON.stringify({ error: 'CEO já existe no sistema' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create CEO user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'ceo@millennialsb2b.com',
      password: 'ceo123456',
      email_confirm: true,
      user_metadata: { name: 'CEO', role: 'ceo' }
    })
    
    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = authData.user.id
    
    // Create profile
    await supabaseAdmin.from('profiles').insert({
      user_id: userId,
      name: 'Ricardo Oliveira',
      email: 'ceo@millennialsb2b.com',
      department: 'Diretoria'
    })
    
    // Assign CEO role
    await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'ceo'
    })
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'CEO criado com sucesso!',
        credentials: {
          email: 'ceo@millennialsb2b.com',
          password: 'ceo123456'
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
