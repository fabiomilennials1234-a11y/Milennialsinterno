---
title: Kanban Video
tags:
  - feature
  - kanban
  - video
---

# Kanban Video

> [!abstract] Edição de vídeo em pipeline
> Swim lane por editor de vídeo. Status: `a_fazer → fazendo → alteracao → aguardando_aprovacao → aprovados`.

Componente: `src/components/video/VideoKanbanBoard.tsx`.

## Colunas

Dinâmicas por `editor_video`. `BY {NOME}` + `JUSTIFICATIVA ({NOME})`.

## Criação (CreateVideoCardModal)

Briefing em `video_briefings` — campos similares a design (referências, identidade, script).

## Notificação

Ao mover para `aguardando_aprovacao`:
- Insere em `video_completion_notifications`
- Requester recebe no NotificationCenter

Hook: `src/hooks/useVideoCompletionNotifications.ts`.

## Quem pode mover

`ceo`, `cto`, `gestor_projetos`, `gestor_ads`, `editor_video`, `sucesso_cliente`.

## Links

- [[03-Features/Kanbans por Área]]
- [[03-Features/Notification Center]]
