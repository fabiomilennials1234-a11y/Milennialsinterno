# Fix: Page-grant data scope race condition

**Data**: 2026-05-04
**Autor**: Brainstorm com fundador
**Status**: Spec aprovado, aguardando plano

## Problema

Usuário com `user_page_grants` adicional (ex: treinador comercial com grant em
`gestor-crm`) deveria ter visão total da página correspondente — todas as
tarefas diárias, clientes, acompanhamento diário, configurações. Hoje a página
abre **parcialmente vazia**: tarefas/clientes/tracking pertencentes a outros
operadores não aparecem, mesmo após logout/login fresco.

RLS backend está correto (`can_access_page_data` libera via `user_page_grants`).
Edge functions sincronizam grants corretamente. Frontend hooks têm a lógica
`seesAll` certa. Mesmo assim, **dados não chegam**.

## Causa raiz

Race condition em hooks de leitura. Padrão atual:

```ts
const { data: pageAccess = [] } = usePageAccess();         // RPC async
const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');

return useQuery({
  queryKey: ['crm-kanban-clients', user?.id, user?.role],  // sem pageAccess
  queryFn: async () => {
    if (!seesAll && user?.role === 'gestor_crm') {
      query = query.eq('assigned_crm', user?.id);
    }
    ...
  },
  enabled: !!user?.id,
});
```

Sequência de boot do treinador comercial:

1. `usePageAccess` dispara RPC (assíncrono)
2. Hook de dados monta paralelamente. `pageAccess=[]` ainda → `seesAll=false`
3. Query roda com fallback `assigned_crm=user.id` ou `user_id=user.id`
4. Treinador comercial não é dono natural → resultado vazio é cacheado
5. `pageAccess` resolve com `['gestor-crm', ...]`. `seesAll` recalcula → `true`
6. **`queryKey` não inclui `pageAccess`/`seesAll`** → React Query NÃO refetch
7. Usuário vê página vazia até `staleTime` expirar (60s) E re-render forçado

Quem não vê o bug:
- **Admin/CEO**: `isAdminUser=true` síncrono → `seesAll=true` na 1ª render
- **Gestor_crm nativo**: filtro fallback `assigned_crm=user.id` casa com ele
  próprio → vê suas próprias coisas (visão parcial é "correta" pra eles)

Quem vê:
- Treinador comercial + grant `gestor-crm`: nada lá é dele → vazio
- Qualquer outra combinação `role X + grant página Y` cross-funcional

## Hooks afetados

13 call sites em 5 arquivos:

| Arquivo | Sites | Slug |
|---|---|---|
| `src/hooks/useCrmKanban.ts` | 7 | `gestor-crm` |
| `src/hooks/useMktplaceKanban.ts` | 3 | `consultor-mktplace` |
| `src/hooks/useDepartmentTasks.ts` | 1 | dinâmico via `DEPARTMENT_TO_PAGE_SLUG` |
| `src/hooks/useOutboundManager.ts` | 1 | `outbound` |
| `src/hooks/useOnboardingTasks.ts` | 1 | `sucesso-cliente` |

Fora de escopo:
- `src/hooks/usePageDataScope.ts` — toggle UI manual mine/all, comportamento
  diferente; não tem race
- `src/hooks/useSidebarPermissions.ts`, `usePermissionDivergenceLogger.ts` —
  não são data queries

## Solução

Hook helper `useDataScope(pageSlug)` em `src/hooks/useDataScope.ts`. Centraliza
o cálculo de `seesAll` e expõe identificadores estáveis para `queryKey` e
`enabled`.

### API

```ts
export interface DataScopeResult {
  /** True quando user vê dados completos da página. */
  seesAll: boolean;
  /** True quando o cálculo de seesAll é confiável (pageAccess resolveu ou bypass admin). */
  isReady: boolean;
  /** Identidade estável pra compor queryKey. Muda quando seesAll muda. */
  scopeKey: 'all' | 'mine' | 'pending';
}

export function useDataScope(pageSlug: string | undefined): DataScopeResult;
```

### Implementação

```ts
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';

export function useDataScope(pageSlug: string | undefined): DataScopeResult {
  const { isAdminUser, isCEO } = useAuth();
  const { data: pageAccess, isSuccess, isError } = usePageAccess();

  const adminBypass = isAdminUser || isCEO;
  const isReady = adminBypass || isSuccess || isError;
  const seesAll = adminBypass || (!!pageSlug && (pageAccess?.includes(pageSlug) ?? false));
  const scopeKey: DataScopeResult['scopeKey'] = !isReady
    ? 'pending'
    : seesAll
      ? 'all'
      : 'mine';

  return { seesAll, isReady, scopeKey };
}
```

Pontos:
- Admin/CEO: `isReady=true` síncrono, `seesAll=true`. Zero penalty.
- `pageSlug=undefined` (caso `useDepartmentTasks` com department fora do mapa):
  `seesAll=false` fail-closed, `isReady=true` (não trava render).
- `isError` no `pageAccess` não bloqueia: `isReady=true` com `seesAll=false`.
  Conservador e fail-closed.

### Padrão de uso nos consumidores

Antes:

```ts
const { user, isAdminUser, isCEO } = useAuth();
const { data: pageAccess = [] } = usePageAccess();
const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');

return useQuery({
  queryKey: ['crm-kanban-clients', user?.id, user?.role],
  queryFn: async () => { ... },
  enabled: !!user?.id,
});
```

