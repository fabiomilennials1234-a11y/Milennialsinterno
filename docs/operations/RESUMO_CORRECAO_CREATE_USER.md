# Resumo da Correção – Criação de Usuários

## O que estava errado

A função que cria usuários (Edge Function `create-user`) **não estava publicada no servidor do Supabase**. Por isso surgia o erro "Failed to send a request to the Edge Function" quando o frontend tentava chamá-la.

## O que foi feito

1. **Script automatizado de deploy**  
   Foi criado o script `scripts/setup-and-deploy-edge-functions.sh`, que:
   - Vincula o projeto ao Supabase
   - Configura as variáveis de ambiente das Edge Functions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`)
   - Faz o deploy de `create-user`, `update-user`, `delete-user` e `delete-group`

2. **Usuário CEO verificado**  
   O usuário CEO (`gabrielgipp04@gmail.com`) já existe e está com cargo CEO configurado no banco.

3. **Documentação atualizada**  
   - `INSTRUCOES_DEPLOY_EDGE_FUNCTIONS.md` – inclusão de instruções para uso de token
   - `.env.example` – referência das variáveis necessárias

## O que falta fazer (você)

O deploy exige um access token do Supabase. Faça:

1. Acesse https://supabase.com/dashboard/account/tokens e crie um token.
2. No terminal do projeto:
   ```bash
   export SUPABASE_ACCESS_TOKEN="seu_token"
   ./scripts/setup-and-deploy-edge-functions.sh
   ```
3. Aguarde até o script finalizar sem erros.

## Como testar

1. Faça login no app com o usuário CEO (`gabrielgipp04@gmail.com` e a senha configurada).
2. Acesse **Gestão de Usuários**.
3. Clique em **Novo Usuário**.
4. Preencha: nome, e-mail, senha, cargo e (se fizer sentido) squad.
5. Clique em criar.

## Resultado esperado

- Mensagem: "Usuário criado com sucesso"
- Novo usuário na lista de usuários

## Se ainda der erro

- **"Apenas o CEO pode criar usuários"** – confira se está logado com o usuário CEO.
- **401 Unauthorized** – faça logout e login de novo.
- **Erro ao chamar a Edge Function** – verifique se o deploy foi concluído com sucesso.
