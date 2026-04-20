---
title: Papéis do Sistema
tags:
  - permissoes
  - papeis
---

# Papéis do Sistema

> [!abstract] 17 papéis, 4 tiers
> O sistema reconhece 17 papéis, agrupados em 4 tiers de hierarquia. O tier não é armazenado (é derivado no código), mas é o modelo mental certo para entender a matriz de permissões.

Definição canônica: `src/types/auth.ts:2-47` (union `UserRole`).

## Tier 100 — Executivos

Acesso **irrestrito**. `is_executive() = true`. Podem criar/editar/deletar qualquer entidade.

| Role | Label | Notas |
|---|---|---|
| `ceo` | CEO | Único capaz de criar outro CEO |
| `cto` | CTO | Adicionado em abril/2026. **Deve ser tratado como CEO em todas as novas policies** (ver [[01-Papeis-e-Permissoes/Hierarquia Executiva]]) |

## Tier 90 — Admin

Acesso amplo, mas não total. `is_admin() = true`.

| Role | Label | Notas |
|---|---|---|
| `gestor_projetos` | Gestor de Projetos | Pode ver todos os boards, criar tabs, mover cards livremente. Não pode criar/deletar usuários (essa é CEO-only). |

## Tier 60-50 — Gestores de área (PRO+)

Cada um tem uma **rota dedicada** (ver [[01-Papeis-e-Permissoes/Matriz de Permissões#Rotas PRO+|seção de rotas]]) onde opera seu módulo.

| Role | Label | Rota | Tabela primária |
|---|---|---|---|
| `gestor_ads` | Gestor de Ads | `/gestor-ads` | `ads_tasks`, `client_daily_tracking` |
| `outbound` | Outbound | `/millennials-outbound` | `outbound_tasks` |
| `sucesso_cliente` | Sucesso do Cliente | `/sucesso-cliente` | cs_* |
| `consultor_comercial` | Consultor Comercial | `/consultor-comercial` | `comercial_tracking`, `comercial_daily_documentation` |
| `consultor_mktplace` | Consultor Marketplace | `/consultor-mktplace` | mktplace_* |
| `gestor_crm` | Gestor CRM | `/gestor-crm` | — (integra com Torque externo) |

## Tier 40 — Execução (áreas produtivas)

Cada um tem **seu kanban** (ver [[03-Features/Kanbans por Área]]).

| Role | Label | Kanban | Notas |
|---|---|---|---|
| `design` | Design | `/design` | Colunas por designer (swim lanes) |
| `editor_video` | Editor de Vídeo | `/editor-video` | Idem |
| `devs` | Devs | `/devs` | Ver [[03-Features/Kanban Devs]] |
| `atrizes_gravacao` | Atrizes de Gravação | `/atrizes-gravacao` | Ver [[03-Features/Kanban Atrizes]] |
| `produtora` | Produtora | — | Sem kanban próprio visível; acesso via board compartilhado |
| `rh` | RH | `/rh` | Acesso ao [[03-Features/RH Jornada Equipe]] |
| `financeiro` | Financeiro | `/financeiro` | Opera tasks de cobrança e onboarding financeiro |

## Por papel: o que aparece no sidebar

Controlado por `src/hooks/useSidebarPermissions.ts` + `BOARD_VISIBILITY` em `src/types/auth.ts:71-159`.

### Executivos (CEO, CTO)
Tudo. Sidebar completo.

### Gestor de Projetos
Tudo, menos gestão de usuários (que exige CEO explicitamente em `create-user`/`update-user`/`delete-user`).

### Gestor de Ads / Outbound
- Rota PRO+ própria (`/gestor-ads` / `/millennials-outbound`)
- Boards: ads, design, editor-video, devs, produtora, atrizes, gestor-crm, consultor-comercial, consultor-mktplace
- **Não vê**: RH, financeiro, sucesso, executivo

### Sucesso do Cliente
Quase como gestor_ads, mas **também vê** RH e `/sucesso-cliente`.

### Design / Editor Video / Devs / Atrizes
- Seu próprio kanban
- **Devs** vê também design (integração comum)
- **Atrizes** (`atrizes_gravacao`) vê também o kanban do próprio pool

### Consultor Comercial
- `/consultor-comercial` (próprio PRO+)
- Boards: comercial, paddock

### Consultor Marketplace
- `/consultor-mktplace`
- Boards: mktplace

### RH / Financeiro
- Rotas próprias (`/rh`, `/financeiro`)
- Não veem kanbans de áreas produtivas

## Flag adicional: `can_access_mtech`

Independente do papel, qualquer perfil pode ganhar acesso ao [[03-Features/Mtech — Milennials Tech|Mtech]] se um admin (CEO, CTO, Gestor de Projetos ou Sucesso) setar `profiles.can_access_mtech = true`.

Default: CEO, CTO e Devs têm acesso automático. Outros precisam do flag.

Detalhes em [[01-Papeis-e-Permissoes/Flag can_access_mtech]].

## Papéis especiais no perfil

- **`is_coringa`** — flag em `profiles`. Usado para marcar usuários "curinga" que operam fora do modelo padrão de squad. Não afeta RLS, afeta filtros de UI.
- **`additional_pages[]`** — lista de slugs de página que aquele usuário vê **além** do que seu papel permite. Ponte de exceção para "aquela pessoa específica precisa ver X".
- **`custom_role` (via squad)** — se o usuário tem um squad com `custom_role`, esse role sobrepõe o padrão via `custom_roles.allowed_pages[]`. Ver [[03-Features/Groups, Squads e Custom Roles]].

## Por que 17 papéis

> [!question] Não é excesso?
> Um papel por função operacional. A alternativa seria poucos papéis + um sistema de permissões granulares tipo RBAC completo. Foi evitado porque: (1) a matriz é estável — não há reorgs frequentes; (2) o custom_roles já cobre casos excepcionais; (3) RLS fica muito mais legível com `role IN ('ceo', 'cto')` do que `has_permission('users:read:all')`.

## Quando criar um novo papel

> [!warning] Antes de adicionar role
> 1. **Tem rota própria?** Se não, provavelmente é uma variação de papel existente + `additional_pages` ou custom_role.
> 2. **Tem RLS própria?** Cada papel novo multiplica o trabalho em todas as policies. O incidente do CTO (april/2026) mostra: esquecer uma policy esconde dados silenciosamente.
> 3. **Atualize TODAS as helpers.** `is_ceo`, `is_admin`, `is_executive`, `can_view_user`, `can_see_tech`. Esqueceu uma? Bug.
> 4. **Atualize `BOARD_VISIBILITY`** em `src/types/auth.ts`.
> 5. **Atualize `ROLE_LABELS`** para o novo rótulo em PT.
> 6. **Adicione teste pgTAP** cobrindo as helpers com o novo papel.

## Links

- [[01-Papeis-e-Permissoes/Matriz de Permissões]]
- [[01-Papeis-e-Permissoes/Funções RLS]]
- [[01-Papeis-e-Permissoes/Hierarquia Executiva]]
- [[02-Fluxos/Criação de Usuário]]