Depois:

```ts
const { user } = useAuth();
const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

return useQuery({
  queryKey: ['crm-kanban-clients', user?.id, scopeKey],
  queryFn: async () => {
    if (!seesAll && user?.role === 'gestor_crm') {
      query = query.eq('assigned_crm', user?.id);
    }
    ...
  },
  enabled: isReady && !!user?.id,
});
```

Mudanças mecânicas por hook:
1. Trocar `useAuth()` (parcial) + `usePageAccess()` + cálculo de `seesAll`
   pela chamada `useDataScope(slug)`. Manter `useAuth()` quando o hook ainda
   precisa de `user.id`/`user.role`.
2. `queryKey`: incluir `scopeKey` no array. Substitui `user?.role` quando role
   é usado só pra discriminar scope; soma a ele quando role tem outro propósito.
3. `enabled`: prefixar com `isReady &&`.

### Casos especiais

**`useOutboundManager` / `useOnboardingTasks`** — lógica `!targetUserId && (...)`:

```ts
const { seesAll: pageScopeSeesAll, isReady, scopeKey } = useDataScope('outbound');
const seesAll = !targetUserId && pageScopeSeesAll;
```

`scopeKey` ainda entra em queryKey e `isReady` em enabled. `targetUserId` já
está em queryKey hoje — preserva.

**`useDepartmentTasks`** — slug dinâmico:

```ts
const slug = DEPARTMENT_TO_PAGE_SLUG[department];
const { seesAll, isReady, scopeKey } = useDataScope(slug);
```

`useDataScope(undefined)` retorna `seesAll=false, isReady=true` — fail-closed
quando department não tem mapping (alinha com filtro existente).

## Testing

### Manual (golden path)

Após implementação, validar no browser:

1. Login fresco como treinador comercial **sem** grant `gestor-crm` →
   `PageAccessRoute` redireciona (não muda).
2. Admin adiciona `additional_pages: ['gestor-crm']` via UsersPage modal.
3. Treinador faz logout/login → página CRM PRO+ abre com:
   - Tarefas diárias do `gestor_crm` (todas, não só dele)
   - Coluna "Novos clientes" populada com todos clients no fluxo
   - Coluna "Boas-vindas" populada
   - Coluna "Acompanhamento diário" populada (todas linhas de `crm_daily_tracking`)
   - Colunas "Configuração V8/Automation/Copilot" populadas
   - Coluna "Justificativa" populada
4. Repetir o teste cruzado pra:
   - Mktplace (`consultor-mktplace`) — colunas de tracking/clients
   - Outbound (`outbound`) — `useOutboundManager`
   - Sucesso Cliente (`sucesso-cliente`) — `useOnboardingTasks`
   - Department tasks (financeiro/rh/gestor_projetos) — `useDepartmentTasks`

### Regressão (não quebrar comportamento atual)

1. Admin/CEO continua vendo tudo (path síncrono `adminBypass=true`).
2. Gestor_crm nativo (sem grant explícito): vê só clients onde
   `assigned_crm=user.id`. `seesAll=false`, fallback role mantido.
3. Consultor mktplace nativo idem.
4. User sem role nem grant: `PageAccessRoute` redireciona (não chega aos hooks).

### Verificação automática

Antes de migrar, rodar suite existente (`npm test` / `vitest`) e capturar
baseline. Após cada commit de migração, rodar de novo. Hooks afetados não
têm tests dedicados hoje (verificar e anotar como gap).

## Rollout

1 commit por unidade lógica:

1. `useDataScope.ts` (novo arquivo) + tipos exportados
2. Migrar `useCrmKanban.ts` (7 sites)
3. Migrar `useMktplaceKanban.ts` (3 sites)
4. Migrar `useDepartmentTasks.ts` (1 site)
5. Migrar `useOutboundManager.ts` (1 site)
6. Migrar `useOnboardingTasks.ts` (1 site)

Cada commit é `bisect`-friendly. QA manual entre commits 2–6 ou em batch ao
final, conforme preferência. Segurança e arquiteto não precisam re-revisar
(zero impacto em RLS / contratos de dados / superfície externa).

## Riscos

| Risco | Mitigação |
|---|---|
| Quebrar gestor_crm/consultor_mktplace nativo (filtro `assigned_*`) | Manter os blocos `if (!seesAll && user?.role === 'X')` literalmente; só muda como `seesAll` é computado. |
| `isReady=false` permanente trava render | `isReady` cobre `isSuccess || isError || adminBypass`. Erro da RPC não trava — `seesAll=false`, query roda em fallback. |
| Outro hook futuro reintroduz o padrão antigo | Documentar no `useDataScope` que ele é o caminho canônico. ESLint rule é follow-up fora de escopo. |
| `usePageAccess` ainda tem `staleTime: 60s` — se grant mudar mid-session, refetch demora | Fora do escopo desta task. Realtime invalidation é follow-up. |

## Out of scope (follow-ups)

- ESLint rule proibindo `pageAccess.includes(...)` direto
- Realtime listener invalidando `['page-access', userId]` quando admin altera
  grants em outra sessão
- Centralizar `DEPARTMENT_TO_PAGE_SLUG` em local canônico (hoje vive em
  `useDepartmentTasks.ts`)
- Migrar `usePageDataScope.ts` (toggle manual mine/all — comportamento
  intencionalmente diferente)
