-- Convert role permissions to per-action grants and enforce them with RLS.
-- This migration is intentionally not applied to the Supabase project here.

-- Preserve the original rows before converting any values.
CREATE TABLE IF NOT EXISTS public.cm_role_permissions_backup_20261006
  (LIKE public.cm_role_permissions INCLUDING ALL);

INSERT INTO public.cm_role_permissions_backup_20261006
SELECT * FROM public.cm_role_permissions
ON CONFLICT (club_id, role) DO NOTHING;

ALTER TABLE public.cm_role_permissions_backup_20261006 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cm_role_permissions_backup_20261006 FROM PUBLIC, anon, authenticated;

DO $migration$
DECLARE
  v_modules constant text[] := ARRAY[
    'dashboard', 'partidas', 'elenco', 'campanha', 'estatisticas', 'ranking',
    'calendario', 'competicoes', 'financeiro', 'patrocinadores', 'contratos',
    'documentos', 'config'
  ];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cm_role_permissions AS rp
    CROSS JOIN LATERAL jsonb_object_keys(rp.permissions) AS k(module)
    WHERE jsonb_typeof(rp.permissions) <> 'object'
       OR k.module <> ALL (v_modules)
  ) THEN
    RAISE EXCEPTION 'cm_role_permissions contains an invalid top-level permission key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cm_role_permissions AS rp
    CROSS JOIN LATERAL jsonb_each(rp.permissions) AS p(module, value)
    WHERE jsonb_typeof(p.value) NOT IN ('boolean', 'object')
  ) THEN
    RAISE EXCEPTION 'cm_role_permissions contains a permission value that is neither boolean nor object';
  END IF;
END
$migration$;

UPDATE public.cm_role_permissions AS rp
SET permissions = (
  SELECT jsonb_object_agg(
    module,
    CASE
      WHEN jsonb_typeof(rp.permissions -> module) = 'object'
        THEN rp.permissions -> module
      ELSE jsonb_build_object(
        'view', COALESCE(rp.permissions -> module = 'true'::jsonb, false),
        'create', false,
        'edit', false,
        'delete', false
      )
    END
  ) AS permissions
  FROM unnest(ARRAY[
    'dashboard', 'partidas', 'elenco', 'campanha', 'estatisticas', 'ranking',
    'calendario', 'competicoes', 'financeiro', 'patrocinadores', 'contratos',
    'documentos', 'config'
  ]::text[]) AS modules(module)
);

CREATE OR REPLACE FUNCTION private.cm_is_admin(p_club uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.cm_members AS m
    WHERE m.club_id = p_club
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('Presidente', 'Vice-presidente')
  );
$function$;

