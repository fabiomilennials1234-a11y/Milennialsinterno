# Plano P0-P2 — Arquitetura, Permissões, Kanban e Tarefas

Status: em execução
Data: 2026-04-28

## Regra de execução

Cada prioridade fecha com QA antes da próxima:

- `npm run typecheck`
- `npm run test`
- `npm run test:db` quando houver Supabase local disponível
- varredura de rotas paralelas, código legado e fontes duplicadas de permissão

## P0 — Estabilização

1. Permissões: preparar cutover para `user_page_grants`.
   - Criar RPC de reconciliação de grants ativos.
   - Fazer Create/Edit User sincronizar defaults do cargo, páginas extras e `mtech`.
   - Manter runtime legado até QA confirmar paridade.

2. Rotas: trocar guards paralelos por um wrapper único por `pageSlug`.
   - Substituir rotas PRO+ e páginas internas com `PageAccessRoute`.
   - Remover guards internos redundantes quando forem só duplicação.

3. Kanban: corrigir risco de cards invisíveis por RLS.
   - Garantir que criação manual em board global tenha `client_id` quando a policy exigir.
   - Mapear casos em que card operacional pode ser sem cliente e ajustar policy ou fluxo.

4. Criação de cliente/tarefas: concluir rollout da RPC transacional.
   - ~~Validar flag `use_rpc_client_creation`.~~ ✓ flag rodava em prod com `enabled=true`.
   - Caminho legado removido em 2026-04-29:
     - `createClientLegacy()` (343 linhas) deletado de `src/hooks/useClientRegistration.ts`.
     - Branch `if (useRpc) ... else legacy` substituído por chamada direta a `createClientViaRpc`.
     - `useFeatureFlag('use_rpc_client_creation')` removido do hook.
     - Imports `useAuth`, `useFeatureFlag`, `createNewClientNotificationAndTask`, `createWelcomeTaskForProjectManager`, `addDays`, `addMonths`, `parseISO` excluídos (só serviam ao legado).
     - Migration `20260429210000_remove_use_rpc_client_creation_flag.sql` aplicada — row da flag removida.
     - `create_client_with_automations` segue sendo a única porta de entrada (tudo-ou-nada, idempotência via `client_idempotency_keys`).

## P1 — Contratos de Backend

1. Criar RPCs transacionais para kanban.
   - `kanban_create_card`
   - `kanban_move_card`
   - `kanban_archive_card`
   - `kanban_delete_card`
   - Status: concluído em 2026-04-28.
   - Frontend genérico e boards especializados passaram a chamar RPCs em vez de mutar `kanban_cards` direto.
   - Migrations aplicadas:
     - `20260428200000_align_kanban_rls_with_page_grants.sql`
     - `20260428203000_kanban_card_operation_rpcs.sql`

