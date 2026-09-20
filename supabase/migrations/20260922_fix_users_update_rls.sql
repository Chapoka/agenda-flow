-- Fix users_update para super_admin poder desmarcar is_professional/is_master
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
FOR UPDATE USING (
  auth.uid() = id
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = users.id
      AND public.user_owns_company(uc.company_id)
  )
)
WITH CHECK (
  auth.uid() = id
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = users.id
      AND public.user_owns_company(uc.company_id)
  )
);
