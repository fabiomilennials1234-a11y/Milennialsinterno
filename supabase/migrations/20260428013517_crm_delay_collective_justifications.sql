-- 20260428013517_crm_delay_collective_justifications.sql
--
-- Cobranca COLETIVA de justificativa quando uma crm_configuracoes do
-- gestor de CRM atrasa em relacao ao deadline do produto (V8/Automation/Copilot)
-- definido em src/hooks/useCrmKanban.ts: CRM_CONFIG_DEADLINE_DAYS.
--
-- Decisoes do fundador (cravadas, ver thread "Q1..Q5"):
--   Q1=C  comercial = crm_configuracoes.created_by se for consultor_comercial,
--         senao fallback clients.assigned_comercial. Se ambos null, skip role.
--   Q2=A  novo campo clients.assigned_sucesso_cliente (UI no cadastro/edicao).
--   Q3    deadline reusado de CRM_CONFIG_DEADLINE_DAYS via INTERVAL.
--   Q4=B  MANTER cobranca mesmo se config for finalizada depois do atraso.
--         Atrasou eh atrasou. NAO criar trigger dismiss-on-finalizado.
--   Q5=A  UNIQUE(config_id, user_id). Uma cobranca por par.
--
-- Decisao de implementacao tecnica:
--   task_delay_notifications tem UNIQUE(task_id, task_table). Para emitir 4
--   notifs por config (uma por role), task_table eh sufixado com __<role>:
--     crm_config_delay__gestor_crm
--     crm_config_delay__consultor_comercial
--     crm_config_delay__gestor_ads
--     crm_config_delay__sucesso_cliente
--   crm_delay_justification_pending eh a tabela canonica do dominio (joga junto
--   com a UNIQUE composta config_id+user_id). task_delay_notifications eh
--   apenas o veiculo do modal bloqueante existente (JustificationContext).

BEGIN;

-- ============================================================
-- 1) Colunas novas em tabelas existentes
-- ============================================================

-- crm_configuracoes.created_by: quem criou a config (gestor_crm normalmente, mas
-- pode ser consultor_comercial em fluxos onde ele cria pelo cadastro do cliente).
-- Eh esse user que define o "treinador comercial responsavel" via Q1=C.
ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_config_created_by
  ON public.crm_configuracoes(created_by)
  WHERE created_by IS NOT NULL;

-- clients.assigned_sucesso_cliente: novo papel responsavel pela conta.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_sucesso_cliente uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_sucesso
  ON public.clients(assigned_sucesso_cliente)
  WHERE assigned_sucesso_cliente IS NOT NULL;

-- ============================================================
-- 2) Trigger BEFORE UPDATE: lock-on-create de crm_configuracoes.created_by
-- ============================================================
-- Uma vez setado o criador, nao muda. Protege auditoria e reproduz padrao do
-- tech_tasks (ver 20260417120000_tech_tasks_lock_created_by.sql).

CREATE OR REPLACE FUNCTION public.crm_configuracoes_lock_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.created_by IS NOT NULL
     AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'crm_configuracoes.created_by is immutable once set'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_configuracoes_lock_created_by ON public.crm_configuracoes;
CREATE TRIGGER trg_crm_configuracoes_lock_created_by
  BEFORE UPDATE OF created_by ON public.crm_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_configuracoes_lock_created_by();

