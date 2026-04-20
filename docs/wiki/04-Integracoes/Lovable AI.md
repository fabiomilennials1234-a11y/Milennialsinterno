---
title: Lovable AI
tags:
  - integracao
  - ai
---

# Lovable AI

> [!abstract] Transformação de texto
> Dois endpoints no sistema usam AI via Lovable: polir Results Reports e sumarizar weekly problems. Ambos via edge function, com fallback gracioso se API falhar.

## Configuração

Env var `LOVABLE_API_KEY` em edge function secrets.

```bash
supabase secrets set LOVABLE_API_KEY="{key}"
```

## Usos

### `transform-results-report`

Edge function: `supabase/functions/transform-results-report/index.ts`.

Input (POST):

```json
{
  "clientName": "...",
  "actionsLast30Days": "...",
  "achievements": "...",
  "trafficResults": "...",
  "keyMetrics": "...",
  "topCampaign": "...",
  "improvementPoints": "...",
  "next30Days": "...",
  "nextSteps": "..."
}
```

Output: JSON estruturado com cada campo polido em linguagem profissional.

**Fallback**: se AI falhar, o hook usa o raw input como saída. Relatório é criado de qualquer jeito.

Chamada por `useCreateResultsReport()` em [[02-Fluxos/Geração de Results Report]].

### `summarize-weekly-problems`

Edge function: `supabase/functions/summarize-weekly-problems/index.ts`.

Input (POST):

```json
{
  "challenges": [...],
  "delays": [...],
  "observations": [...],
  "totalProblems": 12
}
```

Output: markdown sumarizando os problemas da semana.

Chamada pela UI de weekly review, não em cron.

## Links

- [[02-Fluxos/Geração de Results Report]]
- [[04-Integracoes/Edge Functions]]
