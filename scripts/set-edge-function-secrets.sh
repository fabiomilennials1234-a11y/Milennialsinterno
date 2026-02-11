#!/bin/bash
# Configura os secrets CUSTOM das Edge Functions no Supabase (opcional).
#
# NOTA: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY são
# INJETADOS automaticamente pelo Supabase em todas as Edge Functions.
# Este script só é necessário para secrets adicionais (ex: API keys externas).
#
# Requer: supabase login, supabase link (projeto correto)
# Uso: ./scripts/set-edge-function-secrets.sh
#
# Para adicionar secrets customizados, edite este script e use:
#   supabase secrets set NOME_CUSTOM="valor"

set -e
cd "$(dirname "$0")/.."

echo "Secrets padrão SUPABASE_* são injetados automaticamente pelo Supabase."
echo "Para adicionar secrets customizados, use: supabase secrets set NOME=valor"