-- ============================================================
-- 3) Tabela canonica: crm_delay_justification_pending
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crm_delay_justification_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.crm_configuracoes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN (
    'gestor_crm', 'consultor_comercial', 'gestor_ads', 'sucesso_cliente'
  )),
  notification_id uuid REFERENCES public.task_delay_notifications(id) ON DELETE SET NULL,
  justification_id uuid REFERENCES public.task_delay_justifications(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  justified_at timestamptz,
  dismissed_at timestamptz,
  dismissed_reason text,
  CONSTRAINT crm_delay_pending_unique UNIQUE (config_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_delay_pending_user_open
  ON public.crm_delay_justification_pending(user_id)
  WHERE justified_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_delay_pending_config
  ON public.crm_delay_justification_pending(config_id);

CREATE INDEX IF NOT EXISTS idx_crm_delay_pending_client
  ON public.crm_delay_justification_pending(client_id);

ALTER TABLE public.crm_delay_justification_pending ENABLE ROW LEVEL SECURITY;

-- SELECT: user ve seu pending OU pendings de configs nas quais ele esta envolvido OU is_ceo
DROP POLICY IF EXISTS "crm_delay_pending_select" ON public.crm_delay_justification_pending;
CREATE POLICY "crm_delay_pending_select" ON public.crm_delay_justification_pending
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_ceo(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.crm_delay_justification_pending p2
      WHERE p2.config_id = crm_delay_justification_pending.config_id
        AND p2.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: somente via SECURITY DEFINER RPCs.
-- Nada de policy para authenticated. Service role bypassa RLS, RPCs idem.

-- ============================================================
-- 4) Trigger AFTER INSERT em task_delay_justifications: linka justified_at
-- ============================================================
-- Quando o user submete justificativa via JustificationContext (insert em
-- task_delay_justifications), achamos o pending correspondente via
-- notification_id e marcamos justified_at.

CREATE OR REPLACE FUNCTION public.crm_delay_pending_link_justification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_delay_justification_pending
     SET justified_at = NOW(),
         justification_id = NEW.id
   WHERE notification_id = NEW.notification_id
     AND user_id = NEW.user_id
     AND justified_at IS NULL
     AND dismissed_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_delay_pending_link_justification
  ON public.task_delay_justifications;
CREATE TRIGGER trg_crm_delay_pending_link_justification
  AFTER INSERT ON public.task_delay_justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_delay_pending_link_justification();

-- ============================================================
-- 5) RPC: check_crm_configs_delayed
-- ============================================================
-- Para cada crm_configuracoes cujo deadline passou (mesmo finalizada -- Q4=B):
--   resolve 4 user_ids (gestor_crm executor, comercial criador-ou-fallback,
--   gestor_ads do cliente, sucesso_cliente do cliente). Para cada user_id
--   nao-null, INSERT em crm_delay_justification_pending (idempotente via
--   UNIQUE(config_id,user_id)) e cria a task_delay_notifications correspondente
--   (para alimentar o modal bloqueante existente).
--
-- Plug-in: edge check-scheduled-notifications chama esta RPC.

CREATE OR REPLACE FUNCTION public.check_crm_configs_delayed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          RECORD;
  v_actor_id     uuid;
  v_actor_role   text;
  v_pending_row  public.crm_delay_justification_pending;
  v_notif_id     uuid;
  v_actor_name   text;
  v_due_date     timestamptz;
  v_task_table   text;
  v_client_name  text;
  v_creator_role text;
BEGIN
  FOR v_cfg IN
    SELECT
      cc.id              AS config_id,
      cc.client_id,
      cc.produto,
      cc.created_at,
      cc.created_by,
      c.name             AS client_name,
      c.assigned_crm,
      c.assigned_comercial,
      c.assigned_ads_manager,
      c.assigned_sucesso_cliente
    FROM public.crm_configuracoes cc
    JOIN public.clients c
      ON c.id = cc.client_id
     AND c.archived = false
    WHERE
      cc.created_at + (
        CASE cc.produto
          WHEN 'v8'         THEN INTERVAL '7 days'
          WHEN 'automation' THEN INTERVAL '7 days'
          WHEN 'copilot'    THEN INTERVAL '10 days'
          ELSE                   INTERVAL '7 days'
        END
      ) < NOW()
  LOOP
    v_due_date := v_cfg.created_at + (
      CASE v_cfg.produto
        WHEN 'v8'         THEN INTERVAL '7 days'
        WHEN 'automation' THEN INTERVAL '7 days'
        WHEN 'copilot'    THEN INTERVAL '10 days'
        ELSE                   INTERVAL '7 days'
      END
    );
    v_client_name := v_cfg.client_name;

    -- Resolve role do criador (necessario pra Q1=C)
    v_creator_role := NULL;
    IF v_cfg.created_by IS NOT NULL THEN
      SELECT ur.role::text INTO v_creator_role
        FROM public.user_roles ur
       WHERE ur.user_id = v_cfg.created_by
       LIMIT 1;
    END IF;

    -- Loop pelos 4 papeis envolvidos
    FOR v_actor_role, v_actor_id IN
      SELECT * FROM (VALUES
        ('gestor_crm'::text,         v_cfg.assigned_crm),
        ('consultor_comercial'::text,
            CASE
              WHEN v_creator_role = 'consultor_comercial' THEN v_cfg.created_by
              ELSE v_cfg.assigned_comercial
            END
        ),
        ('gestor_ads'::text,         v_cfg.assigned_ads_manager),
        ('sucesso_cliente'::text,    v_cfg.assigned_sucesso_cliente)
      ) AS roles(role_name, uid)
    LOOP
      CONTINUE WHEN v_actor_id IS NULL;

      v_task_table := 'crm_config_delay__' || v_actor_role;

      -- Idempotencia: ja existe pending pra esse (config, user)?
      SELECT * INTO v_pending_row
        FROM public.crm_delay_justification_pending
       WHERE config_id = v_cfg.config_id
         AND user_id   = v_actor_id;

      IF FOUND THEN
        CONTINUE;
      END IF;

      -- Cria task_delay_notifications (veiculo do modal)
      SELECT COALESCE(p.name, 'Usuario') INTO v_actor_name
        FROM public.profiles p
       WHERE p.user_id = v_actor_id;

      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_cfg.config_id,
        v_task_table,
        v_actor_id,
        COALESCE(v_actor_name, 'Usuario'),
        v_actor_role,
        'Configuracao CRM atrasada: ' || v_client_name || ' (' || v_cfg.produto || ')',
        v_due_date
      )
      ON CONFLICT (task_id, task_table) DO UPDATE
        SET task_owner_id   = EXCLUDED.task_owner_id,
            task_owner_name = EXCLUDED.task_owner_name,
            task_owner_role = EXCLUDED.task_owner_role,
            task_title      = EXCLUDED.task_title,
            task_due_date   = EXCLUDED.task_due_date
        RETURNING id INTO v_notif_id;

      -- Insere pending (idempotente via UNIQUE; se outra session ganhou, pula)
      INSERT INTO public.crm_delay_justification_pending (
        config_id, client_id, user_id, user_role, notification_id
      ) VALUES (
        v_cfg.config_id,
        v_cfg.client_id,
        v_actor_id,
        v_actor_role,
        v_notif_id
      )
      ON CONFLICT (config_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.check_crm_configs_delayed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_crm_configs_delayed() TO authenticated, service_role;

COMMENT ON FUNCTION public.check_crm_configs_delayed() IS
  'Cron RPC: detecta crm_configuracoes atrasadas (Q4=B mantem mesmo se finalizadas) e cobra 4 papeis via crm_delay_justification_pending. Idempotente via UNIQUE(config_id,user_id).';

-- ============================================================
-- 6) RPC: get_pending_crm_justifications_for_user
-- ============================================================
-- Drives o auto-trigger do modal bloqueante. Retorna pendings abertos do user
-- logado, com metadata pra o JustificationContext montar o request.

