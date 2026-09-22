import { useState } from "react";
import { db } from "@/api/dbClient";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPhone } from "@/utils/formatters";
import CompanyMultiSelect from "@/components/settings/CompanyMultiSelect";
import {
  UserCog,
  Building2,
  Plus,
  Edit,
  Trash2,
  Search,
  ArrowLeft,
  Camera,
  Upload,
  MoreVertical,
  Power,
  PowerOff,
  LayoutGrid,
  List,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

const EMPTY_PROFESSIONAL = {
  name: "", email: "", phone: "", active: true,
  commission_pct: 0, photo_url: "",
  work_days: ["seg", "ter", "qua", "qui", "sex", "sab"],
  service_ids: [],
  company_ids: [],
};

const WORK_DAYS = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const TABS = [
  { key: "info", label: "Informações" },
  { key: "services", label: "Serviços" },
  { key: "products", label: "Produtos" },
];

export default function Profissionais() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const { companyId, companyIds: hookCompanyIds, isSuperAdmin, ready } = useCurrentUser();
  const userCompanyIds = hookCompanyIds || [];
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [showForm, setShowForm] = useState(false);
  const [selectedProf, setSelectedProf] = useState(null);
  const [editingProf, setEditingProf] = useState(null);
  const [deletingProf, setDeletingProf] = useState(null);
  const [profForm, setProfForm] = useState(EMPTY_PROFESSIONAL);
  const [activeTab, setActiveTab] = useState("services");

  const effectiveCompanyId = companyId;

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => db.entities.User.list(),
    enabled: ready,
  });

  const { data: rawUserCompanies = [] } = useQuery({
    queryKey: ["user_companies_prof"],
    queryFn: async () => {
      const { data } = await supabase.from("user_companies").select("user_id, company_id");
      return data || [];
    },
    enabled: ready,
  });
  const userCompanyMap = {};
  rawUserCompanies.forEach(uc => {
    if (!userCompanyMap[uc.user_id]) userCompanyMap[uc.user_id] = [];
    userCompanyMap[uc.user_id].push(uc.company_id);
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ["services"],
    queryFn: () => db.entities.Service.list(),
    enabled: ready,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies", isSuperAdmin, ...userCompanyIds],
    queryFn: () => db.entities.Company.list(),
    enabled: ready,
    select: (data) => {
      if (isSuperAdmin) return data;
      if (userCompanyIds.length === 0) return [];
      return data.filter(c => userCompanyIds.includes(c.id));
    },
  });

  const { data: allOverrides = [] } = useQuery({
    queryKey: ["company_service_overrides", effectiveCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("company_service_overrides").select("*");
      return data || [];
    },
    enabled: ready && !!effectiveCompanyId,
  });

  const getEffectiveActive = (svc) => {
    if (!svc.company_id && effectiveCompanyId) {
      const override = allOverrides.find(o => o.service_id === svc.id && o.company_id === effectiveCompanyId);
      if (override) return override.active;
    }
    return svc.active !== false;
  };

  const { data: allProServ = [] } = useQuery({
    queryKey: ["professional_services"],
    queryFn: () => db.entities.ProfessionalService.list(),
    enabled: ready,
  });

  const effectiveViewMode = isMobile ? "grid" : viewMode;

  const professionals = allUsers.filter(u => {
    const rawRole = u.role || "";
    const role = rawRole === "teacher" ? "profissional" : rawRole;
    const isProf = role === "profissional" || u.is_professional === true;
    const uIds = userCompanyMap[u.id] || (u.company_ids || (u.company_id ? [u.company_id] : []));
    const matchCompany = isSuperAdmin
      ? (companyFilter === "all" || uIds.includes(companyFilter))
      : (!effectiveCompanyId || uIds.includes(effectiveCompanyId));
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (statusFilter === "active" && u.active !== false) || (statusFilter === "inactive" && u.active === false);
    return isProf && matchCompany && matchSearch && matchStatus;
  });

  const sortedProfessionals = [...professionals].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.full_name || b.email || "").localeCompare(a.full_name || a.email || "", "pt-BR");
    if (sortOrder === "empresa-asc") {
      const aIds = userCompanyMap[a.id] || (a.company_ids || (a.company_id ? [a.company_id] : []));
      const bIds = userCompanyMap[b.id] || (b.company_ids || (b.company_id ? [b.company_id] : []));
      const aName = aIds.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "";
      const bName = bIds.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "";
      return aName.localeCompare(bName, "pt-BR");
    }
    if (sortOrder === "empresa-desc") {
      const aIds = userCompanyMap[a.id] || (a.company_ids || (a.company_id ? [a.company_id] : []));
      const bIds = userCompanyMap[b.id] || (b.company_ids || (b.company_id ? [b.company_id] : []));
      const aName = aIds.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "";
      const bName = bIds.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "";
      return bName.localeCompare(aName, "pt-BR");
    }
    if (sortOrder === "status-asc") return (a.active !== false ? 1 : 0) - (b.active !== false ? 1 : 0);
    if (sortOrder === "status-desc") return (b.active !== false ? 1 : 0) - (a.active !== false ? 1 : 0);
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return 0;
  });

  const services = effectiveCompanyId
    ? allServices.filter(s => (s.company_id === effectiveCompanyId || s.company_id === null) && getEffectiveActive(s))
    : allServices.filter(s => getEffectiveActive(s));

  const proServForProf = (profId) => allProServ.filter(ps => ps.professional_id === profId);

  const proServByType = (profId, type) => {
    const links = allProServ.filter(ps => ps.professional_id === profId);
    if (type === "services") return links.filter(l => allServices.some(s => s.id === l.service_id && s.type === "service"));
    if (type === "products") return links.filter(l => allServices.some(s => s.id === l.service_id && s.type === "product"));
    return links;
  };

  const createProf = useMutation({
    mutationFn: async (data) => {
      const extra = {
        phone: data.phone,
        commission_pct: data.commission_pct || 0,
        photo_url: data.photo_url || "",
        work_days: data.work_days || [],
      };
      if (isSuperAdmin) {
        const ids = data.company_ids || [];
        if (ids.length > 0) {
          extra.company_id = ids[0];
          extra.company_ids = ids;
        }
      } else if (effectiveCompanyId) {
        extra.company_id = effectiveCompanyId;
        extra.company_ids = [effectiveCompanyId];
      }
      const result = await db.users.inviteUser(data.email, "profissional", data.name, extra);
      // Fallback: update fields on the client if server didn't handle them
      if (result?.user_id) {
        try {
          const ids = isSuperAdmin ? (data.company_ids || []) : (effectiveCompanyId ? [effectiveCompanyId] : []);
          await supabase.from("users").update({
            phone: data.phone,
            commission_pct: data.commission_pct || 0,
            photo_url: data.photo_url || "",
            work_days: data.work_days || [],
            must_change_password: true,
            company_id: ids[0] || effectiveCompanyId,
            company_ids: ids.length ? ids : (effectiveCompanyId ? [effectiveCompanyId] : undefined),
          }).eq("id", result.user_id);
          // Para super_admin, garantir user_companies multi
          if (isSuperAdmin && ids.length > 1) {
            await supabase.from("user_companies").delete().eq("user_id", result.user_id);
            const rows = ids.map(company_id => ({ user_id: result.user_id, company_id }));
            await supabase.from("user_companies").insert(rows);
          }
        } catch {
          // RLS might block client-side update, that's OK — server already saved
        }
      }
      return result;
    },
    onSuccess: async (result) => {
      if (result?.user_id && profForm.service_ids?.length > 0) {
        const svcLinks = profForm.service_ids.map(sid => {
          const svc = allServices.find(s => s.id === sid);
          return {
            professional_id: result.user_id,
            service_id: sid,
            company_id: effectiveCompanyId,
            commission_pct: svc?.comissao || 0,
            performs_service: true,
            price_override: svc?.price || 0,
            duration_override: svc?.duration_mins || 30,
          };
        });
        await supabase.from("professional_services").insert(svcLinks);
      }
      queryClient.invalidateQueries(["users"]);
      queryClient.invalidateQueries(["professional_services"]);
      toast.success(`Profissional criado! Senha: ${result?.temp_password || "123456"}`);
      setShowForm(false);
      setProfForm(EMPTY_PROFESSIONAL);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const updateProf = useMutation({
    mutationFn: async ({ id, service_ids, ...data }) => {
      try {
        await db.users.updateUser(id, {
          full_name: data.name,
          phone: data.phone,
          active: data.active,
          commission_pct: data.commission_pct || 0,
          photo_url: data.photo_url || "",
          work_days: data.work_days || [],
        });
      } catch {
        await supabase.from("users").update({
          full_name: data.name,
          phone: data.phone,
          active: data.active,
        }).eq("id", id);
      }
      // Empresa - somente super_admin pode alterar (via CompanyMultiSelect)
      if (isSuperAdmin && data.company_ids !== undefined) {
        const ids = data.company_ids || [];
        // valida: só super_admin pode vincular a qualquer empresa, mas garante que ids existem
        await supabase.from("users").update({ company_id: ids[0] || null }).eq("id", id);
        // sincroniza user_companies (fonte para get_user_company_ids)
        await supabase.from("user_companies").delete().eq("user_id", id);
        if (ids.length > 0) {
          const rows = ids.map(company_id => ({ user_id: id, company_id }));
          const { error: ucErr } = await supabase.from("user_companies").insert(rows);
          if (ucErr) throw ucErr;
        }
      }
      if (service_ids != null) {
        const { data: existing } = await supabase.from("professional_services").select("id, service_id").eq("professional_id", id);
        const existingIds = (existing || []).map(e => e.service_id);
        const toAdd = service_ids.filter(sid => !existingIds.includes(sid));
        const toRemove = (existing || []).filter(e => !service_ids.includes(e.service_id));
        if (toRemove.length > 0) {
          await supabase.from("professional_services").delete().in("id", toRemove.map(e => e.id));
        }
        if (toAdd.length > 0) {
          const inserts = toAdd.map(sid => {
            const svc = allServices.find(s => s.id === sid);
            return {
              professional_id: id,
              service_id: sid,
              company_id: effectiveCompanyId,
              commission_pct: svc?.comissao || 0,
              performs_service: true,
              price_override: svc?.price || 0,
              duration_override: svc?.duration_mins || 30,
            };
          });
          await supabase.from("professional_services").insert(inserts);
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(["users"]); queryClient.invalidateQueries(["professional_services"]); toast.success("Atualizado!"); setShowForm(false); setEditingProf(null); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const deleteProf = useMutation({
    mutationFn: async (id) => {
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiBase || window.location.origin}/api/auth/admin-delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ user_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries(["users"]); queryClient.invalidateQueries(["professional_services"]); toast.success("Removido!"); setDeletingProf(null); setSelectedProf(null); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }) => {
      await db.users.updateUser(id, { active });
    },
    onSuccess: () => { queryClient.invalidateQueries(["users"]); toast.success("Status atualizado!"); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const saveLink = useMutation({
    mutationFn: async ({ professionalId, serviceId, commission, performs_service, price_override, duration_override }) => {
      const existing = allProServ.find(ps => ps.professional_id === professionalId && ps.service_id === serviceId);
      const payload = { commission_pct: commission, performs_service, price_override, duration_override };
      if (existing) {
        const { error } = await supabase.from("professional_services").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professional_services").insert({ professional_id: professionalId, service_id: serviceId, company_id: effectiveCompanyId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries(["professional_services"]),
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const removeLink = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from("professional_services").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries(["professional_services"]); toast.success("Removido!"); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const handleSaveProf = () => {
    if (!profForm.name) return toast.error("Nome é obrigatório");
    if (!editingProf && !profForm.email) return toast.error("E-mail é obrigatório");
    if (editingProf) updateProf.mutate({ id: editingProf.id, ...profForm });
    else createProf.mutate(profForm);
  };

  const handleAddService = (serviceId) => {
    const svc = allServices.find(s => s.id === serviceId);
    saveLink.mutate({
      professionalId: selectedProf.id, serviceId,
      commission: svc?.comissao || 0, performs_service: true,
      price_override: svc?.price || 0, duration_override: svc?.duration_mins || 30,
    });
  };

  const formatDuration = (mins) => `${String(Math.floor((mins || 0) / 60)).padStart(2, "0")}:${String((mins || 0) % 60).padStart(2, "0")}`;
  const parseDuration = (str) => { const [h, m] = str.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

  const selectedProfServices = selectedProf ? proServByType(selectedProf.id, activeTab) : [];
  const linkedIds = selectedProfServices.map(ps => ps.service_id);
  const availableItems = activeTab === "services"
    ? services.filter(s => !linkedIds.includes(s.id))
    : [];

  // --- LIST VIEW ---
  if (!selectedProf) {
    return (
      <div className={cn("max-w-6xl mx-auto p-4 sm:p-6 space-y-6", theme.pageBg)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: theme.cardText }}>Profissionais</h1>
            <p className="text-sm mt-1" style={{ color: theme.mutedText }}>Gerencie profissionais, serviços e comissões</p>
          </div>
          <Button onClick={() => { setEditingProf(null); setProfForm(EMPTY_PROFESSIONAL); setShowForm(true); }} className="bg-branding-primary text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> Novo Profissional
          </Button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar profissional..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-surface-container-low rounded-lg p-1 gap-1">
            {[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  statusFilter === opt.value
                    ? "bg-card text-on-surface shadow-sm"
                    : "text-muted-foreground hover:text-on-surface"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 rounded-lg h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>

          {isSuperAdmin && allCompanies.length > 0 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48 rounded-lg h-9">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {allCompanies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-44 rounded-lg h-9">
              <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nome A → Z</SelectItem>
              <SelectItem value="name-desc">Nome Z → A</SelectItem>
              <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
              <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
              <SelectItem value="status-asc">Inativo → Ativo</SelectItem>
              <SelectItem value="status-desc">Ativo → Inativo</SelectItem>
              <SelectItem value="recent">Mais recentes ↓</SelectItem>
              <SelectItem value="oldest">Mais antigos ↑</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex bg-surface-container-low rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                effectiveViewMode === "list"
                  ? "bg-card text-on-surface shadow-sm"
                  : "text-muted-foreground hover:text-on-surface"
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                effectiveViewMode === "grid"
                  ? "bg-card text-on-surface shadow-sm"
                  : "text-muted-foreground hover:text-on-surface"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingUsers ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : sortedProfessionals.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum profissional encontrado</p>
          </div>
        ) : effectiveViewMode === "list" ? (
          <div className="space-y-3">
            {sortedProfessionals.map(prof => {
              const svcCount = proServByType(prof.id, "services").length;
              const prodCount = proServByType(prof.id, "products").length;
              return (
                <div key={prof.id} onClick={() => { setSelectedProf(prof); setActiveTab("services"); }}
                  className={cn("rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer", prof.active === false ? "opacity-60" : "")}
                  style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {prof.photo_url ? (
                        <img src={prof.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-branding-primary/10 flex items-center justify-center text-branding-primary font-bold text-lg">
                          {(prof.full_name || prof.email || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-on-surface flex items-center gap-1.5">
                          {prof.full_name || "Sem nome"}
                          <span className={cn("w-2 h-2 rounded-full", prof.active !== false ? "bg-emerald-500" : "bg-gray-400")} title={prof.active !== false ? "Ativo" : "Inativo"}></span>
                        </h3>
                        <p className="text-xs text-muted-foreground">{prof.email}</p>
                        {prof.phone && <p className="text-xs text-muted-foreground">{prof.phone} • {prof.commission_pct || 0}% comissão</p>}
                        {(() => {
                          const ids = userCompanyMap[prof.id] || (prof.company_ids || (prof.company_id ? [prof.company_id] : []));
                          const names = ids.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ");
                          return names ? <p className="text-xs text-branding-primary font-medium">{names}</p> : null;
                        })()}
                        {(prof.work_days || []).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(prof.work_days || []).slice(0,4).map(d => (
                              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant text-muted-foreground">{d}</span>
                            ))}
                            {(prof.work_days || []).length > 4 && <span className="text-[10px] text-muted-foreground">+{prof.work_days.length-4}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs font-medium", prof.active !== false ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>
                        {prof.active !== false ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{prof.commission_pct || 0}%</span>
                      {svcCount > 0 && <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30">{svcCount} serviços</Badge>}
                      {prodCount > 0 && <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30">{prodCount} produtos</Badge>}
                      <Switch
                        checked={prof.active !== false}
                        onCheckedChange={(checked) => {
                          toggleActive.mutate({ id: prof.id, active: checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={prof.active !== false ? "Ativo - clique para inativar" : "Inativo - clique para ativar"}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button onClick={e => e.stopPropagation()} className="p-1 rounded-lg hover:bg-surface-container transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingProf(prof); setProfForm({ name: prof.full_name || "", email: prof.email || "", phone: prof.phone || "", active: prof.active !== false, commission_pct: prof.commission_pct || 0, photo_url: prof.photo_url || "", work_days: prof.work_days || ["seg", "ter", "qua", "qui", "sex", "sab"], service_ids: allProServ.filter(ps => ps.professional_id === prof.id && services.some(s => s.id === ps.service_id)).map(ps => ps.service_id), company_ids: userCompanyMap[prof.id] || (prof.company_ids || (prof.company_id ? [prof.company_id] : [])) }); setShowForm(true); }}>
                            <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: prof.id, active: prof.active === false }); }}>
                            {prof.active === false ? <><Power className="w-4 h-4 mr-2" /> Ativar</> : <><PowerOff className="w-4 h-4 mr-2" /> Desativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeletingProf(prof); }} className="text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedProfessionals.map(prof => {
              const svcCount = proServByType(prof.id, "services").length;
              return (
                <div key={prof.id} onClick={() => { setSelectedProf(prof); setActiveTab("services"); }}
                  className={cn("rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer text-center", prof.active === false ? "opacity-60" : "")}
                  style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
                  {prof.photo_url ? (
                    <img src={prof.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-branding-primary/10 flex items-center justify-center text-branding-primary font-bold text-2xl mx-auto mb-3">
                      {(prof.full_name || prof.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <h3 className="font-semibold text-on-surface text-sm truncate flex items-center justify-center gap-1">
                    {prof.full_name || "Sem nome"}
                    <span className={cn("w-2 h-2 rounded-full", prof.active !== false ? "bg-emerald-500" : "bg-gray-400")}></span>
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">{prof.email}</p>
                  {prof.phone && <p className="text-xs text-muted-foreground truncate">{prof.phone} • {prof.commission_pct || 0}%</p>}
                  {(() => {
                    const ids = userCompanyMap[prof.id] || (prof.company_ids || (prof.company_id ? [prof.company_id] : []));
                    const names = ids.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ");
                    return names ? <p className="text-xs text-branding-primary font-medium truncate mt-0.5">{names}</p> : null;
                  })()}
                  {(prof.work_days || []).length > 0 && (
                    <div className="flex gap-1 justify-center flex-wrap mt-1">
                      {(prof.work_days || []).slice(0,4).map(d => (
                        <span key={d} className="text-[10px] px-1 py-0.5 rounded bg-surface-container-low border border-outline-variant text-muted-foreground">{d}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px] font-medium", prof.active !== false ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>
                      {prof.active !== false ? "Ativo" : "Inativo"}
                    </Badge>
                    {svcCount > 0 && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/30">{svcCount} svc</Badge>}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Switch
                      checked={prof.active !== false}
                      onCheckedChange={(checked) => {
                        toggleActive.mutate({ id: prof.id, active: checked });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-muted-foreground">{prof.active !== false ? "Ativo" : "Inativo"}</span>
                  </div>
                  <div className="flex justify-center gap-1 mt-3">
                    <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); setEditingProf(prof); setProfForm({ name: prof.full_name || "", email: prof.email || "", phone: prof.phone || "", active: prof.active !== false, commission_pct: prof.commission_pct || 0, photo_url: prof.photo_url || "", work_days: prof.work_days || ["seg", "ter", "qua", "qui", "sex", "sab"], service_ids: allProServ.filter(ps => ps.professional_id === prof.id && services.some(s => s.id === ps.service_id)).map(ps => ps.service_id), company_ids: userCompanyMap[prof.id] || (prof.company_ids || (prof.company_id ? [prof.company_id] : [])) }); setShowForm(true); }}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: prof.id, active: prof.active === false }); }}>
                      {prof.active === false ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs text-red-400 border-red-500/30"
                      onClick={(e) => { e.stopPropagation(); setDeletingProf(prof); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!deletingProf} onOpenChange={() => setDeletingProf(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle>Excluir profissional?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">"{deletingProf?.full_name}" será removido permanentemente.</p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeletingProf(null)}>Cancelar</Button>
              <Button onClick={() => deleteProf.mutate(deletingProf.id)} className="bg-error text-white hover:bg-error/80">Excluir</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingProf ? "Editar" : "Novo Profissional"}</DialogTitle></DialogHeader>
            <div className="space-y-5">
              {/* Photo */}
              <div className="flex flex-col items-center gap-3">
                <Label className="text-sm font-medium">Foto do Profissional</Label>
                <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden border-2 border-outline-variant">
                  {profForm.photo_url ? (
                    <img src={profForm.photo_url} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-outline" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-xl"
                    onClick={async () => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) return;
                        try {
                          const result = await db.integrations.Core.UploadFile({ file });
                          setProfForm(f => ({ ...f, photo_url: result.file_url }));
                        } catch (err) {
                          toast.error("Erro ao fazer upload: " + (err.message || err));
                        }
                      };
                      input.click();
                    }}>
                    <Upload className="w-4 h-4 mr-1" /> Escolher Foto
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl"
                    onClick={async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                        const video = document.createElement("video");
                        video.srcObject = stream;
                        video.play();
                        await new Promise(r => setTimeout(r, 2000));
                        const canvas = document.createElement("canvas");
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        canvas.getContext("2d").drawImage(video, 0, 0);
                        stream.getTracks().forEach(t => t.stop());
                        canvas.toBlob(async (blob) => {
                          if (!blob) return;
                          const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
                          try {
                            const result = await db.integrations.Core.UploadFile({ file });
                            setProfForm(f => ({ ...f, photo_url: result.file_url }));
                          } catch (err) {
                            toast.error("Erro ao enviar selfie: " + (err.message || err));
                          }
                        }, "image/jpeg", 0.8);
                      } catch {
                        toast.error("Câmera não disponível");
                      }
                    }}>
                    <Camera className="w-4 h-4 mr-1" /> Tirar Selfie
                  </Button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <Label className="text-sm font-medium">Nome Completo <span className="text-red-400">*</span></Label>
                <Input value={profForm.name} onChange={e => setProfForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do profissional" className="mt-1" />
              </div>

              {/* Telefone + Comissão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Telefone</Label>
                  <Input value={profForm.phone} onChange={e => setProfForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Comissão (%)</Label>
                  <Input type="number" min={0} max={100} value={profForm.commission_pct || 0} onChange={e => setProfForm(f => ({ ...f, commission_pct: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label className="text-sm font-medium">E-mail</Label>
                <Input type="email" value={profForm.email} onChange={e => setProfForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" disabled={!!editingProf} className="mt-1" />
              </div>

              {/* Empresa - somente super_admin pode alterar */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Empresa</Label>
                {isSuperAdmin ? (
                  <CompanyMultiSelect companies={allCompanies} selectedIds={profForm.company_ids || []} onChange={(ids)=>setProfForm(f=>({...f, company_ids: ids}))} />
                ) : (
                  <div className="px-3 py-2 rounded-xl border border-outline-variant bg-background text-on-surface text-sm">
                    {allCompanies.find(c=>c.id===effectiveCompanyId)?.name || "Nenhuma empresa"}
                    <p className="text-xs text-muted-foreground mt-1">Somente super admin pode alterar empresa</p>
                  </div>
                )}
              </div>

              {/* Serviços */}
              <div>
                <Label className="text-sm font-medium">Serviços Vinculados</Label>
              {allServices.filter(s => getEffectiveActive(s)).length === 0 ? (
                  <p className="text-xs text-outline mt-1">Nenhum serviço criado ainda. Deseja <a href="/Servicos" className="text-branding-primary underline">criar um</a>?</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Select onValueChange={(v) => {
                      if (v && !(profForm.service_ids || []).includes(v)) {
                        setProfForm(f => ({ ...f, service_ids: [...(f.service_ids || []), v] }));
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Adicionar serviço..." /></SelectTrigger>
                      <SelectContent>
                        {allServices.filter(s => getEffectiveActive(s) && !(profForm.service_ids || []).includes(s.id)).map(svc => (
                          <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                        ))}
                        {allServices.filter(s => getEffectiveActive(s) && !(profForm.service_ids || []).includes(s.id)).length === 0 && (
                          <SelectItem value="__" disabled>Todos já adicionados</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(profForm.service_ids || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(profForm.service_ids || []).map(sid => {
                          const svc = allServices.find(s => s.id === sid);
                          return svc ? (
                            <Badge key={sid} variant="outline" className="text-xs gap-1">
                              {svc.name}
                              <button type="button" onClick={() => setProfForm(f => ({ ...f, service_ids: f.service_ids.filter(id => id !== sid) }))} className="text-outline hover:text-red-400 ml-1">&times;</button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dias de Trabalho */}
              <div>
                <Label className="text-sm font-medium">Dias de Trabalho</Label>
                <div className="grid grid-cols-4 gap-3 mt-2">
                  {WORK_DAYS.map(day => (
                    <label key={day.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={(profForm.work_days || []).includes(day.key)}
                        onCheckedChange={(checked) => {
                          setProfForm(f => ({
                            ...f,
                            work_days: checked
                              ? [...(f.work_days || []), day.key]
                              : (f.work_days || []).filter(d => d !== day.key),
                          }));
                        }}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--border, #e5e7eb)" }}>
                <div>
                  <p className="text-sm font-medium">Profissional Ativo</p>
                  <p className="text-xs text-muted-foreground">Disponível para agendamento</p>
                </div>
                <Switch checked={profForm.active} onCheckedChange={v => setProfForm(f => ({ ...f, active: v }))} />
              </div>

              {!editingProf && <p className="text-sm text-branding-primary">Senha padrão: <strong>123456</strong></p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleSaveProf} className="bg-branding-primary text-white rounded-xl">{editingProf ? "Salvar" : "Criar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  return (
    <div className={cn("max-w-6xl mx-auto p-4 sm:p-6 space-y-6", theme.pageBg)}>
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedProf(null)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          {selectedProf.photo_url ? (
            <img src={selectedProf.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-branding-primary/10 flex items-center justify-center text-branding-primary font-bold">
              {(selectedProf.full_name || "?")[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: theme.cardText }}>{selectedProf.full_name}</h1>
            <p className="text-sm" style={{ color: theme.mutedText }}>{selectedProf.email}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit" style={{ background: theme.isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn("px-5 py-2 rounded-md text-sm font-medium transition-all", activeTab === t.key ? "bg-card text-on-surface shadow-sm" : "text-muted-foreground hover:text-on-surface")}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "info" && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <h2 className="text-lg font-semibold" style={{ color: theme.cardText }}>Dados do Profissional</h2>
          {selectedProf.photo_url && (
            <div className="flex justify-center mb-4">
              <img src={selectedProf.photo_url} alt={selectedProf.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-outline-variant" />
            </div>
          )}
          {(() => {
            const profIds = userCompanyMap[selectedProf.id] || (selectedProf.company_ids || (selectedProf.company_id ? [selectedProf.company_id] : []));
            const profCompanyNames = profIds.map(id => allCompanies.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "-";
            return [["Nome", selectedProf.full_name], ["E-mail", selectedProf.email], ["Telefone", selectedProf.phone || "-"], ["Empresa", profCompanyNames], ["Serviços", allProServ.filter(ps => ps.professional_id === selectedProf.id).map(ps => allServices.find(s => s.id === ps.service_id)?.name).filter(Boolean).join(", ") || "-"], ["Comissão", `${selectedProf.commission_pct || 0}%`], ["Dias", (selectedProf.work_days || []).map(d => WORK_DAYS.find(w => w.key === d)?.label).filter(Boolean).join(", ") || "-"], ["Status", selectedProf.active !== false ? "Ativo" : "Inativo"]].map(([l, v]) => (
            <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className="text-sm font-medium">{v}</p></div>
          ))})()}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => { const profServiceIds = allProServ.filter(ps => ps.professional_id === selectedProf.id && services.some(s => s.id === ps.service_id)).map(ps => ps.service_id); const profCompanyIds = userCompanyMap[selectedProf.id] || (selectedProf.company_ids || (selectedProf.company_id ? [selectedProf.company_id] : [])); setEditingProf(selectedProf); setProfForm({ name: selectedProf.full_name || "", email: selectedProf.email || "", phone: selectedProf.phone || "", active: selectedProf.active !== false, commission_pct: selectedProf.commission_pct || 0, photo_url: selectedProf.photo_url || "", work_days: selectedProf.work_days || ["seg", "ter", "qua", "qui", "sex", "sab"], service_ids: profServiceIds, company_ids: profCompanyIds }); setShowForm(true); }}>
              <Edit className="w-4 h-4 mr-2" /> Editar
            </Button>
            <Button variant="outline" className="text-red-400 border-red-500/30 hover:bg-error-container/20" onClick={() => setDeletingProf(selectedProf)}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </Button>
          </div>
        </div>
      )}

      {(activeTab === "services" || activeTab === "products") && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>{activeTab === "services" ? "Adicionar Serviço" : "Adicionar Produto"}</Label>
              <Select onValueChange={handleAddService}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {availableItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                  {availableItems.length === 0 && <SelectItem value="__" disabled>Nenhum disponível</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProfServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm rounded-xl border" style={{ borderColor: theme.cardBorder }}>
              Nenhum {activeTab === "services" ? "serviço" : "produto"} vinculado.
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: theme.cardBorder }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase" style={{ background: theme.isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", color: theme.mutedText }}>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-center px-4 py-3">{activeTab === "services" ? "Barbeiro faz?" : "Ativo?"}</th>
                    <th className="text-center px-4 py-3">Tipo</th>
                    <th className="text-center px-4 py-3">Valor (R$)</th>
                    <th className="text-center px-4 py-3">Tempo (HH:MM)</th>
                    <th className="text-center px-4 py-3">Comissão (%)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProfServices.map(ps => {
                    const svc = allServices.find(s => s.id === ps.service_id);
                    if (!svc) return null;
                    return (
                      <tr key={ps.id} className="border-t" style={{ borderColor: theme.cardBorder }}>
                        <td className="px-4 py-3 font-medium" style={{ color: theme.cardText }}>{svc.name}</td>
                        <td className="px-4 py-3 text-center">
                          <Checkbox
                            checked={ps.performs_service !== false}
                            onCheckedChange={v => saveLink.mutate({ professionalId: selectedProf.id, serviceId: ps.service_id, commission: ps.commission_pct || 0, performs_service: v, price_override: ps.price_override, duration_override: ps.duration_override })}
                          />
                        </td>
                        <td className="px-4 py-3 text-center"><Badge variant="outline" className="text-xs">{svc.service_type || "Normal"}</Badge></td>
                        <td className="px-4 py-3 text-center">
                          <Input type="number" min={0} step={0.5} value={ps.price_override ?? svc.price ?? 0}
                            onChange={e => saveLink.mutate({ professionalId: selectedProf.id, serviceId: ps.service_id, commission: ps.commission_pct || 0, performs_service: ps.performs_service, price_override: parseFloat(e.target.value) || 0, duration_override: ps.duration_override })}
                            className="h-8 w-20 text-xs text-center mx-auto" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input type="text" value={formatDuration(ps.duration_override ?? svc.duration_mins)}
                            onChange={e => { const val = e.target.value; if (/^\d{0,2}:?\d{0,2}$/.test(val)) saveLink.mutate({ professionalId: selectedProf.id, serviceId: ps.service_id, commission: ps.commission_pct || 0, performs_service: ps.performs_service, price_override: ps.price_override, duration_override: parseDuration(val) }); }}
                            className="h-8 w-20 text-xs text-center mx-auto" placeholder="00:00" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Input type="number" min={0} max={100} step={0.5} value={ps.commission_pct || 0}
                              onChange={e => saveLink.mutate({ professionalId: selectedProf.id, serviceId: ps.service_id, commission: parseFloat(e.target.value) || 0, performs_service: ps.performs_service, price_override: ps.price_override, duration_override: ps.duration_override })}
                              className="h-8 w-16 text-xs text-center" />
                            <span className="text-xs text-outline">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeLink.mutate(ps.id)} className="p-1 rounded hover:bg-error-container/20 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Profissional</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Photo */}
            <div className="flex flex-col items-center gap-3">
              <Label className="text-sm font-medium">Foto do Profissional</Label>
              <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden border-2 border-outline-variant">
                {profForm.photo_url ? (
                  <img src={profForm.photo_url} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-outline" />
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-xl"
                  onClick={async () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        const result = await db.integrations.Core.UploadFile({ file });
                        setProfForm(f => ({ ...f, photo_url: result.file_url }));
                      } catch (err) {
                        toast.error("Erro ao fazer upload: " + (err.message || err));
                      }
                    };
                    input.click();
                  }}>
                  <Upload className="w-4 h-4 mr-1" /> Escolher Foto
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-xl"
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                      const video = document.createElement("video");
                      video.srcObject = stream;
                      video.play();
                      await new Promise(r => setTimeout(r, 2000));
                      const canvas = document.createElement("canvas");
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      canvas.getContext("2d").drawImage(video, 0, 0);
                      stream.getTracks().forEach(t => t.stop());
                      canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
                        try {
                          const result = await db.integrations.Core.UploadFile({ file });
                          setProfForm(f => ({ ...f, photo_url: result.file_url }));
                        } catch (err) {
                          toast.error("Erro ao enviar selfie: " + (err.message || err));
                        }
                      }, "image/jpeg", 0.8);
                    } catch {
                      toast.error("Câmera não disponível");
                    }
                  }}>
                  <Camera className="w-4 h-4 mr-1" /> Tirar Selfie
                </Button>
              </div>
            </div>

            {/* Nome */}
            <div>
              <Label className="text-sm font-medium">Nome Completo <span className="text-red-400">*</span></Label>
              <Input value={profForm.name} onChange={e => setProfForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do profissional" className="mt-1" />
            </div>

            {/* Telefone + Comissão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Telefone</Label>
                <Input value={profForm.phone} onChange={e => setProfForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Comissão (%)</Label>
                <Input type="number" min={0} max={100} value={profForm.commission_pct || 0} onChange={e => setProfForm(f => ({ ...f, commission_pct: parseFloat(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label className="text-sm font-medium">E-mail</Label>
              <Input type="email" value={profForm.email} disabled className="mt-1" />
            </div>

            {/* Empresa - somente super_admin pode alterar */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Empresa</Label>
              {isSuperAdmin ? (
                <CompanyMultiSelect companies={allCompanies} selectedIds={profForm.company_ids || []} onChange={(ids)=>setProfForm(f=>({...f, company_ids: ids}))} />
              ) : (
                <div className="px-3 py-2 rounded-xl border border-outline-variant bg-background text-on-surface text-sm">
                  {allCompanies.find(c=>c.id===effectiveCompanyId)?.name || "Nenhuma empresa"}
                  <p className="text-xs text-muted-foreground mt-1">Somente super admin pode alterar empresa</p>
                </div>
              )}
            </div>

            {/* Serviços */}
            <div>
              <Label className="text-sm font-medium">Serviços Vinculados</Label>
              {allServices.filter(s => getEffectiveActive(s)).length === 0 ? (
                <p className="text-xs text-outline mt-1">Nenhum serviço criado ainda. Deseja <a href="/Servicos" className="text-branding-primary underline">criar um</a>?</p>
              ) : (
                <div className="space-y-2 mt-2">
                  <Select onValueChange={(v) => {
                    if (v && !(profForm.service_ids || []).includes(v)) {
                      setProfForm(f => ({ ...f, service_ids: [...(f.service_ids || []), v] }));
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Adicionar serviço..." /></SelectTrigger>
                    <SelectContent>
                      {allServices.filter(s => getEffectiveActive(s) && !(profForm.service_ids || []).includes(s.id)).map(svc => (
                        <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                      ))}
                      {allServices.filter(s => getEffectiveActive(s) && !(profForm.service_ids || []).includes(s.id)).length === 0 && (
                        <SelectItem value="__" disabled>Todos já adicionados</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {(profForm.service_ids || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(profForm.service_ids || []).map(sid => {
                        const svc = allServices.find(s => s.id === sid);
                        return svc ? (
                          <Badge key={sid} variant="outline" className="text-xs gap-1">
                            {svc.name}
                            <button type="button" onClick={() => setProfForm(f => ({ ...f, service_ids: f.service_ids.filter(id => id !== sid) }))} className="text-outline hover:text-red-400 ml-1">&times;</button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dias de Trabalho */}
            <div>
              <Label className="text-sm font-medium">Dias de Trabalho</Label>
              <div className="grid grid-cols-4 gap-3 mt-2">
                {WORK_DAYS.map(day => (
                  <label key={day.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={(profForm.work_days || []).includes(day.key)}
                      onCheckedChange={(checked) => {
                        setProfForm(f => ({
                          ...f,
                          work_days: checked
                            ? [...(f.work_days || []), day.key]
                            : (f.work_days || []).filter(d => d !== day.key),
                        }));
                      }}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--border, #e5e7eb)" }}>
              <div>
                <p className="text-sm font-medium">Profissional Ativo</p>
                <p className="text-xs text-muted-foreground">Disponível para agendamento</p>
              </div>
              <Switch checked={profForm.active} onCheckedChange={v => setProfForm(f => ({ ...f, active: v }))} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleSaveProf} className="bg-branding-primary text-white rounded-xl">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingProf} onOpenChange={() => setDeletingProf(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Excluir profissional?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">"{deletingProf?.full_name}" será removido permanentemente.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeletingProf(null)}>Cancelar</Button>
            <Button onClick={() => deleteProf.mutate(deletingProf.id)} className="bg-error text-white hover:bg-error/80">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
