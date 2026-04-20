---
title: RH Jornada Equipe
tags:
  - feature
  - rh
  - kanban
---

# RH Jornada Equipe

> [!abstract] Jornada de colaborador, não de task
> Kanban **atípico**: as colunas são **stages do ciclo de vida** do colaborador (onboarding → integração → desenvolvimento → promoção → datas comemorativas → desligamento), não pessoas ou status de trabalho. Cada card é um **colaborador** com eventos associados (aniversário, promoção, treinamento, reconhecimento, aumento salarial).

Componente: `src/components/rh/RHJornadaEquipeKanban.tsx`.

## Rota

`/rh/jornada-equipe` (ou seção dentro de `/rh`).

## Colunas (`JORNADA_STATUSES`)

| Coluna | Propósito |
|---|---|
| Onboarding | colaborador novo, 0-90 dias |
| Integração | fase de integração ao time |
| Desenvolvimento | trajetória de crescimento |
| Promoção | em processo ou recém-promovido |
| Datas Comemorativas | aniversários, tempo de casa |
| Desligamento | saída (voluntária ou não) |

## Quem pode mover

**Apenas** `ceo`, `cto`, `gestor_projetos`. `rh` tem view-only.

## Cards

Não há "criação tradicional" de card. As entries são geradas a partir da base de colaboradores (`profiles` + eventos). Cada card renderiza:

- Nome, avatar, papel
- Eventos próximos (birthday, anniversary, promotion, training, recognition, salary_increase)
- Notas específicas do stage

## Sem notificações de completion

Este board é informacional. Não dispara notificações ao mover colaborador entre colunas.

## Outros componentes de RH

Além do Jornada Equipe:

- **RHDashboard** — visão geral
- **RHKanbanBoard** — board geral de tasks de RH (vagas, processos)
- **RHTarefasSection** — lista de tasks
- **CreateRHVagaModal** — registrar vaga
- **RegistrarVagaModal** — idem
- **ProcessoSeletivoModal** — gestão de processo
- **VagaRegistradaModal** / **RHVagaDetailModal** — detalhe
- **RHDelayModal** — justificativa de atraso

## Integração com onboarding de cliente

Apesar do nome similar, RH Jornada **não** se integra com [[02-Fluxos/Onboarding de Cliente|Onboarding de Cliente]]. São domínios disjuntos: RH Jornada é do colaborador, Onboarding é do cliente.

## Links

- [[03-Features/Kanbans por Área]]
- [[01-Papeis-e-Permissoes/Matriz de Permissões]]
