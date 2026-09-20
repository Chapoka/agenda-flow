-- Criar tabela de tipos de estabelecimento (gerenciado por super_admin em Configurações)
CREATE TABLE IF NOT EXISTS establishment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_establishment_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS establishment_types_updated_at ON establishment_types;
CREATE TRIGGER establishment_types_updated_at
  BEFORE UPDATE ON establishment_types
  FOR EACH ROW EXECUTE FUNCTION update_establishment_types_updated_at();

-- RLS
ALTER TABLE establishment_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "establishment_types_select" ON establishment_types;
CREATE POLICY "establishment_types_select" ON establishment_types FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "establishment_types_insert" ON establishment_types;
CREATE POLICY "establishment_types_insert" ON establishment_types FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "establishment_types_update" ON establishment_types;
CREATE POLICY "establishment_types_update" ON establishment_types FOR UPDATE USING (public.is_super_admin());

DROP POLICY IF EXISTS "establishment_types_delete" ON establishment_types;
CREATE POLICY "establishment_types_delete" ON establishment_types FOR DELETE USING (public.is_super_admin());

-- Inserir tipos padrão genéricos (mantém legados para compatibilidade)
INSERT INTO establishment_types (name, slug) VALUES
  ('Atendimento Geral', 'atendimento_geral'),
  ('Clínica / Saúde', 'clinica_saude'),
  ('Consultório', 'consultorio'),
  ('Estúdio', 'estudio'),
  ('Barbearia', 'barbearia'),
  ('Clínica / Estética', 'clinica_estetica'),
  ('Empresa de Beleza', 'salao_beleza'),
  ('Studio / Manicure', 'studio_manicure')
ON CONFLICT (slug) DO NOTHING;
