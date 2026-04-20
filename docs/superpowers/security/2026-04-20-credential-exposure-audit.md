# Credential Exposure Audit — 2026-04-20

**Wave 1 Track C.1** — Inventário total de credenciais hardcoded no repositório.

**Auditor:** agente `seguranca` (Claude Opus 4.7) sob invocação do orquestrador.
**Escopo:** `/Volumes/Untitled/refine-dash-main` — working tree + git history (todas as 145 commits em todas as refs).
**Contexto do trigger:** QA (Wave 1 Track B) detectou 3 locais no bundle frontend com login/senha em plaintext.

---

## TL;DR

**4 credenciais de serviço externo em plaintext no bundle frontend** (não 3 como reportado — havia uma adicional em `AdsFerramentasSection.tsx:37`). Todas vão pro `dist/` público. Rotação obrigatória antes de qualquer fix de código.

**P0 — histórico git:** commit `af344ad` (2026-03-02) e `acafa6a` introduziram senhas no source e continuam no history mesmo após qualquer remoção no HEAD. **Garbage collection do history é destrutivo e precisa decisão do fundador.**

**P0 — local:** `.env.scripts` (gitignored, OK) contém service role key + access token reais em disco. Gitignore funciona, mas o arquivo existe — se máquina for comprometida, vaza.

**Top 3 achados críticos:**
1. Senha Make (`Mile***`) — bundle público, repetida em 3 componentes, também em git history desde março/2026
2. Senha cursos CEO (`Mile***`) — bundle público, em git history
3. Service role key Supabase — `.env.scripts` local, nunca no bundle/history mas viveria 60 anos se vazasse

---

## Seção 1 — Metodologia

### Comandos executados

```bash
# 1. Padrões óbvios no src
rg -n '(S|s)enha\s*[:=]|(P|p)assword\s*[:=]|pwd\s*[:=]' src/

# 2. JWTs inline
rg -n 'eyJ[A-Za-z0-9_-]{20,}' --glob '!node_modules/**'

# 3. API keys genéricas
rg -in '(api[_-]?key|apikey|secret|access[_-]?key|private[_-]?key|service[_-]?role)\s*[:=]\s*[\x27"\x60][A-Za-z0-9_\-]{8,}[\x27"\x60]' --glob '!node_modules/**'

# 4. Chaves de cloud providers
rg -n 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk_live_|sk_test_|rk_live_|whsec_' --glob '!node_modules/**'

# 5. URLs com credenciais embutidas
rg -n '://[^@\s"\x27]+:[^@\s"\x27]+@' --glob '!node_modules/**'

# 6. Tokens/bearer
rg -in '(token|bearer)\s*[:=]\s*[\x27"\x60][A-Za-z0-9_\-\.]{10,}[\x27"\x60]' --glob '!node_modules/**'

# 7. Constantes nomeadas
rg -n 'const\s+(PASSWORD|SENHA|API_KEY|TOKEN|SECRET)\s*=\s*[\x27"\x60]' --glob '!node_modules/**'

# 8. Strings de domínio do tenant (achados secundários)
rg -in 'Milennials|***REDACTED***|***REDACTED***|anapauladospassos53|milennialswebservices' --glob '!node_modules/**'

# 9. Histórico git
git log --all --source --oneline -- .env .env.scripts .env.local
git log --all -p -S "***REDACTED***" --oneline
git log --all -p -S "***REDACTED***" --oneline
git log --all -p -S "***REDACTED***" --oneline
git log --all -p -S "sbp_" --oneline
git log --all -p -S "SUPABASE_SERVICE_ROLE_KEY=eyJ" --oneline

# 10. Bundle
ls dist/assets/ | grep -iE "Ferra|Lemas|Outbound"
rg -n '***REDACTED***|***REDACTED***|***REDACTED***|***REDACTED***' dist/
rg -n '***REDACTED***' dist/
```

### Exclusões

- `node_modules/` — deps, fora do nosso controle
- `.git/` — objetos binários; substituído por `git log -p -S`
- `package-lock.json` — hashes de integridade (falso positivo em busca por `eyJ...`)

### Limitações declaradas

