---
title: Results Reports
tags:
  - feature
  - relatorio
  - cliente
---

# Results Reports

> [!abstract] O ritual de 30 dias
> A cada 30 dias o gestor apresenta ao cliente um relatório padronizado. O sistema: (1) calcula status do ciclo (normal/alert/overdue), (2) guia o gestor através dos campos, (3) usa [[04-Integracoes/Lovable AI|AI]] para polir o texto, (4) publica link público por token, (5) cria auto-task de apresentação.

Ver [[02-Fluxos/Geração de Results Report]] para o fluxo passo a passo.

## Tabelas

### `client_results_reports`

| Campo | Papel |
|---|---|
| `id`, `client_id`, `created_by`, `created_at` | metadados |
| `actions_last_30_days`, `achievements`, `traffic_results`, `key_metrics`, `top_campaign`, `improvement_points`, `next_30_days`, `next_steps` | conteúdo do relatório |
| `client_logo_url`, `sectionImages` (JSONB) | assets visuais |
| `cycle_start_date`, `cycle_end_date` | janela do relatório |
| `is_published` | gate do link público |
| `pdf_url` | se gerado externamente |
| `token` | UUID para `/results/{token}` |

## Status de ciclo

Calculado por `useResultsReportStatus(clientId)`:

- **pending** — sem contrato (onboarding não concluiu marco 5)
- **normal** — ≤ 26 dias do último report
- **alert** — 27-30 dias
- **overdue** — ≥ 30 dias

**Cutoff 2026-04-02**: clientes pré-existentes usam essa data como `cycle_start_date` para não ficarem "permanentemente overdue".

## Geração

Hook: `useCreateResultsReport()` em `src/hooks/useClientResultsReports.ts`.

1. Chama [[04-Integracoes/Lovable AI|edge function `transform-results-report`]]
2. Persiste em `client_results_reports` (is_published=false inicialmente)
3. Detecta duplicatas criadas por trigger e as deleta
4. Cria auto-task "Apresentar PDF Resultados {clientName}" em `ads_tasks`

## Página pública

Rota: `/results/:token`. Componente: `src/pages/PublicResultsReportPage.tsx`.

Sem auth — só o token gate.

Renderiza:
- Logo do cliente
- Seções com imagens
- Métricas em gráficos (Recharts)
- Próximos passos
- Download PDF (se `pdf_url`)

## Auto-task "Apresentar PDF"

Inserida com:
- `title = "Apresentar PDF Resultados {clientName}"`
- `description` JSON: `{type: 'present_results_report', reportId, clientId}`
- `priority = 'high'`
- `due_date = +3 dias`
- `tags = []` (inferência: podem ter algo como 'results_presentation')

Ao marcar done, exige justificativa (J11).

## Hooks úteis

- `useClientResultsReports(clientId)` — todos os reports
- `useLatestReport(clientId)` — o mais recente
- `useResultsReportStatus(clientId)` — status do ciclo
- `useCreateResultsReport()` — criar novo
- `useUpdateResultsReport()` — editar (se `is_published=false`)
- `usePublishReport()` — toggle `is_published`

## Trigger de duplicata (bug conhecido)

Há um trigger no DB que, em certos cenários, duplica o INSERT. O hook detecta (`allDuplicates`) e deleta em lotes de 50. Fix ideal: remover o trigger (requer análise de dependências).

## Links

- [[02-Fluxos/Geração de Results Report]]
- [[03-Features/Ads Manager]]
- [[04-Integracoes/Lovable AI]]
- [[03-Features/Públicas — NPS, Diagnóstico, Strategy]]
