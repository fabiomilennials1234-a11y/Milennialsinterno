-- 20260504280000_devs_mtech_optional.sql
--
-- Torna acesso a Milennials Tech opcional para devs.
-- Antes: devs tinham grant automático 'mtech' via role_default.
-- Agora: devs precisam de can_access_mtech=true ou grant manual.

BEGIN;

-- Remove grant automático 'mtech' de users com role 'devs'
-- que receberam via role_default (não manual)
DELETE FROM public.user_page_grants upg
USING public.user_roles ur
WHERE upg.user_id = ur.user_id
  AND ur.role = 'devs'
  AND upg.page_slug = 'mtech'
  AND upg.source = 'role_default';

-- Atualizar a RPC de reconciliação para não incluir 'mtech' nos defaults de devs
CREATE OR REPLACE FUNCTION public.admin_reconcile_user_page_grants(
  _target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user   RECORD;
  v_role_default text[];
  v_slug   text;
  v_added  integer := 0;
  v_removed integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  FOR v_user IN
    SELECT ur.user_id, ur.role
    FROM user_roles ur
    WHERE (_target_user_id IS NULL OR ur.user_id = _target_user_id)
  LOOP
    v_role_default := CASE v_user.role::text
      WHEN 'ceo'                 THEN ARRAY(SELECT slug FROM app_pages)
      WHEN 'cto'                 THEN ARRAY(SELECT slug FROM app_pages)
      WHEN 'gestor_projetos'     THEN ARRAY['gestor-projetos','financeiro','rh','gestor-crm','consultor-mktplace','sucesso-cliente','outbound','design','editor-video','devs','produtora','consultor-comercial','mtech','gestor-ads']
      WHEN 'gestor_ads'          THEN ARRAY['gestor-ads']
      WHEN 'sucesso_cliente'     THEN ARRAY['sucesso-cliente']
      WHEN 'gestor_crm'          THEN ARRAY['gestor-crm']
      WHEN 'outbound'            THEN ARRAY['outbound']
      WHEN 'consultor_mktplace'  THEN ARRAY['consultor-mktplace']
      WHEN 'consultor_comercial' THEN ARRAY['consultor-comercial']
      WHEN 'financeiro'          THEN ARRAY['financeiro']
      WHEN 'rh'                  THEN ARRAY['rh']
      WHEN 'devs'                THEN ARRAY['devs','design']
      WHEN 'design'              THEN ARRAY['design']
      WHEN 'editor_video'        THEN ARRAY['editor-video']
      WHEN 'produtora'           THEN ARRAY['produtora']
      ELSE ARRAY[]::text[]
    END;

    -- Add missing role_default grants
    FOREACH v_slug IN ARRAY v_role_default LOOP
      INSERT INTO user_page_grants (user_id, page_slug, granted_by, source)
      VALUES (v_user.user_id, v_slug, v_caller, 'role_default')
      ON CONFLICT (user_id, page_slug) DO NOTHING;

      IF FOUND THEN v_added := v_added + 1;
      ELSE v_skipped := v_skipped + 1;
      END IF;
    END LOOP;

    -- Remove stale role_default grants that are no longer in the default set
    DELETE FROM user_page_grants
    WHERE user_id = v_user.user_id
      AND source = 'role_default'
      AND page_slug != ALL(v_role_default);

    GET DIAGNOSTICS v_skipped = ROW_COUNT;
    v_removed := v_removed + v_skipped;
  END LOOP;

  RETURN jsonb_build_object(
    'added', v_added,
    'removed', v_removed,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_user_page_grants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_user_page_grants(uuid) TO authenticated;

COMMIT;
