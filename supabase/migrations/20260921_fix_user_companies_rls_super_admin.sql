-- Fix user_companies RLS para super_admin não tomar 403 ao vincular
DROP POLICY IF EXISTS "user_companies_select" ON user_companies;
DROP POLICY IF EXISTS "user_companies_insert" ON user_companies;
DROP POLICY IF EXISTS "user_companies_delete" ON user_companies;

CREATE POLICY "user_companies_select" ON user_companies
FOR SELECT USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.user_owns_company(company_id)
);

CREATE POLICY "user_companies_insert" ON user_companies
FOR INSERT WITH CHECK (
  public.is_super_admin()
  OR public.user_owns_company(company_id)
);

CREATE POLICY "user_companies_delete" ON user_companies
FOR DELETE USING (
  public.is_super_admin()
  OR public.user_owns_company(company_id)
);

-- Garante que is_super_admin vê tudo em users para o teste
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users
FOR SELECT USING (
  auth.uid() = id
  OR public.is_super_admin()
  OR (
    role IN ('admin','profissional')
    AND EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = users.id
        AND public.user_owns_company(uc.company_id)
    )
  )
);