CREATE OR REPLACE FUNCTION private.cm_perm(
  p_club uuid,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_role text;
  v_permissions jsonb;
  v_modules constant text[] := ARRAY[
    'dashboard', 'partidas', 'elenco', 'campanha', 'estatisticas', 'ranking',
    'calendario', 'competicoes', 'financeiro', 'patrocinadores', 'contratos',
    'documentos', 'config'
  ];
BEGIN
  IF p_module IS NULL OR p_module <> ALL (v_modules)
     OR p_action IS NULL OR p_action NOT IN ('view', 'create', 'edit', 'delete') THEN
    RETURN false;
  END IF;

  IF private.cm_is_admin(p_club) THEN
    RETURN true;
  END IF;

  -- User-specific overrides in cm_members.permissions can be added here later.
  SELECT m.role, rp.permissions
    INTO v_role, v_permissions
  FROM public.cm_members AS m
  LEFT JOIN public.cm_role_permissions AS rp
    ON rp.club_id = m.club_id AND rp.role = m.role
  WHERE m.club_id = p_club
    AND m.user_id = auth.uid()
    AND m.status = 'active';

  IF NOT FOUND OR p_module = 'config' THEN
    RETURN false;
  END IF;

  RETURN COALESCE(v_permissions -> p_module ->> p_action = 'true', false);
END;
$function$;

REVOKE ALL ON FUNCTION private.cm_is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.cm_perm(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cm_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.cm_perm(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.cm_role_permissions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_modules constant text[] := ARRAY[
    'dashboard', 'partidas', 'elenco', 'campanha', 'estatisticas', 'ranking',
    'calendario', 'competicoes', 'financeiro', 'patrocinadores', 'contratos',
    'documentos', 'config'
  ];
  v_actions constant text[] := ARRAY['view', 'create', 'edit', 'delete'];
  v_module text;
  v_action text;
  v_module_value jsonb;
  v_action_value jsonb;
  v_permissions jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role IN ('Presidente', 'Vice-presidente') THEN
      RAISE EXCEPTION 'Administrator permissions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  NEW.permissions := COALESCE(NEW.permissions, '{}'::jsonb);
  IF jsonb_typeof(NEW.permissions) <> 'object' THEN
    RAISE EXCEPTION 'Role permissions must be a JSON object';
  END IF;

  FOR v_module, v_module_value IN
    SELECT key, value FROM jsonb_each(NEW.permissions)
  LOOP
    IF v_module <> ALL (v_modules) OR jsonb_typeof(v_module_value) <> 'object' THEN
      RAISE EXCEPTION 'Unknown module or invalid permission object: %', v_module;
    END IF;
    FOR v_action, v_action_value IN
      SELECT key, value FROM jsonb_each(v_module_value)
    LOOP
      IF v_action <> ALL (v_actions) OR jsonb_typeof(v_action_value) <> 'boolean' THEN
        RAISE EXCEPTION 'Unknown action or invalid permission value: %.%', v_module, v_action;
      END IF;
    END LOOP;
  END LOOP;

  IF NEW.role IN ('Presidente', 'Vice-presidente') THEN
    SELECT jsonb_object_agg(
      module,
      jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true)
    )
    INTO NEW.permissions
    FROM unnest(v_modules) AS modules(module);
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_permissions := '{}'::jsonb;
    FOREACH v_module IN ARRAY v_modules LOOP
      v_module_value := COALESCE(NEW.permissions -> v_module, '{}'::jsonb);
      v_module_value := jsonb_build_object(
        'view', v_module <> 'config',
        'create', false,
        'edit', false,
        'delete', false
      ) || v_module_value;
      IF v_module = 'config' THEN
        v_module_value := jsonb_build_object(
          'view', false, 'create', false, 'edit', false, 'delete', false
        );
      END IF;
      v_permissions := v_permissions || jsonb_build_object(v_module, v_module_value);
    END LOOP;
    NEW.permissions := v_permissions;
  ELSE
    NEW.permissions := NEW.permissions || jsonb_build_object(
      'config', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.cm_role_permissions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cm_role_permissions_guard ON public.cm_role_permissions;
CREATE TRIGGER cm_role_permissions_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.cm_role_permissions
FOR EACH ROW EXECUTE FUNCTION private.cm_role_permissions_guard();

-- Enforce admin grants and validate converted rows through the same guard used for future writes.
UPDATE public.cm_role_permissions SET permissions = permissions;

DO $policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cm_role_permissions'
      AND (
        COALESCE(qual, '') || COALESCE(with_check, '') ~ 'cm_is_manager|cm_role_permissions_write'
        OR policyname IN ('cm_perm_select', 'cm_perm_insert', 'cm_perm_update', 'cm_perm_delete')
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.cm_role_permissions', v_policy.policyname);
  END LOOP;
END
$policies$;

ALTER TABLE public.cm_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_perm_select ON public.cm_role_permissions
  FOR SELECT TO authenticated USING (private.cm_is_admin(club_id));
CREATE POLICY cm_perm_insert ON public.cm_role_permissions
  FOR INSERT TO authenticated WITH CHECK (private.cm_is_admin(club_id));
CREATE POLICY cm_perm_update ON public.cm_role_permissions
  FOR UPDATE TO authenticated
  USING (private.cm_is_admin(club_id))
  WITH CHECK (private.cm_is_admin(club_id));
CREATE POLICY cm_perm_delete ON public.cm_role_permissions
  FOR DELETE TO authenticated USING (private.cm_is_admin(club_id));

GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.cm_guard_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_module text := TG_ARGV[0];
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF NOT private.cm_perm(NEW.club_id, v_module, 'delete') THEN
      RAISE EXCEPTION 'Permission denied: % delete', v_module USING ERRCODE = '42501';
    END IF;
  ELSIF NOT private.cm_perm(NEW.club_id, v_module, 'edit') THEN
    RAISE EXCEPTION 'Permission denied: % edit', v_module USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.cm_guard_soft_delete() FROM PUBLIC, anon, authenticated;

DO $module_policies$
DECLARE
  v_table text;
  v_module text;
  v_policy record;
BEGIN
  FOR v_table, v_module IN
    SELECT * FROM (VALUES
      ('cm_matches', 'partidas'),
      ('cm_match_events', 'partidas'),
      ('cm_match_players', 'partidas'),
      ('cm_player_ratings', 'partidas'),
      ('cm_opponents', 'partidas'),
      ('cm_players', 'elenco'),
      ('cm_staff', 'elenco'),
      ('cm_competitions', 'competicoes'),
      ('cm_competition_games', 'competicoes'),
      ('cm_competition_teams', 'competicoes'),
      ('cm_transactions', 'financeiro'),
      ('cm_monthly_fees', 'financeiro'),
      ('cm_sponsors', 'patrocinadores'),
      ('cm_sponsor_history', 'patrocinadores'),
      ('cm_contracts', 'contratos'),
      ('cm_documents', 'documentos')
    ) AS modules(table_name, module_name)
  LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
        AND (
          COALESCE(qual, '') || COALESCE(with_check, '')
            ~ 'cm_is_member|cm_can_sports|cm_can_finance|cm_can_documents'
          OR policyname IN ('cm_perm_select', 'cm_perm_insert', 'cm_perm_update', 'cm_perm_delete')
        )
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'CREATE POLICY cm_perm_select ON public.%I FOR SELECT TO authenticated USING (private.cm_is_member(club_id) AND private.cm_perm(club_id, %L, %L))',
      v_table, v_module, 'view'
    );
    EXECUTE format(
      'CREATE POLICY cm_perm_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (private.cm_is_member(club_id) AND private.cm_perm(club_id, %L, %L))',
      v_table, v_module, 'create'
    );
    EXECUTE format(
      'CREATE POLICY cm_perm_update ON public.%I FOR UPDATE TO authenticated USING (private.cm_is_member(club_id) AND (private.cm_perm(club_id, %L, %L) OR private.cm_perm(club_id, %L, %L))) WITH CHECK (private.cm_is_member(club_id) AND (private.cm_perm(club_id, %L, %L) OR private.cm_perm(club_id, %L, %L)))',
      v_table, v_module, 'edit', v_module, 'delete', v_module, 'edit', v_module, 'delete'
    );
    EXECUTE format(
      'CREATE POLICY cm_perm_delete ON public.%I FOR DELETE TO authenticated USING (private.cm_is_member(club_id) AND private.cm_perm(club_id, %L, %L))',
      v_table, v_module, 'delete'
    );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'deleted_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS cm_soft_delete_guard ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER cm_soft_delete_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.cm_guard_soft_delete(%L)',
        v_table, v_module
      );
    END IF;
  END LOOP;
END
$module_policies$;