import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

// ============================================================
// Constants
// ============================================================

const PRODUCT_NAMES: Record<string, string> = {
  'millennials-growth': 'Millennials Growth',
  'millennials-outbound': 'Millennials Outbound',
  'millennials-paddock': 'Millennials Paddock',
  'torque-crm': 'Torque CRM',
  'millennials-hunting': 'Millennials Hunting',
}

const VALID_PRODUCT_SLUGS = Object.keys(PRODUCT_NAMES)

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ============================================================
// Helper: JSON response
// ============================================================

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// ============================================================
// Helper: Hash API key with SHA-256 (Web Crypto API)
// ============================================================

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// Helper: Sanitize request body for logging (mask CPF)
// ============================================================

function sanitizeForLog(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body }
  if (sanitized.cpf) {
    sanitized.cpf = '***.***.***-**'
  }
  return sanitized
}

// ============================================================
// Auth: Validate API key
// ============================================================

interface ApiKeyResult {
  id: string
  name: string
}

async function validateApiKey(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ key: ApiKeyResult | null; error: Response | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { key: null, error: jsonResponse({ success: false, error: 'Header Authorization ausente', code: 'UNAUTHORIZED' }, 401) }
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token) {
    return { key: null, error: jsonResponse({ success: false, error: 'API key ausente', code: 'UNAUTHORIZED' }, 401) }
  }

  const keyHash = await hashApiKey(token)

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return { key: null, error: jsonResponse({ success: false, error: 'API key inválida ou expirada', code: 'UNAUTHORIZED' }, 401) }
  }

  if (!data.is_active) {
    return { key: null, error: jsonResponse({ success: false, error: 'API key desativada', code: 'UNAUTHORIZED' }, 401) }
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { key: null, error: jsonResponse({ success: false, error: 'API key expirada', code: 'UNAUTHORIZED' }, 401) }
  }

  return { key: { id: data.id, name: data.name }, error: null }
}

// ============================================================
// Rate Limiting
// ============================================================

async function checkRateLimit(
  apiKeyId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<Response | null> {
  const { count, error } = await supabaseAdmin
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())

  if (error) {
    console.error('[api-v1] Rate limit check error:', error)
    return null // Allow request on error (fail open)
  }

  if (count !== null && count >= 60) {
    return new Response(
      JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em 1 minuto.', code: 'RATE_LIMITED' }),
      { status: 429, headers: { ...JSON_HEADERS, 'Retry-After': '60' } }
    )
  }

  return null
}

// ============================================================
// Logging
// ============================================================

async function logRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  apiKeyId: string | null,
  action: string,
  method: string,
  statusCode: number,
  requestBody: Record<string, unknown> | null,
  responseBody: Record<string, unknown>,
  ipAddress: string | null
): Promise<void> {
  try {
    await supabaseAdmin.from('api_logs').insert({
      api_key_id: apiKeyId,
      action,
      method,
      status_code: statusCode,
      request_body: requestBody ? sanitizeForLog(requestBody) : null,
      response_body: responseBody,
      ip_address: ipAddress,
    })
  } catch (err) {
    console.error('[api-v1] Log error:', err)
  }
}

// ============================================================
// CNPJ Validation (format + check digits)
// ============================================================

function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/[^\d]/g, '')
  if (cleaned.length !== 14) return false
  if (/^(\d)\1+$/.test(cleaned)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned[i]) * weights1[i]
  let remainder = sum % 11
  const digit1 = remainder < 2 ? 0 : 11 - remainder

  if (parseInt(cleaned[12]) !== digit1) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(cleaned[i]) * weights2[i]
  remainder = sum % 11
  const digit2 = remainder < 2 ? 0 : 11 - remainder

  return parseInt(cleaned[13]) === digit2
}

// ============================================================
// CPF Validation (format + check digits)
// ============================================================

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]/g, '')
  if (cleaned.length !== 11) return false
  if (/^(\d)\1+$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  const digit1 = remainder === 10 ? 0 : remainder

  if (parseInt(cleaned[9]) !== digit1) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i)
  remainder = (sum * 10) % 11
  const digit2 = remainder === 10 ? 0 : remainder

  return parseInt(cleaned[10]) === digit2
}

