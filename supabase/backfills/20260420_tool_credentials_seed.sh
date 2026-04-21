#!/usr/bin/env bash
set -euo pipefail

# One-shot seed para public.tool_credentials.
# Fundador roda UMA VEZ após migration 20260420230000 aplicada.
#
# Valores via env vars — NUNCA commita shell com valores dentro.
# Depois de rodar: limpar as vars do shell OU apagar .env.tool_credentials (se usar).
#
# Uso:
#   export MAKE_LOGIN='...'
#   export MAKE_PASSWORD='...'
#   export CURSOS_LOGIN='...'
#   export CURSOS_PASSWORD='...'
#   ./supabase/backfills/20260420_tool_credentials_seed.sh
#
# OU, mais seguro (não entra no history):
#   env MAKE_LOGIN='...' MAKE_PASSWORD='...' CURSOS_LOGIN='...' CURSOS_PASSWORD='...' \
#     ./supabase/backfills/20260420_tool_credentials_seed.sh

: "${MAKE_LOGIN:?MAKE_LOGIN env var required}"
: "${MAKE_PASSWORD:?MAKE_PASSWORD env var required}"
: "${CURSOS_LOGIN:?CURSOS_LOGIN env var required}"
: "${CURSOS_PASSWORD:?CURSOS_PASSWORD env var required}"

if [[ ! -f .env.scripts ]]; then
  echo "ERRO: .env.scripts não encontrado no cwd. Roda a partir da raiz do repo." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.scripts
set +a

# Usa psql-style via supabase db query. Valores interpolados via variáveis de psql
# para evitar problemas de escape com aspas simples dentro de senhas.
supabase db query --linked <<SQL
\set make_login   '${MAKE_LOGIN//\'/\'\'}'
\set make_pass    '${MAKE_PASSWORD//\'/\'\'}'
\set cursos_login '${CURSOS_LOGIN//\'/\'\'}'
\set cursos_pass  '${CURSOS_PASSWORD//\'/\'\'}'

INSERT INTO public.tool_credentials (tool_name, credential_type, credential_value, label, visible_to_roles)
VALUES
  ('make',   'login',    :'make_login',   'Make - Email',   ARRAY['ceo','cto','gestor_projetos','outbound','gestor_ads']::text[]),
  ('make',   'password', :'make_pass',    'Make - Senha',   ARRAY['ceo','cto','gestor_projetos','outbound','gestor_ads']::text[]),
  ('cursos', 'login',    :'cursos_login', 'Cursos - Email', ARRAY['ceo','cto','gestor_projetos','outbound']::text[]),
  ('cursos', 'password', :'cursos_pass',  'Cursos - Senha', ARRAY['ceo','cto','gestor_projetos','outbound']::text[])
ON CONFLICT (tool_name, credential_type) DO UPDATE
  SET credential_value = EXCLUDED.credential_value,
      label            = EXCLUDED.label,
      visible_to_roles = EXCLUDED.visible_to_roles,
      is_active        = true;
SQL

echo ""
echo "Seed aplicado. Verificando (sem credential_value):"
supabase db query --linked "SELECT tool_name, credential_type, label, visible_to_roles, is_active, rotated_at FROM public.tool_credentials ORDER BY tool_name, credential_type"
