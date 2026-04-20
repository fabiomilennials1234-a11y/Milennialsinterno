---
title: Kanban Produtora
tags:
  - feature
  - kanban
  - produtora
---

# Kanban Produtora

> [!abstract] Produção audiovisual externa
> Swim lane por usuário de produtora. Padrão similar aos outros — inclusive notificação de completion.

Componente: `src/components/produtora/ProdutoraKanbanBoard.tsx`.

## Colunas

Dinâmicas por `produtora`. `BY {NOME}`.

## Criação (CreateProdutoraCardModal)

Briefing em `produtora_briefings`.

## Completion

Ao mover para `gravado` (status final deste board):
- INSERT `produtora_completion_notifications`
- Requester notificado

Hook: `src/hooks/useProdutoraCompletionNotifications.ts`.

## Links

- [[03-Features/Kanbans por Área]]
- [[03-Features/Notification Center]]
