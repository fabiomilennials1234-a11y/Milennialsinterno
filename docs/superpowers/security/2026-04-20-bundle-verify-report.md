# Bundle Verify Report — 2026-04-20

**Wave 1 Track C.5** — Verificacao de que o bundle `dist/` produzido pelo HEAD atual nao contem credenciais que foram removidas em Track C.4.

**Executor:** agente `seguranca` (Claude Opus 4.7) sob invocacao direta do fundador.
**Escopo:** `npm run build` -> `dist/` -> scan contra lista de 10 literais purgados em Track C.3 + checks genericos de secret + verificacao de ausencia de service_role JWT.

---

## TL;DR

- **Build prod OK** (23.69s, sem erro, 0 warnings criticos)
- **10/10 strings de credencial conhecidas: 0 matches em `dist/`** (APROVADO)
- **Service role JWT no bundle: 0** (APROVADO)
- **Anon key JWT no bundle: 3** (ESPERADO — anon key e publica)
- **Nenhum literal `Senha:"..."`/`Password:"..."` em JS minificado**
- **CI guard criado:** `.github/workflows/secret-scan.yml` + `.gitleaks.toml` com regras customizadas do projeto

**Veredicto:** APROVADO. Bundle limpo. Credenciais fora do frontend.

---

## Secao 1 — Build

### Comando
```bash
rm -rf dist/
npm run build
```

### Resultado
- Exit code: 0
- Duracao: 23.69s
- Artefatos: `dist/assets/` com chunks code-split conforme arquitetura atual
- Chunk de maior tamanho: `charts-DYvjy-fS.js` (422.93 KB / 112.43 KB gzip) — esperado
- Sem erros de TypeScript/Vite

---

## Secao 2 — Scanner de strings conhecidas

Metodologia: Python script escrito inline com lista dos 10 literais purgados em Track C.3 (ver `docs/superpowers/security/2026-04-20-git-history-purge-report.md` Secao 1). Valores comparados byte-a-byte contra todos os arquivos sob `dist/`. **Valores nunca foram logados em stdout** — script so imprime versao redacted (`primeiro_char***ultimo_char`) + contagem.

### Resultados

| Cred ID (redacted) | Descricao | Matches | Status |
|---|---|---:|:---:|
| `M***6` | senha CTO bootstrap | 0 | OK |
| `M***3` | senha cursos (prefix) | 0 | OK |
| `m***6` | API key seed (`mk-test-*`) | 0 | OK |
| `l***l` | email local-part Make | 0 | OK |
| `f***4` | email local-part cursos | 0 | OK |
| `M***3` | senha Make prefix bare | 0 | OK |
| `M***+` | senha Make atual (completa com sufixo) | 0 | OK |
| `M***.` | senha Make antiga (completa) | 0 | OK |
| `l***m` | email Make completo | 0 | OK |
| `f***m` | email cursos completo | 0 | OK |

**Total:** 10/10 strings com 0 matches. Nenhuma credencial conhecida presente em `dist/`.

---

## Secao 3 — Verificacao JWT

Scan diferencial entre anon key (publica, esperada no bundle) e service_role (CRITICA, nunca pode aparecer).

### Metodo
- Regex `eyJ...\.eyJ...\.(.+)` localiza todo JWT no bundle
- Payload (parte 2) decodificado base64url -> JSON
- Verificacao do claim `role`:
  - `"anon"` -> benigno (anon key)
  - `"service_role"` -> **CRITICO**

### Resultado
```
service_role JWTs found: 0   (expected: 0)   APPROVED
anon JWTs found:         3   (expected: >=1, public) APPROVED
```

Os 3 hits de anon key correspondem a fallbacks/clientes multiplos — benigno, anon key e projetada pra ser publica e opera sob RLS.

---

## Secao 4 — Scanner generico

Contagens de palavras-chave (case-insensitive):

| Padrao | Count dist/ | Interpretacao |
|---|---:|---|
| `password` | 95 | Nomes de variaveis/props em forms de login (esperado) |
| `senha` | 12 | Strings UI em PT-BR (labels de form) |
| `api_key` | 0 | Sem referencia a var com esse nome em minified |
| `api-key` | 0 | Idem |
| `apikey` | 15 | Header names / var names (benigno) |
| `bearer` | 14 | `Authorization: Bearer ${token}` templates (benigno) |

### Analise granular — literais de valor

Regex adicional pra detectar padrao `senha:"<valor>"` / `password:"<valor>"` / `pwd:"<valor>"` com capture group no valor literal:

```
Resultado: NO literal password/senha patterns found in dist/ JS
```

