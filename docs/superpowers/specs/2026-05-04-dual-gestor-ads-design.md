# Dual-Gestor ADS — Design Spec

## Problema

Um cliente só pode ter 1 gestor de ADS (`clients.assigned_ads_manager`). Precisa suportar 2 gestores simultâneos com comportamento diferenciado por fase.

## Requisitos

- Botão "+ Gestor" na linha expandida do cliente em `ClientListPage`, junto a "+ Venda" e "Churn"
- Modal permite selecionar: **gestor secundário** + **fase** (onboarding / acompanhamento)
- Gestor principal = `assigned_ads_manager` atual — não muda
- Fase é configuração manual, não acompanha status do cliente automaticamente
- Quando já tem secundário, botão muda visual para "2 Gestores" (borda azul) — ao clicar, permite editar fase, trocar gestor ou remover
- Sem badge/distinção visual no kanban do secundário — cliente aparece igual

### Comportamento por fase

| Fase | Kanban | Tarefas |
|------|--------|---------|
| **Onboarding** | Cliente aparece no kanban do secundário | Secundário recebe mesmas tarefas (independentes, não linkadas) |
| **Acompanhamento** | Cliente aparece no kanban do secundário | Secundário **não** recebe tarefas |

## Abordagem: Tabela dedicada `client_secondary_managers`

### DB Schema

```sql
CREATE TABLE public.client_secondary_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  secondary_manager_id UUID NOT NULL REFERENCES auth.users(id),
  phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'acompanhamento')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)  -- 1 secundário por cliente
);
```

Constraint `UNIQUE(client_id)` garante max 1 secundário. Se no futuro precisar N, remove constraint.

### RLS

```sql
-- SELECT: gestores veem registros onde são o secondary_manager, admins veem tudo
CREATE POLICY "select_own_or_admin" ON public.client_secondary_managers
  FOR SELECT USING (
    secondary_manager_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- INSERT/UPDATE/DELETE: apenas admins (CEO, sucesso_cliente)
CREATE POLICY "admin_manage" ON public.client_secondary_managers
  FOR ALL USING (public.is_admin(auth.uid()));
```

### Impacto no Kanban — `useAssignedClients`

Query atual filtra `clients.assigned_ads_manager = uid`. Adicionar:

```sql
-- Clientes onde user é secundário
OR clients.id IN (
  SELECT client_id FROM client_secondary_managers
  WHERE secondary_manager_id = auth.uid()
)
```

Alternativa mais performante: RPC que faz UNION internamente.

### Impacto na geração de tarefas

Hooks afetados:
- `useOnboardingAutomation` — ao criar tarefa pra gestor principal, checar se existe secundário com phase='onboarding'. Se sim, criar tarefa duplicada com `ads_manager_id = secondary_manager_id`
- `create_client_with_automations` RPC — mesmo check na criação atômica do cliente
- `useComercialAutomation` (se gerar ads_tasks) — mesmo padrão

Tarefas do secundário são independentes. Sem FK entre elas. Cada gestor completa a sua.

### Impacto no RLS de `clients`

Adicionar política SELECT:

```sql
CREATE POLICY "secondary_manager_can_view" ON public.clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM client_secondary_managers WHERE secondary_manager_id = auth.uid())
  );
```

### Frontend

#### Botão na `ClientListPage`

Na linha expandida do cliente (coluna Ações), novo botão:
- **Sem secundário**: `👥 + Gestor` — borda cinza, texto muted
- **Com secundário**: `👥 2 Gestores` — borda azul, texto azul claro, fundo azul escuro

Na linha expandida, adicionar label "2º Gestor: {nome}" ao lado do Gestor/Treinador quando existir.

#### Modal `SecondaryManagerModal`

Componente novo. Props: `clientId, clientName, primaryManagerName, existing?: { id, secondaryManagerId, phase }`.

- Toggle fase: Onboarding / Acompanhamento (cards clicáveis)
- Dropdown gestor: lista gestores de ADS excluindo o principal
- Botões: Salvar / Remover (se editando) / Cancelar

#### Hook `useSecondaryManager`

- `useSecondaryManager(clientId)` — query single record
- `useSetSecondaryManager()` — mutation upsert
- `useRemoveSecondaryManager()` — mutation delete

## Fora de escopo

- Mais de 2 gestores por cliente
- Distinção visual no kanban pra clientes secundários
- Sync automática de fase com status do cliente
- Link entre tarefas do primário e secundário

## Tabelas satélites que NÃO mudam

`client_daily_tracking`, `ads_daily_documentation`, `ads_justifications`, `ads_meetings` — continuam associadas ao gestor via `ads_manager_id`. Cada gestor gera seus próprios registros naturalmente ao interagir com o cliente no kanban.
