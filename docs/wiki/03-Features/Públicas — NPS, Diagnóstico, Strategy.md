---
title: Públicas — NPS, Diagnóstico, Strategy
tags:
  - feature
  - public
---

# Páginas Públicas

> [!abstract] O cliente final interage aqui
> Páginas acessíveis por URL pública com token único. Sem auth — o token em `URL` é o gate. Armazenam feedback estruturado que alimenta dashboards internos.

## Inventário

| Rota | Página | Propósito |
|---|---|---|
| `/nps/:token` | `PublicNPSPage` | Pesquisa NPS |
| `/diagnostico/:token` | `PublicDiagnosticoPage` | Diagnóstico marketplace/paddock |
| `/paddock/:token` | `PublicPaddockDiagnosticoPage` | Variante paddock-específica |
| `/strategy/:token` | `PublicStrategyPage` | Apresentação de estratégia (marcos, próximos passos) |
| `/outbound-strategy/:token` | `PublicOutboundStrategyPage` | Estratégia de prospecção outbound |
| `/results/:token` | `PublicResultsReportPage` | [[03-Features/Results Reports\|Results Report]] para cliente |
| `/exit-form/:token` | `PublicExitFormPage` | Exit survey (churn) |

## NPS

`src/pages/PublicNPSPage.tsx`.

Campos:
- `company_name`
- `nps_score` (0-10)
- `score_reason`
- `strategies_aligned` (enum: sim/parcial/não)
- `communication_rating` (1-5)
- `creatives_rating` (1-5)
- `creatives_represent_brand` (boolean)
- `improvement_suggestions`

Hooks: `useNPSSurveyByToken()`, `useSubmitNPSResponse()`. Tabela: `nps_surveys`.

## Diagnóstico Marketplace

Questionário com scoring por área (operação, produtos, preços, logística, conversão, reputação, crescimento). Resultado: radar chart + bar chart + recomendações priorizadas (imediatas/curto prazo/escala).

Hook: `useMktplaceDiagnostico()`.

## Strategy

Renderização apresentacional da estratégia do cliente: marcos, próximos passos, expectativa. Hook: `usePublicStrategy()`.

## Exit Form

Survey para cliente que está saindo. Coleta razões de churn, feedback final, NPS de saída.

## Geração de token

Tokens são UUIDs gerados no backend ao criar a entidade correspondente (survey, diagnóstico, strategy). Compartilhados com o cliente por fora do sistema (e-mail, WhatsApp, link manual).

> [!warning] Token é autenticação
> Qualquer um com o link tem acesso. Não há expiração automática em todos os casos — considerar adicionar TTL se sensibilidade aumentar.

## Estilo visual

Páginas públicas têm branding Milennials (logo, paleta), mas são independentes do app autenticado. Renderizam sem sidebar, sem header de produto — experiência focada.

## Links

- [[03-Features/Results Reports]]
- [[00-Arquitetura/Modelo de Dados#Públicas e misc]]
