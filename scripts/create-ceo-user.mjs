/**
 * Script one-off: cria um usuário CEO no Supabase Auth + profiles + user_roles.
 * Uso: adicione SUPABASE_SERVICE_ROLE_KEY no .env (Dashboard > Project Settings > API > service_role)
 *      Depois: node scripts/create-ceo-user.mjs
 * Após criar o usuário, remova a Service Role Key do .env se quiser (segurança).
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
    let content = readFileSync(path, 'utf8')
    content = content.replace(/^\uFEFF/, '') // BOM
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
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const EMAIL = 'gabrielgipp04@gmail.com'
const PASSWORD = 'Aurelio01@'
const NAME = 'Gabriel'
const ROLE = 'ceo'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Erro: variáveis não encontradas no .env (ou .env.local).')
  if (!SUPABASE_URL) console.error('  - VITE_SUPABASE_URL (ou SUPABASE_URL) está faltando.')
  if (!SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY está faltando (adicione sem # na frente).')
  console.error('Service Role Key: Dashboard > Project Settings > API > service_role (secret).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('Criando usuário CEO...')

  let userId
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: NAME, role: ROLE }
  })

  if (authError) {
    if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const existing = users.find((u) => u.email === EMAIL)
      if (!existing) {
        console.error('E-mail já cadastrado mas usuário não encontrado. Tente outro e-mail.')
        process.exit(1)
      }
      userId = existing.id
      console.log('Usuário já existe no Auth. Atualizando profile e cargo para CEO...')
    } else {
      console.error('Erro ao criar usuário no Auth:', authError.message)
      process.exit(1)
    }
  } else {
    userId = authData.user.id
  }

  // Trigger on_auth_user_created já pode ter inserido profile e role 'design'; usar upsert/replace
  const { error: profileError } = await supabase.from('profiles').upsert(
    { user_id: userId, name: NAME, email: EMAIL },
    { onConflict: 'user_id' }
  )
  if (profileError) {
    console.error('Erro ao criar/atualizar profile:', profileError.message)
    process.exit(1)
  }

  await supabase.from('user_roles').delete().eq('user_id', userId)
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: userId,
    role: ROLE
  })
  if (roleError) {
    console.error('Erro ao atribuir cargo:', roleError.message)
    process.exit(1)
  }

  console.log('Usuário CEO criado com sucesso.')
  console.log('  Email:', EMAIL)
  console.log('  Nome:', NAME)
  console.log('  Cargo: CEO')
  console.log('Faça login no app com esse e-mail e a senha informada.')
}

main()
