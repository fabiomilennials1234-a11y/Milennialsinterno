# Configurar ambiente no Easypanel

O app usa **Supabase**. As variáveis são lidas em **tempo de execução** (quando o container sobe): o entrypoint gera um `config.js` a partir das variáveis de **Ambiente** e o app usa esses valores. Não é necessário configurar Build args.

---

## Onde configurar no Easypanel

1. Abra o projeto **milennials** no Easypanel e clique no app **milennials**.
2. No menu lateral, entre em **Ambiente** (Environment / Variáveis de ambiente).
3. Adicione as **3 variáveis** abaixo (sem comentários, sem `SUPABASE_SERVICE_ROLE_KEY`).
4. **Salve** e faça um **novo deploy**.

---

## Variáveis obrigatórias

| Nome | Valor (exemplo) | Onde pegar |
|------|-----------------|------------|
| `VITE_SUPABASE_URL` | `https://semhnpwxptfgqxhkoqsk.supabase.co` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon/public key) | Supabase → Settings → API → anon public |
| `VITE_SUPABASE_PROJECT_ID` | `semhnpwxptfgqxhkoqsk` | Supabase → Settings → General → Reference ID |

Use os valores do **seu** projeto no [Dashboard do Supabase](https://supabase.com/dashboard) (Settings → API e General).

---

## Forma de preencher no Easypanel

Em **Ambiente** (e em **Build args**, se existir):

- **Nome:** `VITE_SUPABASE_URL`  
  **Valor:** `https://SEU_PROJECT_REF.supabase.co`

- **Nome:** `VITE_SUPABASE_PUBLISHABLE_KEY`  
  **Valor:** a chave **anon** (public) do Supabase

- **Nome:** `VITE_SUPABASE_PROJECT_ID`  
  **Valor:** o **Reference ID** do projeto (ex.: `semhnpwxptfgqxhkoqsk`)

Salve e rode um novo deploy.

---

## Importante

- **Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend nem nas variáveis de ambiente do app no Easypanel (essa chave é só para backend/scripts).
- Depois de alterar variáveis, é necessário **gerar um novo deploy** para o build usar os valores novos.
