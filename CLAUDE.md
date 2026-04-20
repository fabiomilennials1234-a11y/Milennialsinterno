# CLAUDE.md — Instruções do projeto

## Regra número zero: tudo passa pelos agentes

**Toda ação de trabalho neste projeto passa pelo harness de agentes em `.claude/agents/`.** Sem exceção. Sem atalho. Sem "é rapidinho".

Isso vale pra:

- Planejar feature → `conselheiro` → `orquestrador` monta o DAG
- Desenhar arquitetura → `arquiteto`
- Qualquer superfície visual → `frontend-design` (invoca `hm-design`)
- Qualquer código TS/React/Deno → `engenheiro`
- Qualquer coisa de DB (schema, RLS, migration, RPC, query) → `db-specialist`
- Antes de declarar "pronto" → `qa` (invoca `hm-qa`) **sempre**
- Qualquer toque em auth/dados/exposição externa → `seguranca`

**Orquestrador é o ponto de entrada quando o trabalho toca >1 disciplina.** Ele decide quem entra, em que ordem, e sintetiza tudo.

## O que NÃO precisa passar pelos agentes

Apenas três classes:

1. **Pergunta factual sem ação** ("o que faz a função is_ceo?")
2. **Leitura de documentação/código sem mudança** (explorar, responder, referenciar)
3. **Trivialidade mecânica pura** (corrigir um typo que o usuário apontou com arquivo:linha)

Qualquer coisa **além** dessas três — agente. Se estiver em dúvida se é trivial ou não, é porque não é — chame o agente.

## Quando o usuário pede "só faz X direto"

Explique que neste projeto tudo passa pelos agentes, e invoque o agente correto assim mesmo. A barra é world-class e o harness é o que garante isso.

A única exceção é se o usuário disser explicitamente "pule o harness, faça direto" — nesse caso, proceda e documente que foi decisão explícita do fundador.

## Elenco

Ver `.claude/agents/README.md` para o mapa completo. Resumo:

| Agente | Quando |
|---|---|
| `conselheiro` | Sempre antes de feature não-trivial — sanity-check estratégico |
| `orquestrador` | Quando o trabalho toca >1 disciplina |
| `arquiteto` | Design de módulo/feature novo, mudança estrutural |
| `frontend-design` | Qualquer UI — roda `hm-design` obrigatoriamente |
| `engenheiro` | Implementação de código |
| `db-specialist` | Schema, RLS, migrations, RPCs, queries |
| `qa` | Antes de declarar "done" — roda `hm-qa` obrigatoriamente |
| `seguranca` | Auth, dados sensíveis, exposição externa |

## Princípio comum

**Inteligência é obrigatória.** Cada agente tem seção explícita sobre isso. Não é cerimonial — é o que separa world-class de mediano.

## Gates antes de merge

- [ ] Conselheiro consultado (se feature não-trivial)
- [ ] Arquiteto assinou (se multi-módulo)
- [ ] db-specialist validou (se tocou DB)
- [ ] frontend-design rodou `hm-design` (se tocou UI)
- [ ] Engenheiro entregou com arquivos:linhas
- [ ] QA rodou `hm-qa` e aprovou
- [ ] Segurança aprovou (se tocou auth/dados)

Pular gate é dívida técnica explícita. Documente por quê.

## Wiki

Contexto do sistema vive em `docs/wiki/`. Entrada: `docs/wiki/README.md`. Todo agente deve ler o que é relevante antes de opinar.
