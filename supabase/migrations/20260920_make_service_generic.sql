-- Tornar sistema genérico para diversas áreas (não só barbearia)
-- Remove CHECK restrito a corte/barba e torna genérico

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_category_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_service_category_check
  CHECK (service_category IS NULL OR char_length(service_category) > 0);

ALTER TABLE appointments ALTER COLUMN service_category SET DEFAULT 'servico';

ALTER TABLE waiting_list DROP CONSTRAINT IF EXISTS waiting_list_modality_check;
ALTER TABLE waiting_list ADD CONSTRAINT waiting_list_modality_check
  CHECK (modality IS NULL OR char_length(modality) > 0);
ALTER TABLE waiting_list ALTER COLUMN modality SET DEFAULT 'servico';

-- Atualizar tipos de estabelecimento para genéricos (mantém legados)
INSERT INTO establishment_types (name, slug) VALUES
  ('Atendimento Geral', 'atendimento_geral'),
  ('Clínica / Saúde', 'clinica_saude'),
  ('Consultório', 'consultorio'),
  ('Estúdio', 'estudio')
ON CONFLICT (slug) DO NOTHING;

-- Atualizar dados antigos corte/barba para genérico se desejado (mantém para compatibilidade, não converte)
-- UPDATE appointments SET service_category = 'servico' WHERE service_category IN ('corte', 'barba');
