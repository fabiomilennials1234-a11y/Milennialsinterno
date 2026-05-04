-- 20260504100000_justifications_extend_columns.sql
-- Adiciona suporte a comentário do master e flag de revisão exigida.
-- Spec: docs/superpowers/specs/2026-05-04-justificativas-sidebar-design.md

ALTER TABLE public.task_delay_justifications
  ADD COLUMN IF NOT EXISTS master_comment text,
  ADD COLUMN IF NOT EXISTS master_comment_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS master_comment_at timestamptz,
  ADD COLUMN IF NOT EXISTS requires_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_requested_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tdj_requires_revision
  ON public.task_delay_justifications (user_id)
  WHERE requires_revision = true;

CREATE INDEX IF NOT EXISTS idx_tdj_notification_user
  ON public.task_delay_justifications (notification_id, user_id);

COMMENT ON COLUMN public.task_delay_justifications.master_comment IS
  'Comentário do master sobre essa justificativa. Sobrescrito a cada chamada de request_justification_revision.';
COMMENT ON COLUMN public.task_delay_justifications.requires_revision IS
  'Quando true, a justificativa foi rejeitada pelo master e o devedor precisa refazer. RPC submit_justification arquiva o registro antigo e cria um novo zerando essa flag.';
