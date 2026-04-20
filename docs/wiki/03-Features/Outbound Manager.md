---
title: Outbound Manager
tags:
  - feature
  - outbound
---

# Outbound Manager

> [!abstract] Gêmeo do Ads Manager, para prospecção
> Dashboard PRO+ do outbound manager. Fluxo **quase idêntico** ao [[03-Features/Ads Manager|Ads Manager]], com menos seções (sem Ferramentas PRO+/Bônus/Lemas) e tabela própria de tasks (`outbound_tasks`).

Rota: `/millennials-outbound`. Página: `src/pages/OutboundManagerPage.tsx`.

## Quem acessa

- `outbound` — vê seus próprios clientes
- `ceo`, `cto`, `gestor_projetos` — acesso via `effectiveUserId`

## Seções (8)

1. Reuniões
2. Documentação
3. Tarefas Diárias (`outbound_tasks` daily)
4. Tarefas Semanais (weekly)
5. Acompanhamento (clientes por dia)
6. Justificativa
7. Novo Cliente
8. Churns

Sem: Ferramentas PRO+, Bônus, Lemas — específicos do ads.

## Acompanhamento (diferença vs. Ads)

Em `src/components/outbound-manager/OutboundAcompanhamentoSection.tsx`:

- **Não requer `campaign_published_at`**. Outbound opera com lead em qualquer fase.
- **Auto-cria tracking**: se cliente ativo não tem `client_daily_tracking`, insere com `current_day = hoje BR`.
- Fluxo de doc + combinado + mover dia: idêntico ao Ads.

Task de combinado é inserida em `outbound_tasks` (não `ads_tasks`).

## Tabela `outbound_tasks`

Schema espelha `ads_tasks`:

```
assigned_outbound_manager uuid   -- substitui ads_manager_id
title, description
task_type, status, priority
due_date
tags[]
```

Não há "Apresentar PDF" auto-task — relatórios de resultados são do ads. Outbound mede performance por taxa de conversão de leads.

## Churns

Mesma tabela `churn_notifications` (não separada). Filtradas por cliente vinculado ao outbound manager.

## Links

- [[03-Features/Ads Manager]]
- [[02-Fluxos/Ciclo Diário do Ads Manager]]
- [[03-Features/Clientes]]