2. Migrar dashboards para RPCs/views agregadas.
   - Remover `select('*')` em visões executivas.
   - Remover placeholders e métricas aleatórias.
   - Status: em execução.
   - Concluído (financeiro):
     - `FinanceiroOverviewDashboard` migrado para RPC única `get_financeiro_overview()`.
     - Antes: 5 queries (`financeiro_contas_receber.*`, `financeiro_contas_pagar.*`, `mrr_changes.*`, `upsells.*`, `clients.*`) somadas no React.
     - Agora: 1 RPC retornando `{ contasReceber, contasPagar, mrr, contratosExpirando, distratos }` agregado no DB.
     - Acesso: financeiro + admin + executive.
     - Migration aplicada: `20260429170000_financeiro_overview_rpc.sql`.
     - Hook `useFinanceiroOverview()` criado.
   - Concluído (outbound):
     - `useOutboundDashboard` migrado para RPC única `get_outbound_dashboard(_manager_id uuid DEFAULT NULL)`.
     - Antes: 7 queries (`clients.*`, `client_onboarding.*`, `client_daily_tracking.*`, `client_product_churns.*`, `outbound_tasks.*`, `outbound_meetings.*`, `outbound_daily_documentation.*`) baixadas e agregadas no React.
     - Agora: 1 RPC retornando KPIs + funnel + statusData + managerPerformance + monthlyEvolution agregados no DB. Filtro por manager opcional via parâmetro `_manager_id`.
     - Acesso: outbound + sucesso_cliente + admin + executive.
     - Migration aplicada: `20260429180000_outbound_dashboard_rpc.sql`.
     - `managers` continua vindo de `useOutboundManagerBoards` (lookup pequeno).
   - Concluído (TV dashboard):
     - `useTVDashboardStats` migrado para RPC única `get_tv_dashboard_stats()`.
     - Antes: 8 queries baixando até 5000 kanban_cards + 2000 ads_tasks + 2000 comercial_tasks + 2000 clients + 2000 client_onboarding + 1000 columns + 500 profiles + 500 user_roles e agregando no React por profissional.
     - Agora: 1 RPC retornando array `all` de ProfessionalStats com pending/done_today/delayed por role já agregados via CTEs (kanban_stats, comercial_stats, ads_stats, ads_client_counts). Frontend só faz split por role.
     - Acesso: authenticated (TV interno).
     - Migration aplicada: `20260429190000_tv_dashboard_stats_rpc.sql`.
     - Smoke: 21 profissionais retornados.
   - Concluído:
     - `CEODashboardPage` / `useCEOIndicadores` agora usa `get_ceo_indicadores(_month)`.
     - O cálculo mensal financeiro/receita/churn/MRR saiu do browser e passou para RPC agregada.
     - Migration aplicada: `20260428210000_ceo_indicadores_rpc.sql`.
     - `MillennialsGrowthDashPage` / `useCEOAdvancedStats` agora usa `get_ceo_advanced_stats()`.
     - A visão avançada deixou de baixar tabelas completas no browser e passou a consumir payload agregado do backend.
     - Migrations aplicadas:
       - `20260428213000_ceo_advanced_stats_rpc.sql`
       - `20260428214000_fix_ceo_advanced_stats_rpc_stable.sql`
       - `20260428215000_fix_ceo_advanced_stats_no_nested_aggs.sql`
     - Observação: os detalhes profundos por gestor, squads, produto, produção e listas analíticas foram mantidos com contrato estável, mas simplificados em arrays vazios/zeros quando exigiam agregações complexas. Próximo bloco deve separar esses detalhes em RPCs menores e testáveis, em vez de concentrar tudo em uma função gigante.
   - Quebra em sub-RPCs concluída:
     - `get_ceo_advanced_stats()` agora compõe payload chamando 7 sub-RPCs por domínio: `get_ceo_stats_onboarding()`, `_production()`, `_churn()`, `_client_labels()`, `_group_squad()`, `_financial()`, `_tasks()`. Contrato externo (forma do JSON) preservado.
     - `_onboarding` ganhou implementação **real**: `byManager` (gestor_ads), `activeByMilestone`, `avgDaysToComplete` calculados de `client_onboarding`.
     - `_churn` ganhou `churnedLastMonth` real. `byManager`/`distratoClients` ainda placeholder.
     - `_financial` e `_tasks` mantêm agregados reais; `byProduct`/`monthlyTrend`/`overdueByArea` continuam placeholder.
     - `_production`, `_group_squad` permanecem placeholder até próximo corte.
     - Cada sub-RPC valida `is_executive(caller) OR is_admin(caller)`.
     - Migration aplicada: `20260429140000_split_ceo_advanced_stats_into_sub_rpcs.sql`.
     - Smoke test: keys do payload mantidas (10 top-level), sub-RPCs retornam payload esperado.
   - Implementação real preenchida em mais 3 sub-RPCs:
     - `_production`: avgDays/totalCompleted/pending por board especializado (design, video, produtora, atrizes) lendo `kanban_cards` agrupado por `card_type` × status final (`aprovado` para design/video, `aprovados` para devs/atrizes, `gravado` para produtora).
     - `_churn`: `byManager` agrega churns por `assigned_ads_manager`. `topChurnManager` retorna o gestor com mais churns. `distratoClients` lista clientes em distrato com nome/step/monthly_value.
     - `_client_labels`: `byManager` distribui labels (otimo/bom/medio/ruim/sem) por gestor de ads. `topRuimManager` retorna gestor com mais clientes "ruim".
     - Migration aplicada: `20260429150000_implement_ceo_stats_production_and_byManager.sql`.
     - Smoke test: payload populado com dados reais (3 managers no byManager de client_labels, 4 clientes ativos contabilizados).
   - Quebra finalizada (sem placeholders):
     - `_financial.byProduct`: `SUM(monthly_value)` agrupado por `product_slug` em `financeiro_active_clients`.
     - `_financial.monthlyTrend`: série de 6 meses (atual + 5 anteriores) com `recebido`, `pago`, `receivable`, `payable`, `result` por `mes_referencia`.
     - `_tasks.overdueByArea`: array com 4 áreas (kanban, ads, comercial, rh) e contagem de overdue por área.
     - `_group_squad`: agregado por `organization_groups` ⨯ `squads` aninhado, com `total_clients`/`active_clients`/`churned_clients`/`total_mrr`. Fix aplicado para `COUNT(*) FILTER` em LEFT JOIN não contar squad vazio.
     - Migration aplicada: `20260429160000_finalize_ceo_stats_remaining_placeholders.sql`.
     - Smoke test: byProduct retorna 2 produtos (Torque CRM, Millennials Growth); monthlyTrend retorna 6 meses; overdueByArea com kanban=1, rh=1; group_squad retorna Grupo 1/Grupo 2 com squads aninhados (Fenix MRR R$ 227.500).
     - **`get_ceo_advanced_stats()` agora 100% real, sem placeholders zerados.**

