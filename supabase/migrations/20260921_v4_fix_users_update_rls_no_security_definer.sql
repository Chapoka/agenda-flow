-- Fix users UPDATE RLS for super_admin: avoid SECURITY DEFINER is_super_admin()
-- is_super_admin() may not resolve auth.uid() correctly inside RLS context

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_same_company" ON public.users;

-- UPDATE: super admin (check role directly from users table, no SECURITY DEFINER)
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- UPDATE: admin can update users from same companies
CREATE POLICY "users_update_same_company" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_companies my_uc
      WHERE my_uc.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.user_companies target_uc
          WHERE target_uc.user_id = users.id
            AND target_uc.company_id = my_uc.company_id
        )
    )
  );