// ============================================================
// Payload Validation for create_client
// ============================================================

interface CreateClientPayload {
  nome_cliente: string
  razao_social: string
  cnpj: string
  cpf?: string
  nicho: string
  observacoes_gestor: string
  investimento_previsto: number
  comissao_vendas_percent: number
  data_entrada: string
  duracao_contrato_meses: number
  dia_vencimento: number
  produtos_contratados?: string[]
  valores_produtos?: Record<string, number>
}

function normalizeProductSlug(slug: string): string {
  return slug.replace(/_/g, '-')
}

function validateCreateClientPayload(body: Record<string, unknown>): {
  payload: CreateClientPayload | null
  errors: Record<string, string> | null
} {
  const errors: Record<string, string> = {}

  // Required string fields
  const nome_cliente = body.nome_cliente as string | undefined
  if (!nome_cliente || typeof nome_cliente !== 'string' || nome_cliente.trim().length === 0) {
    errors.nome_cliente = 'Obrigatório'
  } else if (nome_cliente.length > 100) {
    errors.nome_cliente = 'Máximo 100 caracteres'
  }

  const razao_social = body.razao_social as string | undefined
  if (!razao_social || typeof razao_social !== 'string' || razao_social.trim().length === 0) {
    errors.razao_social = 'Obrigatório'
  } else if (razao_social.length > 255) {
    errors.razao_social = 'Máximo 255 caracteres'
  }

  const cnpj = body.cnpj as string | undefined
  if (!cnpj || typeof cnpj !== 'string') {
    errors.cnpj = 'Obrigatório'
  } else if (!validateCNPJ(cnpj)) {
    errors.cnpj = 'CNPJ inválido (formato ou dígitos verificadores)'
  }

  const cpf = body.cpf as string | undefined
  if (cpf !== undefined && cpf !== null && cpf !== '') {
    if (typeof cpf !== 'string' || !validateCPF(cpf)) {
      errors.cpf = 'CPF inválido (formato ou dígitos verificadores)'
    }
  }

  const nicho = body.nicho as string | undefined
  if (!nicho || typeof nicho !== 'string' || nicho.trim().length === 0) {
    errors.nicho = 'Obrigatório'
  } else if (nicho.length > 100) {
    errors.nicho = 'Máximo 100 caracteres'
  }

  const observacoes_gestor = body.observacoes_gestor as string | undefined
  if (!observacoes_gestor || typeof observacoes_gestor !== 'string' || observacoes_gestor.trim().length === 0) {
    errors.observacoes_gestor = 'Obrigatório'
  } else if (observacoes_gestor.length > 1000) {
    errors.observacoes_gestor = 'Máximo 1000 caracteres'
  }

  // Numeric fields
  const investimento_previsto = body.investimento_previsto as number | undefined
  if (investimento_previsto === undefined || investimento_previsto === null || typeof investimento_previsto !== 'number') {
    errors.investimento_previsto = 'Obrigatório (número positivo)'
  } else if (investimento_previsto <= 0) {
    errors.investimento_previsto = 'Deve ser maior que 0'
  }

  const comissao_vendas_percent = body.comissao_vendas_percent as number | undefined
  if (comissao_vendas_percent === undefined || comissao_vendas_percent === null || typeof comissao_vendas_percent !== 'number') {
    errors.comissao_vendas_percent = 'Obrigatório (0 a 100)'
  } else if (comissao_vendas_percent < 0 || comissao_vendas_percent > 100) {
    errors.comissao_vendas_percent = 'Deve ser entre 0 e 100'
  }

  // Date field
  const data_entrada = body.data_entrada as string | undefined
  if (!data_entrada || typeof data_entrada !== 'string') {
    errors.data_entrada = 'Obrigatório (formato YYYY-MM-DD)'
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data_entrada)) {
    errors.data_entrada = 'Formato inválido. Use YYYY-MM-DD'
  } else {
    const parsed = new Date(data_entrada + 'T00:00:00')
    if (isNaN(parsed.getTime())) {
      errors.data_entrada = 'Data inválida'
    }
  }

  // Integer fields
  const duracao_contrato_meses = body.duracao_contrato_meses as number | undefined
  if (duracao_contrato_meses === undefined || duracao_contrato_meses === null || typeof duracao_contrato_meses !== 'number') {
    errors.duracao_contrato_meses = 'Obrigatório (inteiro positivo)'
  } else if (!Number.isInteger(duracao_contrato_meses) || duracao_contrato_meses <= 0) {
    errors.duracao_contrato_meses = 'Deve ser inteiro positivo'
  }

  const dia_vencimento = body.dia_vencimento as number | undefined
  if (dia_vencimento === undefined || dia_vencimento === null || typeof dia_vencimento !== 'number') {
    errors.dia_vencimento = 'Obrigatório (1 a 31)'
  } else if (!Number.isInteger(dia_vencimento) || dia_vencimento < 1 || dia_vencimento > 31) {
    errors.dia_vencimento = 'Deve ser inteiro entre 1 e 31'
  }

  // Products (optional)
  let normalizedProducts: string[] | undefined
  let normalizedValues: Record<string, number> | undefined
  const produtos_contratados = body.produtos_contratados as string[] | undefined

  if (produtos_contratados !== undefined && produtos_contratados !== null) {
    if (!Array.isArray(produtos_contratados)) {
      errors.produtos_contratados = 'Deve ser um array de strings'
    } else {
      normalizedProducts = produtos_contratados.map(normalizeProductSlug)
      for (const slug of normalizedProducts) {
        if (!VALID_PRODUCT_SLUGS.includes(slug)) {
          errors.produtos_contratados = `Produto inválido: "${slug}". Válidos: ${VALID_PRODUCT_SLUGS.join(', ')}`
          break
        }
      }

      // If products are present, valores_produtos is required
      if (normalizedProducts.length > 0) {
        const valores_produtos = body.valores_produtos as Record<string, number> | undefined
        if (!valores_produtos || typeof valores_produtos !== 'object') {
          errors.valores_produtos = 'Obrigatório quando produtos_contratados está presente'
        } else {
          normalizedValues = {}
          for (const slug of normalizedProducts) {
            const originalSlug = Object.keys(valores_produtos).find(
              k => normalizeProductSlug(k) === slug
            )
            const value = originalSlug ? valores_produtos[originalSlug] : undefined
            if (value === undefined || value === null || typeof value !== 'number' || value <= 0) {
              errors.valores_produtos = `Valor do produto "${slug}" deve ser um número maior que 0`
              break
            }
            normalizedValues[slug] = value
          }
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { payload: null, errors }
  }

  return {
    payload: {
      nome_cliente: (nome_cliente as string).trim(),
      razao_social: (razao_social as string).trim(),
      cnpj: cnpj as string,
      cpf: cpf || undefined,
      nicho: (nicho as string).trim(),
      observacoes_gestor: (observacoes_gestor as string).trim(),
      investimento_previsto: investimento_previsto as number,
      comissao_vendas_percent: comissao_vendas_percent as number,
      data_entrada: data_entrada as string,
      duracao_contrato_meses: duracao_contrato_meses as number,
      dia_vencimento: dia_vencimento as number,
      produtos_contratados: normalizedProducts,
      valores_produtos: normalizedValues,
    },
    errors: null,
  }
}

// ============================================================
// Helper: Add months to a date string (YYYY-MM-DD) → YYYY-MM-DD
// ============================================================

function addMonthsToDate(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setMonth(date.getMonth() + months)
  return date.toISOString().split('T')[0]
}

// ============================================================
// Helper: Add days to a date string (YYYY-MM-DD) → ISO string
// ============================================================

function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

// ============================================================
// Action Handlers
// ============================================================

async function handleHealth(
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<Response> {
  // Verify DB connectivity
  const { error } = await supabaseAdmin.from('api_keys').select('id', { count: 'exact', head: true })
  if (error) {
    return jsonResponse({ success: false, error: 'Falha na conexão com o banco de dados', code: 'INTERNAL_ERROR' }, 500)
  }

  return jsonResponse({
    success: true,
    system_name: 'Sistema Millennials',
    version: '1.0',
  }, 200)
}

async function handleSearchClient(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<Response> {
  const url = new URL(req.url)
  const cnpj = url.searchParams.get('cnpj')

  if (!cnpj) {
    return jsonResponse({ success: false, error: 'Parâmetro cnpj é obrigatório', code: 'VALIDATION_ERROR', details: { cnpj: 'Obrigatório' } }, 400)
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, razao_social, cnpj')
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (error) {
    console.error('[api-v1] Search error:', error)
    return jsonResponse({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500)
  }

  if (!data) {
    return jsonResponse({ found: false }, 200)
  }

  return jsonResponse({
    found: true,
    cliente_id: data.id,
    nome_cliente: data.name,
    razao_social: data.razao_social,
    cnpj: data.cnpj,
  }, 200)
}

async function handleCreateClient(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ response: Response; requestBody: Record<string, unknown> | null }> {
  // Parse body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return {
      response: jsonResponse({ success: false, error: 'Body JSON inválido', code: 'VALIDATION_ERROR' }, 400),
      requestBody: null,
    }
  }

  // Validate payload
  const { payload, errors } = validateCreateClientPayload(body)
  if (errors) {
    return {
      response: jsonResponse({ success: false, error: 'Erro de validação', code: 'VALIDATION_ERROR', details: errors }, 400),
      requestBody: body,
    }
  }

  const p = payload!

  // Check for duplicate CNPJ
  const { data: existingClient } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('cnpj', p.cnpj)
    .maybeSingle()

  if (existingClient) {
    return {
      response: jsonResponse({
        success: false,
        error: 'Cliente com este CNPJ já existe',
        code: 'DUPLICATE',
        cliente_id: existingClient.id,
      }, 409),
      requestBody: body,
    }
  }

  // Calculate monthly_value from product values
  const monthlyValue = p.valores_produtos
    ? Object.values(p.valores_produtos).reduce((sum, v) => sum + v, 0)
    : 0

  // INSERT client
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .insert({
      name: p.nome_cliente,
      razao_social: p.razao_social,
      cnpj: p.cnpj,
      cpf: p.cpf || null,
      niche: p.nicho,
      general_info: p.observacoes_gestor,
      expected_investment: p.investimento_previsto,
      monthly_value: monthlyValue,
      sales_percentage: p.comissao_vendas_percent,
      entry_date: p.data_entrada,
      contract_duration_months: p.duracao_contrato_meses,
      payment_due_day: p.dia_vencimento,
      contracted_products: (p.produtos_contratados && p.produtos_contratados.length > 0) ? p.produtos_contratados : null,
      created_by: null,
      status: 'new_client',
      comercial_status: 'novo',
      comercial_entered_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (clientError) {
    console.error('[api-v1] Client insert error:', clientError)

    // Handle unique violation (CNPJ race condition fallback)
    if (clientError.code === '23505' && clientError.message?.includes('cnpj')) {
      const { data: raceClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('cnpj', p.cnpj)
        .maybeSingle()

      return {
        response: jsonResponse({
          success: false,
          error: 'Cliente com este CNPJ já existe',
          code: 'DUPLICATE',
          cliente_id: raceClient?.id || null,
        }, 409),
        requestBody: body,
      }
    }

    return {
      response: jsonResponse({ success: false, error: 'Erro ao criar cliente', code: 'INTERNAL_ERROR' }, 500),
      requestBody: body,
    }
  }

  const clientId = client.id
  const produtosCriados: string[] = []

  // Process products (if any)
  if (p.produtos_contratados && p.produtos_contratados.length > 0 && p.valores_produtos) {
    const contractExpirationDate = addMonthsToDate(p.data_entrada, p.duracao_contrato_meses)
    const dueDateIso = addDaysToDate(p.data_entrada, 3)

    for (const slug of p.produtos_contratados) {
      const productName = PRODUCT_NAMES[slug]
      const productValue = p.valores_produtos[slug]
      const taskTitle = `${p.nome_cliente} — ${productName} → Cadastrar no Asaas + Enviar 1ª Cobrança`

      // a. client_product_values
      const { error: pvError } = await supabaseAdmin
        .from('client_product_values')
        .insert({
          client_id: clientId,
          product_slug: slug,
          product_name: productName,
          monthly_value: productValue,
        })

      if (pvError) {
        console.error(`[api-v1] client_product_values error (${slug}):`, pvError)
        continue // Skip this product but continue with others
      }

      produtosCriados.push(slug)

      // b. financeiro_client_onboarding
      const { error: fcoError } = await supabaseAdmin
        .from('financeiro_client_onboarding')
        .insert({
          client_id: clientId,
          product_slug: slug,
          product_name: productName,
          current_step: 'novo_cliente',
          contract_expiration_date: contractExpirationDate,
        })

      if (fcoError) {
        console.error(`[api-v1] financeiro_client_onboarding error (${slug}):`, fcoError)
      }

      // c. financeiro_active_clients
      const { error: facError } = await supabaseAdmin
        .from('financeiro_active_clients')
        .insert({
          client_id: clientId,
          product_slug: slug,
          product_name: productName,
          monthly_value: 0,
          invoice_status: 'em_dia',
          contract_expires_at: contractExpirationDate,
        })

      if (facError) {
        console.error(`[api-v1] financeiro_active_clients error (${slug}):`, facError)
      }

      // d. financeiro_tasks
      const { error: ftError } = await supabaseAdmin
        .from('financeiro_tasks')
        .insert({
          client_id: clientId,
          product_slug: slug,
          product_name: productName,
          title: taskTitle,
          status: 'pending',
          due_date: dueDateIso,
        })

      if (ftError) {
        console.error(`[api-v1] financeiro_tasks error (${slug}):`, ftError)
      }

      // department_tasks: skipped — user_id is NOT NULL and there's no
      // authenticated user in M2M calls. financeiro_tasks already covers
      // the notification to the financial team.
    }
  }

  return {
    response: jsonResponse({
      success: true,
      cliente_id: clientId,
      message: 'Cliente cadastrado com sucesso',
      produtos_criados: produtosCriados,
    }, 201),
    requestBody: body,
  }
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req) => {
  // CORS preflight (M2M doesn't need it, but handle gracefully)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const method = req.method
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null

  try {
    // 1. Validate API key
    const { key: apiKey, error: authError } = await validateApiKey(req, supabaseAdmin)
    if (authError) {
      await logRequest(supabaseAdmin, null, action || 'unknown', method, 401, null, { code: 'UNAUTHORIZED' }, ipAddress)
      return authError
    }

    // 2. Rate limit check
    const rateLimitResponse = await checkRateLimit(apiKey!.id, supabaseAdmin)
    if (rateLimitResponse) {
      await logRequest(supabaseAdmin, apiKey!.id, action || 'unknown', method, 429, null, { code: 'RATE_LIMITED' }, ipAddress)
      return rateLimitResponse
    }

    // 3. Route to action handler
    let response: Response
    let requestBody: Record<string, unknown> | null = null

    switch (action) {
      case 'health': {
        if (method !== 'GET') {
          response = jsonResponse({ success: false, error: 'Método não permitido. Use GET.', code: 'VALIDATION_ERROR' }, 400)
          break
        }
        response = await handleHealth(supabaseAdmin)
        break
      }
      case 'search_client': {
        if (method !== 'GET') {
          response = jsonResponse({ success: false, error: 'Método não permitido. Use GET.', code: 'VALIDATION_ERROR' }, 400)
          break
        }
        response = await handleSearchClient(req, supabaseAdmin)
        break
      }
      case 'create_client': {
        if (method !== 'POST') {
          response = jsonResponse({ success: false, error: 'Método não permitido. Use POST.', code: 'VALIDATION_ERROR' }, 400)
          break
        }
        const result = await handleCreateClient(req, supabaseAdmin)
        response = result.response
        requestBody = result.requestBody
        break
      }
      default: {
        response = jsonResponse({
          success: false,
          error: `Ação desconhecida: "${action}". Ações válidas: health, create_client, search_client`,
          code: 'VALIDATION_ERROR',
        }, 400)
      }
    }

    // 4. Log the request
    const responseBody = await response.clone().json().catch(() => ({}))
    await logRequest(supabaseAdmin, apiKey!.id, action || 'unknown', method, response.status, requestBody, responseBody, ipAddress)

    return response
  } catch (error) {
    console.error('[api-v1] Unexpected error:', error)
    const errResponse = jsonResponse({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500)
    await logRequest(supabaseAdmin, null, action || 'unknown', method, 500, null, { code: 'INTERNAL_ERROR' }, ipAddress)
    return errResponse
  }
})
