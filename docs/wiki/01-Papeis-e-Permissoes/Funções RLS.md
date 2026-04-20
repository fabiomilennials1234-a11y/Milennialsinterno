---
title: Funções RLS
tags:
  - permissoes
  - rls
  - referencia
---

# Funções RLS

> [!abstract] Catálogo
> Toda função `SECURITY DEFINER` usada em policies e RPCs. Assinatura, propósito, migration de origem, e exemplo de uso. Quando escrever policy nova, **chame daqui** — não duplique lógica.

## Funções de papel

### `is_ceo(_user_id uuid) → boolean`

Retorna `true` se o usuário tem role `ceo` **ou** `cto`. É o gate mais usado no sistema (14+ policies e várias edge functions).

Migration atual: `20260416130000_is_ceo_includes_cto.sql`.
Original: `20260110183415` (depois foi redefinido pela fix do CTO).

```sql
SELECT public.is_ceo(auth.uid());
```

> [!warning] Nome semântico desalinhado
> A função se chama `is_ceo` mas inclui CTO. Mantemos o nome por backward-compat (reescrever 14 policies era risco demais). Em código novo, prefira `is_executive()`.

Ver [[01-Papeis-e-Permissoes/Hierarquia Executiva]].

### `is_executive(_user_id uuid) → boolean`

Sinônimo moderno de `is_ceo()`. Mesma lógica: `role IN ('ceo', 'cto')`.

Migration: `20260415120001_add_cto_role_functions.sql`.

### `is_admin(_user_id uuid) → boolean`

Retorna `true` se o usuário é executivo **ou** gestor de projetos.

```sql
-- role IN ('ceo', 'cto', 'gestor_projetos')
SELECT public.is_admin(auth.uid());
```

Usado para operações de "quem administra a plataforma mas não necessariamente lida com usuários" (criar tab, mover cards livremente, gerenciar boards).

### `has_role(_user_id uuid, _role user_role) → boolean`

Check genérico de papel. Mais raramente usado — quase sempre preferimos uma helper semântica (`is_ceo`, `is_admin`, etc.).

```sql
SELECT public.has_role(auth.uid(), 'gestor_ads');
```

Migration: `20260110183415`.

## Funções de visibilidade

### `can_view_user(_viewer_id uuid, _target_user_id uuid) → boolean`

Decide se o viewer pode ver o profile do target. Lógica:

```
executivo → sempre true
gestor_projetos → sempre true
viewer == target → true (self)
viewer e target no mesmo grupo → true
viewer e target no mesmo squad → true
caso contrário → false
```

Migration: `20260110191514`.

Usada em `profiles` SELECT policy — por isso "listas de usuários" variam por papel.

### `can_view_board(_user_id uuid, _board_id uuid) → boolean`

Decide se o usuário vê um kanban board específico.

```
executivo → sempre true
gestor_projetos → sempre true
caso contrário → match em squad_id, group_id ou category_id do board vs. do usuário
```

Migration: `20260415100000`.

### `can_see_tech(_user_id uuid) → boolean`

Gate do [[03-Features/Mtech — Milennials Tech|Mtech]]. Role-based OR flag-based.

```
role IN (ceo, cto, devs) → true
profiles.can_access_mtech = true → true
caso contrário → false
```

Migration: `20260417150000`.

Ver [[01-Papeis-e-Permissoes/Flag can_access_mtech]].

## Funções do módulo Mtech

### `tech_can_edit_task(_task_id uuid) → boolean`

Retorna `true` se o chamador pode editar aquela task:

```
is_executive() → true
task.assignee_id = auth.uid() → true
auth.uid() ∈ tech_task_collaborators(task_id) → true
caso contrário → false
```

Migration: `20260415120600_tech_rpcs.sql:6-16`.

### `tech_timer_is_active(_task_id uuid, _user_id uuid) → boolean`

Checa se existe timer ativo para `(task, user)`. "Ativo" = última entry é `START` ou `RESUME`.

Migration: `20260415120600:20-35`.

## RPCs (mutations)

Todas `SECURITY DEFINER`, todas começam validando `auth.uid()` e papel/permissão.

### Gestão de usuário

| RPC | O que faz | Quem chama |
|---|---|---|
| `set_mtech_access(_user_id, _value)` | Toggle do flag `can_access_mtech` | Admin (ceo/cto/gp/sucesso) |
| `force_delete_user_cleanup(_target)` | Limpeza atômica pre-delete | Edge function `delete-user` |

### Módulo Mtech (supabase/migrations/20260415120600_tech_rpcs.sql)

