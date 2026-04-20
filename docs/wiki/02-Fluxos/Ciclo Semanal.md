---
title: Ciclo Semanal
tags:
  - fluxo
  - semanal
  - automacao
---

# Ciclo Semanal

> [!abstract] O ritual automatizado
> Toda segunda-feira (ou início de semana, conforme cron), uma edge function cria tasks semanais automáticas para cada gestor de ads. Idempotente via tags — roda quantas vezes quiser no mesmo dia, não duplica.

Edge function: `supabase/functions/create-weekly-tasks/index.ts`.

## O que é criado

Para cada usuário com `role = 'gestor_ads'`, **2 tasks** são criadas:

1. **"Enviar relatório"** — due terça da semana
2. **"Enviar lema"** — due terça da semana

Ambas entram em `ads_tasks` com:
- `task_type = 'weekly'`
- `status = 'todo'`
- `priority = 'medium'` (ou conforme configuração)
- `tags = ['auto_weekly:YYYY-MM-DD']` (idempotência)

## Idempotência

A tag `auto_weekly:{data-da-semana}` garante que, se o cron rodar duas vezes, o INSERT é skip-ado. Implementado via upsert com `on_conflict` na tag ou check-before-insert.

## Cron

Agendado no Supabase Dashboard (Schedule → Edge Functions) ou via `pg_cron`. Frequência: segunda-feira 05:00 BRT (ou conforme env).

Trigger manual: invoke via dashboard ou:

```bash
curl -X POST $SUPABASE_URL/functions/v1/create-weekly-tasks \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

## Outras crons semanais

### `summarize-weekly-problems`

Edge function que consome `weekly_problems` + `weekly_summaries` e chama [[04-Integracoes/Lovable AI]] para sumarizar. Invocada sob demanda pela UI, não em cron fixo.

### `check-scheduled-notifications`

Roda com frequência maior (diária ou horária). Chama ~23 RPCs de verificação. Ver [[02-Fluxos/Notificações Agendadas]].

## Fim de semana: semana fecha

Rituais comuns que acontecem no fechamento de semana:

- **1:1 meetings** (`meetings_one_on_one`): RH / gestores marcam reuniões individuais.
- **Weekly summaries** (`weekly_summaries`): um resumo é gerado pela UI, pode usar AI para sugerir texto.
- **Weekly problems review** (`weekly_problems`): lista de problemas da semana com owner e deadline.

## Links

- [[04-Integracoes/Edge Functions]]
- [[02-Fluxos/Ciclo Diário do Ads Manager]]
- [[02-Fluxos/Notificações Agendadas]]
