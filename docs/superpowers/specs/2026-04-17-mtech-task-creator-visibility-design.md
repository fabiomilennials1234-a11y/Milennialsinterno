# Milennials Tech — Visibilidade do criador da task (Design)

**Data:** 2026-04-17
**Escopo:** Garantir que toda task do módulo Milennials Tech (`tech_tasks`) seja vinculada de forma confiável e visível ao usuário que a criou, em ambos os fluxos de criação (formulário interno e rota pública `/submit-task`).
**Status:** Design aprovado. Próximo passo: plano de implementação (writing-plans).

---

## 1. Problema

O banco já persiste `tech_tasks.created_by` (`NOT NULL REFERENCES auth.users(id)`) em ambos os fluxos:

- Formulário interno: `TaskFormModal.tsx:92-103` envia `created_by: user.id` explicitamente.
- Rota pública `/submit-task`: RPC `tech_submit_task` (migration `20260416170000_submit_task_rpc.sql:40-41`) grava `auth.uid()` server-side.

O que falta:

1. **UI não exibe o criador em nenhum lugar.** O `TaskCard` e o `TaskDetailModal` mostram apenas o responsável (`assignee_id`). Quando o time precisa discutir uma task, não tem como saber quem a criou sem consultar o banco.
2. **`created_by` é mutável.** Nenhuma RLS ou trigger impede um UPDATE de alterar a coluna. Um executivo com permissão de UPDATE pode trocar o criador — mesmo que seja acidente, compromete a verdade do vínculo.

## 2. Objetivo

Tornar a autoria de cada task **visível e imutável**, sem novas queries, sem alterações de API, e sem interferir nas permissões existentes.

## 3. Design

### 3.1 Imutabilidade de `created_by` no banco

Nova migration cria um trigger `BEFORE UPDATE` em `public.tech_tasks` que bloqueia qualquer tentativa de alterar `created_by`:

```sql
CREATE OR REPLACE FUNCTION public.tech_tasks_lock_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tech_tasks_lock_created_by
  BEFORE UPDATE ON public.tech_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tech_tasks_lock_created_by();
```

**Por que trigger e não RLS:** políticas RLS não têm acesso a `OLD` para comparar valores antes/depois de um UPDATE. Trigger é o mecanismo nativo correto.

**Teste pgTAP** (`supabase/tests/tech_tasks_created_by_immutable_test.sql`) cobre três cenários:
1. UPDATE normal (outros campos) passa.
2. UPDATE tentando trocar `created_by` falha com SQLSTATE `42501`.
3. UPDATE como executivo (CEO/CTO) tentando trocar `created_by` também falha — o trigger roda independente da RLS.

### 3.2 Exibição no card (kanban/backlog)

Arquivo: `src/features/milennials-tech/components/TaskCard.tsx`.

Regra visual:

| Situação | Render |
|---|---|
| `created_by === assignee_id` | Um avatar (20px) com micro-badge "own" (dot 8px no canto inferior direito) |
| `created_by !== assignee_id` | Stack de dois avatares (`-space-x-2`): criador atrás, assignee na frente. Tooltip no hover identifica cada um ("Criada por X" / "Responsável: Y") |
| sem assignee | Só avatar do criador, sem badge |
| `profileMap[created_by] === undefined` | Avatar com iniciais `??`, tooltip "Criador indisponível" |

Iniciais via `getInitials()` já exportado em `hooks/useProfiles.ts:39`. Badge "own" é um dot com cor de acento (reuso da paleta existente), sem texto.

### 3.3 Exibição no sidebar do modal de detalhes

Arquivo: `src/features/milennials-tech/components/TaskDetailModal.tsx`.

Novo bloco **acima** de "Responsável" no sidebar direito:

```
Criada por
[Avatar 32px]  Nome Completo
               16/abr 14:32
```

