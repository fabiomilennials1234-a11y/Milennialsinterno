# Plano — Consolidar 5 Specialized Boards em 1

Status: **pendente execução** · Autor: CTO + Claude · Data: 2026-04-20

## Contexto

Hoje temos 5 arquivos `*KanbanBoard.tsx` (Atrizes, Design, Video, Produtora, Devs) com ~4.240 linhas totais. Análise detectou ~85% de código idêntico duplicado. Mudanças no Kanban exigem tocar 5 arquivos toda vez; bugs corrigidos num não migram para os outros; novos boards custam 800 linhas de copy-paste.

## Escopo

Trocar 5 componentes de ~800 linhas por:

1. `SpecializedKanbanBoard.tsx` — componente único (~600 linhas).
2. 5 arquivos finos (~40 linhas cada) que passam `config` para o base.

## Superfície variável — mapeada

| Dimensão | Atrizes | Design | Video | Produtora | Devs |
|---|---|---|---|---|---|
| slug do board | `atrizes-board` | `design` | `editor-video` | `produtora-board` | `devs-board` |
| card_type | `atrizes` | `design` | `video` | `produtora` | `dev` |
| statuses const | `ATRIZES_STATUSES` | `DESIGN_STATUSES` (inline) | `VIDEO_STATUSES` | `PRODUTORA_STATUSES` | `DEV_STATUSES` (inline) |
| fallback status | `a_fazer` | `a_fazer` | `a_fazer` | `a_gravar` | `a_fazer` |
| pessoas hook | `useAtrizes` | `useDesigners` | `useEditors` | `useProdutoras` | `useDevs` |
| canCreate | `canCreateAtrizesCard` | `canCreateDesignCard` | `canCreateVideoCard` | `canCreateProdutoraCard` | `canCreateDevCard` |
| canMove | `canMoveAtrizesCard` | `canMoveDesignCard` | `canMoveVideoCard` | `canMoveProdutoraCard` | `canMoveDevCard` |
| canArchive | `canArchiveAtrizesCard` | `canArchiveDesignCard` | `canArchiveVideoCard` | `canArchiveProdutoraCard` | `canArchiveDevCard` |
| dot color | primary (amarelo) | primary | purple | primary | info |
| delay hook | — | `useDesignerDelayedCards` | `useEditorDelayedCards` | `useProdutoraDelayedCards` | `useDevDelayedCards` |
| justification hook | — | `useDesignerJustifications` | `useEditorJustifications` | `useProdutoraJustifications` | `useDevJustifications` |
| DelayModal | — | `DesignDelayModal` | `VideoDelayModal` | `ProdutoraDelayModal` | `DevsDelayModal` |
| completion notif | `useAtrizesCompletionNotifications` (único) | — | — | — | — |
| CreateCardModal | `CreateAtrizesCardModal` | `CreateDesignCardModal` | `CreateVideoCardModal` | `CreateProdutoraCardModal` | `CreateDevCardModal` |
| briefing table | `atrizes_briefings` (não-tipada) | `design_briefings` | `video_briefings` | `produtora_briefings` | — (usa `attachments` em vez de briefing) |
| briefing fields | instagram, script_url, drive_upload_url | description, references_url, identity_url, client_instagram, script_url | script_url, observations, materials_url, reference_video_url, identity_url | script_url, observations, reference_video_url | (somente materials_url + attachments) |
| CardDetail flag | — | `isDesignBoard=true` | `isVideoBoard=true` | `isProdutoraBoard=true` | `isDevBoard=true` |
| side-effect ao mover | cria notif se `aguardando_aprovacao` | — | — | — | — |

## Config contract

```ts
interface SpecializedBoardConfig<TBriefing = unknown> {
  // Identificação
  boardSlug: string;
  boardQueryKey: string;        // prefixo de query-key; ex: 'atrizes'
  cardType: string;             // inserido na coluna `card_type` do DB
  fallbackStatus: string;       // status default quando nulo
  statuses: Array<{ id: string; label: string; color: string }>;

  // Pessoas que geram colunas "BY X"
  usePeopleList: () => { data: Person[]; isLoading: boolean };
  peopleRoleLabel: string;      // 'Atrizes de Gravação', 'Designer', etc

  // Permissões
  permissions: {
    canCreate: (role: UserRole | null) => boolean;
    canMove:   (role: UserRole | null) => boolean;
    canArchive:(role: UserRole | null) => boolean;
  };

  // Visual
  columnDot: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

  // Atraso / justificativa (opcional — Atrizes não tem)
  delay?: {
    useDelayedCards: () => { data: DelayNotification[] };
    useJustifications: (personName?: string) => { data: Justification[] };
    DelayModal: React.ComponentType<DelayModalProps>;
  };

  // Notificação especial no move (opcional — só Atrizes)
  onAfterMove?: (args: { card: KanbanCard; destStatus: string; sourceStatus: string; user: User }) => Promise<void>;

  // Modais
  CreateCardModal: React.ComponentType<CreateModalProps<TBriefing>>;
  cardDetailFlag: 'isDesignBoard' | 'isVideoBoard' | 'isProdutoraBoard' | 'isDevBoard' | 'isAtrizesBoard' | null;

  // Briefing (opcional — Devs usa attachments em vez)
  briefing?: {
    tableName: string;
    fields: Array<keyof TBriefing>;  // usa os nomes do tipo do briefing
  };

  // Attachments (opcional — só Devs)
  attachments?: {
    storageBucket: string;
  };
}
```

## Ordem de migração (risco crescente)

1. **Devs** — mais simples, sem briefing table, tem attachments. Valida config de attachments.
2. **Produtora** — briefing com 3 campos. Valida fluxo de briefing padrão.
3. **Video** — briefing com 5 campos + DelayModal. Valida expansão de briefing.
4. **Design** — idem Video, statuses próprios inline. Valida override de statuses.
5. **Atrizes** — briefing table não-tipada + notificação especial no move. Valida hooks opcionais e escape de tipos.

Cada migração = 1 commit atômico. Se algum falhar, `git revert` volta o board específico sem afetar outros.

## Critérios de aceite

- [ ] Zero mudança visual (pixel parity verificada em Playwright).
- [ ] Zero mudança funcional (drag, archive, delete, create, justify idênticos).
- [ ] `npm run typecheck && npm run build && npm run test` verdes após cada commit.
- [ ] Cada board migrado deixa um arquivo ≤ 60 linhas.
- [ ] 1 teste de integração por board validando render + drag happy path.

## Rollback

Cada board é um commit isolado. Se Atrizes quebrar em prod, `git revert <sha-atrizes>` volta só Atrizes para versão pré-consolidação enquanto os outros 4 continuam consolidados.

## Não-goals

- Não mudar schema de banco.
- Não mudar RLS.
- Não adicionar features novas.
- Não mexer em ClientRegistrationBoard (estrutura muito diferente).

## Estimativa

- Scaffold `SpecializedKanbanBoard` + primeiro board (Devs): **3-4 h**.
- Cada board subsequente: **1-1.5 h**.
- Testes de regressão manual via Playwright: **1 h**.
- **Total: ~10-12 h** (1.5 dia).

## Decisão

Executar em sessões separadas para permitir revisão entre cada migração. Começar por Devs.