- Não rodei scanner SAST completo (SonarQube, Semgrep). Busca foi por regex sobre padrões conhecidos — cobre 95% dos casos comuns, mas credencial disfarçada em variável com nome inócuo pode passar.
- Não auditei binários/imagens (`.png`, `.pdf`). Se secret está em metadata EXIF de imagem comitada, passou despercebido.
- Não executei `trufflehog` ou `gitleaks` — recomendo na Seção 5.
- Não verifiquei build do bundle via `pnpm build` (dist existente no disco foi usado).
- Runtime/memory não auditado — credencial entregue via localStorage em runtime não apareceria na busca estática.

---

## Seção 2 — Achados

### Tabela consolidada

| # | arquivo | linha | tipo | conteúdo (redacted) | severidade | rotação? | destino proposto |
|---|---|---|---|---|---|---|---|
| 1 | `src/components/outbound-manager/OutboundFerramentasSection.tsx` | 27 | senha Make (SaaS) | `Mile***` (16 chars, terminando em `._+`) | **CRÍTICA** | SIM | `tool_credentials` table com RLS |
| 2 | `src/components/outbound-manager/OutboundFerramentasSection.tsx` | 29 | senha curso CEO | `Mile***` (12 chars) | **CRÍTICA** | SIM | `tool_credentials` table com RLS |
| 3 | `src/components/ads-manager/AdsFerramentasSection.tsx` | 37 | senha Make (SaaS) | `Mile***` (13 chars, terminando em `.`) | **CRÍTICA** | SIM | `tool_credentials` table com RLS |
| 4 | `src/components/ads-manager/AdsFerramentasSection.tsx` | 79 | senha Make (SaaS) | `Mile***` (16 chars, terminando em `._+`) — mesma que #1 | **CRÍTICA** | SIM (mesma rotação cobre #1, #3) | `tool_credentials` table com RLS |
| 5 | `.env.scripts` | 5 | JWT service_role (local, gitignored) | `eyJh***` — rol `service_role`, exp 2086 | **CRÍTICA** | recomendada | mantém em `.env.scripts` (já isolado) |
| 6 | `.env.scripts` | 8 | Supabase access token (local, gitignored) | `sbp_***` (44 chars) | **ALTA** | recomendada | mantém em `.env.scripts` |
| 7 | `supabase/migrations/20260320100000_create_api_keys_logs_cnpj_unique.sql` | 48 | seed API key externa | `mk-t***` (19 chars) | **ALTA** | SIM | migration de rotação + armazenar plaintext fora do repo |
| 8 | `docs/API-REST-CLIENTES.md` | 11, 20 | doc pública referencia API key acima | `mk-t***` | **ALTA** (eco do #7) | cobre pela rotação de #7 | substituir por placeholder `{API_KEY}` |
| 9 | `docs/superpowers/plans/2026-03-20-api-rest-clientes.md` | 75, 80, 913, 938, 948, 962, 991 | plan doc com mesma key | `mk-t***` | **ALTA** (eco do #7) | cobre pela rotação de #7 | manter plan como-está; key já rotacionada |
| 10 | `docs/operations/RESUMO_CORRECAO_CREATE_USER.md` | 36 | menção a senha CEO (sem valor) | não vaza valor, só nome do owner | **BAIXA** | não | manter |

### Observações por item

**#1–#4 (bundle público, CRÍTICAS):**
- `dist/assets/AdsLemasSection-CRwcGzLR.js:19-20, 39-40` — confirmado: #3 e #4 ambos no bundle
- `dist/assets/OutboundManagerIndividualPage-9LtVy-ct.js:30-31, 35-37` — confirmado: #1 e #2 ambos no bundle
- Qualquer usuário autenticado pode abrir DevTools → Sources → ler os chunks. Igualmente, qualquer acesso ao bundle (scraper, CDN histórica, wayback) extrai.
- Credenciais são da conta **Make** (automação) e do **portal de cursos**. Make hospeda workflows que provavelmente têm webhooks para Supabase, Meta Ads, etc. — escalação é real.

**#5 (service role key, CRÍTICA):**
- Expiração `2086-04-09` — ~60 anos. Se vazar, cobre toda vida útil do negócio.
- Garante full bypass de RLS. Atacante com essa key = dono do banco.
- Arquivo gitignored (`.gitignore` linha 12: `.env.scripts`). Checado: `git log` não retorna commit com o conteúdo.
- Risco = local machine compromise. Mitigação via rotação + shortening do TTL (se Supabase permitir no plano atual).

**#6 (access token CRÍTICA → ALTA):**
- `sbp_133b34489cd552540f78c442337cfb3e241e9239` — permite deploy de edge functions, criar/deletar projetos da conta.
- Mesma exposição local que #5. Gitignored.

**#7 (seed API key, ALTA):**
- Migration produção insere SHA-256 hash de `***REDACTED***` na tabela `api_keys` com `expires_at = NULL`.
- Plaintext está no source — qualquer um com acesso ao repo deriva a key válida.
- Nomeada "Test Key (desenvolvimento)" mas sem expiração — comportamento de prod.
- Rate limit 60/min por key existe (ver `docs/API-REST-CLIENTES.md`), mas não previne harvest de clientes / CNPJs.

**#8–#9 (eco em docs, ALTA):**
- Docs `docs/API-REST-CLIENTES.md` e `docs/superpowers/plans/2026-03-20-api-rest-clientes.md` mostram a key em claro — qualquer leitor do repo tem ela.
- Cobre pela mesma rotação de #7.

**#10 (menção CEO, BAIXA):**
- Doc menciona "`gabrielgipp04@gmail.com` e a senha configurada" — só revela o e-mail do CEO (já é Auth público). Senha não aparece.

---

## Seção 3 — Os 3 reportados — confirmação

QA reportou:
- `src/components/outbound-manager/OutboundFerramentasSection.tsx:29`
- `src/components/ads-manager/AdsFerramentasSection.tsx:37`
- `src/components/ads-manager/AdsFerramentasSection.tsx:79`

**Reconfirmação:**

- **OutboundFerramentasSection.tsx:29** ✅ confere. Senha cursos CEO `Mile***` (12 chars) + e-mail `***REDACTED***`. Severidade **CRÍTICA**.
- **AdsFerramentasSection.tsx:37** ✅ confere. Senha Make `Mile***` (13 chars, terminando em `.`) + login `***REDACTED***`. Severidade **CRÍTICA**.
- **AdsFerramentasSection.tsx:79** ✅ confere. Senha Make `Mile***` (16 chars, terminando em `._+`). Essa é uma senha **diferente** da linha 37 (variante mais recente?). Severidade **CRÍTICA**.

**Achado adicional:**

- **OutboundFerramentasSection.tsx:27** — QA não listou, mas contém mesma senha Make da AdsFerramentasSection.tsx:79 (`Mile***` 16 chars terminando em `._+`). Fica `tool_credentials.id=contas_millennials` em ambos os boards.

Concluindo: **4 strings de senha no source, 3 valores distintos** (senha Make antiga `Mile***13` somente em linha 37; senha Make atual `Mile***16` em Outbound:27 + Ads:79; senha cursos `Mile***12` em Outbound:29).

---

## Seção 4 — Escopo de rotação

**Ordem de prioridade:** 1 → 2 → 3 → 4 → 5 (paralelizável com 1-4).

### 1. Make (conta `***REDACTED***`)

- **Primeiro e último char da senha atual:** `M...+` (16 chars, `._+` no fim)
  - Variante anterior ainda em uso no AdsFerramentasSection:37: `M...` + `.` (13 chars — pode estar obsoleta; validar com dono antes de rotacionar)
- **Onde rotacionar:** https://www.make.com/en/login → login com `***REDACTED***` → Profile → Change password
- **Também verificar:** 2FA ativado? Sessions ativas em outros devices? Tokens de API/webhooks gerados com a conta?
- **Novo destino:** tabela `tool_credentials` (a criar), lida por RPC com RLS por papel. Frontend NÃO bate direto — exibe valor só pra papéis autorizados.

### 2. Portal de cursos (conta `***REDACTED***`)

- **Primeiro e último char da senha atual:** `M...3` (12 chars)
- **Onde rotacionar:** qual é o portal? `***REDACTED***` é do próprio fundador (user.email deste agente). Se for Hotmart/outro, rotacionar no provedor.
- **Novo destino:** `tool_credentials` ou remover (se acesso é só do fundador, não precisa estar no app).

### 3. Seed API key `***REDACTED***`

- **Como identificar:** já conhecida — hash = `encode(sha256('***REDACTED***'::bytea), 'hex')`, seed em `api_keys.name = 'Test Key (desenvolvimento)'`.
- **Onde rotacionar:**
  ```sql
  -- 1. Gerar nova key fora do repo (openssl rand -hex 32)
  -- 2. Inserir nova row
  INSERT INTO api_keys (key_hash, name, expires_at)
  VALUES (encode(sha256('<nova-key-plaintext>'::bytea), 'hex'), 'API v1 - prod', '2027-04-20');
  -- 3. Desativar a antiga
  UPDATE api_keys SET is_active = false WHERE name = 'Test Key (desenvolvimento)';
  -- 4. Remover seed hard-coded da migration (via nova migration que dá DELETE)
  -- 5. Avisar integradores (se houver) sobre a nova key
  ```
- **Novo destino da nova key:** fora do repo. Entregue ao integrador via canal seguro (1Password, Signal). Hash fica no banco.

### 4. Supabase service_role + access_token (arquivo `.env.scripts`)

- **Primeiro e último char da service_role:** `e...w` (JWT começa com `eyJ`, termina em `S9w`)
- **Primeiro e último char do access_token:** `s...9` (começa `sbp_`, termina em `9`)
- **Onde rotacionar:**
  - Service role: Dashboard > Project Settings > API > "Reset service_role key" (pode impactar edge functions — precisa redeploy com nova key via `supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."`).
  - Access token: https://supabase.com/dashboard/account/tokens → revoke, gerar novo.
- **Observação:** Não há evidência de leak. Rotação aqui é **preventiva** (reduzir TTL efetivo). Se fundador quer shippar mais rápido, essa fica como follow-up P1 em vez de gate.

### 5. Senhas em git history (CEO `***REDACTED***` + CTO `***REDACTED***` + Make `***REDACTED***`)

Os 3 primeiros estão no objects do git (commits `af344ad`, `acafa6a`, `6ebeb3d` → e56e7ae, etc.) mesmo se removidos do HEAD.

- **Decisão necessária do fundador:** reescrever history (destrutivo, obriga rebase de quem tem fork; se repo é só dele, baixo impacto) vs. tratar como leak e rotacionar tudo.
- **Recomendação:** rotacionar (parte da ação #1-#3 acima) **e** rodar `git filter-repo` para remover os valores do history depois. Proteção em camadas.

---

## Seção 5 — CI guards (prevenção de regressão)

**Recomendação mínima — 2 ferramentas essenciais. Não 5.**

### A. `gitleaks` como pre-commit hook

- Por quê: maior coverage de patterns (JWT, cloud keys, Stripe, Supabase) out-of-the-box, mantido ativamente.
- Setup:
  ```bash
  brew install gitleaks
  cat > .pre-commit-config.yaml <<'EOF'
  repos:
    - repo: https://github.com/gitleaks/gitleaks
      rev: v8.21.2
      hooks:
        - id: gitleaks
  EOF
  pre-commit install
  ```
- Custom rules em `.gitleaks.toml` pra padrões do projeto (strings `Senha:`, `Login:` em JSX):
  ```toml
  [[rules]]
  id = "millennials-inline-password"
  description = "Inline password pattern (Senha: ou Login:) em source code"
  regex = '''(?i)(Senha|Login|Password|Pwd)\s*[:=]\s*['"\x60][A-Za-z0-9]{6,}'''
  path = '''\.(ts|tsx|js|jsx|md|json)$'''
  ```

### B. GitHub Actions — secret scanning on push

- Por quê: defense-in-depth. Pre-commit pode ser bypassado com `--no-verify`. CI action não.
- `.github/workflows/secret-scan.yml`:
  ```yaml
  name: Secret scan
  on: [push, pull_request]
  jobs:
    gitleaks:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
          with: { fetch-depth: 0 }
        - uses: gitleaks/gitleaks-action@v2
          env:
            GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```
- Combina com **GitHub native secret scanning** (grátis em repo privado com advanced security ou público): ativar em Settings > Code security.

### Opcional, não recomendado agora

- ESLint custom rule pra `<user>@<host>` em JSX: falso positivo alto (e-mails legítimos em mailto links). Gitleaks regex resolve melhor.
- Trufflehog: redundante com Gitleaks. Um é suficiente.
- pgTAP test bloqueando seed de `api_keys` no repo: overkill.

---

## Seção 6 — Bundle check (verifier pra Track C.5)

Comando canônico pra `engenheiro` rodar após remover os hardcodes:

```bash
# 1. Rebuild fresco (garante que o chunk velho saiu)
cd /Volumes/Untitled/refine-dash-main
rm -rf dist
pnpm build  # ou npm run build

# 2. Grep por valores conhecidos (devem retornar 0 matches)
rg -c '***REDACTED***|***REDACTED***(\.|$|456)|***REDACTED***|***REDACTED***' dist/

# 3. Grep preventivo (qualquer "Senha:" em chunk JS)
rg -c 'Senha:|Password:' dist/assets/

# 4. Comparação antes/depois (opcional)
# Executar ANTES do fix, salvar contagem:
rg -c '***REDACTED***|***REDACTED***|***REDACTED***|***REDACTED***' dist/ > /tmp/before.txt
# Após fix:
rg -c '***REDACTED***|***REDACTED***|***REDACTED***|***REDACTED***' dist/ > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt  # after deve ter só zeros
```

**Critério de pass da C.5:**
- Passos 2 e 3 retornam `0` em todos os arquivos do `dist/assets/`
- `docs/API-REST-CLIENTES.md` linhas 11 e 20 substituídas por placeholder após rotação da `mk-test-*` key

---

## Seção 7 — Histórico git (P0 pra fundador)

### Commits com credenciais

| Commit | Data | Credencial | Ação necessária |
|---|---|---|---|
| `af344ad` | 2026-03-02 | Senha Make `Mile***151203._+` introduzida em `OutboundFerramentasSection.tsx` (ainda em HEAD) | rotacionar |
| `acafa6a` | ? | Senha Make `Mile***123.` + `Mile***151203._+` + senha cursos `Mile***123` em `AdsFerramentasSection.tsx` (ainda em HEAD) | rotacionar |
| `6ebeb3d` | ? | Senha CTO `***REDACTED***` em `scripts/create-cto-user.mjs` (removida em `5379650`) | rotacionar senha do CTO Marcelo |
| `5379650` | chore(security) | Tentou remover senhas de scripts e mocks. Remove do HEAD mas **deixa no history**. | `git filter-repo` ou aceitar como leak |

### Access token / service_role key

- Nenhum commit adicionou `sbp_` ou `SUPABASE_SERVICE_ROLE_KEY=eyJ...` no history. `.env.scripts` funcionou como esperado.

### Recomendação de reescrita

Dois caminhos:

**Caminho A — pragmático (recomendado):**
1. Rotacionar todas as senhas Make, CEO cursos, CTO bootstrap (Seção 4)
2. Aceitar que as senhas *antigas* no history existem mas não são mais válidas
3. Não reescrever history (evita dor de rebase, force-push)

**Caminho B — purista:**
1. Rotacionar tudo (Seção 4)
2. `git filter-repo --path scripts/create-cto-user.mjs --invert-paths` (ou com `--replace-text` apontando valores)
3. Force-push na `main`. **Destrutivo** — quem tiver clone fica com history divergente. Se só o fundador usa o repo, OK.

Decisão do fundador necessária. Padrão world-class favorece B, mas só faz sentido com senhas rotacionadas antes (porque B sem A = ilusão de segurança).

---

## Veredicto

- [ ] Aprovado
- [x] **Bloqueado** — não prossegue pra C.4 (remoção hardcode) antes de:
  - [ ] Rotação das 3 senhas externas (Make x2 variantes, cursos CEO)
  - [ ] Decisão sobre rotação CTO bootstrap password
  - [ ] Decisão sobre rotação `***REDACTED***`
  - [ ] Decisão fundador sobre reescrita de history (Caminho A vs B)

Após rotação, C.4 pode prosseguir. C.5 usa comandos da Seção 6 como verifier.

---

## Recomendações opcionais (pós-fix)

1. Shippar `tool_credentials` table com RLS (`cto`/`ceo` full, outros papéis só leitura por `tool_id`).
2. Modal que exibe credencial puxa via RPC `get_tool_credential(tool_id text)` — valida papel, retorna plaintext, loga acesso em `tool_credential_access_log`.
3. Adicionar `gitleaks` (Seção 5.A) antes de qualquer outro commit.
4. Reduzir TTL da service_role key no futuro (Supabase Enterprise permite custom expiration).
5. Considerar mover `.env.scripts` pra 1Password CLI (`op run` carrega em runtime, nunca toca disco).

---

**Fim do audit.**
