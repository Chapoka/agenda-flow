-- Protect super_admin: só deletável via SQL direto no Supabase (postgres/supabase_admin sem JWT)
-- App (PostgREST / service_role via API) será bloqueado por trigger + RLS

CREATE OR REPLACE FUNCTION public.prevent_super_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    -- Permite apenas conexão direta como superuser sem JWT (Studio > SQL Editor / psql no container db)
    -- auth.jwt() é NULL quando vem direto do Postgres, não via PostgREST
    IF current_user IN ('postgres', 'supabase_admin') AND auth.jwt() IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'super_admin "%" (id=%) não pode ser deletado via app. Use Supabase Studio > SQL Editor como postgres: DELETE FROM auth.users WHERE id = ''%''; -- ou DELETE FROM public.users WHERE id = ''%'';', OLD.email, OLD.id, OLD.id, OLD.id USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_delete ON public.users;
CREATE TRIGGER trg_prevent_super_admin_delete
BEFORE DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_delete();

-- RLS: super_admin pode deletar qualquer usuário EXCETO outro super_admin via API (PostgREST)
-- service_role bypassa RLS, mas trigger acima ainda bloqueia (pois service_role vem com JWT)
DROP POLICY IF EXISTS "users_delete" ON public.users;
CREATE POLICY "users_delete" ON public.users
FOR DELETE USING (
  public.is_super_admin()
  AND role != 'super_admin'
);

-- Bloqueia também via RPC delete_user_direct (usado em Settings.jsx)
CREATE OR REPLACE FUNCTION public.delete_user_direct(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir usuários';
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    RAISE EXCEPTION 'super_admin não pode ser deletado via app/RPC. Use SQL direto: DELETE FROM auth.users WHERE id = ''%'';', p_user_id USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.prevent_super_admin_delete() IS '20260920: bloqueia DELETE de super_admin via app; só postgres/supabase_admin sem JWT (Studio SQL Editor) permite';
COMMENT ON POLICY "users_delete" ON public.users IS '20260920: super_admin não deletável via PostgREST; trigger garante bloqueio mesmo para service_role';
