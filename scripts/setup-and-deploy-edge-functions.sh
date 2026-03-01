#!/bin/bash
# Deploy das Edge Functions de usuários (create-user, update-user, delete-user, delete-group).
# Requer: supabase CLI e SUPABASE_ACCESS_TOKEN no .env ou em export.
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY são injetados automaticamente pelo Supabase.

set -e
cd "$(dirname "$0")/.."
PROJECT_REF="semhnpwxptfgqxhkoqsk"

echo "=== Setup e Deploy das Edge Functions ==="

# 1. Carregar .env PRIMEIRO (token pode estar aqui)
if [ -f .env ]; then
  echo "Carregando variáveis do .env..."
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

# 2. Verificar token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo ""
  echo "ERRO: SUPABASE_ACCESS_TOKEN não está definido."
  echo "Adicione no .env: SUPABASE_ACCESS_TOKEN=seu_token"
  echo "Obtenha em: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

# 3. Vincular projeto
echo ""
echo "Vinculando ao projeto $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

# 4. Deploy das funções
# Nota: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY são injetados automaticamente pelo Supabase
echo ""
echo "Fazendo deploy das Edge Functions..."
supabase functions deploy create-user
supabase functions deploy update-user
supabase functions deploy delete-user
supabase functions deploy delete-group

echo ""
echo "=== Deploy concluído com sucesso ==="
echo ""
echo "Próximos passos:"
echo "1. Se não tiver usuário CEO: node scripts/create-ceo-user.mjs"
echo "2. Faça login como CEO no app e teste a criação de usuário em Gestão de Usuários"
echo ""
