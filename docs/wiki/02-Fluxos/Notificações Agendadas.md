---
title: Notificações Agendadas
tags:
  - fluxo
  - notificacoes
  - cron
---

# Notificações Agendadas

> [!abstract] O cron guard
> Uma única edge function (`check-scheduled-notifications`) é invocada por cron e executa ~23 RPCs de verificação em sequência. Cada RPC examina o estado do sistema (contratos, tasks, docs, onboarding, OKRs, etc.) e insere alertas nas tabelas `system_notifications`, `task_delay_notifications` ou `ads_note_notifications` quando detecta condição suspeita.

Edge: `supabase/functions/check-scheduled-notifications/index.ts`.

## Design: fail-open

Cada RPC é invocada dentro de um try/catch. Falha em uma RPC **não bloqueia** as outras. Retorno da edge é `200 OK` com map de booleans por RPC. Isso garante que um bug em uma verificação não silencie o restante.

## RPCs inventoriadas

### Contratos

| RPC | Gatilho | Alerta |
|---|---|---|
| `check_expiring_contracts()` | contrato vence em ≤ N dias | `system_notifications` para CEO + sucesso_cliente |
| `check_contract_no_renewal_plan()` | contrato vence e não há plano de renovação | idem |
| `check_contract_expired_alert()` | contrato já venceu | urgente para CEO |

### Cards em kanbans

| RPC | Gatilho | Alerta |
|---|---|---|
| `check_stalled_cards()` | card sem movimento > N dias | `task_delay_notifications` para assignee |
| `check_pending_approvals()` | card em `aguardando_aprovacao`/`para_aprovacao` há muito | para aprovador (ceo, gestor_ads) |

### Ads Manager

| RPC | Gatilho | Alerta |
|---|---|---|
| `check_pending_ads_documentation()` | gestor não documentou cliente hoje/ontem | para gestor e executivos |
| `check_ads_client_no_movement_7d()` | cliente parado em mesmo dia há 7d | gestor |
| `check_ads_client_stalled_14d()` | cliente parado 14d | gestor + executivo |
| `check_pending_comercial_documentation()` | consultor comercial sem doc | consultor |

### Comercial

| RPC | Gatilho |
|---|---|
| `check_comercial_consultoria_stalled()` | consultoria parada |

### Onboarding de cliente

| RPC | Gatilho |
|---|---|
| `check_stalled_onboarding()` | onboarding parado > N dias em um marco |
| `check_onboarding_tasks_stuck()` | task de onboarding overdue |

### Clientes e relacionamento

| RPC | Gatilho |
|---|---|
| `check_clients_without_contact()` | cliente sem contato recente |

### OKRs

| RPC | Gatilho |
|---|---|
| `check_okr_deadlines()` | OKR próximo do deadline |

### Departamento e usuários

| RPC | Gatilho |
|---|---|
| `check_department_tasks_stalled()` | task de departamento atrasada |
| `check_user_inactive()` | usuário sem ação recente |

### Receita

| RPC | Gatilho |
|---|---|
| `generate_monthly_receivables()` | início de mês → gera `contas_receber` para clientes ativos |

## Tabelas de saída

- `system_notifications` — genérica (título, descrição, tipo, user_id, read_at)
- `task_delay_notifications` — task específica atrasada (task_id, notification_type)
- `task_delay_justifications` — pair com justificativa do responsável
- `ads_note_notifications` — para notas em ads_tasks
- `churn_notifications` — cliente em risco (auto-criado? ou manual — verificar)

Todas são lidas pelo [[03-Features/Notification Center]].

## Agendamento

Configurado no Supabase Dashboard → Functions → Schedule, ou via `pg_cron`. Frequência típica: diária às 05:00 BRT.

Invocação manual (debug):

```bash
curl -X POST $SUPABASE_URL/functions/v1/check-scheduled-notifications \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

## Resposta

```json
{
  "check_expiring_contracts": true,
  "check_stalled_cards": true,
  "check_clients_without_contact": false,  // falhou, mas seguiu
  ...
}
```

## Adicionando nova verificação

> [!todo] Checklist
> - [ ] Criar RPC `check_<algo>()` em nova migration — SECURITY DEFINER, insere em `system_notifications`
> - [ ] Garantir idempotência — não re-notificar se já notificou hoje
> - [ ] Adicionar chamada em `check-scheduled-notifications/index.ts`
> - [ ] Redeploy edge function (`supabase functions deploy check-scheduled-notifications`)
> - [ ] Validar no Studio que a row aparece na próxima execução

## Idempotência é crucial

> [!warning] Repetição silenciosa
> A edge function pode rodar múltiplas vezes por dia se o cron for mal configurado. Cada RPC **deve**: (1) checar se já existe notificação similar hoje antes de inserir, ou (2) usar `ON CONFLICT DO NOTHING` via índice único. Caso contrário, usuários recebem 10 notificações iguais.

## Links

- [[04-Integracoes/Edge Functions]]
- [[03-Features/Notification Center]]
- [[01-Papeis-e-Permissoes/Funções RLS#RPCs de notificações agendadas]]
