---
title: Flag can_access_mtech
tags:
  - permissoes
  - mtech
---

# Flag `can_access_mtech`

> [!abstract] O problema que resolve
> Acesso ao [[03-Features/Mtech — Milennials Tech|Mtech]] não cabe numa regra de papel. Um designer, um gestor de ads, um CS — qualquer um pode eventualmente precisar submeter ou acompanhar uma task técnica. Em vez de criar "mega-papéis" ou contaminar cada papel com uma permissão, adicionamos **um flag boolean por usuário** que um admin pode ligar/desligar a qualquer momento.

## Onde o flag vive

Coluna `profiles.can_access_mtech boolean NOT NULL DEFAULT false`.

Migration: `supabase/migrations/20260417150000_profiles_mtech_access.sql`.

## Como o flag é avaliado

Função canônica `can_see_tech(_user_id uuid)`:

```sql
CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('ceo', 'cto', 'devs')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND can_access_mtech = true
    )
$$;
```

Ou seja: **role-based OR flag-based**. CEO/CTO/Devs **sempre** passam — não depende do flag. Outros papéis só entram se o flag está true.

## Quem pode mudar o flag

**Apenas 4 papéis**, enforceds em duas camadas:

### Camada 1 — Trigger BEFORE UPDATE

```sql
CREATE OR REPLACE FUNCTION public.profiles_guard_mtech_access()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.can_access_mtech IS DISTINCT FROM OLD.can_access_mtech THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('ceo', 'cto', 'gestor_projetos', 'sucesso_cliente')
    ) THEN
      RAISE EXCEPTION 'not authorized to change can_access_mtech';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_profiles_guard_mtech_access
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_guard_mtech_access();
```

Mesmo que a RLS deixe passar, o trigger levanta exceção se o chamador não é admin.

### Camada 2 — RPC explícita

Para o frontend e edge functions, há uma RPC `set_mtech_access(_user_id uuid, _value boolean)` que:

1. Valida `auth.uid() IS NOT NULL`.
2. Checa se o chamador tem role IN (ceo, cto, gestor_projetos, sucesso_cliente).
3. Atualiza `profiles.can_access_mtech`.
4. Registra activity log (se implementado).

Migration: `supabase/migrations/20260417160000_set_mtech_access_rpc.sql`.

## Onde é usado

### Rota

`MilennialsTechRoute` guard em `src/App.tsx:104-111`:

```tsx
const canAccess = isExecutive(user?.role) ||
                  user?.role === 'devs' ||
                  user?.can_access_mtech === true
```

Se `canAccess === false`, redireciona para `/`.

### Sidebar

`src/components/layout/AppSidebar.tsx:580` aplica o mesmo check para mostrar ou esconder o menu "Milennials Tech".

### RLS das tabelas `tech_*`

Todas as policies de SELECT em `tech_tasks`, `tech_sprints`, `tech_time_entries`, `tech_task_activities`, `tech_task_attachments` usam `can_see_tech(auth.uid())`.

### Storage bucket `tech-attachments`

Policy de INSERT no storage: `can_see_tech(auth.uid()) = true`.

### `/submit-task` (pública a autenticados)

Exceção: qualquer usuário autenticado **pode submeter** tasks via `/submit-task`, mesmo sem flag. Isso é intencional — é o jeito de alguém "pedir ajuda ao time técnico" sem ganhar acesso ao Mtech inteiro. A RPC `submit_task()` faz bypass de `can_see_tech()` para o INSERT em `tech_tasks`. Detalhes em [[03-Features/Mtech — Milennials Tech#Submit task]].

## Interface de toggle

Dois lugares:

1. **CreateUserModal** — switch "Acesso ao Mtech" no formulário de criação. Default off.
2. **EditUserModal** — mesmo switch.
3. **Coluna rápida na lista de usuários** — toggle inline sem abrir modal. Implementado em abril/2026 (commit `27eefe8 feat(mtech): quick toggle column`).

## Regras de comportamento

| Cenário | Resultado |
|---|---|
| CEO loga | Vê Mtech (role-based, flag irrelevante) |
| CTO loga | Vê Mtech (role-based) |
| Dev loga | Vê Mtech (role-based) |
| Designer com `can_access_mtech=true` | Vê Mtech |
| Designer com `can_access_mtech=false` | Não vê Mtech. Pode usar `/submit-task` para submeter. |
| Gestor de Ads seta flag em outro usuário | ❌ Trigger bloqueia (só admin muda flag) |
| Admin tenta setar flag em si mesmo | ✅ Permitido |

## Como testar

```sql
-- em pgTAP
SELECT ok(
  public.can_see_tech('{uuid do CEO}'::uuid),
  'CEO sempre vê mtech'
);

UPDATE profiles SET can_access_mtech = true WHERE user_id = '{uuid do designer}';

SELECT ok(
  public.can_see_tech('{uuid do designer}'::uuid),
  'Designer com flag vê mtech'
);
```

## Por que não papel "mtech_user"

> [!question] Foi considerado?
> Sim. Rejeitado porque:
> - Um usuário teria múltiplos papéis (designer + mtech_user), e o sistema é 1:1 em `user_roles` por design.
> - Flag boolean é idempotente: ligar/desligar é operação segura e reversível, sem mudar identity principal.
> - Permite "acesso temporário" — ligar para sprint específica, desligar depois — sem mexer em user_roles.

## Links

- [[01-Papeis-e-Permissoes/Funções RLS#can_see_tech]]
- [[03-Features/Mtech — Milennials Tech]]
- [[02-Fluxos/Criação de Usuário]]
