# CLAUDE.md — Instruções do projeto

## Regra número zero: tudo passa pelo arquiteto

**Toda ação de trabalho não-trivial neste projeto entra pelo `arquiteto`** (em `.claude/agents/arquiteto.md`). Sem exceção. Sem atalho. Sem "é rapidinho".

O arquiteto faz sanity-check estratégico, desenha arquitetura quando aplicável, e invoca os outros agents (`design` ou `engenheiro`) diretamente. O Claude principal **não invoca** `design` nem `engenheiro` por conta própria — sempre via arquiteto.

## Harness — 3 agents

| Agente | Cobertura | Skill obrigatória |
|---|---|---|
| `arquiteto` | Gateway: sanity-check + arquitetura + roteamento | — |
| `design` | UI/UX, frontend visual, interação | `hm-design` |
| `engenheiro` | Código TS/React/Deno + DB schema/RLS/RPC/migrations + Testes (vitest/playwright/pgTAP) + Segurança (auth/dados/exposição) + QA | `hm-qa`, `hm-engineer`, `supabase-postgres-best-practices` quando aplicável |

`engenheiro` cobre 4 disciplinas em **seções nomeadas** (Implementação / DB / Testes / Segurança). Ativa cada seção conforme o pedido — bug de 1 linha não roda pgTAP; tabela nova exige tudo.

## O que NÃO precisa passar pelo harness

Apenas três classes:

1. **Pergunta factual sem ação** ("o que faz `is_ceo()`?")
2. **Leitura de documentação/código sem mudança**
3. **Trivialidade mecânica pura** (typo apontado pelo usuário com arquivo:linha)

Qualquer coisa **além** dessas três — arquiteto. Em dúvida se é trivial ou não, é porque não é — chame o arquiteto.

## Quando o usuário pede "só faz X direto"

Explique que neste projeto tudo passa pelo arquiteto, e invoque o arquiteto. A barra é world-class — o harness garante.

Exceção única: usuário disser literalmente "pule o harness, faça direto". Nesse caso, proceda e documente que foi decisão explícita do fundador.

## Fluxo

```
pedido → arquiteto
            ↓
       Fase 0: sanity-check (sempre)
            ↓
       Fase 1: arquitetura (quando aplica)
            ↓
       Fase 2: invoca design e/ou engenheiro
            ↓
       arquiteto sintetiza → entrega ao fundador
```

Detalhes em `.claude/agents/README.md`.

## Princípio comum

**Inteligência é obrigatória.** Cada agente tem seção explícita sobre isso. Não é cerimonial — é o que separa world-class de mediano.

## Gates antes de merge

- [ ] Arquiteto: sanity-check aprovado (sempre); arquitetura assinada (se aplicável)
- [ ] Design: rodou `hm-design` (se tocou UI)
- [ ] Engenheiro: typecheck/lint clean, testes passando, hm-qa rodada, segurança auditada (se tocou auth/dados)

Pular gate é dívida técnica explícita. Documente por quê.

## Wiki

Contexto do sistema vive em `docs/wiki/`. Entrada: `docs/wiki/README.md`. Todo agente deve ler o que é relevante antes de opinar.
