import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/dbClient";
import { useCurrentUser } from "@/components/auth/useCurrentUser";

/**
 * Hook centralizado para isolamento multi-tenant de empresas.
 * - super_admin: vê todas as empresas
 * - admin/profissional/cliente: vê apenas empresas vinculadas ao seu cadastro (user_companies)
 * Evita vazamento UI onde admin de 1 empresa via 4 (bug imagem Clientes)
 */
export function useVisibleCompanies() {
  const { companyIds, isSuperAdmin, ready } = useCurrentUser();
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: ready,
    select: (data) => {
      if (isSuperAdmin) return data;
      if (!companyIds || companyIds.length === 0) return [];
      return data.filter((c) => companyIds.includes(c.id));
    },
  });
  return { companies, isLoading, isSuperAdmin, companyIds };
}
