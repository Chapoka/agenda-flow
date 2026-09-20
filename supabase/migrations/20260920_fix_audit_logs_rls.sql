-- Fix audit_logs RLS - super_admin check estava falhando no WITH CHECK
-- Permitir qualquer usuário autenticado inserir log (app precisa registrar criação de usuário)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE USING (public.is_super_admin());