3. Centralizar permissões de ações.
   - Create/move/archive/edit briefing devem ser derivados do backend.
   - Adicionar testes por papel.
   - Status: em execução.
   - Concluído:
     - Criada a função canônica `can_operate_kanban_card(_user_id, _board_id, _action)`.
     - RPCs `kanban_create_card`, `kanban_move_card`, `kanban_archive_card` e `kanban_delete_card` agora validam ação no backend, não apenas visualização.
     - Boards especializados (`design`, `editor-video`, `devs`, `produtora`, `atrizes-gravacao`) passaram a ter matriz de ação no banco.
     - Boards ainda não especializados preservam compatibilidade via `can_view_board` até receberem matriz própria.
     - Migration aplicada: `20260428220000_centralize_kanban_action_permissions.sql`.
   - Corte seguinte concluído:
     - Criada a RPC `get_kanban_action_permissions(_board_id)`.
     - Criados `fetchKanbanActionPermissions` e `useKanbanActionPermissions`.
     - `KanbanBoard` e `SpecializedKanbanBoard` agora preferem as permissões de ação retornadas pelo backend para criar, mover, arquivar e excluir.
     - Migration aplicada: `20260429100000_get_kanban_action_permissions_rpc.sql`.
     - Teste unitário adicionado para normalização defensiva do payload de permissões.
   - Próximo corte:
     - Remover gradualmente os helpers locais `canCreate*`, `canMove*`, `canArchive*` depois de cobrir todos os boards com matriz backend.
     - Criar RPCs específicas para upsert de briefings e anexos, porque ainda há inserts diretos em tabelas de briefing após a criação do card.
   - Corte de briefings concluído:
     - Criada a RPC `upsert_kanban_briefing(_card_id, _briefing_type, _payload)`.
     - A RPC valida `can_operate_kanban_card(..., 'edit_briefing')` antes de gravar.
     - Tipos cobertos: `design`, `video`, `dev`, `produtora`, `atrizes`.
     - Hooks `useUpsert*Briefing` e criação de cards especializados passaram a usar RPC em vez de insert/update direto nas tabelas de briefing.
     - Migrations aplicadas:
       - `20260429103000_upsert_kanban_briefing_rpc.sql`
       - `20260429104000_fix_upsert_kanban_briefing_array_append.sql`
   - Corte de anexos concluído:
     - Criadas as RPCs `create_kanban_card_attachment(_card_id, _file_name, _file_url, _file_type, _file_size)` e `delete_kanban_card_attachment(_attachment_id)`.
     - Ambas validam `can_operate_kanban_card(..., 'edit_briefing')` antes de gravar/remover. Upload no Storage continua no cliente; só o vínculo migrou pro backend.
     - `src/lib/kanbanAttachmentOperations.ts` centraliza as chamadas. Hooks compartilhados `useUploadAttachment` e `useDeleteAttachment` (em `useDesignKanban.ts`) consumidos por todos os boards (design, video, devs, produtora, atrizes, CardDetailModal) passaram a usar as RPCs em vez de `.from('card_attachments').insert/.delete`.
     - Reads diretos remanescentes (`useCardAttachments.ts`, `useDesignKanban.ts:268`) são apenas SELECT cobertos pela RLS canônica de `card_attachments`.
     - Migration aplicada: `20260429110000_kanban_attachment_rpcs.sql`.
     - Validação Supabase: chamada anônima bloqueia com `auth required` (ERRCODE 28000).
   - Corte de helpers locais concluído:
     - `KanbanBoard`, `SpecializedKanbanBoard` e `CardDetailModal` deixaram de calcular fallback local via `canOperateKanban`+helpers legacy. Toda matriz vem de `useKanbanActionPermissions(boardId)` (RPC `get_kanban_action_permissions`).
     - Wrapper boards (`DesignKanbanBoard`, `VideoKanbanBoard`, `DevsKanbanBoard`, `ProdutoraKanbanBoard`, `AtrizesKanbanBoard`) não passam mais `permissions` no config.
     - Helpers `canCreate*Card`, `canMove*Card`, `canArchive*Card`, `canEdit*Briefing` removidos dos hooks `useDesignKanban`, `useVideoKanban`, `useDevsKanban`, `useProdutoraKanban`, `useAtrizesKanban`. Constantes de role (`*_CARD_CREATORS`, `*_CARD_ARCHIVERS`, `*_CARD_MOVERS`, `*_BRIEFING_EDITORS`) também excluídas — não tinham mais consumidor.
     - `canViewXBoard` (a única decisão de visualização) preservado por enquanto.
     - `SpecializedKanbanBoard` agora repassa `boardId` para `CardDetailModal`, que usa o mesmo hook para `canDelete`/`canEditBriefing`.
     - Test suite ajustada (`SpecializedKanbanBoard.test.tsx` sem prop `permissions`).
   - Corte de boards funcionais concluído:
     - `can_operate_kanban_card` ganhou matriz explícita para os 6 page_slugs restantes: `rh`, `financeiro`, `gestor-crm`, `outbound`, `consultor-mktplace`, `consultor-comercial`.
     - Cada matriz reflete o role "dono" do domínio + `sucesso_cliente` quando faz sentido operacional. Admins (`ceo`, `cto`, `gestor_projetos`) continuam bypass via `is_admin`.
     - Boards COM page_slug não-mapeado agora retornam `false` (fail-closed) — força matriz explícita em vez de fallback permissivo.
     - Boards SEM page_slug (operacionais internos: `ads-*`, `b2b-*`, `ceo`, `cadastro-novos-clientes`, `grupo-*`, `forja`, `millennials-hunting`, `on-demand`, `organic`, `septem`, `vendedor-pastinha-*`, `zydon`) continuam com fallback permissivo até ganharem `page_slug` próprio.
     - Migration aplicada: `20260429120000_extend_kanban_action_matrix_remaining_boards.sql`.
     - Smoke test no banco: 121 combinações de (board, role) verificadas — cada role só opera no domínio próprio.
   - Corte de boards operacionais internos concluído:
     - 13 boards ganharam `page_slug`: 5 `ads-*` + 2 `grupo-2-squad-*-ads` ⇒ `gestor-ads`; 2 `grupo-2-squad-*-design` ⇒ `design`; 2 `grupo-2-squad-*-devs` ⇒ `devs`; 2 `grupo-2-squad-*-video` ⇒ `editor-video`; `cadastro-novos-clientes` ⇒ `cadastro-clientes`.
     - Matrizes adicionadas: `gestor-ads` ⇒ `gestor_ads, sucesso_cliente`; `cadastro-clientes` ⇒ `sucesso_cliente`.
     - Boards remanescentes sem `page_slug` (13: `ceo`, `forja`, `b2b-club`, `b2b-summit`, `grupo-1-projetos`, `grupo-2-projetos`, `millennials-hunting`, `on-demand`, `organic`, `septem`, `vendedor-pastinha-comunidade`, `vendedor-pastinha-educacional`, `zydon`) são kanbans admin-only / produtos internos. Continuam no fallback permissivo até audit caso-a-caso de propriedade.
     - Migration aplicada: `20260429130000_assign_page_slug_internal_boards_and_extend_action_matrix.sql`.
   - Corte fail-closed concluído:
     - Audit dos 13 boards remanescentes (`b2b-club`, `b2b-summit`, `ceo`, `forja`, `grupo-1-projetos`, `grupo-2-projetos`, `millennials-hunting`, `on-demand`, `organic`, `septem`, `vendedor-pastinha-comunidade`, `vendedor-pastinha-educacional`, `zydon`): todos com `allowed_roles=[]` e sem squad/category — efetivamente admin-only via `can_view_board`.
     - Branch `IF v_page_slug IS NULL THEN ... permissive` substituído por `RETURN false` (fail-closed total). Admins continuam passando via `is_admin` no early return.
     - Migration aplicada: `20260429200000_can_operate_kanban_card_fail_closed.sql`.
     - Smoke: CEO opera board NULL ✓, gestor_ads em board NULL bloqueado ✓, gestor_ads em board design (matriz) ✓.
     - pgTAP atualizado: 2 asserts NULL invertidos para `NOT ok(...)`. 53/53 passa.
     - **`can_operate_kanban_card` agora 100% fail-closed.**

