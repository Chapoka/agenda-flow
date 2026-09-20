import { useState, useEffect } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function CopyIdButton({ id }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copiar ID"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-branding-primary transition-colors font-mono bg-background border border-outline-variant rounded px-1.5 py-0.5"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copiado!" : id.slice(0, 8) + "…"}
    </button>
  );
}
import { db } from "@/api/dbClient";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Edit, Trash2, MoreVertical, GitBranch, Copy, Check, LayoutGrid, List, MessageCircle, Power, PowerOff, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCPF, formatCNPJ } from "@/utils/formatters";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CompanyFormModal from "@/components/companies/CompanyFormModal";

const FALLBACK_ESTABELECIMENTO_LABELS = {
  atendimento_geral: "Atendimento Geral",
  clinica_saude: "Clínica / Saúde",
  consultorio: "Consultório",
  estudio: "Estúdio",
  // legado
  barbearia: "Barbearia",
  clinica_estetica: "Clínica / Estética",
  salao_beleza: "Empresa de Beleza",
  studio_manicure: "Studio / Manicure",
};

export default function Companies() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(() => {
    try { return localStorage.getItem("form_draft_company_open") === "true"; } catch { return false; }
  });
  const [editing, setEditing] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem("form_draft_company");
      return saved ? JSON.parse(saved) : {
        name: "", cnpj: "", cpf_document: "", tipo: "", estabelecimento_tipo: "", razao_social: "", situacao_cadastral: "",
        data_abertura: "", capital_social: "", porte: "", cnae_principal: "",
        natureza_juridica: "", cep: "", uf: "", cidade: "", bairro: "",
        logradouro: "", numero: "", complemento: "", phone: "", email: "",
        owner_email: "", owner_name: "", owner_phone: "", owner_cpf: "", active: true, has_branch: false,
      };
    } catch { return {
      name: "", cnpj: "", cpf_document: "", tipo: "", estabelecimento_tipo: "", razao_social: "", situacao_cadastral: "",
      data_abertura: "", capital_social: "", porte: "", cnae_principal: "",
      natureza_juridica: "", cep: "", uf: "", cidade: "", bairro: "",
      logradouro: "", numero: "", complemento: "", phone: "", email: "",
      owner_email: "", owner_name: "", owner_phone: "", owner_cpf: "", active: true, has_branch: false,
    }; }
  });

  useEffect(() => {
    localStorage.setItem("form_draft_company_open", String(showModal));
    if (showModal) {
      localStorage.setItem("form_draft_company", JSON.stringify(form));
    }
  }, [form, showModal]);

  useEffect(() => {
    db.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const rawRole = currentUser?.role;
  const role = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const userCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);

  const { data: establishmentTypes = [] } = useQuery({
    queryKey: ["establishment_types"],
    queryFn: () => db.entities.EstablishmentType.list(),
  });
  const estabelecimentoLabelMap = establishmentTypes.length
    ? Object.fromEntries(establishmentTypes.map(t => [t.slug, t.name]))
    : FALLBACK_ESTABELECIMENTO_LABELS;
  const getEstabelecimentoLabel = (tipo) => estabelecimentoLabelMap[tipo] || tipo || "";

  const { data: allCompanies = [], isLoading, error: queryError } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list("-created_at"),
    onError: (err) => toast.error("Erro ao listar empresas: " + (err?.message || "verifique sua conexão")),
  });

  // Filter: super_admin sees all, admin/profissional see only linked companies
  const companies = isSuperAdmin
    ? allCompanies
    : allCompanies.filter(c => userCompanyIds.includes(c.id));

  const sortedCompanies = [...companies].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.name || "").localeCompare(a.name || "", "pt-BR");
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortOrder === "city-asc") return (a.cidade || "").localeCompare(b.cidade || "", "pt-BR");
    if (sortOrder === "city-desc") return (b.cidade || "").localeCompare(a.cidade || "", "pt-BR");
    if (sortOrder === "tipo-asc") return getEstabelecimentoLabel(a.estabelecimento_tipo).localeCompare(getEstabelecimentoLabel(b.estabelecimento_tipo), "pt-BR");
    if (sortOrder === "tipo-desc") return getEstabelecimentoLabel(b.estabelecimento_tipo).localeCompare(getEstabelecimentoLabel(a.estabelecimento_tipo), "pt-BR");
    if (sortOrder === "cnpj-asc") return (a.cnpj || a.cpf_document || "").localeCompare(b.cnpj || b.cpf_document || "", "pt-BR");
    if (sortOrder === "cnpj-desc") return (b.cnpj || b.cpf_document || "").localeCompare(a.cnpj || a.cpf_document || "", "pt-BR");
    if (sortOrder === "contato-asc") return (a.email || a.phone || "").localeCompare(b.email || b.phone || "", "pt-BR");
    if (sortOrder === "contato-desc") return (b.email || b.phone || "").localeCompare(a.email || a.phone || "", "pt-BR");
    if (sortOrder === "responsavel-asc") return (a.owner_name || "").localeCompare(b.owner_name || "", "pt-BR");
    if (sortOrder === "responsavel-desc") return (b.owner_name || "").localeCompare(a.owner_name || "", "pt-BR");
    if (sortOrder === "status-asc") return (a.active !== false ? 1 : 0) - (b.active !== false ? 1 : 0);
    if (sortOrder === "status-desc") return (b.active !== false ? 1 : 0) - (a.active !== false ? 1 : 0);
    return 0;
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { responsible_admin_id, ...companyData } = data;
      const result = await db.entities.Company.create(companyData);
      if (responsible_admin_id && result?.id) {
        try {
          await supabase.from("user_companies").upsert({ user_id: responsible_admin_id, company_id: result.id }, { onConflict: "user_id,company_id" });
          await supabase.from("users").update({ company_id: result.id }).eq("id", responsible_admin_id);
        } catch (e) { console.warn("Falha ao vincular responsável:", e); }
      }
      return { ...result, responsible_admin_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users_for_company"] });
      if (result?.id) queryClient.invalidateQueries({ queryKey: ["userCompany", result.id] });
      toast.success("Empresa criada!" + (result?.responsible_admin_id ? " Responsável vinculado." : ""));
      closeModal();
    },
    onError: (err) => toast.error("Erro ao criar empresa: " + (err?.message || "verifique os dados")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { responsible_admin_id, ...companyData } = data;
      const result = await db.entities.Company.update(id, companyData);
      if (responsible_admin_id) {
        try {
          await supabase.from("user_companies").upsert({ user_id: responsible_admin_id, company_id: id }, { onConflict: "user_id,company_id" });
        } catch (e) { console.warn("Falha ao vincular responsável:", e); }
      }
      return { ...result, responsible_admin_id };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users_for_company"] });
      queryClient.invalidateQueries({ queryKey: ["userCompany", variables.id] });
      toast.success("Empresa atualizada!");
      closeModal();
    },
    onError: (err) => toast.error("Erro ao atualizar empresa: " + (err?.message || "verifique os dados")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Company.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); toast.success("Empresa removida!"); },
    onError: (err) => toast.error("Erro ao excluir empresa: " + (err?.message || "verifique se não há dependências")),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => db.entities.Company.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Status da empresa atualizado!");
    },
    onError: (err) => toast.error("Erro ao atualizar status: " + (err?.message || "verifique sua conexão")),
  });

  const openModal = (company = null) => {
    if (company) {
      setEditing(company);
      setForm({
        name: company.name || "", cnpj: company.cnpj || "", cpf_document: company.cpf_document || "",
        tipo: company.tipo || "",
        estabelecimento_tipo: company.estabelecimento_tipo || "",
        razao_social: company.razao_social || "", situacao_cadastral: company.situacao_cadastral || "",
        data_abertura: company.data_abertura || "", capital_social: company.capital_social || "",
        porte: company.porte || "", cnae_principal: company.cnae_principal || "",
        natureza_juridica: company.natureza_juridica || "", cep: company.cep || "",
        uf: company.uf || "", cidade: company.cidade || "", bairro: company.bairro || "",
        logradouro: company.logradouro || "", numero: company.numero || "",
        complemento: company.complemento || "", phone: company.phone || "",
        email: company.email || "", owner_email: company.owner_email || "",
        owner_name: company.owner_name || "", owner_phone: company.owner_phone || "",
        owner_cpf: company.owner_cpf || "",
        active: company.active !== false, has_branch: company.has_branch || false,
      });
    } else {
      setEditing(null);
      setForm({
        name: "", cnpj: "", cpf_document: "", tipo: "", estabelecimento_tipo: "", razao_social: "", situacao_cadastral: "",
        data_abertura: "", capital_social: "", porte: "", cnae_principal: "",
        natureza_juridica: "", cep: "", uf: "", cidade: "", bairro: "",
        logradouro: "", numero: "", complemento: "", phone: "", email: "",
        owner_email: "", owner_name: "", owner_phone: "", owner_cpf: "", active: true, has_branch: false,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    localStorage.removeItem("form_draft_company");
    localStorage.removeItem("form_draft_company_open");
  };

  const handleSave = () => {
    // Required fields validation
    const requiredFields = [
      { key: "name", label: "Nome Fantasia" },
      { key: "estabelecimento_tipo", label: "Tipo de Estabelecimento" },
    ];
    for (const field of requiredFields) {
      if (!form[field.key] || String(form[field.key]).trim() === "") {
        return toast.error(`O campo "${field.label}" precisa ser preenchido`);
      }
    }
    // Sanitize data: convert formatted strings to proper types
    const COMPANY_COLUMNS = [
      "name", "cnpj", "cpf_document", "tipo", "estabelecimento_tipo", "razao_social", "situacao_cadastral",
      "data_abertura", "capital_social", "porte", "cnae_principal", "natureza_juridica",
      "cep", "uf", "cidade", "bairro", "logradouro", "numero", "complemento",
      "phone", "email", "owner_email", "owner_name", "owner_phone", "owner_cpf",
      "active", "has_branch",
      "branding_app_name", "branding_logo_url",
    ];
    const sanitize = (raw) => {
      const out = {};
      // Only include known columns
      for (const key of COMPANY_COLUMNS) {
        if (raw[key] !== undefined && raw[key] !== null) out[key] = raw[key];
      }
      // Clean formatted documents to digits only
      if (out.cnpj) out.cnpj = String(out.cnpj).replace(/\D/g, "");
      if (out.cpf_document) out.cpf_document = String(out.cpf_document).replace(/\D/g, "");
      if (out.cep) out.cep = String(out.cep).replace(/\D/g, "");
      if (out.phone) out.phone = String(out.phone).replace(/\D/g, "");
      if (out.owner_phone) out.owner_phone = String(out.owner_phone).replace(/\D/g, "");
      // capital_social: "1.000,00" -> 1000.00 (number)
      if (out.capital_social !== "" && out.capital_social != null) {
        const num = Number(String(out.capital_social).replace(/\./g, "").replace(",", "."));
        out.capital_social = isNaN(num) ? null : num;
      } else {
        out.capital_social = null;
      }
      // Empty strings -> undefined (avoid constraint errors)
       ["data_abertura", "email", "owner_email", "tipo", "estabelecimento_tipo",
        "branding_app_name", "branding_logo_url",
       ].forEach(key => {
        if (out[key] === "") out[key] = null;
      });
      return out;
    };
    const payload = sanitize(form);
    // Preserva vínculo de responsável para user_companies (não é coluna de companies)
    if (form.responsible_admin_id) payload.responsible_admin_id = form.responsible_admin_id;
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              Empresas
            </h1>
            <p className="text-muted-foreground mt-1">{companies.length} empresa(s) cadastrada(s)</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {companies.length > 0 && (
              <>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-44 rounded-xl border-outline-variant text-sm h-9">
                    <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Empresa A → Z</SelectItem>
                    <SelectItem value="name-desc">Empresa Z → A</SelectItem>
                    <SelectItem value="tipo-asc">Tipo A → Z</SelectItem>
                    <SelectItem value="tipo-desc">Tipo Z → A</SelectItem>
                    <SelectItem value="cnpj-asc">CNPJ A → Z</SelectItem>
                    <SelectItem value="cnpj-desc">CNPJ Z → A</SelectItem>
                    <SelectItem value="contato-asc">Contato A → Z</SelectItem>
                    <SelectItem value="contato-desc">Contato Z → A</SelectItem>
                    <SelectItem value="responsavel-asc">Responsável A → Z</SelectItem>
                    <SelectItem value="responsavel-desc">Responsável Z → A</SelectItem>
                    <SelectItem value="city-asc">Cidade A → Z</SelectItem>
                    <SelectItem value="city-desc">Cidade Z → A</SelectItem>
                    <SelectItem value="status-asc">Status A → Z</SelectItem>
                    <SelectItem value="status-desc">Status Z → A</SelectItem>
                    <SelectItem value="recent">Mais recentes ↓</SelectItem>
                    <SelectItem value="oldest">Mais antigos ↑</SelectItem>
                  </SelectContent>
                </Select>
                <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "cards" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                    title="Visualização em cards"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "list" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                    title="Visualização em lista"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
            {isSuperAdmin && (
              <Button onClick={() => openModal()} className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20">
                <Plus className="w-5 h-5 mr-2" /> Nova Empresa
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-card rounded-2xl p-6 animate-pulse h-40" />)}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">Nenhuma empresa cadastrada</h3>
            {isSuperAdmin && (
              <>
                <p className="text-muted-foreground mb-6">Crie sua primeira empresa para começar</p>
                <Button onClick={() => openModal()} className="btn-branding rounded-xl">
                  <Plus className="w-5 h-5 mr-2" /> Nova Empresa
                </Button>
              </>
            )}
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCompanies.map(company => (
              <div key={company.id} className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-6 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-semibold"
                      style={{
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      }}
                    >
                      {company.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-on-surface">{company.name}</h3>
                      {company.cpf_document && <p className="text-xs text-muted-foreground">{formatCPF(company.cpf_document)}</p>}
                      {!company.cpf_document && company.cnpj && <p className="text-xs text-muted-foreground">{formatCNPJ(company.cnpj)}</p>}
                    </div>
                  </div>
                  {(isSuperAdmin || isAdmin) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openModal(company)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: company.id, active: !(company.active !== false) })}>
                          {company.active !== false ? <PowerOff className="w-4 h-4 mr-2" /> : <Power className="w-4 h-4 mr-2" />}
                          {company.active !== false ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <DropdownMenuItem onClick={() => setDeletingCompany(company)} className="text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {company.email && <p>✉️ {company.email}</p>}
                  {company.phone && <p>📞 {company.phone}</p>}
                  {company.owner_name && <p>👤 {company.owner_name}</p>}
                  {company.cidade && <p>📍 {company.cidade}{company.uf ? ` - ${company.uf}` : ""}</p>}
                </div>
                <div className="mt-3 pt-3 border-t border-outline-variant/30 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(isSuperAdmin || isAdmin) ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={company.active !== false}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: company.id, active: checked })}
                          aria-label={company.active !== false ? "Desativar empresa" : "Ativar empresa"}
                        />
                        <Badge className={company.active !== false ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-container-low text-muted-foreground"}>
                          {company.active !== false ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    ) : (
                      <Badge className={company.active !== false ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-container-low text-muted-foreground"}>
                        {company.active !== false ? "Ativa" : "Inativa"}
                      </Badge>
                    )}
                    {company.estabelecimento_tipo && (
                      <Badge
                        className="flex items-center gap-1 bg-primary/10 text-primary border-primary/20"
                      >
                        <span
                          className="w-2 h-2 rounded-full bg-primary"
                        />
                        {getEstabelecimentoLabel(company.estabelecimento_tipo)}
                      </Badge>
                    )}
                    {company.has_branch && (
                      <Badge className="bg-blue-500/20 text-blue-300 flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> Possui Filial
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-muted-foreground">ID:</span>
                    <CopyIdButton id={company.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-outline-variant/30">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "tipo-asc" ? "tipo-desc" : "tipo-asc")}><span className="inline-flex items-center gap-1">Tipo {sortOrder === "tipo-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "tipo-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "cnpj-asc" ? "cnpj-desc" : "cnpj-asc")}><span className="inline-flex items-center gap-1">CNPJ {sortOrder === "cnpj-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "cnpj-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "contato-asc" ? "contato-desc" : "contato-asc")}><span className="inline-flex items-center gap-1">Contato {sortOrder === "contato-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "contato-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "responsavel-asc" ? "responsavel-desc" : "responsavel-asc")}><span className="inline-flex items-center gap-1">Responsável {sortOrder === "responsavel-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "responsavel-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "city-asc" ? "city-desc" : "city-asc")}><span className="inline-flex items-center gap-1">Cidade {sortOrder === "city-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "city-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "status-asc" ? "status-desc" : "status-asc")}><span className="inline-flex items-center gap-1">Status {sortOrder === "status-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "status-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {sortedCompanies.map(company => (
                    <tr key={company.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                            style={{
                              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            }}
                          >
                            {company.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-on-surface truncate">{company.name}</p>
                            <span className="text-xs text-muted-foreground md:hidden">{company.cpf_document ? formatCPF(company.cpf_document) : (company.cnpj ? formatCNPJ(company.cnpj) : "—")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {company.estabelecimento_tipo ? (
                          <Badge
                            className="flex items-center gap-1 bg-primary/10 text-primary border-primary/20"
                          >
                            <span
                              className="w-2 h-2 rounded-full bg-primary"
                            />
                            {getEstabelecimentoLabel(company.estabelecimento_tipo)}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{company.cpf_document ? formatCPF(company.cpf_document) : (company.cnpj ? formatCNPJ(company.cnpj) : "—")}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5 text-muted-foreground">
                          {company.phone && <p className="truncate">📞 {company.phone}</p>}
                          {company.email && <p className="truncate">✉️ {company.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5 text-muted-foreground">
                          {company.owner_name && <p className="truncate">👤 {company.owner_name}</p>}
                          {company.owner_phone && (
                            <a
                              href={`https://wa.me/55${company.owner_phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#25D366] hover:underline"
                            >
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {company.cidade ? `${company.cidade}${company.uf ? ` - ${company.uf}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(isSuperAdmin || isAdmin) ? (
                            <>
                              <Switch
                                checked={company.active !== false}
                                onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: company.id, active: checked })}
                                aria-label={company.active !== false ? "Desativar empresa" : "Ativar empresa"}
                              />
                              <Badge className={company.active !== false ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-container-low text-muted-foreground"}>
                                {company.active !== false ? "Ativa" : "Inativa"}
                              </Badge>
                            </>
                          ) : (
                            <Badge className={company.active !== false ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-container-low text-muted-foreground"}>
                              {company.active !== false ? "Ativa" : "Inativa"}
                            </Badge>
                          )}
                          {company.has_branch && (
                            <Badge className="bg-blue-500/20 text-blue-300 flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(isSuperAdmin || isAdmin) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openModal(company)}>
                                <Edit className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: company.id, active: !(company.active !== false) })}>
                                {company.active !== false ? <PowerOff className="w-4 h-4 mr-2" /> : <Power className="w-4 h-4 mr-2" />}
                                {company.active !== false ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              {isSuperAdmin && (
                                <DropdownMenuItem onClick={() => setDeletingCompany(company)} className="text-red-400">
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <CopyIdButton id={company.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <CompanyFormModal
          editing={editing}
          form={form}
          setForm={setForm}
          onClose={closeModal}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <AlertDialog open={!!deletingCompany} onOpenChange={() => setDeletingCompany(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingCompany?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteMutation.mutate(deletingCompany?.id); setDeletingCompany(null); }}
              className="bg-error hover:bg-error/80 rounded-xl"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}