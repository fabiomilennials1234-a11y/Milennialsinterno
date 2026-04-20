---
title: Upsells
tags:
  - feature
  - receita
---

# Upsells

> [!abstract] Oportunidades mensais
> Visão de calendário mensal com oportunidades de upsell por cliente e produto. Status: `pending → contracted → cancelled`.

Componente: `src/pages/UpsellsPage.tsx`. Hook: `useUpsells()`.

## Tabelas

- `upsells` — oportunidades (client_id, product, monthly_value, status, notes)
- `upsell_commissions` — comissões derivadas de upsells contratados

## Fluxo

1. Gestor registra upsell oportuno
2. Status começa `pending`
3. Se contratado → `contracted`, gera comissão em `upsell_commissions`
4. Se caiu → `cancelled`

## Visualização

Calendário mensal por produto. Filtros por status, gestor, produto.

## Quem acessa

Gestores de ads (seus upsells), CEO/CTO/gestor_projetos (todos), financeiro (para cobrar).

## Links

- [[00-Arquitetura/Modelo de Dados#Domínios]]
- [[03-Features/Clientes]]
