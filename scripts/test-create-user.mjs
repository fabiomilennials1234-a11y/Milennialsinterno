/**
 * Testa a criação de usuário via Edge Function create-user.
 * Usa as credenciais do CEO do create-ceo-user.mjs para obter o token.
 * Uso: node scripts/test-create-user.mjs
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

  console.log('Fazendo login como CEO...')
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: CEO_EMAIL,
    password: CEO_PASSWORD,
  })

  if (signInError) {
    console.error('Erro no login:', signInError.message)
    process.exit(1)
  }

  if (!signIn.session?.access_token) {
    console.error('Token não obtido')
    process.exit(1)
  }

  // Usar o cliente já autenticado - ele envia o token automaticamente
  console.log('Chamando Edge Function create-user...')
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: TEST_USER,
  })
  if (error) {
    console.error('Erro:', error.message)
    if (error.context && typeof error.context?.json === 'function') {
      try {
        const ctx = await error.context.json()
        console.error('Detalhes:', JSON.stringify(ctx, null, 2))
      } catch {
        // ignore
      }
    }
    if (data) console.error('Resposta:', JSON.stringify(data, null, 2))
    console.error('\nDica: rode "node scripts/diagnose-create-user.mjs" para ver status/body completos.')
    process.exit(1)
  }

  if (data?.error) {
    console.error('Erro da função:', data.error)
    process.exit(1)
  }

  console.log('OK! Usuário criado com sucesso:', data?.user?.email || TEST_USER.email)
}

main()
