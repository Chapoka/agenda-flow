-- Não permitir CNPJ/CPF duplicados em companies
-- Limpa duplicatas antigas mantendo a mais recente
WITH dup_cnpj AS (
  SELECT cnpj FROM companies WHERE cnpj IS NOT NULL AND cnpj <> '' GROUP BY cnpj HAVING COUNT(*) > 1
)
UPDATE companies SET cnpj = NULL WHERE id IN (
  SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY cnpj ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn FROM companies WHERE cnpj IN (SELECT cnpj FROM dup_cnpj)) t WHERE rn > 1
);

WITH dup_cpf AS (
  SELECT cpf_document FROM companies WHERE cpf_document IS NOT NULL AND cpf_document <> '' GROUP BY cpf_document HAVING COUNT(*) > 1
)
UPDATE companies SET cpf_document = NULL WHERE id IN (
  SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY cpf_document ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn FROM companies WHERE cpf_document IN (SELECT cpf_document FROM dup_cpf)) t WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_cnpj_unique ON companies (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE UNIQUE INDEX IF NOT EXISTS companies_cpf_document_unique ON companies (cpf_document) WHERE cpf_document IS NOT NULL AND cpf_document <> '';
