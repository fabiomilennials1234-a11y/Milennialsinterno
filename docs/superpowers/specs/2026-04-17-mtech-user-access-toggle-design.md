# Milennials Tech — Toggle de acesso por usuário (Design)

**Data:** 2026-04-17
**Escopo:** Permitir que um admin conceda ou revogue o acesso ao módulo Milennials Tech por usuário, independente do cargo.
**Status:** Design aprovado. Próximo passo: plano de implementação (writing-plans).

---

## 1. Problema

O acesso à área Milennials Tech hoje é determinado puramente por cargo:

- Frontend: `MilennialsTechRoute` (`src/App.tsx:104-111`) libera só para `isExecutive(role)` ou `role === 'devs'`.
- Backend: `can_see_tech()` (`supabase/migrations/20260415120400_tech_rls_policies.sql:7-18`) filtra `role IN ('ceo','cto','devs')`. Nove policies RLS e quatro policies de storage chamam essa função.

Quando um admin cria ou edita um usuário no `/admin/usuarios` (`src/pages/admin/UsersPage.tsx`, modais em `src/components/admin/CreateUserModal.tsx` e `UpdateUserModal.tsx`), não há nenhum campo que permita conceder acesso a mtech a alguém que não tenha cargo executivo ou dev. Se um Gestor de Projetos precisar acompanhar o kanban técnico, a única saída hoje é trocar o cargo dele — o que altera permissões em dezenas de outros lugares.

## 2. Objetivo

Introduzir uma flag **aditiva** por usuário que habilita acesso a mtech sem alterar o cargo. O gate atual continua funcionando para CEO/CTO/devs; a flag só estende o acesso para outros usuários.

## 3. Design

### 3.1 Banco: coluna `profiles.can_access_mtech` + gate aditivo

Nova migration cria a coluna e redefine `can_see_tech()`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN can_access_mtech BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('ceo','cto','devs')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND can_access_mtech IS TRUE
    )
$$;
```

Todas as policies RLS que hoje chamam `can_see_tech()` (tech_sprints, tech_tasks, tech_task_collaborators, tech_time_entries, tech_task_activities, tech_task_attachments + quatro storage policies) continuam inalteradas — a função redefinida simplesmente retorna `true` para mais usuários.

**Backfill: nenhum.** CEO/CTO/devs existentes são cobertos pela primeira cláusula do `OR`. A flag começa `false` para todos e só muda quando um admin liga.

### 3.2 Banco: trigger que restringe quem altera a flag

A UPDATE policy do Postgres não é por coluna. Para impedir que um usuário comum altere `can_access_mtech` em si mesmo (ou em outro usuário, caso exista alguma policy permissiva), um trigger `BEFORE UPDATE` em `public.profiles` rejeita qualquer mudança de `can_access_mtech` quando o caller não tem cargo de admin:

```sql
CREATE OR REPLACE FUNCTION public.profiles_guard_mtech_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_access_mtech IS DISTINCT FROM OLD.can_access_mtech THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','cto','gestor_projetos','sucesso_cliente')
    ) THEN
      RAISE EXCEPTION 'Only admin roles may change can_access_mtech'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_guard_mtech_access
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_mtech_access();
```

**Por que trigger e não policy:** o cenário a prevenir é qualquer UPDATE em `profiles` por usuário não-admin que atinja essa coluna. RLS policy de UPDATE não consegue comparar `OLD/NEW` para exigir invariância condicional em uma coluna específica.

**Teste pgTAP** (`supabase/tests/profiles_mtech_access_guard_test.sql`) cobre:
1. Admin (ceo/gestor_projetos/sucesso_cliente) consegue alterar a flag.
2. Não-admin (design, rh) é bloqueado com SQLSTATE `42501`.
3. UPDATE de outras colunas da `profiles` por não-admin continua funcionando (não quebra fluxo existente).

### 3.3 Edge functions: aceitar o campo

Dois arquivos:

- `supabase/functions/create-user/index.ts` — `CreateUserRequest` ganha `can_access_mtech?: boolean`. Após o trigger criar a row de `profiles`, o handler faz um `update` explícito da coluna se o campo veio no payload.
- `supabase/functions/update-user/index.ts` — `UpdateUserRequest` ganha o mesmo campo opcional, incluído no payload de UPDATE da `profiles`.

O trigger da Seção 3.2 valida o caller — se o edge function for chamado com credenciais de usuário não-admin, o UPDATE falha naturalmente. Nenhuma duplicação de validação no handler.

### 3.4 Frontend: AuthContext + route guard + sidebar

Três pontos de alteração:

1. **`src/contexts/AuthContext.tsx`** — o tipo `User` ganha `can_access_mtech: boolean`. Onde o profile é carregado após login/refresh, incluir a coluna no `select`.
2. **`src/App.tsx:104-111`** (`MilennialsTechRoute`) — condição passa a ser `isExecutive(user?.role) || user?.role === 'devs' || user?.can_access_mtech`.
3. **Sidebar / navigation** — onde quer que o item "Milennials Tech" seja renderizado com um guard por role, aplicar o mesmo `OR user.can_access_mtech`. (Arquivo exato identificado no plan.)

### 3.5 UI — modais de criação e edição

Arquivos:

- `src/components/admin/CreateUserModal.tsx`
- `src/components/admin/UpdateUserModal.tsx` (ou arquivo equivalente identificado no plan)

Novo bloco no fim do form, separado por divider visual:

```
Acesso a módulos
────────────────────────────────────────────
[ Switch ] Milennials Tech
Permite ver o kanban e backlog técnico
independente do cargo.
```

Binding: `react-hook-form` → `can_access_mtech`. Default `false` na criação.

**Estado derivado do role:** se o cargo selecionado é `ceo | cto | devs`, o switch renderiza `checked={true}` e `disabled` com tooltip "Acesso garantido pelo cargo". Se o admin depois muda o cargo pra algo que não é executivo/dev, o switch volta ao valor anterior do campo (padrão RHF).

### 3.6 UI — quick toggle na lista de usuários

Arquivo: `src/pages/admin/UsersPage.tsx`

Nova coluna "Milennials Tech" na tabela. Célula condicional:

| Situação | Render |
|---|---|
| `role in (ceo, cto, devs)` | Badge "Incluso" cinza (informativo, não editável) |
| outro role | `<Switch checked={row.can_access_mtech} />` com handler otimista |

Handler:

```ts
const prev = row.can_access_mtech;
setOptimistic(userId, !prev);
const { error } = await supabase
  .from('profiles')
  .update({ can_access_mtech: !prev })
  .eq('user_id', userId);
