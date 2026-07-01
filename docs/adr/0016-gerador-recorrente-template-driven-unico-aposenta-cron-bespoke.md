# 0016 — Gerador de tarefa recorrente é template-driven ÚNICO; aposenta o cron bespoke role-based

- **Status:** 🟢 Aceito (decisão do fundador; plano fechado pelo arquiteto). Implementado: DROP da função bespoke + hardening do gerador canônico + pgTAP de contrato.
- **Data:** 2026-07-01
- **Decisores:** Fundador/CTO
- **Relacionado:** `public._cron_generate_recurring_tasks` (gerador único); `public.recurring_task_templates`; `public.department_tasks.recurring_template_id`; `public.generate_recurring_tasks` (entrada manual admin); cron `generate-recurring-tasks` (jobid 15). Substitui a extinta `public.create_weekly_gestor_tasks`.
- **Migrations:** `supabase/migrations/20260701120000_disable_weekly_gestor_tasks.sql` (desagenda cron jobid 21 + no-op + limpa tasks abertas) e `supabase/migrations/20260701130000_drop_create_weekly_gestor_tasks.sql` (DROP + hardening de grants/search_path).
- **Provas:** pgTAP `supabase/tests/recurring_tasks_template_contract_test.sql` (8/8 contra o remoto).

> **Por que este ADR.** Registra a invariante de que existe UM só gerador de
> tarefa recorrente no sistema, data-driven por template ativo, e por que a
> função bespoke role-based foi aposentada. Um leitor futuro tentado a "criar um
> cron rapidinho que insere uma task pra tal role" precisa ler isto antes.

## Contexto

Existiam DOIS mecanismos concorrentes de geração de tarefa recorrente:

1. **Bespoke role-based** — `public.create_weekly_gestor_tasks()`, agendada no cron
   `weekly-gestor-tasks` (jobid 21, segundas 09:00 UTC). Para TODO `gestor_ads`
   inseria duas tasks fixas e **hardcoded** em `ads_tasks` (`task_type='daily'`):
   `'Enviar relatório para todos os clientes'` e `'Enviar lema no grupo dos
   gestores'`. Sem template, sem dedup por identidade de origem, sem `is_active`.
   Por entrarem como `daily`, apareciam em "Tarefas Diárias" e eram percebidas como
   geradas sem motivo (ruído).

2. **Template-driven canônico** — `public.recurring_task_templates` (admin define
   `title`/`department`/`target_role`/`recurrence`/`is_active`) + o gerador
   `public._cron_generate_recurring_tasks()` (cron `generate-recurring-tasks`,
   jobid 15), que insere em `department_tasks` **carimbando `recurring_template_id`**
   e deduplica por template + janela de recorrência (`daily`, `weekly_*`,
   `biweekly`, `monthly`, `every_1h/6h`). `is_active=false` ⇒ zero geração.

Dois geradores para o mesmo conceito é acoplamento escondido: a lógica de "que
task recorre, para quem, com que cadência" vivia parte em dado (templates) e parte
em SQL hardcoded (bespoke), em tabelas diferentes (`department_tasks` vs `ads_tasks`),
sem fonte única de verdade nem forma de desligar sem editar código.

## Decisão

**Aposentar o bespoke. `_cron_generate_recurring_tasks()` é o gerador ÚNICO.**

- Geração de tarefa recorrente é **SEMPRE data-driven por template ativo** em
  `recurring_task_templates`. Nunca hardcoded por role numa função SQL bespoke.
- Dedup **sempre** por `recurring_template_id` dentro da janela de recorrência.
- `is_active=false` no template ⇒ zero geração (kill-switch em dado, não em código).
- A migration `20260701120000` já desagendou o cron jobid 21, transformou a função
  em no-op e limpou as tasks legadas ABERTAS (histórico `done` preservado). A
  `20260701130000` faz o `DROP FUNCTION` definitivo.
- **Não há reseed** da task semanal legada. Se o relatório semanal do gestor voltar
  a ser desejado, ele nasce como **template** (`recurring_task_templates`), visível
  e desligável — não como novo cron bespoke.

## Alternativas consideradas

- **A) Manter o bespoke.** Rejeitado: duplica o conceito, sem `is_active`, sem
  dedup por origem; o ruído percebido veio exatamente da rigidez hardcoded.
- **B) Parametrizar o bespoke (ainda role-based em SQL).** Rejeitado: reinventa o
  que `recurring_task_templates` já faz melhor (dado + RLS admin + cadências).
- **C) Reseed imediato como template.** Rejeitado pelo fundador: a task era ruído;
  não recriar agora. Fica a porta aberta (criar template quando/se quiser).
- **D) Aposentar o bespoke; template-driven único [ESCOLHIDA].** Fonte única,
  auditável, desligável por dado, testável por contrato.

## Consequências aceitas

- **O relatório semanal do gestor NÃO é mais gerado** até que alguém crie um
  template ativo para ele. Isso é **por design** (decisão de não-reseed), não bug.
- **Muda a superfície de destino se re-seeded.** O bespoke escrevia em `ads_tasks`
  (aba "Tarefas Semanais/Diárias" do Ads Manager). O gerador canônico escreve em
  `department_tasks`. Um futuro template para o gestor de ads aparecerá na
  superfície de `department_tasks`, não em `ads_tasks`. Registrar na wiki do Ads
  Manager (feito).
- **Hardening colateral do gerador canônico** (fechado nesta entrega): o
  `CREATE OR REPLACE` da migration NPS (`20260522300000`) tinha deixado
  `_cron_generate_recurring_tasks` **executável por `anon` e `authenticated`** e
  **sem `search_path` travado** (SECURITY DEFINER, sem auth-check). Corrigido:
  `REVOKE ... FROM PUBLIC, anon, authenticated` (só `postgres`/`service_role`
  executam — é chamada só pelo cron) e `SET search_path = public`.
- **`generate_recurring_tasks()` (entrada manual admin) permanece intacta** — tem
  `auth.uid()` + `is_admin` internos e grant para `authenticated` por design.
- **Guardrail documental**: fica PROIBIDO criar novo cron/função SQL bespoke
  role-based que insira task por role hardcoded. Toda tarefa recorrente passa por
  `recurring_task_templates` + `_cron_generate_recurring_tasks()`. Registrado em
  `CLAUDE.md` e `CONTEXT.md`.
