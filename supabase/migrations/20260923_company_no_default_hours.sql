-- Empresa sem horário definido por padrão - só aparece após cadastro manual
ALTER TABLE companies ALTER COLUMN opening_time DROP DEFAULT;
ALTER TABLE companies ALTER COLUMN closing_time DROP DEFAULT;
ALTER TABLE companies ALTER COLUMN open_days DROP DEFAULT;
-- Define NULL para novas empresas (manter existentes com horário)
UPDATE companies SET opening_time = '08:00' WHERE opening_time IS NULL AND closing_time IS NOT NULL;
