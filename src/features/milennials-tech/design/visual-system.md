# Milennials Tech — Sistema Visual (#154)

Sistema visual reutilizável para o tracker interno. **IA Jira, dark-first, acabamento da casa** (Apple/Stripe/Linear-grade de polish; a *estrutura* é Jira). Consumido por #156 (board/backlog), #157 (issue-view) e o roadmap.

> Modelo de domínio: **PRD #152**. O `TaskCard.tsx` legado (BUG/FEATURE/HOTFIX/CHORE + priority) está **obsoleto** para esta superfície. Não consumir.

---

## 1. Fundações

### Tokens (`design/tokens.css`)
Tudo `--mtech-*`, escopado em `.mtech-scope`, dark-first. Herdado do baseline (#155). Adicionado em #154:

| Grupo | Tokens | Uso |
|---|---|---|
| **Issue type** | `--mtech-type-{story,bug,task}` + `-bg` | Story=verde `#34B27B`, Bug=vermelho `#E5484D`, Task=azul `#4C9AFF` (convenção Jira) |
| **Workflow status** | `--mtech-status-{backlog,todo,in-progress,review,awaiting,changes,done}` + `-bg` | Espectro semântico dos 7 estados |
| **Exception states** | `--mtech-state-{blocked,changes,awaiting}` + `-bg` | Flags ortogonais que empilham no card |
| **Epic palette** | `--mtech-epic-1..8` | Cor categórica por Epic/Project, determinística |
| **Swimlane** | `--mtech-swimlane-header-{bg,border}` | Header de squad |

**Decisão de cor — AWAITING_APPROVAL = ouro `#F4C430` (accent da marca).** Não é arbitrário: o estado "aguardando aprovação" é literalmente o carimbo do fundador. Ouro = portão de aprovação, on-brand. Os outros estados seguem espectro frio→quente→verde (backlog cinza → todo slate → in-progress azul → review violeta → awaiting ouro → changes laranja → done verde).

### Config canônica (`lib/issueSystem.ts`)
Single source of truth: tipos, `ISSUE_TYPE_CONFIG`, `ISSUE_STATUS_CONFIG`, `BOARD_STATUS_ORDER`, `ISSUE_EXCEPTION_CONFIG`, `EPIC_PALETTE`, `epicColorFromKey()`. Componentes leem daqui — **nunca** hardcode cor/label/ícone no componente.

### Tipografia (herdado #155)
Geist + Geist Mono (`[data-mono]` → tabular-nums). Escala em uso:
- Título de card / issue: **13px** `font-medium` `leading-snug`
- Body / valor de metadado: **12px**
- Meta / label / chip: **10–11px**
- Key mono: **11px** `tracking-[0.08em]` (cards) — alinhado ao `0.12em` de prefixo do tracer, ajustado para key completa `AGS-12`
- Header de coluna: **11px** `uppercase tracking-widest`
- Label de seção/coluna de tabela: **10px** `uppercase tracking-widest`

### Densidade & grid
Grid 4px. Container = padding generoso; item = compacto. Cards `py-2.5 px-3`. Coluna `gap-2`. Respiração nos containers, densidade nos itens (Linear).

### Elevação (dark-first, camadas de preto)
`bg` `#09090B` → `surface` `#131316` (cards) → `surface-elev` `#1E1E24` (hover, chips, pills). Sem cinza-claro; profundidade por camadas de preto + border `rgba(255,255,255,.10)`.

---

## 2. Componentes presentational

Todos puros: recebem props tipadas, sem fetch/estado de dados (igual ao baseline `ProjectTracerList`). Contract types exportados por componente. Barrel: `@/features/milennials-tech`.

### 2.1 `IssueTypeBadge`
Marca de tipo — **assinatura Jira**: quadrado sólido com glyph branco.
- `variant="glyph"` (default): quadrado 16–18px cor sólida + glyph. Em cards e linhas densas.
- `variant="full"`: glyph + pílula com label uppercase. No header do issue-view e filtros.
- `issueKey?` → mono à direita.
- Glyphs: Story=`Bookmark`, Bug=`CircleDot`, Task=`SquareCheck`. A **cor** carrega a convenção; o glyph é tasteful.

### 2.2 `StoryPoints`
Pílula Fibonacci (1·2·3·5·8·13). `surface-elev` + mono tabular.
- `points={null}` → nada por default (`emptyAs="hidden"`, comportamento Jira); `emptyAs="dash"` mostra `–` faint (view de estimativa/backlog, onde o gap é sinal).

### 2.3 `IssueStateBadges`
Estados de exceção que empilham. Ortogonais ao status — um issue pode ser IN_PROGRESS **e** BLOCKED.
- Ordem fixa de prioridade: **BLOQUEADO** (mais urgente) → CHANGES_REQUESTED → AWAITING_APPROVAL.
- `size="sm"` + `reason="tooltip"` no card; `size="md"` + `reason="inline"` no issue-view (motivo do bloqueio em extenso).
- Retorna `null` quando nenhum flag ativo.

### 2.4 `IssueCard`
Card de board. Ordem de leitura (como um dev escaneia):
1. **Summary** — 13px, `line-clamp-2`, lidera o card.
2. **States** — `IssueStateBadges` sm, só quando presente.
3. **Epic chip** — dot colorido + label uppercase, só quando pertence a um epic.
4. **Footer** — `IssueTypeBadge glyph + key` (esq) · `StoryPoints + assignee avatar` (dir).

Detalhes: rail de epic de **2px** na borda esquerda (`epicColor`) agrupa por epic sem gastar uma linha. Hover = `border-strong` + `bg surface-elev` (sem transform 3D — densidade Jira). Focus-visible ring inset. Assignee sem nome → avatar tracejado `?`. Largura = preenche a coluna.

`IssueCardData`: `id, key, title, type, storyPoints?, assignee?, epicColor?, epicLabel?, isBlocked?, blockerReason?, changesRequested?, awaitingApproval?, labels?`.

### 2.5 `BoardColumn`
Lane de status. Header = ícone+dot de status, label uppercase 11px tracking-widest, contagem tabular à direita (ecoa `ProjectKanbanColumn`). Largura default **300px** (cards de issue são mais densos que os 370px de cards de projeto).
- `wipLimit?` → renderiza `count/limit`; vira danger quando excede (única vez que a contagem levanta a voz).
- `isDraggingOver` → tint da lane com a cor do status a 10%.
- `children` = lista de cards (o caller liga o droppable — `@hello-pangea/dnd`, como o baseline).

### 2.6 `BoardSwimlane`
Agrupamento por squad (front/back), colapsável. Header full-width: chevron + dot de squad + label uppercase + contagem. Controlado (`collapsed`+`onToggle`) ou uncontrolled. Envolve uma **row de `BoardColumn`**. `accentColor` = `epicColorFromKey(squad)` ou token fixo.

### 2.7 `IssueViewLayout` (shell 2 painéis)
```
┌──────────────────────────────┬──────────────┐
│ header (key · título · type) │              │
├──────────────────────────────┤  sidebar     │
│ main (descrição, atividade,  │  (metadados: │
│  comentários — measure ~680) │   status,    │
│                              │   assignee,  │
│                              │   points…)   │
└──────────────────────────────┴──────────────┘
```
- **Main**: narrativa em medida legível (`max-w-680`). **Sidebar**: 300px, metadados como label/value.
- Helpers: `IssueViewSidebarSection` (grupo titulado) + `IssueViewSidebarField` (grid `96px_1fr`, valores alinham em coluna). Valor = qualquer node (badge, avatar+nome, pílula de pontos, chip de epic).
- Responsivo: empilha em 1 coluna abaixo de `md` (sidebar vai pro fim, `border-t`).

---

## 3. Estados (todo componente cobre)

| Estado | Tratamento |
|---|---|
| **Loading** | Skeleton coerente (pulse em `surface-elev`) — padrão do `ProjectTracerList.SkeletonRows`. Board: 2–3 cards skeleton por lane. |
| **Empty** | Lane vazia = altura mínima 120px, droppable ativo (alvo de drop), sem "No data". Board sem issues = empty state com CTA (copy humana + próximo passo, padrão do tracer). |
| **Error** | Borda/ícone danger + mensagem útil + retry. (Camada de dados em #156 — o shell aceita o slot.) |
| **Overflow** | Título `line-clamp-2`; key/epic `truncate`; assignee stack com `+N`; coluna scroll vertical. |
| **Blocked/changes/awaiting** | `IssueStateBadges` — empilham, ordem de prioridade fixa. |

---

## 4. Interação keyboard-first

Coerente com o `CommandPalette` (cmdk) já existente. **#154 documenta o sistema; não reimplementa features.**

### Já existe
- **Cmd/Ctrl+K** → command palette.
- Hints `G B` (backlog), `G K` (kanban), `G S` (sprints), `C` (nova task).

### Sistema de atalhos a adotar (#156/#157 implementam)
| Tecla | Ação | Contexto |
|---|---|---|
| `j` / `k` | Próximo / anterior card | Board, backlog |
| `Enter` | Abrir issue selecionado | Board, backlog |
| `Esc` | Fechar issue-view / deselecionar | Issue-view |
| `c` | Criar issue | Global (já mapeado) |
| `b` | Toggle BLOQUEADO no issue focado | Board, issue-view |
| `1`–`7` | Transição de status (ordem `BOARD_STATUS_ORDER`/workflow) | Issue focado |
| `a` | Atribuir (abre picker de assignee) | Issue focado |
| `e` | Estimar (abre picker Fibonacci) | Issue focado |
| `/` | Focar busca/filtro | Board, backlog |

Convenções: atalhos de transição respeitam o **workflow fixo** (`ISSUE_STATUS_CONFIG.order`). Toda ação de teclado tem equivalente de mouse. `kbd` hints renderizados como no palette (10px, `text-subtle`, `ml-auto`).

### Foco & navegação
- Todo card/linha/coluna navegável é `tabIndex`, `role="button"`, `Enter`/`Space` ativa (padrão `ProjectTracerList`).
- `focus-visible:ring-1 ring-inset ring-[var(--mtech-input-focus)]` — ring de foco coerente, nunca `outline:none` sem substituto.
- `j/k` movem foco real (`.focus()`), não só seleção visual — screen-reader e teclado convergem.

---

## 5. Acessibilidade
- **Contraste**: texto principal `#F0F0F3` em `#131316` (AAA). Muted `#A0A0AD` em surface ≈ AA. Cores de type/status só carregam significado **acompanhadas de** glyph + label (nunca cor isolada).
- **aria**: glyphs decorativos `aria-hidden`; badges têm `aria-label`; swimlane `aria-expanded`; coluna `aria-label`.
- **Keyboard**: navegação ponta-a-ponta (seção 4).
- **reduced-motion**: animações são transições de cor/posição curtas; nenhuma decorativa. Respeitar `prefers-reduced-motion` ao adicionar drag/layout animations em #156.

---

## 6. Animação
| O quê | Duração | Easing | Justificativa |
|---|---|---|---|
| Hover de card/coluna | instantâneo (`transition-colors`) | — | Feedback imediato, sem distração |
| Drag-over tint da lane | `transition-colors` | — | Mostra alvo de drop |
| Lane/swimlane collapse | 150–200ms ease-out (#156) | ease-out | Mudança de estado perceptível |
| Card enter/leave no board | `AnimatePresence` (já no baseline) | layout | Reordenação compreensível |

**Sem** transform 3D / scale exagerado em hover (red flag). Só anima mudança de estado que o usuário precisa perceber.

---

## 7. Contrato de consumo (#156/#157)

```ts
import {
  IssueCard, IssueCardData,
  BoardColumn, BoardSwimlane,
  IssueTypeBadge, IssueStateBadges, StoryPoints,
  IssueViewLayout, IssueViewSidebarSection, IssueViewSidebarField,
  // config
  ISSUE_STATUS_CONFIG, BOARD_STATUS_ORDER, ISSUE_TYPE_CONFIG,
  epicColorFromKey, FIBONACCI,
} from '@/features/milennials-tech';
```

- **#156 (board)**: itera `BOARD_STATUS_ORDER` → `BoardColumn`; mapeia issues → `IssueCardData` → `IssueCard`; liga `@hello-pangea/dnd` (caller é dono do droppable/draggable). Swimlane por squad = agrupa por `squad`, envolve as colunas em `BoardSwimlane`. Cor de epic via `epicColorFromKey(epic.key)`.
- **#156 (backlog)**: `IssueTypeBadge glyph + key`, `StoryPoints emptyAs="dash"`, `IssueStateBadges` em linha densa (reusar densidade do `ProjectTracerList`).
- **#157 (issue-view)**: `IssueViewLayout`; sidebar = `IssueViewSidebarField` por metadado (status → badge de status, assignee → avatar+nome, points → `StoryPoints`, epic → chip). Estados de exceção no topo do main com `reason="inline"`.

**Regra**: mapear dados → contract type na borda do data layer. Componentes nunca veem a row do Supabase crua.

---

## 8. Aberto (decisão do fundador)
1. **Epic color**: determinística por hash de key (`epicColorFromKey`) **ou** cor escolhida/persistida por epic? Hash = zero config, estável; persistido = controle editorial. Default entregue: hash. Trocar para persistido é só passar `epicColor` explícito no `IssueCardData`.
2. **WIP limits**: tokens/UI prontos (`BoardColumn.wipLimit`); origem do limite (config de board) é decisão de produto em #156.
3. **Glyphs de tipo**: cor segue Jira à risca; glyphs são da casa (Bookmark/CircleDot/SquareCheck). Se quiser fidelidade 1:1 com os ícones Jira, sinalizar.
