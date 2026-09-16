-- ============================================
-- AgendaFlow - Bootstrap completo para novo projeto Supabase
-- Projeto: agendaflow (EasyPanel: agendaflow-supabase)
-- Rode este arquivo INTEIRO no SQL Editor do novo Supabase (como postgres)
-- Idempotente: usa IF NOT EXISTS
-- ============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TABELA companies (empresas)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  cpf_document TEXT,
  tipo TEXT,
  estabelecimento_tipo TEXT,
  razao_social TEXT,
  situacao_cadastral TEXT,
  data_abertura TEXT,
  capital_social NUMERIC(12,2),
  porte TEXT,
  cnae_principal TEXT,
  natureza_juridica TEXT,
  cep TEXT,
  uf TEXT,
  cidade TEXT,
  bairro TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  phone TEXT,
  email TEXT,
  owner_email TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_cpf TEXT,
  active BOOLEAN DEFAULT true,
  has_branch BOOLEAN DEFAULT false,
  branding_app_name TEXT,
  branding_logo_url TEXT,
  branding_primary_color TEXT DEFAULT '#b7005e',
  branding_secondary_color TEXT DEFAULT '#db2777',
  branding_accent_color TEXT DEFAULT '#1a1c1c',
  branding_background_color TEXT DEFAULT '#f9f9f9',
  opening_time TEXT DEFAULT '08:00',
  closing_time TEXT DEFAULT '18:00',
  open_days TEXT[] DEFAULT ARRAY['seg','ter','qua','qui','sex','sab'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. TABELA users (usuarios do sistema)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date TEXT,
  role TEXT DEFAULT 'cliente',
  active BOOLEAN DEFAULT true,
  temp_password TEXT,
  must_change_password BOOLEAN DEFAULT false,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_ids UUID[] DEFAULT '{}',
  stylist_level_id UUID,
  phone TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  specialty TEXT,
  photo_url TEXT,
  work_days TEXT[] DEFAULT ARRAY['seg','ter','qua','qui','sex','sab'],
  whatsapp TEXT,
  is_master BOOLEAN DEFAULT false,
  is_professional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_companies (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);

-- ============================================
-- 3. TABELA customers (clientes/alunos)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  email TEXT,
  whatsapp TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zipcode TEXT,
  birth_date TEXT,
  medical_certificate_url TEXT,
  plan_id UUID,
  custom_plan JSONB,
  current_credits INTEGER DEFAULT 0,
  access_token TEXT,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guardian_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  billing_mode TEXT DEFAULT 'individual',
  portal_enabled BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_companies (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (customer_id, company_id)
);

-- ============================================
-- 4. TABELA appointments (agendamentos)
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  plan_id UUID,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_mins INTEGER DEFAULT 60,
  service_category TEXT,
  modality TEXT,
  status TEXT DEFAULT 'scheduled',
  appointment_type TEXT DEFAULT 'plan',
  cancellation_reason TEXT,
  service_performed BOOLEAN DEFAULT false,
  notes TEXT,
  rescheduled BOOLEAN DEFAULT false,
  rescheduled_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  original_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  service_id UUID,
  product_id UUID,
  professional_id UUID REFERENCES users(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  final_price NUMERIC(10,2),
  commission_value NUMERIC(10,2),
  stylist_level_id UUID,
  punch_card_id UUID,
  is_out_of_hours BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. TABELA services (produtos e serviços)
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'service',
  service_type TEXT DEFAULT 'Normal',
  category TEXT DEFAULT 'Corte',
  duration_mins INTEGER DEFAULT 30,
  price NUMERIC(10,2) DEFAULT 0,
  preco_custo NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  active BOOLEAN DEFAULT true,
  unidade_medida TEXT DEFAULT 'unidade',
  quantidade_estoque INTEGER DEFAULT 0,
  desconto NUMERIC(5,2) DEFAULT 0,
  comissao NUMERIC(5,2) DEFAULT 0,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_combo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  combo_price NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES service_combos(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. TABELA plans
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  modality TEXT DEFAULT 'corte',
  product_type TEXT,
  combo_type TEXT,
  duration_mins INTEGER DEFAULT 60,
  price NUMERIC(10,2) DEFAULT 0,
  session_count INTEGER DEFAULT 4,
  commission NUMERIC(5,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  professional TEXT,
  description TEXT,
  active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_type TEXT DEFAULT 'service',
  ref_id UUID,
  price NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  commission NUMERIC(5,2) DEFAULT 0,
  commission_type TEXT DEFAULT 'percent',
  quantity INTEGER DEFAULT 1,
  manufacturer TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 7. TABELA stylist_levels
-- ============================================
CREATE TABLE IF NOT EXISTS stylist_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  multiplier NUMERIC(5,2) DEFAULT 1.0,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 8. TABELA punch_cards
-- ============================================
CREATE TABLE IF NOT EXISTS punch_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  total_services INTEGER DEFAULT 10,
  used_services INTEGER DEFAULT 0,
  price_paid NUMERIC(10,2) DEFAULT 0,
  price_per_service NUMERIC(10,2) DEFAULT 0,
  name TEXT DEFAULT 'Punch Card',
  notes TEXT,
  expires_at TEXT,
  active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  service_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 9. TABELA professional_services
-- ============================================
CREATE TABLE IF NOT EXISTS professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  performs_service BOOLEAN DEFAULT true,
  price_override NUMERIC(10,2) DEFAULT 0,
  duration_override INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(professional_id, service_id)
);

-- ============================================
-- 10. TABELA blocked_times
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  description TEXT,
  block_all_barbers BOOLEAN DEFAULT false,
  recurrence_type TEXT DEFAULT 'none',
  recurrence_day_of_week INTEGER,
  period_start_date TEXT,
  period_end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 11. TABELA company_integrations
-- ============================================
CREATE TABLE IF NOT EXISTS company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  asaas_api_key TEXT,
  asaas_environment TEXT DEFAULT 'sandbox',
  asaas_subaccount_id TEXT,
  asaas_subaccount_wallet_id TEXT,
  whatsapp_provider TEXT,
  whatsapp_api_url TEXT,
  whatsapp_api_token TEXT,
  whatsapp_phone TEXT,
  whatsapp_webhook_url TEXT,
  whatsapp_instance TEXT,
  whatsapp_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 12. TABELA establishment_types (tipos de estabelecimento)
-- ============================================
CREATE TABLE IF NOT EXISTS establishment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS establishment_types_updated_at ON establishment_types;
CREATE OR REPLACE FUNCTION update_establishment_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER establishment_types_updated_at
  BEFORE UPDATE ON establishment_types
  FOR EACH ROW EXECUTE FUNCTION update_establishment_types_updated_at();

INSERT INTO establishment_types (name, slug) VALUES
  ('Barbearia', 'barbearia'),
  ('Clínica / Estética', 'clinica_estetica'),
  ('Empresa de Beleza', 'salao_beleza'),
  ('Studio / Manicure', 'studio_manicure')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 13. TABELAS auxiliares
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  category TEXT,
  description TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  modality TEXT DEFAULT 'corte',
  duration_mins INTEGER DEFAULT 60,
  preferred_days INTEGER[] DEFAULT '{}',
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  status TEXT DEFAULT 'waiting',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL,
  message TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  send_before_hours INTEGER DEFAULT 24,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  asaas_id TEXT,
  asaas_url TEXT,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  plan_name TEXT,
  value NUMERIC(10,2) NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'pending',
  payment_date TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_service_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, service_id)
);

-- ============================================
-- 14. FUNÇÕES E RLS (multi-tenant)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;
  v_role := COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role');
  RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT unnest(
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    THEN (SELECT array_agg(c.id) FROM public.companies c)
    ELSE COALESCE((SELECT u.company_ids FROM public.users u WHERE u.id = auth.uid()), ARRAY[]::UUID[]) END
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.user_owns_company(p_company_id UUID)
RETURNS BOOLEAN VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN TRUE; END IF;
  IF p_company_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.get_user_company_ids() AS cid WHERE cid = p_company_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar public.users ao criar auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS enable
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylist_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_service_overrides ENABLE ROW LEVEL SECURITY;

-- Policies básicas (super_admin vê tudo, user_owns_company para resto)
DROP POLICY IF EXISTS "companies_all" ON companies; CREATE POLICY "companies_all" ON companies FOR ALL USING (public.user_owns_company(id));
DROP POLICY IF EXISTS "users_select" ON users; CREATE POLICY "users_select" ON users FOR SELECT USING (id = auth.uid() OR public.is_super_admin() OR public.user_owns_company(company_id));
DROP POLICY IF EXISTS "establishment_types_select" ON establishment_types; CREATE POLICY "establishment_types_select" ON establishment_types FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "establishment_types_insert" ON establishment_types; CREATE POLICY "establishment_types_insert" ON establishment_types FOR INSERT WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "establishment_types_update" ON establishment_types; CREATE POLICY "establishment_types_update" ON establishment_types FOR UPDATE USING (public.is_super_admin());
DROP POLICY IF EXISTS "establishment_types_delete" ON establishment_types; CREATE POLICY "establishment_types_delete" ON establishment_types FOR DELETE USING (public.is_super_admin());
DROP POLICY IF EXISTS "cso_select" ON company_service_overrides; CREATE POLICY "cso_select" ON company_service_overrides FOR SELECT USING (public.user_owns_company(company_id) OR public.is_super_admin());
DROP POLICY IF EXISTS "cso_insert" ON company_service_overrides; CREATE POLICY "cso_insert" ON company_service_overrides FOR INSERT WITH CHECK (public.user_owns_company(company_id) OR public.is_super_admin());
DROP POLICY IF EXISTS "cso_update" ON company_service_overrides; CREATE POLICY "cso_update" ON company_service_overrides FOR UPDATE USING (public.user_owns_company(company_id) OR public.is_super_admin());
DROP POLICY IF EXISTS "cso_delete" ON company_service_overrides; CREATE POLICY "cso_delete" ON company_service_overrides FOR DELETE USING (public.user_owns_company(company_id) OR public.is_super_admin());

-- Outras policies simplificadas (permissive para autenticados - ajuste fino via app)
DO $$ DECLARE t TEXT; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t); END LOOP; END $$;
-- Nota: para produção, ajuste as policies específicas por tabela conforme 20260730_multitenant_rls.sql original

-- ============================================
-- 15. DADOS INICIAIS (opcional)
-- ============================================
-- Crie o primeiro super_admin manualmente via Dashboard Auth ou via SQL:
-- INSERT INTO auth.users ... + public.users com role super_admin
-- Exemplo já existente: rodrigo.rocha@morumbisolutions.com.br
