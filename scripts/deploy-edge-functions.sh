#!/bin/bash
# Deploy das Edge Functions de usuários (create-user, update-user, delete-user)
# Execute MANUALMENTE na conta e no projeto corretos do Supabase.
#
# 1. supabase login
# 2. supabase link --project-ref SEU_PROJECT_REF
# 3. ./scripts/deploy-edge-functions.sh
#
# Ou rode os deploys manualmente (veja INSTRUCOES_DEPLOY_EDGE_FUNCTIONS.md).

set -e
cd "$(dirname "$0")/.."

echo "=== Deploy das Edge Functions ==="
echo "Certifique-se de ter feito: supabase login e supabase link --project-ref SEU_REF"
echo ""

supabase functions deploy create-user
supabase functions deploy update-user
supabase functions deploy delete-user
supabase functions deploy delete-group

echo ""
echo "=== Deploy concluído com sucesso ==="
