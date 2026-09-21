-- 20260924: GRANT INSERT/UPDATE/DELETE para authenticated role
-- PostgREST verifica GRANT antes de RLS — sem GRANT, retorna 42501

-- customers
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon;

-- customer_companies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO anon;

-- appointments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon;

-- invoices
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO anon;

-- companies (read for all authenticated)
GRANT SELECT ON public.companies TO authenticated;

-- services
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;

-- plans
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- professional_services
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;

-- blocked_times
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;

-- templates
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;

-- waiting_list
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated;

-- punch_cards
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punch_cards TO authenticated;

-- stylist_levels
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_levels TO authenticated;

-- users (read + update for own profile)
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- user_companies
GRANT SELECT ON public.user_companies TO authenticated;

-- establishment_types
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_types TO authenticated;

-- Verify: show grants for authenticated on key tables
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_name IN ('customers','customer_companies','appointments','invoices','services','plans')
  AND privilege_type = 'INSERT'
ORDER BY table_name;
