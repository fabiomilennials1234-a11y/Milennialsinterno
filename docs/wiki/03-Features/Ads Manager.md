---
title: Ads Manager
tags:
  - feature
  - ads
---

# Ads Manager

> [!abstract] Dashboard PRO+ do gestor de anúncios
> Tela central onde o gestor de ads executa seu [[02-Fluxos/Ciclo Diário do Ads Manager|ciclo diário]]: documenta clientes, registra combinados, move entre dias da semana, acompanha tasks, vê reuniões, alimenta onboarding de novos clientes.

Rota: `/gestor-ads`. Página: `src/pages/AdsManagerPage.tsx`.

## Quem acessa

- `gestor_ads` — vê seus próprios dados (filtrados por `ads_manager_id = user.id`)
- `ceo`, `cto`, `gestor_projetos` — podem mudar o `effectiveUserId` e ver dashboard de qualquer gestor

## As 11 seções

1. **Reuniões** — calendário com meetings 1:1, reuniões de time, presenças
2. **Documentação** — histórico de `ads_daily_documentation` por cliente
3. **Tarefas Diárias** — `ads_tasks` com `task_type='daily'`
4. **Tarefas Semanais** — `task_type='weekly'`, inclui tasks auto-geradas na terça
5. **Acompanhamento** — clientes por dia da semana (core do ciclo diário)
6. **Justificativa** — `ads_justifications`, explicações de atrasos
7. **Novo Cliente** — shortcut para [[02-Fluxos/Cadastro de Cliente]]
8. **Churns** — clientes em risco, `churn_notifications`
9. **Ferramentas PRO+** — recursos de produtividade (links, templates, integrações)
10. **Bônus** — métricas de performance (bônus por cliente ativo, ciclos cumpridos)
11. **Lemas + Onboarding** — operacional (lemas da semana, onboarding de novos clientes)

## Tasks em `ads_tasks`

Schema:

```
ads_manager_id uuid       -- dono da task
title text
description text
task_type text             -- 'daily' | 'weekly'
status text                -- 'todo' | 'doing' | 'done'
priority text              -- 'low' | 'medium' | 'high'
due_date date
tags text[]                -- ex.: ['combinado'], ['auto_weekly:2026-04-20']
archived boolean
created_at, updated_at
```

### Origem das tasks

- **Manual**: gestor cria no dashboard
- **Combinado**: [[02-Fluxos/Ciclo Diário do Ads Manager#Modal de documentação|combinado em documentação]] → auto-cria task `priority=high, tags=['combinado']`
- **Weekly auto**: [[02-Fluxos/Ciclo Semanal|edge cron]] cria 2 tasks/semana (relatório, lema)
- **Results report**: "Apresentar PDF Resultados" — ver [[02-Fluxos/Geração de Results Report]]
- **Onboarding**: tasks vindas de `onboarding_tasks` são refletidas ou copiadas para `ads_tasks`? — verificar na implementação

### Completar task

Ao marcar `status = 'done'`:
- Se é combinado ou overdue → `requireJustification()` (J11)
- UPDATE em `ads_tasks`
- Invalida queries React Query

## Acompanhamento (Aba 5)

Ver [[02-Fluxos/Ciclo Diário do Ads Manager]] — é a aba mais ativa do dashboard.

## Churns

`churn_notifications` alerta sobre clientes em risco. Dismissal via `churn_notification_dismissals` para não mostrar de novo ao mesmo usuário.

Critério de "churn risk" vem de RPCs (ex.: `check_ads_client_stalled_14d`) ou trigger no cliente.

## Ferramentas PRO+

Seção exclusiva dos gestores de ads — links curados, templates, atalhos. Pode evoluir para integração com ferramentas externas.

## Bônus

Métricas agregadas:
- Clientes ativos sob responsabilidade
- % de ciclos de results report cumpridos
- Taxa de resolução de combinados no prazo
- (Possivelmente) valor financeiro equivalente

Alimenta critério de bonificação — verificar com RH/Financeiro.

## Lemas + Onboarding

- **Lemas**: mensagem semanal do gestor (atualizada todo início de semana). Consumida pelo dashboard executivo.
- **Onboarding**: visão agregada dos clientes em `client_onboarding` do gestor. Shortcut para completar tasks de onboarding.

## Visão executiva (effectiveUserId)

Para CEO/CTO/gestor_projetos:
- Sidebar lista "Gestor de Ads" com sub-items de cada gestor_ads
- Clicar navega com `?effectiveUserId={uuid}`
- Toda a UI do dashboard filtra por esse `effectiveUserId` em vez de `user.id`

Permite: "Quero ver o dashboard do João hoje" sem fazer sudo.

## Links

- [[02-Fluxos/Ciclo Diário do Ads Manager]]
- [[02-Fluxos/Ciclo Semanal]]
- [[02-Fluxos/Geração de Results Report]]
- [[03-Features/Outbound Manager]]
- [[03-Features/Clientes]]
