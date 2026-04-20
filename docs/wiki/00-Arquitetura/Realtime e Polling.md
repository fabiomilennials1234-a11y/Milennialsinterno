---
title: Realtime e Polling
tags:
  - arquitetura
  - realtime
---

# Realtime e Polling

> [!abstract] Decisão
> **Realtime** do Postgres é caro em conexões WebSocket e em carga de replicação. Ele só é usado onde a UX **exige** sub-segundo (Mtech — quando dois devs colaboram em uma task, um clica "start timer", o outro precisa ver). Todo o resto usa **polling via React Query** (5-10s `refetchInterval`).

## O que está no publication

Adicionados via `supabase/migrations/20260415120700_tech_realtime.sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  tech_tasks,
  tech_sprints,
  tech_time_entries,
  tech_task_activities;
```

Nada mais. Se você precisar adicionar, considere primeiro: **o custo compensa?**

## Padrões no código

### Realtime — Mtech

Hooks dedicados em `src/features/milennials-tech/hooks/`:

```ts
supabase
  .channel(`tech-tasks-${taskId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_tasks', filter: `id=eq.${taskId}` }, handler)
  .subscribe()
```

- `useTechRealtime.ts` — task updates
- `useTechTimer.ts` — time entries em tempo real
- `useActiveTimer.ts` — timer global do usuário

> [!warning] RLS também vale para realtime
> O cliente só recebe eventos das linhas que teria acesso via SELECT. Subscribe sem JWT → silêncio. Subscribe com papel restrito → só eventos filtrados. Isso é bom (segurança), mas é comum confundir "não recebi evento" com "bug de realtime" quando na real é RLS bloqueando.

### Polling — tudo mais

Padrão via React Query:

```ts
useQuery({
  queryKey: ['dev-completion-notifications', userId],
  queryFn: fetchFn,
  refetchInterval: 10000,  // 10s
})
```

Aplicado em:

- Todas as `*_completion_notifications`
- `system_notifications`
- `churn_notifications`
- `ads_tasks` no AdsManagerPage
- Kanban boards por área (invalidate on mutation, refetch on interval)

### Invalidação por mutação

Quando mutação local precisa refletir imediatamente no cache (sem esperar polling):

```ts
useMutation({
  mutationFn: ...,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ads-tasks', 'daily', effectiveUserId] })
  }
})
```

## Quando subir algo para realtime

> [!question] Checklist
> - A ação é **colaborativa** (duas ou mais pessoas mexendo na mesma entidade simultaneamente)?
> - A latência de 5-10s do polling **causa bug funcional** (não só cosmético)?
> - O volume de eventos é previsível (não vai inundar os clientes)?
>
> Se as três respostas forem "sim", considere. Senão, fique no polling.

## Falhas conhecidas de realtime

- **WebSocket corta em redes corporativas** com proxies agressivos. O hook deve ter fallback para polling.
- **Reconexão não é automática no Supabase JS em todas as versões** — conferir docs antes de assumir que `onReconnect` existe.
- **Eventos podem vir fora de ordem** — o campo `seq` em `tech_time_entries` existe para isso; use `ORDER BY seq DESC` nos hooks.

## Links

- [[00-Arquitetura/Supabase e RLS]]
- [[03-Features/Mtech — Milennials Tech]]
- [[03-Features/Notification Center]]
