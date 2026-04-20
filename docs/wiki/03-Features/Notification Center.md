---
title: Notification Center
tags:
  - feature
  - notificacoes
---

# Notification Center

> [!abstract] Um sino, muitas fontes
> Um único componente (`NotificationCenter`) agrega notificações de **9 fontes diferentes** em uma timeline unificada. O usuário nunca vê que são tabelas diferentes — só vê um feed.

Componente: `src/components/NotificationCenter.tsx`. Hook central: `src/hooks/useNotificationCenter.ts`.

## Fontes agregadas

| Origem | Tabela | Quando surge |
|---|---|---|
| Design completion | `design_completion_notifications` | card movido para `para_aprovacao` no [[03-Features/Kanban Design]] |
| Devs completion | `dev_completion_notifications` | card para `aguardando_aprovacao` em [[03-Features/Kanban Devs]] |
| Video completion | `video_completion_notifications` | idem em [[03-Features/Kanban Video]] |
| Atrizes completion | `atrizes_completion_notifications` | idem em [[03-Features/Kanban Atrizes]] |
| Produtora completion | `produtora_completion_notifications` | em [[03-Features/Kanban Produtora]] |
| Onboarding | `system_notifications` (type='onboarding') | cliente termina onboarding (marco 6) |
| Nova atribuição de cliente | `ads_new_client_notifications` | cliente atribuído a gestor de ads |
| Notas em tasks | `ads_note_notifications` | comentário/nota em `ads_tasks` |
| Churn | `churn_notifications` | cliente em risco detectado |
| Sistema (crons) | `system_notifications` (type=*) | [[02-Fluxos/Notificações Agendadas]] |
| Task delays | `task_delay_notifications` | task overdue detectada por cron |

## Tipo unificado (`UnifiedNotification`)

```ts
interface UnifiedNotification {
  id: string
  type: 'design' | 'video' | 'devs' | 'atrizes' | 'produtora'
      | 'new_client' | 'note' | 'churn' | 'system'
  title: string
  description: string
  read: boolean
  created_at: string
  icon: LucideIcon
  color: string
}
```

Cada fonte tem um adapter que converte suas rows para `UnifiedNotification`.

## UI

- **Bell icon no header**, com badge de contagem de não lidas
- **Dropdown popover** lista notificações mais recentes
- **Click em notificação**:
  - Marca como lida (UPDATE na tabela original, setando `read=true, read_at=now()`)
  - Navega para contexto (card, cliente, task)

## Mark as read

```ts
markAsRead(id: string, type: UnifiedNotificationType)
```

O hook identifica a tabela pelo `type` e faz o UPDATE na correta.

## Polling (não realtime)

Cada query de fonte usa `refetchInterval: 10000` (10s). 9 tabelas × 10s → 54 queries/minuto em idle. Aceitável para o volume atual.

Considerar migrar para realtime se a carga crescer — as tabelas de completion são candidatas naturais.

## Grooming

Notificações antigas ficam na tabela indefinidamente. Considerar:
- Índice em `(user_id, read, created_at DESC)` para performance
- Job de housekeeping para deletar reads > 90 dias

## Links

- [[02-Fluxos/Notificações Agendadas]]
- [[03-Features/Kanbans por Área]]
- [[00-Arquitetura/Realtime e Polling]]
