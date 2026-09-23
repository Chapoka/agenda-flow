-- =============================================================================
-- 20260927: RESTORE settings/modality RLS policies
-- A migration 20260921_fix_companies_plans_rls.sql DROPou TODAS as policies
-- de settings, modalities e establishment_types (linhas 34-40) mas NUNCA
-- recriou as de escrita — super_admin ficou sem conseguir ler/salvar
-- Configurações (INSERT 403 + SELECT vazio).
-- =============================================================================

-- garante RLS ligado
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_types ENABLE ROW LEVEL SECURITY;

-- dropa policies órfãs/ antigas
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('settings','modalities','establishment_types')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END $$;

-- SETTINGS: qualquer autenticado lê; só super_admin escreve
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_insert" ON public.settings
  FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "settings_update" ON public.settings
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "settings_delete" ON public.settings
  FOR DELETE USING (public.is_super_admin());

-- MODALITIES: leitura aberta; escrita super_admin
CREATE POLICY "modalities_select" ON public.modalities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "modalities_insert" ON public.modalities
  FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "modalities_update" ON public.modalities
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "modalities_delete" ON public.modalities
  FOR DELETE USING (public.is_super_admin());

-- ESTABLISHMENT_TYPES: leitura aberta; escrita super_admin
CREATE POLICY "establishment_types_select" ON public.establishment_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "establishment_types_insert" ON public.establishment_types
  FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "establishment_types_update" ON public.establishment_types
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "establishment_types_delete" ON public.establishment_types
  FOR DELETE USING (public.is_super_admin());

-- GRANTs (20260925 só deu SELECT em settings/modalities)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modalities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_types TO authenticated;

-- stylist_levels: 20260921 recriou só SELECT — garante escrita para admin/super
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='stylist_levels' AND cmd <> 'SELECT'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.stylist_levels';
  END LOOP;
END $$;
CREATE POLICY "stylist_levels_insert" ON public.stylist_levels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stylist_levels_update" ON public.stylist_levels
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stylist_levels_delete" ON public.stylist_levels
  FOR DELETE USING (public.is_super_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_levels TO authenticated;
