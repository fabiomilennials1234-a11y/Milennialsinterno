---
title: Kanban Design
tags:
  - feature
  - kanban
  - design
---

# Kanban Design

> [!abstract] Onde as demandas de design viram cards
> Swim lane por designer. Status: `a_fazer → fazendo → arrumar → para_aprovacao → aprovado`. Ao atingir `para_aprovacao`, o criador do briefing recebe notificação.

Componente: `src/components/design/DesignKanbanBoard.tsx`.

## Colunas

Dinâmicas por designer. `BY {NOME}` + `JUSTIFICATIVA ({NOME})`.

## Status do card

- `a_fazer` / `fazendo` / `arrumar` / `para_aprovacao` / `aprovado`

## Quem pode mover

`ceo`, `cto`, `gestor_projetos`, `gestor_ads`, `design`, `sucesso_cliente`.

## Criação (CreateDesignCardModal)

Briefing rico — armazenado em `design_briefings`:
- `references_url` — referências visuais
- `identity_url` — guia de identidade
- `client_instagram` — perfil do cliente
- `script_url` — se há roteiro associado

## Notificação de completion

Ao mover para `para_aprovacao`:
- Insere em `design_completion_notifications`
- `requester_id` = criador do briefing
- Notifica no NotificationCenter

Hook: `src/hooks/useDesignCompletionNotifications.ts:65`.

## Sem anexos

Design usa links (Drive, Figma) em vez de upload direto. Mantém repo leve e centraliza em ferramentas específicas.

## Integrado com Devs

Designers têm acesso ao [[03-Features/Kanban Devs]] (assets para devs).

## Links

- [[03-Features/Kanbans por Área]]
- [[03-Features/Notification Center]]