## P2 — Limpeza Estrutural

1. Finalizar consolidação dos kanbans especializados.
   - Estado prévio: 5 wrappers (~75 linhas cada) + `SpecializedKanbanBoard` (974 linhas).
   - Corte de hooks de delay/justificativa concluído (2026-04-29):
     - 4 hooks duplicados (~278 linhas cada) — `useDesignDelayNotifications`, `useVideoDelayNotifications`, `useDevsDelayNotifications`, `useProdutoraDelayNotifications` — reescritos como wrappers finos (~34 linhas cada) sobre `createKanbanDelayHooks(config)` factory novo.
     - Lógica idêntica (overdue cards, dismissals, justified, create/dismiss/notify) centralizada em `src/hooks/createKanbanDelayHooks.ts` (314 linhas).
     - Redução: 4×278 = 1112 linhas → 4×34 + 314 = 450 linhas (**−662 linhas / −60%**).
     - API externa preservada — consumidores (`DesignDelayModal`, `VideoDelayModal`, etc.) intocados.
   - Corte de hooks de completion notifications concluído (2026-04-29):
     - 3 hooks duplicados (~255 linhas cada) — `useDesignCompletionNotifications`, `useVideoCompletionNotifications`, `useDevsCompletionNotifications` — reescritos como wrappers finos (~23 linhas) sobre `createKanbanCompletionHooks(config)` factory novo.
     - `useProdutoraCompletionNotifications` preservado (usa realtime channel — comportamento divergente).
     - Lógica idêntica (fetch, markRead, create, toasts, cardCreator, multipleCreators) centralizada em `src/hooks/createKanbanCompletionHooks.ts` (265 linhas).
     - Redução: 3×255 = 765 linhas → 3×23 + 265 = 334 linhas (**−431 linhas / −56%**).
     - API externa preservada — consumidores intocados.
   - Corte de delay modals concluído (2026-04-29):
     - 4 modais duplicados (~125 linhas cada) — `DesignDelayModal`, `VideoDelayModal`, `DevsDelayModal`, `ProdutoraDelayModal` — reescritos como wrappers finos (~25 linhas) sobre `KanbanDelayModal` genérico.
     - Lógica idêntica (state de current card, submit, mutation, layout) centralizada em `src/components/kanban/KanbanDelayModal.tsx` (140 linhas).
     - Config injetado: `useCreateJustification` (hook do factory de delay) + `title` opcional.
     - Redução: 4×125 = 497 linhas → 4×25 + 140 = 240 linhas (**−257 linhas / −52%**).
     - API externa preservada — cada wrapper exporta default igual ao anterior.
   - Corte de Produtora completion (realtime) concluído (2026-04-29):
     - `createKanbanCompletionHooks` ganhou `realtime?: { channelName }` e `briefingsTable?` opcional.
     - `useProdutoraCompletionNotifications` (229 linhas) reescrito como wrapper (28 linhas) sobre o factory.
     - Toast usa `postgres_changes` channel quando `realtime` configurado; senão polling.
     - Redução: −201 linhas adicionais. Total consolidado completion: 4 boards.