if (error) { setOptimistic(userId, prev); toast.error('Falha ao atualizar acesso'); }
```

A listagem atual já puxa profiles — basta incluir a coluna nova no `select`.

## 4. Arquivos impactados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/migrations/20260417140000_profiles_mtech_access.sql` | novo | Coluna + gate `can_see_tech()` + trigger guard |
| `supabase/tests/profiles_mtech_access_guard_test.sql` | novo | pgTAP cobrindo 3 cenários |
| `supabase/functions/create-user/index.ts` | edit | Aceitar `can_access_mtech` |
| `supabase/functions/update-user/index.ts` | edit | Aceitar `can_access_mtech` |
| `src/contexts/AuthContext.tsx` | edit | Tipo User + fetch da coluna |
| `src/App.tsx` | edit | MilennialsTechRoute aditiva |
| Sidebar component (a identificar no plan) | edit | Item "Milennials Tech" aditivo |
| `src/components/admin/CreateUserModal.tsx` | edit | Switch + binding + disabled por cargo |
| `src/components/admin/UpdateUserModal.tsx` | edit | Idem |
| `src/pages/admin/UsersPage.tsx` | edit | Coluna + quick toggle otimista |

## 5. Fora de escopo

- Granularidade read vs write dentro de mtech (ex: "pode ver mas não pode criar task"). Hoje mtech tem um gate único; não vamos fragmentar.
- Tabela genérica `user_feature_access`. Escolha explícita: uma coluna em `profiles` é suficiente pro caso atual. Se um segundo feature flag aparecer, aí sim vale extrair.
- Log de auditoria "quem concedeu o acesso e quando". Se precisar, é uma tabela `profiles_mtech_access_log` separada. Não entra agora.
- Notificação ao usuário quando o acesso é concedido/revogado.
- Edição em massa (dar acesso a N usuários de uma vez).

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Admin revoga acesso de alguém que está com kanban aberto | O usuário vê a tela quebrar/redirecionar no próximo refresh. RLS bloqueia queries subsequentes. Aceitável — não há dado sensível cacheado no cliente além do que já foi visto. |
| Trigger bloqueia UPDATE legítimo feito por script/RPC server-side | O edge function é executado com a sessão do admin logado via SSR, então `auth.uid()` resolve corretamente para o admin. Se no futuro alguma rotina automática precisar mudar a flag, cria-se uma RPC `SECURITY DEFINER` específica. |
| Quick toggle dispara muitas requisições em sequência | Optimistic update + debounce mínimo não são necessários: switch tem throttle natural do usuário. Se virar problema, adicionar. |
| Pessoa que cria usuário e esquece do toggle | Default `false` é o mais seguro. Admin pode ligar depois pelo quick toggle. |

## 7. Critérios de aceitação

1. Migration aplicada no remoto, pgTAP verde (3 asserts).
2. Column `profiles.can_access_mtech` existe, `NOT NULL DEFAULT false`.
3. `can_see_tech(userId)` retorna `true` para (a) role `ceo|cto|devs` e (b) qualquer usuário com `can_access_mtech = true`, mesmo com cargo `design` ou `rh`.
4. Tentativa de UPDATE direto na coluna por usuário sem role admin retorna `42501 - Only admin roles may change can_access_mtech`.
5. Admin (ceo/cto/gestor_projetos/sucesso_cliente) consegue togglar pela UI.
6. Usuário comum com flag ligada consegue abrir `/milennials-tech/kanban` e ver tasks (RLS permite).
7. Usuário com flag desligada que não tem role tech é redirecionado para `/dashboard` ao tentar `/milennials-tech/*`.
8. Item "Milennials Tech" aparece/some da sidebar de acordo com a flag + role.
9. Quick toggle na listagem atualiza otimista e reverte + toast em caso de erro.
10. Switch no modal trava em `checked+disabled` quando role é ceo/cto/devs, com tooltip "Acesso garantido pelo cargo".
