-- 20260608150000_concessao_lifecycle_columns.sql
--
-- Slices #150 (revogar) + #151 (converter) — ADR 0009.
--
-- Adiciona as colunas de CICLO DE VIDA da concessão que faltavam no schema
-- inicial (20260608130000): teardown (revogada) e transição financeira
-- (convertida). Sem elas as RPCs revogar_concessao / converter_concessao não
-- têm onde gravar quem/quando revogou nem o vínculo com o upsell gerado.
--
-- CONTRACT-ONLY (ADR 0004): revoked_by é uuid SOLTO (audit, sem FK) e
-- converted_to_upsell_id é uuid SOLTO apontando para public.upsells SEM FK —
-- a Concessão pertence ao módulo financeiro e o vínculo é por contrato, não por
-- integridade referencial do banco (igual client_id/granted_by no schema base).
-- Todas NULLABLE: só populadas quando o estado correspondente acontece.
--
-- IDEMPOTENTE (ADD COLUMN IF NOT EXISTS) — seguro re-rodar.

BEGIN;

ALTER TABLE public.concessoes
  ADD COLUMN IF NOT EXISTS revoked_by              uuid        NULL,
  ADD COLUMN IF NOT EXISTS revoked_at              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS converted_to_upsell_id  uuid        NULL;

COMMENT ON COLUMN public.concessoes.revoked_by IS
  'Quem revogou a concessão (audit). uuid SOLTO sem FK (contract-only, ADR 0004). '
  'Populado só por revogar_concessao (#150) quando status -> revogada.';
COMMENT ON COLUMN public.concessoes.revoked_at IS
  'Quando a concessão foi revogada. Populado só por revogar_concessao (#150).';
COMMENT ON COLUMN public.concessoes.converted_to_upsell_id IS
  'id do upsell criado quando a concessão virou venda. uuid SOLTO apontando para '
  'public.upsells SEM FK cross-módulo (contract-only, ADR 0004). Populado só por '
  'converter_concessao (#151) quando status -> convertida.';

-- BUGFIX (#150/#151): o trigger de updated_at do schema base (#146) foi declarado
-- como `moddatetime()` SEM o argumento da coluna. moddatetime EXIGE o nome da
-- coluna (todas as outras tabelas usam `moddatetime(updated_at)`); sem ele QUALQUER
-- UPDATE em concessoes falha com 'A single argument was expected'. Passou
-- despercebido porque nada atualizava concessoes até as RPCs de ciclo de vida.
-- Recria o trigger com a assinatura correta — sem isso revogar/converter quebram.
DROP TRIGGER IF EXISTS set_concessoes_updated_at ON public.concessoes;
CREATE TRIGGER set_concessoes_updated_at
  BEFORE UPDATE ON public.concessoes
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime(updated_at);

COMMIT;
