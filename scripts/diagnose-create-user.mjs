/**
 * Diagnóstico: chama a Edge Function create-user e imprime status + body completos.
 * Uso: node scripts/diagnose-create-user.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const path = join(rootDir, name)
    if (!existsSync(path)) continue
    const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
    for (const raw of content.split('\n')) {
      const line = raw.replace(/\r$/, '').trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
    break
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
const CEO_EMAIL = 'gabrielgipp04@gmail.com'
const CEO_PASSWORD = 'Aurelio01@'

const TEST_USER = {
  email: `teste-${Date.now()}@teste.com`,
  password: 'SenhaTeste123!',
  name: 'Usuário Teste',
  role: 'design',
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Erro: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  console.log('1. Fazendo login como CEO...')
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: CEO_EMAIL,
    password: CEO_PASSWORD,
  })

  if (signInError) {
    console.error('   Erro no login:', signInError.message)
    process.exit(1)
  }

  const token = signIn.session?.access_token
  if (!token) {
    console.error('   Token não obtido')
    process.exit(1)
  }
  console.log('   OK. Token obtido, user_id:', signIn.user?.id)

  const functionsUrl = `${SUPABASE_URL}/functions/v1/create-user`
  console.log('\n2. Chamando Edge Function (fetch direto)...')
  console.log('   URL:', functionsUrl)

  const res = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(TEST_USER),
  })

  const bodyText = await res.text()
  let bodyJson = null
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null
  } catch {
    bodyJson = bodyText
  }

  console.log('\n--- Resposta ---')
  console.log('   Status:', res.status, res.statusText)
  console.log('   Headers:', Object.fromEntries(res.headers.entries()))
  console.log('   Body:', typeof bodyJson === 'object' ? JSON.stringify(bodyJson, null, 2) : bodyJson)

  if (res.ok) {
    console.log('\nOK! Usuário criado.')
    return
  }

  console.log('\n--- Diagnóstico ---')
  if (res.status === 401) {
    console.log('401: JWT inválido ou não aceito pela Edge Function.')
    console.log('   - Verificar se a função está deployada no projeto correto')
    console.log('   - Verificar se SUPABASE_ANON_KEY está correto no ambiente da função')
  }
  if (res.status === 403) {
    console.log('403: Usuário não é CEO (is_ceo retornou false).')
  }
}

main().catch((e) => {
  console.error('Exceção:', e)
  process.exit(1)
})
