# Fluxo de Correção: Criação de Usuários via Edge Function

## Problema

O teste `node scripts/test-create-user.mjs` retorna **401 Invalid JWT** ao chamar a Edge Function `create-user`.

## Causa Raiz

O **gateway** do Supabase valida o JWT **antes** da requisição chegar à nossa função. Com as novas chaves assimétricas (JWT Signing Keys), essa validação pode falhar e devolver `401 Invalid JWT` sem executar nosso código.

**Nossa função já valida o JWT internamente** (via `getUser(token)` e `is_ceo`), então é seguro desativar a verificação no gateway.

## Solução

1. **`verify_jwt = false`** nas funções que fazem validação própria (config em `supabase/config.toml`).
2. **Redeploy** para que a configuração seja aplicada.

## Passos para Corrigir

### 1. Login no Supabase (se necessário)

```bash
supabase login
```

### 2. Deploy das funções (aplica o novo config)

```bash
cd /Volumes/Untitled/refine-dash-main
supabase functions deploy create-user update-user delete-user delete-group --project-ref semhnpwxptfgqxhkoqsk
```

Ou use o script:

```bash
./scripts/deploy-edge-functions.sh
```

### 3. Testar

```bash
node scripts/test-create-user.mjs
```

Ou use o diagnóstico para ver status/body completos:

```bash
node scripts/diagnose-create-user.mjs
```

### 4. Validar no app

1. Faça login como CEO
2. Vá em Gestão de Usuários
3. Clique em "Novo Usuário"
4. Preencha e crie – deve aparecer "Usuário criado com sucesso"

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | `verify_jwt = false` para create-user, update-user, delete-user, delete-group |
| `supabase/functions/create-user/index.ts` | Validação com `getUser(token)` explícito |
| `scripts/diagnose-create-user.mjs` | Script de diagnóstico com fetch direto |
| `scripts/deploy-edge-functions.sh` | Inclusão do deploy de delete-group |

## Segurança

- `verify_jwt = false` só desativa a checagem **no gateway**.
- As funções continuam validando o JWT com `getUser(token)` e restringindo acesso ao CEO via `is_ceo`.
- Sem JWT válido ou sem ser CEO, a função responde 401 ou 403.