Zero ocorrencias de string literal sendo atribuida a campo `senha`/`password`/`pwd`. Bundle limpo.

---

## Secao 5 — CI guards criados

### `.github/workflows/secret-scan.yml`

Criado em `/Volumes/Untitled/refine-dash-main/.github/workflows/secret-scan.yml`. Roda `gitleaks/gitleaks-action@v2` em:
- Todo `push` em `main` e branches `feat/**`
- Todo `pull_request` contra `main`

Usa `GITHUB_TOKEN` default, nao requer license pra repo publico. Se repo for privado e quiser features premium do gitleaks, adicionar `GITLEAKS_LICENSE` em repo secrets.

### `.gitleaks.toml`

Criado em `/Volumes/Untitled/refine-dash-main/.gitleaks.toml`. Rules customizadas baseadas no leak real auditado em Track C:

| Rule ID | Cobre |
|---|---|
| `millennials-inline-password` | `Senha:"..."` / `Password:"..."` em qualquer source |
| `senha-milennials-prefix` | Literal `Milennials<digitos>` (padrao historico) |
| `api-key-mk-test` | `mk-test-api-key-*` |
| `supabase-service-role-literal` | JWT com claim `service_role` |
| `supabase-access-token` | `sbp_...` (Supabase PAT) |

Default rules do gitleaks tambem ligadas (`useDefault = true`) — cobrem AWS/GCP/Stripe/GitHub tokens/etc.

### Allowlist

Docs de auditoria (`docs/superpowers/security/*.md`, `docs/superpowers/plans/*.md`) e o proprio `.gitleaks.toml` sao permitidos — contem referencias redacted/exemplos que regex pegaria como falso positivo.

Stopwords: `REDACTED`, `***REDACTED***`, `placeholder`, `example`, `YOUR_API_KEY_HERE`.

---

## Secao 6 — Recomendacao pre-commit local

Nao instalado automaticamente (decisao do dev individual), mas recomendado:

```bash
brew install gitleaks

# ~/.git-hooks/pre-commit (ou .git/hooks/pre-commit):
#!/usr/bin/env bash
gitleaks protect --staged --verbose --config .gitleaks.toml || exit 1
```

Ou via `pre-commit` framework:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
```

Bypass intencional (`git commit --no-verify`) continua possivel. CI guard (Secao 5) e a rede de seguranca.

---

## Secao 7 — Riscos residuais

1. **Bundle de producao no CDN antigo.** Se Vercel deployou chunk com credencial antes do Track C.4, usuario que carregou naquela janela tem JS cacheado localmente. **Mitigacao:** rotacao (Track C.4 ja realizou) invalida as credenciais — mesmo que atacante extraia do cache, login falha.

2. **Source maps em producao.** Se `vite.config.ts` estiver com `build.sourcemap: true`, sources originais vazam via `.map`. Nao verificado neste track — recomendacao pra futuro: scan `dist/**/*.map` tambem.

3. **Dev mode.** `npm run dev` serve source sem minificacao — em DevTools, strings aparecem. Aceitavel: dev e localhost-only.

4. **Novos hardcodes introduzidos pos-Track C.** CI guard (Secao 5) cobre prevencao. Se desenvolvedor usar `--no-verify` ou atalho, pode passar. GitHub native secret scanning (Settings > Code security) e camada adicional gratis.

---

## Secao 8 — Checks nao executados (justificados)

- **Scan de source maps (`*.map`)**: maps nao sao gerados por default no build atual (verificado: `ls dist/assets/*.map` retorna vazio). Se flag for ligada no futuro, adicionar scan.
- **Dev mode curl**: a restricao do audit e que `dev` tem source visivel por design; bundle prod minificado e o deliverable. Checar dev daria ruido, nao sinal.
- **Scan recursivo de node_modules**: fora de escopo — deps nao contem secrets do projeto.

---

## Veredicto

- [x] **APROVADO**

Bundle HEAD atual (post-Track C.4) passa verificacao de ausencia de credenciais conhecidas. Service role key ausente. Anon key presente como esperado. CI guard (`gitleaks-action` + `.gitleaks.toml` custom) configurado pra prevenir regressao.

### Follow-ups (nao bloqueantes)

- [ ] Ativar GitHub native secret scanning em Settings > Code security (gratis em repos publicos + Advanced Security em privados)
- [ ] Dev instalar `gitleaks` localmente + wire pre-commit hook
- [ ] Em proximo release, validar que `vite.config.ts` nao liga source maps em prod
- [ ] Adicionar scan de `.map` no CI se source maps forem habilitadas

---

**Fim do relatorio.**
