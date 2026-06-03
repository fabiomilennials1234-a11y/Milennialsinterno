#!/usr/bin/env bash
# Teste do eslint-boundaries (#76 / ADR 0004).
# Prova, via interface pública (o build do lint), que a fronteira de módulo
# é enforçada:
#   1. violation.ts (import que FURA o barrel) -> DEVE produzir erro boundaries
#   2. allowed.ts   (import via barrel index.ts) -> DEVE estar limpo
# As fixtures são ignoradas pelo lint geral; aqui usamos --no-ignore para
# inspecioná-las isoladamente. Sai 0 só se ambos os comportamentos baterem.
set -uo pipefail
cd "$(dirname "$0")/.."

FIX_DIR="src/modules/__boundaries_fixture__"
VIOLATION="$FIX_DIR/violation.ts"
ALLOWED="$FIX_DIR/allowed.ts"

fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. A violação deve disparar o erro boundaries/dependencies.
VOUT=$(npx eslint --no-ignore "$VIOLATION" 2>&1)
VCODE=$?
if [[ $VCODE -eq 0 ]]; then
  echo "$VOUT"
  fail "esperava erro de fronteira em $VIOLATION, mas o lint passou (RED não vira GREEN)."
fi
if ! echo "$VOUT" | grep -q "boundaries/dependencies"; then
  echo "$VOUT"
  fail "lint falhou em $VIOLATION, mas NÃO por boundaries/dependencies (erro errado)."
fi
echo "OK: violation.ts dispara boundaries/dependencies como esperado."

# 2. O import via barrel deve estar limpo (sem erro de boundaries).
AOUT=$(npx eslint --no-ignore "$ALLOWED" 2>&1)
if echo "$AOUT" | grep -q "boundaries/dependencies"; then
  echo "$AOUT"
  fail "import via barrel ($ALLOWED) foi bloqueado — regra overzealous."
fi
echo "OK: allowed.ts (import via barrel) passa limpo."

echo "OK: teste de boundaries passou."
