# Instruções para Deploy das Edge Functions (Criação de Usuários)

O erro "Failed to send a request to the Edge Function" ou "401 Invalid JWT" ocorre quando:
- as funções não estão publicadas no Supabase, ou
- o gateway valida o JWT antes da função (configurado com `verify_jwt = false` para as funções que validam internamente).

Execute os passos abaixo **na conta e no projeto corretos do Supabase**. Veja também `FLUXO_CORRECAO_CREATE_USER.md` para o fluxo completo.

## Passo 1: Login e Vincular o Projeto

1. No terminal: `supabase login`
2. Vincule ao projeto **correto** (o mesmo que o app usa):
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   ```
   O Project Ref está em: Dashboard do Supabase > Settings > General > Reference ID.  
   Também é a parte antes de `.supabase.co` na URL do projeto (ex.: `https://xxxx.supabase.co` → `xxxx`).

## Passo 2: Configurar os Secrets das Edge Functions

No **Dashboard do Supabase** do seu projeto:

1. Vá em **Project Settings** > **Edge Functions** > **Manage secrets**
2. Adicione estas variáveis:

| Nome | Valor |
|------|-------|
| SUPABASE_URL | URL do projeto (Settings > API > Project URL) |
| SUPABASE_SERVICE_ROLE_KEY | Chave service_role (Settings > API) |
| SUPABASE_ANON_KEY | Chave anon (Settings > API) |

## Passo 3: Deploy das Funções

No terminal, no diretório do projeto:

```bash
supabase functions deploy create-user
supabase functions deploy update-user
supabase functions deploy delete-user
supabase functions deploy delete-group
```

Ou use o script: `./scripts/deploy-edge-functions.sh`

O `supabase/config.toml` já define `verify_jwt = false` para essas funções, evitando 401 no gateway.

## Passo 4: Verificar Usuário CEO

Apenas usuários CEO podem criar outros usuários. Se ainda não tiver um CEO:

```bash
node scripts/create-ceo-user.mjs
```

(Edite o script para definir e-mail e senha desejados nas linhas 42-45.)

## Passo 5: Testar

1. Faça login como CEO no app
2. Vá em Gestão de Usuários
3. Clique em "Novo Usuário"
4. Preencha os campos e crie um usuário de teste
5. Deve aparecer "Usuário criado com sucesso"