2. Remover código legado de permissões e criação de cliente. ✓
3. Padronizar query keys e invalidações. ✓ (parcial)
   - Catálogo central criado em `src/lib/queryKeys.ts` (clients, kanban, specializedBoard, delay, completion, attachments, cardActivity, briefing, dashboards, pageGrants, tasks).
   - Factory hierárquica permite invalidar tudo de um domínio (`queryKeys.kanban.all`) sem listar caso a caso.
   - Migração progressiva: novos hooks adotam diretamente; hooks antigos serão convertidos sob demanda.
4. Painel de auditoria entregue (2026-04-29):
   - Tabela `public.page_access_audit` (user_id, page_slug, user_role, grant_source ∈ {role_default, page_grant, admin_bypass}, accessed_at).
   - RPC `log_page_access(_page_slug)`: registra acesso. Idempotente em janela de 5 min.
   - RPC `get_page_access_audit(_user_id, _page_slug, _since, _limit)`: leitura paginada com filtros, apenas admins.
   - Hook `useLogPageAccess(slug)` integrado em `PageAccessRoute` — registra automaticamente em cada acesso autorizado.
   - Página `/admin/auditoria` (`AuditoriaPage`) lista acessos com filtros (page_slug, janela 24h/7d/30d/tudo). RLS limita SELECT a admins.
   - Migration aplicada: `20260429220000_page_access_audit.sql`.

## QA Gates

P0 só fecha quando:

- Nenhuma rota importante usa decisão diferente da sidebar.
- Create/Edit User mantém `user_page_grants` em paridade com o modelo legado.
- Cards/tarefas criados não desaparecem após reload por RLS.
- Criação de cliente não deixa automação parcial.

P1 só fecha quando:

- Movimentação de kanban é transacional. ✓ (RPCs `kanban_*` aplicadas em 2026-04-28).
- Dashboards não dependem de payloads completos no browser. (parcial — CEO indicadores e advanced stats migrados; pendente quebra do advanced stats em RPCs menores.)
- Testes cobrem pelo menos CEO, CTO, gestor_projetos, gestor_ads, sucesso_cliente, financeiro, rh e executor de área. ✓ (`supabase/tests/can_operate_kanban_card_matrix_test.sql` — 53 asserts cobrindo 16 papéis × 14 boards.)

P2 só fecha quando:

- Código legado removido.
- Documentação atualizada.
- Build, unit tests e DB tests passam.
