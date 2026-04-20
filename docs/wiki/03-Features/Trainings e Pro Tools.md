---
title: Trainings e Pro Tools
tags:
  - feature
  - treinamento
  - tools
---

# Trainings e Pro Tools

> [!abstract] Conteúdo curado
> Duas features de conteúdo estático/semi-estático: **Trainings** (treinamentos/aulas com agenda e links) e **Pro Tools** (lista curada de ferramentas externas).

## Trainings

Rota: `/treinamentos`. Página: `TreinamentosPage`. Tabela: `trainings`.

### Schema

| Campo | Papel |
|---|---|
| `title`, `description`, `thumbnail_url` | metadados |
| `created_by` | quem cadastrou |
| `allowed_roles[]` | quais papéis veem |
| `class_date`, `class_time` | agenda |
| `class_links[]` | links (Meet, Zoom, gravação) |
| `is_recurring`, `recurrence_days` | recorrência |
| `archived` | arquivamento |

### Visibilidade

Filtrada por `allowed_roles[]`. Um training com `allowed_roles=['gestor_ads', 'outbound']` aparece só para esses dois papéis.

Executivos veem todos.

## Pro Tools

Tabela: `pro_tools`. Rota: inferida — provavelmente sob role-gated pages (sem rota dedicada visível).

### Schema

| Campo | Papel |
|---|---|
| `slug` | identificador |
| `title` | nome da ferramenta |
| `content` | descrição (markdown?) |
| `icon` | ícone/emoji |
| `link` | URL externa |
| `position` | ordenação |

### Propósito

Lista curada de "ferramentas que o time usa" — Canva, n8n, ChatGPT, Looker Studio, etc. Cada um com explicação breve de quando usar.

## Company Content

Tabela `company_content`: páginas estáticas da empresa (manifesto, procedimentos, documentação interna). `slug` + `title` + `content`.

## Quem administra

- `ceo`, `cto`, `gestor_projetos` — criam/editam
- Todos autenticados — leem (filtrado por `allowed_roles` quando aplicável)

## Links

- [[00-Arquitetura/Modelo de Dados#Públicas e misc]]
- [[01-Papeis-e-Permissoes/Matriz de Permissões]]
