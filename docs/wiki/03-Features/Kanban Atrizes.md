---
title: Kanban Atrizes
tags:
  - feature
  - kanban
  - atrizes
---

# Kanban Atrizes

> [!abstract] Pool de gravação
> Swim lane por atriz de gravação. Fluxo similar aos outros kanbans de área, com briefing específico: Instagram do cliente, script, Drive de upload.

Componente: `src/components/atrizes/AtrizesKanbanBoard.tsx`.

## Colunas

Dinâmicas por `atrizes_gravacao`. `BY {NOME}` + `JUSTIFICATIVA ({NOME})`.

## Status

Enum `ATRIZES_STATUSES`: `a_fazer → fazendo → alteracao → aguardando_aprovacao → aprovados`.

## Criação (CreateAtrizesCardModal)

Briefing em `atrizes_briefings`:
- `client_instagram` — para referência de tom
- `script_url` — roteiro
- `drive_upload_url` — onde a atriz sobe o vídeo gravado

## Notificações

Completion notifications em `atrizes_completion_notifications`. Hook: `src/hooks/useAtrizesCompletionNotifications.ts:62`.

## Quem pode mover

`ceo`, `cto`, `gestor_projetos`, `gestor_ads`, `atrizes_gravacao`, `sucesso_cliente`.

## Links

- [[03-Features/Kanbans por Área]]
- [[03-Features/Notification Center]]