Formato:
- Nome: `text-sm font-medium`
- Data: `text-xs text-muted-foreground`, formato `dd/MMM HH:mm` (date-fns pt-BR, consistente com o timeline de atividade existente no mesmo componente)
- Fallback perfil removido: itálico muted "Usuário removido", data ainda visível
- **Não clicável.** Informação, não ação.

Quando `created_by === assignee_id`, ambos os blocos aparecem mesmo assim no detalhe — no modal a redundância é informação útil (contexto completo). A economia visual só vale no card.

### 3.4 Outras listagens de task

Dois componentes adicionais listam tasks e devem receber o mesmo avatar discreto pra consistência:

- `TaskRow.tsx:78` (view de lista/tabela do backlog)
- `SprintFormModal.tsx:249` (tasks dentro de uma sprint)

Mesma regra do card (3.2). Sem novo modal de detalhe nesses componentes — clique leva ao `TaskDetailModal` existente que já vai ter o bloco do 3.3.

### 3.5 Fonte de dados

Hook existente `useProfileMap()` (`hooks/useProfiles.ts:26`):
- Já carregado por `TaskCard`, `TaskRow`, `TaskDetailModal` e `SprintFormModal`.
- Cache React Query com `staleTime: 5 min`.
- Retorna `Record<user_id, name>`.

**Zero query nova.** Basta ler `profileMap[task.created_by]` onde o assignee já é lido.

## 4. Arquivos impactados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/migrations/20260417xxxxxx_tech_tasks_lock_created_by.sql` | novo | Trigger de imutabilidade |
| `supabase/tests/tech_tasks_created_by_immutable_test.sql` | novo | pgTAP cobrindo 3 cenários |
| `src/features/milennials-tech/components/TaskCard.tsx` | edit | Avatar stack + badge own |
| `src/features/milennials-tech/components/TaskRow.tsx` | edit | Célula/avatar do criador |
| `src/features/milennials-tech/components/TaskDetailModal.tsx` | edit | Bloco "Criada por" no sidebar |
| `src/features/milennials-tech/components/SprintFormModal.tsx` | edit | Avatar stack nas tasks da sprint (line 249) |

## 5. Fora de escopo

- Filtro/busca por criador no kanban ou backlog. Escolha explícita do usuário na fase de brainstorming.
- Ação de contato direto (mailto, menção) a partir do nome exibido.
- Backfill: desnecessário — `created_by` é `NOT NULL` desde o `CREATE TABLE` original (migration `20260415120200_create_tech_tables.sql:35`).
- Notificação ao criador quando a task muda de status. Separado, não relacionado à visibilidade.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Trigger bloqueia algum UPDATE legítimo (ex: job que re-atribui autoria) | Não existe hoje. Se aparecer, a exceção é explícita e o caminho é via SECURITY DEFINER function específica, não via UPDATE direto. |
| Profile do criador foi deletado → avatar quebrado | Fallback textual "Usuário removido" + iniciais `??`. Testado explicitamente. |
| `profileMap` pode não ter o criador se ele não estiver em `public.profiles` (ex: usuário só em `auth.users`) | Fallback idem acima. O hook hoje carrega todos os `public.profiles` sem filtro, então cenário raro. |
| Stack de dois avatares poluir cards densos | Tamanho pequeno (20px) + overlap `-space-x-2`. Mesma solução que o código já usa em kanbans de outros módulos. |

## 7. Critérios de aceitação

1. Migration + teste pgTAP aplicados no remoto. `supabase db test` passa.
2. UPDATE direto em `tech_tasks` alterando `created_by` (testado via `execute_sql` no dashboard) retorna erro `42501`.
3. No kanban, toda task mostra avatar(es) do criador e (quando diferente) do assignee. Hover revela quem é quem.
4. Quando criador = assignee, card mostra um avatar só com badge "own" discreto.
5. No modal de detalhes, bloco "Criada por" aparece acima de "Responsável" com nome + data formatada.
6. Tasks com criador sem profile exibem "Usuário removido" em vez de quebrar.
7. Nenhuma query nova aparece na aba Network ao abrir o kanban (validação: `useTechProfiles` já cacheado).
