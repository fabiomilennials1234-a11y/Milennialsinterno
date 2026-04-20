---
title: Groups, Squads e Custom Roles
tags:
  - feature
  - organizacao
---

# Groups, Squads e Custom Roles

> [!abstract] Estrutura organizacional
> Três níveis de hierarquia: **Groups** (Design, Video, Devs, etc.) → **Squads** (sub-times dentro de um group) → **Custom Roles** (papéis granulares por squad com `allowed_pages[]`). Permite modelar estruturas reais da agência sem inflar a tabela de papéis principais.

## Tabelas

### `organization_groups`

| Campo | Papel |
|---|---|
| `id`, `name`, `slug` | identidade |
| `description` | descrição |
| `product_category_id` | FK para categoria de produto |
| `position` | ordenação |

Cada usuário pode pertencer a **um** grupo (`profiles.group_id`). Deletar grupo é operação CEO-only via [[04-Integracoes/Edge Functions|edge function `delete-group`]], com opção de cascatar deleção dos usuários.

### `squads`

| Campo | Papel |
|---|---|
| `id`, `name`, `slug` | identidade |
| `group_id` | FK |
| `description` | descrição |
| `position` | ordenação |

Cada usuário pode pertencer a **um** squad (`profiles.squad_id`). Squad é a unidade que o [[01-Papeis-e-Permissoes/Funções RLS#can_view_board|`can_view_board()`]] usa para decidir visibilidade.

### `custom_roles`

| Campo | Papel |
|---|---|
| `id`, `name`, `display_name` | identidade |
| `allowed_pages[]` | slugs de rotas permitidas |
| `is_viewer` | se é só-leitura |
| `squad_id` | FK (optional) |
| `created_by` | quem criou |

Ativado via `accessMode='custom'` em CreateUserModal/EditUserModal. Quando ativo, `custom_roles.allowed_pages[]` sobrepõe o acesso padrão do `user_roles.role`.

### `group_role_limits`

Limita quantos usuários de cada papel um grupo pode ter.

```
group_id, role, max_count
```

Valida no CreateUserModal ao atribuir papel a um group.

## Como se combina com papéis

```
profiles.group_id     →  organization_groups
profiles.squad_id     →  squads
user_roles.role       →  papel principal (ceo, gestor_ads, design, etc.)
profiles.additional_pages[]   →  exceções por usuário
```

Se `squad_id` tem `custom_role` associado, esse custom role sobrepõe o default do `role` para `allowed_pages`.

## Fluxo de criação

1. Criar `organization_groups` (admin UI)
2. Criar `squads` dentro do grupo
3. Opcional: criar `custom_roles` para squads específicas
4. Criar usuário atribuindo `group_id + squad_id + role (+ custom_role)`

## Interação com kanban boards

`kanban_boards.squad_id` é como o board sabe "a qual time pertenço". `can_view_board()` usa:

```
is_executive(user) → sempre true
senão:
  board.squad_id = user.squad_id → true
  board.group_id = user.group_id → true
  board.category_id = user.category_id → true
```

## Admin UI

- `GroupsPage` — CRUD de grupos
- CRUD de squads dentro do grupo
- CRUD de custom_roles dentro do squad

## Links

- [[01-Papeis-e-Permissoes/Papéis do Sistema]]
- [[01-Papeis-e-Permissoes/Matriz de Permissões]]
- [[02-Fluxos/Criação de Usuário]]
- [[04-Integracoes/Edge Functions#delete-group]]