CREATE OR REPLACE FUNCTION public.get_pending_crm_justifications_for_user()
RETURNS TABLE (
  pending_id      uuid,
  config_id       uuid,
  client_id       uuid,
  client_name     text,
  produto         text,
  user_role       text,
  notification_id uuid,
  task_table      text,
  task_title      text,
  task_due_date   timestamptz,
  detected_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT
      p.id              AS pending_id,
      p.config_id,
      p.client_id,
      c.name            AS client_name,
      cc.produto,
      p.user_role,
      p.notification_id,
      ('crm_config_delay__' || p.user_role) AS task_table,
      n.task_title,
      n.task_due_date,
      p.detected_at
    FROM public.crm_delay_justification_pending p
    JOIN public.crm_configuracoes cc ON cc.id = p.config_id
    JOIN public.clients c            ON c.id  = p.client_id
    LEFT JOIN public.task_delay_notifications n ON n.id = p.notification_id
    WHERE p.user_id = v_uid
      AND p.justified_at IS NULL
      AND p.dismissed_at IS NULL
    ORDER BY p.detected_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_crm_justifications_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_crm_justifications_for_user() TO authenticated;

COMMENT ON FUNCTION public.get_pending_crm_justifications_for_user() IS
  'Pendings em aberto do user logado (drives modal bloqueante).';

-- ============================================================
-- 7) RPC: get_crm_config_collective_justifications
-- ============================================================
-- Retorna 1 linha por papel envolvido naquela config (ja registrado em
-- crm_delay_justification_pending). Para cada papel, traz texto da
-- justificativa quando ja existe, ou is_pending=true caso contrario.
--
-- Visibilidade: apenas users envolvidos na config OU is_ceo. Caso contrario,
-- raise exception (evita IDOR via config_id).

CREATE OR REPLACE FUNCTION public.get_crm_config_collective_justifications(
  p_config_id uuid
)
RETURNS TABLE (
  pending_id        uuid,
  user_id           uuid,
  user_role         text,
  user_name         text,
  justification     text,
  justified_at      timestamptz,
  detected_at       timestamptz,
  is_pending        boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_involved  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_ceo(v_uid) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.crm_delay_justification_pending
      WHERE config_id = p_config_id
        AND user_id   = v_uid
    ) INTO v_involved;

    IF NOT v_involved THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      p.id                      AS pending_id,
      p.user_id,
      p.user_role,
      COALESCE(pr.name, 'Usuario') AS user_name,
      j.justification,
      p.justified_at,
      p.detected_at,
      (p.justified_at IS NULL AND p.dismissed_at IS NULL) AS is_pending
    FROM public.crm_delay_justification_pending p
    LEFT JOIN public.profiles pr                ON pr.user_id = p.user_id
    LEFT JOIN public.task_delay_justifications j ON j.id       = p.justification_id
    WHERE p.config_id = p_config_id
    ORDER BY
      CASE p.user_role
        WHEN 'gestor_crm'           THEN 1
        WHEN 'consultor_comercial'  THEN 2
        WHEN 'gestor_ads'           THEN 3
        WHEN 'sucesso_cliente'      THEN 4
        ELSE                              5
      END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_crm_config_collective_justifications(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crm_config_collective_justifications(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_crm_config_collective_justifications(uuid) IS
  'Coluna do kanban: 4 perspectivas (1 por papel) sobre o atraso de uma config CRM. Auth: user envolvido OU is_ceo.';

COMMIT;