| RPC | Propósito | Permissão |
|---|---|---|
| `tech_start_timer(_task_id)` | Inicia timer. Pausa outros timers ativos do usuário. Move task para IN_PROGRESS se estiver em TODO. | `tech_can_edit_task` |
| `tech_pause_timer(_task_id)` | Pausa timer ativo | `tech_can_edit_task` |
| `tech_resume_timer(_task_id)` | Resume. Pausa outros ativos. | `tech_can_edit_task` |
| `tech_stop_timer(_task_id)` | Para timer | `tech_can_edit_task` |
| `tech_send_to_review(_task_id)` | IN_PROGRESS → REVIEW. Stopa timer. | `tech_can_edit_task` |
| `tech_approve_task(_task_id)` | REVIEW → DONE | `is_executive()` |
| `tech_reject_task(_task_id)` | REVIEW → IN_PROGRESS | `is_executive()` |
| `tech_block_task(_task_id, _reason)` | Marca `is_blocked`, `blocker_reason` | `tech_can_edit_task` |
| `tech_unblock_task(_task_id)` | Limpa block | `tech_can_edit_task` |
| `tech_start_sprint(_sprint_id)` | PLANNING → ACTIVE. Enforce 1 ACTIVE por vez (unique index). | `is_executive()` |
| `tech_end_sprint(_sprint_id)` | ACTIVE → CLOSED. Move non-DONE tasks para BACKLOG. | `is_executive()` |
| `tech_submit_task(...)` | INSERT em `tech_tasks` via `/submit-task` | Qualquer autenticado |
| `tech_comment_task(_task_id, _content)` | INSERT em activity log como comentário | `tech_can_edit_task` |
| `tech_get_time_totals(_task_id, _user_id)` | Soma tempo por user/task | Qualquer com SELECT na task |

## RPCs de notificações agendadas

Invocadas pelo cron `check-scheduled-notifications` (edge function). Cada uma cria rows em `system_notifications`, `task_delay_notifications`, ou `ads_note_notifications` conforme a regra de negócio:

- `check_expiring_contracts()` — contratos prestes a vencer
- `check_stalled_cards()` — cards sem movimento
- `check_clients_without_contact()` — clientes sem contato recente
- `check_okr_deadlines()` — OKRs próximos do deadline
- `check_pending_ads_documentation()` — gestor de ads com doc diária atrasada
- `check_pending_comercial_documentation()` — consultor comercial idem
- `check_stalled_onboarding()` — onboarding parado
- `check_pending_approvals()` — cards em para_aprovacao há tempo demais
- `check_contract_no_renewal_plan()` — contrato sem plano de renovação
- `check_comercial_consultoria_stalled()` — consultoria comercial parada
- `check_onboarding_tasks_stuck()` — tasks de onboarding travadas
- `check_ads_client_stalled_14d()` — cliente ads sem movimento há 14 dias
- `check_department_tasks_stalled()` — tasks de departamento atrasadas
- `check_contract_expired_alert()` — contrato vencido
- `check_ads_client_no_movement_7d()` — cliente ads sem movimento há 7 dias
- `check_user_inactive()` — usuário inativo
- `generate_monthly_receivables()` — gera contas a receber do mês

Ver [[02-Fluxos/Notificações Agendadas]].

## Triggers importantes

| Trigger | Tabela | Quando | O que faz |
|---|---|---|---|
| `trg_profiles_guard_mtech_access` | `profiles` | BEFORE UPDATE | Bloqueia mudança em `can_access_mtech` por não-admin |
| `tech_tasks_created_by_immutable` | `tech_tasks` | BEFORE UPDATE | Raise se `created_by` mudar |
| `ensure_*_on_insert` | kanban_cards, tech_tasks | AFTER INSERT | Log em activities |
| `moddatetime` | várias | BEFORE UPDATE | Atualiza `updated_at` |

## Padrão para RPC nova

> [!example] Template
> ```sql
> CREATE OR REPLACE FUNCTION public.my_new_rpc(_arg uuid)
> RETURNS void
> LANGUAGE plpgsql
> SECURITY DEFINER
> SET search_path = public
> AS $$
> DECLARE
>   v_caller uuid := auth.uid();
> BEGIN
>   IF v_caller IS NULL THEN
>     RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
>   END IF;
>
>   IF NOT public.is_admin(v_caller) THEN
>     RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
>   END IF;
>
>   -- ... lógica ...
> END
> $$;
>
> REVOKE ALL ON FUNCTION public.my_new_rpc(uuid) FROM PUBLIC;
> GRANT EXECUTE ON FUNCTION public.my_new_rpc(uuid) TO authenticated;
> ```

Regra de ouro: **sempre `REVOKE FROM PUBLIC`, depois `GRANT EXECUTE TO authenticated`**. Caso contrário, anon pode chamar a RPC via REST.

## Links

- [[00-Arquitetura/Supabase e RLS]]
- [[01-Papeis-e-Permissoes/Matriz de Permissões]]
- [[01-Papeis-e-Permissoes/Hierarquia Executiva]]
- [[04-Integracoes/Edge Functions]]
