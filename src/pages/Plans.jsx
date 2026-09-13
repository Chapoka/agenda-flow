import { useState } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  MoreVertical,
  Building2,
  Globe,
  Scissors,
  User,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const modalityLabels = { corte: "Corte", barba: "Barba" };
const getModalityLabel = (m) => modalityLabels[m] || m || "-";
const modalityColors = {
  corte: "bg-branding-primary/10 text-branding-primary border-branding-primary/20",
  barba: "bg-branding-secondary/10 text-branding-secondary border-branding-secondary/20",
};
const getModalityColor = (m) => modalityColors[m] || "bg-purple-500/20 text-purple-300 border-purple-500/30";

const EMPTY_FORM = {
  name: "",
  modality: "corte",
  product_type: "",
  combo_type: "",
  duration_mins: 60,
  price: 0,
  total_value: 0,
  discount: 0,
  session_count: 4,
  commission: 0,
  professional: "",
  description: "",
  company_id: "",
  selected_service_ids: [],
};

// Usuário pode gerenciar planos se for admin ou se tiver company_id (empresa)
const canManagePlans = (isAdmin, companyId) => isAdmin || !!companyId;

export default function Plans() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const { currentUser, companyId, isSuperAdmin, isAdmin, isProfissional, ready } = useCurrentUser();

  const [viewMode, setViewMode] = useState("grid");
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [filterCompany, setFilterCompany] = useState("all");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [planItems, setPlanItems] = useState([]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => db.entities.Plan.list(),
    enabled: ready,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.filter({ active: true }),
    enabled: ready && isAdmin,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", companyId, isProfissional],
    queryFn: () => companyId && !isSuperAdmin
      ? db.entities.Customer.filter({ company_id: companyId })
      : db.entities.Customer.list(),
    enabled: ready,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: () => db.entities.Service.list("-created_at"),
    enabled: ready,
  });

  const { data: planServices = [] } = useQuery({
    queryKey: ["plan_services"],
    queryFn: () => db.entities.PlanService.list(),
    enabled: ready,
  });

  const { data: allPlanItems = [] } = useQuery({
    queryKey: ["plan_items"],
    queryFn: () => db.entities.PlanItem.list(),
    enabled: ready,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => db.entities.User.list(),
    enabled: ready,
  });

  const professionals = users.filter(u => u.role === "profissional" && u.active !== false);

  const visiblePlans = (() => {
    if (isAdmin) {
      if (filterCompany === "all") return plans;
      if (filterCompany === "global") return plans.filter(p => !p.company_id);
      return plans.filter(p => p.company_id === filterCompany);
    }
    return plans.filter(p => !p.company_id || p.company_id === companyId);
  })();

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.Plan.create({ ...data, active: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans"] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Plan.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans"] }); resetForm(); toast.success("Plano atualizado!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Plan.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans"] }); queryClient.invalidateQueries({ queryKey: ["plan_services"] }); setDeletingPlan(null); toast.success("Plano removido!"); },
  });

  const togglePlanMutation = useMutation({
    mutationFn: ({ id, active }) => db.entities.Plan.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  const savePlanServices = useMutation({
    mutationFn: async ({ planId, serviceIds }) => {
      const existing = planServices.filter(ps => ps.plan_id === planId);
      const existingServiceIds = existing.map(ps => ps.service_id);
      const toAdd = serviceIds.filter(id => !existingServiceIds.includes(id));
      const toRemove = existing.filter(ps => !serviceIds.includes(ps.service_id));
      for (const ps of toRemove) {
        await db.entities.PlanService.delete(ps.id);
      }
      for (const serviceId of toAdd) {
        await db.entities.PlanService.create({ plan_id: planId, service_id: serviceId, quantity: 1 });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan_services"] }),
  });

  const canManage = canManagePlans(isAdmin, companyId);

  const resetForm = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData(EMPTY_FORM);
    setPlanItems([]);
  };

  const handleOpenCreate = () => {
    // Para empresa (não admin), pré-preenche company_id automaticamente
    setFormData({ ...EMPTY_FORM, company_id: isAdmin ? "" : (companyId || "") });
    setShowModal(true);
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    const linkedServiceIds = planServices.filter(ps => ps.plan_id === plan.id).map(ps => ps.service_id);
    const items = allPlanItems.filter(pi => pi.plan_id === plan.id).map(pi => ({
      id: pi.id,
      name: pi.name || "",
      item_type: pi.item_type || "service",
      ref_id: pi.ref_id || null,
      price: pi.price || 0,
      discount: pi.discount || 0,
      discount_type: pi.discount_type || "fixed",
      commission: pi.commission || 0,
      commission_type: pi.commission_type || "percent",
      quantity: pi.quantity || 1,
      manufacturer: pi.manufacturer || "",
    }));
    setPlanItems(items);
    setFormData({
      name: plan.name || "",
      modality: plan.modality || "",
      product_type: plan.product_type || "",
      combo_type: plan.combo_type || "",
      duration_mins: plan.duration_mins || 60,
      price: plan.price || 0,
      session_count: plan.session_count || 4,
      discount: plan.discount || 0,
      commission: plan.commission || 0,
      professional: plan.professional || "",
      description: plan.description || "",
      company_id: plan.company_id || "",
      selected_service_ids: linkedServiceIds,
    });
    setShowModal(true);
  };

  const savePlanItems = useMutation({
    mutationFn: async ({ planId, items }) => {
      const existing = allPlanItems.filter(pi => pi.plan_id === planId);
      const existingIds = existing.map(pi => pi.id);
      const toDelete = existing.filter(pi => !items.some(i => i.id === pi.id));
      for (const pi of toDelete) {
        await db.entities.PlanItem.delete(pi.id);
      }
      for (const item of items) {
        const itemData = {
          plan_id: planId,
          name: item.name,
          item_type: item.item_type,
          ref_id: item.ref_id || null,
          price: parseFloat(item.price) || 0,
          discount: parseFloat(item.discount) || 0,
          discount_type: item.discount_type || "fixed",
          commission: parseFloat(item.commission) || 0,
          commission_type: item.commission_type || "percent",
          quantity: parseInt(item.quantity) || 1,
          manufacturer: item.manufacturer || null,
        };
        if (item.id && existingIds.includes(item.id)) {
          await db.entities.PlanItem.update(item.id, itemData);
        } else {
          await db.entities.PlanItem.create(itemData);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan_items"] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const effectiveCompanyId = isAdmin ? (formData.company_id || null) : (companyId || null);
    const { selected_service_ids, total_value, ...planData } = formData;
    
    // Auto-calculate price from plan items if items exist
    let finalPrice = parseFloat(planData.price) || 0;
    if (planItems.length > 0) {
      const totalPlan = planItems.reduce((sum, item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const disc = item.discount_type === "percent"
          ? itemTotal * ((item.discount || 0) / 100)
          : (item.discount || 0);
        return sum + itemTotal - disc;
      }, 0);
      const visits = parseInt(planData.session_count) || 1;
      finalPrice = totalPlan / visits;
    }
    
    const data = {
      ...planData,
      price: finalPrice,
      company_id: effectiveCompanyId,
      product_type: planData.product_type || null,
      combo_type: planData.combo_type || null,
      commission: parseFloat(planData.commission) || 0,
      discount: parseFloat(planData.discount) || 0,
      professional: planData.professional || null,
      description: planData.description || null,
    };
    const saveAll = (planId) => {
      const tasks = [];
      tasks.push(savePlanServices.mutateAsync({ planId, serviceIds: selected_service_ids }));
      if (planItems.length > 0) {
        tasks.push(savePlanItems.mutateAsync({ planId, items: planItems }));
      }
      Promise.all(tasks)
        .then(() => { resetForm(); toast.success(editingPlan ? "Plano atualizado!" : "Plano criado!"); })
        .catch((err) => { toast.error("Erro ao salvar itens do plano: " + err.message); });
    };
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data }, { onSuccess: () => saveAll(editingPlan.id) });
    } else {
      createMutation.mutate(data, { onSuccess: (newPlan) => { if (newPlan?.id) saveAll(newPlan.id); } });
    }
  };

  // Empresa só pode editar/excluir planos da própria empresa (nunca planos globais)
  const canEditPlan = (plan) => isAdmin || (!!plan.company_id && plan.company_id === companyId);
  const canDeletePlan = (plan) => isAdmin || (!!plan.company_id && plan.company_id === companyId);

  const getCompanyName = (cid) => companies.find(c => c.id === cid)?.name || "—";

  const sortedPlans = [...visiblePlans].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.name || "").localeCompare(a.name || "", "pt-BR");
    if (sortOrder === "tipo-asc") return (a.modality || "").localeCompare(b.modality || "", "pt-BR");
    if (sortOrder === "tipo-desc") return (b.modality || "").localeCompare(a.modality || "", "pt-BR");
    if (sortOrder === "empresa-asc") return (a.company_id ? getCompanyName(a.company_id) : "Global").localeCompare(b.company_id ? getCompanyName(b.company_id) : "Global", "pt-BR");
    if (sortOrder === "empresa-desc") return (b.company_id ? getCompanyName(b.company_id) : "Global").localeCompare(a.company_id ? getCompanyName(a.company_id) : "Global", "pt-BR");
    if (sortOrder === "profissional-asc") return (a.professional || "").localeCompare(b.professional || "", "pt-BR");
    if (sortOrder === "profissional-desc") return (b.professional || "").localeCompare(a.professional || "", "pt-BR");
    if (sortOrder === "visitas-asc") return (a.session_count || 0) - (b.session_count || 0);
    if (sortOrder === "visitas-desc") return (b.session_count || 0) - (a.session_count || 0);
    if (sortOrder === "price-desc") return (b.price || 0) - (a.price || 0);
    if (sortOrder === "price-asc") return (a.price || 0) - (b.price || 0);
    if (sortOrder === "total-asc") return ((a.price || 0)*(a.session_count||0)-(a.discount||0)) - ((b.price || 0)*(b.session_count||0)-(b.discount||0));
    if (sortOrder === "total-desc") return ((b.price || 0)*(b.session_count||0)-(b.discount||0)) - ((a.price || 0)*(a.session_count||0)-(a.discount||0));
    if (sortOrder === "ativo-asc") return (a.active !== false ? 1 : 0) - (b.active !== false ? 1 : 0);
    if (sortOrder === "ativo-desc") return (b.active !== false ? 1 : 0) - (a.active !== false ? 1 : 0);
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return 0;
  });

  const planCompanyLabel = (plan) => {
    if (!plan.company_id) return { label: "Global (Admin)", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
    return { label: getCompanyName(plan.company_id), color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  };

  return (
    <div className={cn("min-h-screen", theme.pageBg)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
<h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" style={{ color: theme.cardText }}>
              <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                <Package className="w-6 h-6 text-white" />
              </div>
              Planos
            </h1>
            <p className="mt-1" style={{ color: theme.mutedText }}>Gerencie os planos de serviços</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="rounded-xl w-48 bg-card">
                  <SelectValue placeholder="Filtrar empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  <SelectItem value="global">Global (Admin)</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="rounded-xl w-44 bg-card">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nome A → Z</SelectItem>
                <SelectItem value="name-desc">Nome Z → A</SelectItem>
                <SelectItem value="tipo-asc">Tipo A → Z</SelectItem>
                <SelectItem value="tipo-desc">Tipo Z → A</SelectItem>
                <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
                <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
                <SelectItem value="profissional-asc">Profissional A → Z</SelectItem>
                <SelectItem value="profissional-desc">Profissional Z → A</SelectItem>
                <SelectItem value="visitas-asc">Visitas ↑</SelectItem>
                <SelectItem value="visitas-desc">Visitas ↓</SelectItem>
                <SelectItem value="price-asc">Preço ↑</SelectItem>
                <SelectItem value="price-desc">Preço ↓</SelectItem>
                <SelectItem value="total-asc">Total ↑</SelectItem>
                <SelectItem value="total-desc">Total ↓</SelectItem>
                <SelectItem value="ativo-asc">Inativo → Ativo</SelectItem>
                <SelectItem value="ativo-desc">Ativo → Inativo</SelectItem>
                <SelectItem value="recent">Mais recentes ↓</SelectItem>
                <SelectItem value="oldest">Mais antigos ↑</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border border-outline-variant rounded-xl overflow-hidden">
              <button onClick={() => setViewMode("grid")} className={cn("px-3 py-2 transition-colors", viewMode === "grid" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <Package className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("px-3 py-2 transition-colors", viewMode === "list" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <DollarSign className="w-4 h-4" />
              </button>
            </div>

            {canManage && (
<Button
                onClick={handleOpenCreate}
                className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Plano
              </Button>
            )}
          </div>
        </div>

        {/* Custom Plans */}
        {customers.filter(s => s.custom_plan).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-on-surface mb-4">Planos Personalizados</h2>
            {viewMode === "list" ? (
              <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="bg-background border-b border-outline-variant/30">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell">Tipo de Serviço</th>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant">Serviços / Duração</th>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell">Frequência</th>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant">Preço/serviço</th>
                      <th className="text-left px-4 py-3 font-medium text-on-surface-variant">Total Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {customers.filter(s => s.custom_plan).map(customer => {
                      const cp = customer.custom_plan;
                      const totalValue = (cp.price_per_service || 0) * (cp.total_services || 0);
                      const frequencyText = cp.frequency_type === "weekly" ? "p/ semana" : cp.frequency_type === "daily" ? "p/ dia" : "p/ mês";
                      return (
<tr key={customer.id} className="hover:bg-surface-container-low">
                            <td className="px-4 py-3 font-medium text-on-surface">{customer.name}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge className={cn("border", getModalityColor(cp.modality))}>{getModalityLabel(cp.modality)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{cp.total_services} serviços / {cp.duration_mins}min</td>
                          <td className="px-4 py-3 text-on-surface-variant hidden sm:table-cell">{cp.frequency_count}x {frequencyText}</td>
                          <td className="px-4 py-3 font-semibold text-on-surface">R$ {cp.price_per_service?.toFixed(2)}</td>
                          <td className="px-4 py-3 font-bold text-on-surface">R$ {totalValue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customers.filter(s => s.custom_plan).map(customer => {
                  const cp = customer.custom_plan;
                  const totalValue = (cp.price_per_service || 0) * (cp.total_services || 0);
                  const frequencyText = cp.frequency_type === "weekly" ? "por semana" : cp.frequency_type === "daily" ? "por dia" : "por mês";
                  return (
                    <div key={customer.id} className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden hover:shadow-md transition-all">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-on-surface">{customer.name}</h3>
                            <Badge className={cn("mt-2 border", getModalityColor(cp.modality))}>{getModalityLabel(cp.modality)}</Badge>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <div className="flex items-center gap-2 text-on-surface-variant"><Clock className="w-4 h-4 text-branding-primary" />Duração</div>
                            <span className="font-semibold text-on-surface">{cp.duration_mins} min</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <div className="flex items-center gap-2 text-on-surface-variant"><Package className="w-4 h-4 text-branding-secondary" />Serviços</div>
                            <span className="font-semibold text-on-surface">{cp.total_services} serviços</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm">Frequência</span>
                            <span className="font-semibold text-on-surface text-sm">{cp.frequency_count}x {frequencyText}</span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-on-surface-variant text-sm">Valor por serviço</span>
                            <span className="font-semibold text-on-surface">R$ {cp.price_per_service?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-branding-primary/5 to-branding-secondary/5 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-branding-primary" /><span className="text-on-surface-variant">Total Estimado</span></div>
                        <span className="text-2xl font-bold text-on-surface">R$ {totalValue.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Standard Plans */}
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-4">Planos Padrão</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl p-6 animate-pulse h-48" />)}
            </div>
          ) : sortedPlans.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-12 text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-on-surface mb-2">Nenhum plano encontrado</h3>
              <p className="text-muted-foreground mb-6">
                {isAdmin ? "Crie um plano e vincule a uma empresa ou deixe global." : "Nenhum plano disponível para sua empresa."}
              </p>
              {canManage && (
                <Button onClick={handleOpenCreate} className="btn-branding rounded-xl">
                  <Plus className="w-5 h-5 mr-2" />Criar Plano
                </Button>
              )}
            </div>
          ) : viewMode === "list" ? (
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-background border-b border-outline-variant/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Nome {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "tipo-asc" ? "tipo-desc" : "tipo-asc")}><span className="inline-flex items-center gap-1">Tipo {sortOrder === "tipo-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "tipo-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    {isAdmin && <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "empresa-asc" ? "empresa-desc" : "empresa-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "empresa-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "empresa-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>}
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "profissional-asc" ? "profissional-desc" : "profissional-asc")}><span className="inline-flex items-center gap-1">Profissional {sortOrder === "profissional-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "profissional-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "visitas-asc" ? "visitas-desc" : "visitas-asc")}><span className="inline-flex items-center gap-1">Visitas {sortOrder === "visitas-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "visitas-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none hidden sm:table-cell" onClick={() => setSortOrder(prev => prev === "price-desc" ? "price-asc" : "price-desc")}><span className="inline-flex items-center gap-1">Preço/visita {sortOrder === "price-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "price-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "total-asc" ? "total-desc" : "total-asc")}><span className="inline-flex items-center gap-1">Total {sortOrder === "total-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "total-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "ativo-asc" ? "ativo-desc" : "ativo-asc")}><span className="inline-flex items-center gap-1">Ativo {sortOrder === "ativo-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "ativo-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    {canManage && <th className="text-right px-4 py-3 font-medium text-on-surface-variant">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {sortedPlans.map(plan => {
                    const { label, color } = planCompanyLabel(plan);
                    const linkedServices = planServices
                      .filter(ps => ps.plan_id === plan.id)
                      .map(ps => services.find(s => s.id === ps.service_id))
                      .filter(Boolean);
                    return (
                      <tr key={plan.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-3 font-medium text-on-surface">{plan.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge className={cn("border", getModalityColor(plan.modality))}>{getModalityLabel(plan.modality)}</Badge>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 hidden md:table-cell">
                            <Badge className={cn("border text-xs", color)}>{label}</Badge>
                          </td>
                        )}
                        <td className="px-4 py-3 text-on-surface-variant hidden lg:table-cell">{plan.professional || "—"}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{plan.session_count} / {plan.duration_mins}min</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">R$ {plan.price?.toFixed(2)}</td>
                        <td className="px-4 py-3 font-bold text-on-surface">R$ {((plan.price || 0) * (plan.session_count || 0) - (plan.discount || 0)).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {canEditPlan(plan)
                            ? <Switch checked={plan.active !== false} onCheckedChange={(checked) => togglePlanMutation.mutate({ id: plan.id, active: checked })} />
                            : <Badge variant={plan.active !== false ? "default" : "secondary"}>{plan.active !== false ? "Ativo" : "Inativo"}</Badge>
                          }
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {canEditPlan(plan) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(plan)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                  {canDeletePlan(plan) && <DropdownMenuItem onClick={() => setDeletingPlan(plan)} className="text-red-400"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPlans.map(plan => {
                const customersWithPlan = customers.filter(s => s.plan_id === plan.id);
                const { label, color } = planCompanyLabel(plan);
                return (
                  <div key={plan.id} className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden hover:shadow-md transition-all">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-on-surface">{plan.name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge className={cn("border", getModalityColor(plan.modality))}>{getModalityLabel(plan.modality)}</Badge>
                            {isAdmin && (
                              <Badge className={cn("border text-xs", color)}>
                                {plan.company_id ? <Building2 className="w-3 h-3 mr-1 inline" /> : <Globe className="w-3 h-3 mr-1 inline" />}
                                {label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {canEditPlan(plan) && (
                          <div className="flex items-center gap-1">
                            <Switch checked={plan.active !== false} onCheckedChange={(checked) => togglePlanMutation.mutate({ id: plan.id, active: checked })} />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(plan)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                {canDeletePlan(plan) && <DropdownMenuItem onClick={() => setDeletingPlan(plan)} className="text-red-400"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                          <div className="flex items-center gap-2 text-on-surface-variant"><Clock className="w-4 h-4 text-branding-primary" />Duração</div>
                          <span className="font-semibold text-on-surface">{plan.duration_mins} min</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                          <div className="flex items-center gap-2 text-on-surface-variant"><Package className="w-4 h-4 text-branding-secondary" />Visitas</div>
                          <span className="font-semibold text-on-surface">{plan.session_count} visitas</span>
                        </div>
                        {plan.product_type && (
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm">Produto</span>
                            <span className="font-medium text-on-surface text-sm">{plan.product_type}</span>
                          </div>
                        )}
                        {plan.combo_type && (
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm">Combo</span>
                            <span className="font-medium text-on-surface text-sm">{plan.combo_type}</span>
                          </div>
                        )}
                        {plan.professional && (
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm">Profissional</span>
                            <span className="font-medium text-on-surface text-sm">{plan.professional}</span>
                          </div>
                        )}
                        {plan.commission > 0 && (
                          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm">Comissão</span>
                            <span className="font-medium text-on-surface text-sm">{plan.commission}%</span>
                          </div>
                        )}
                        {plan.description && (
                          <div className="py-2 border-b border-outline-variant/30">
                            <span className="text-on-surface-variant text-sm block mb-1">Descrição</span>
                            <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                          </div>
                        )}
                        {(() => {
                          const linkedServices = planServices
                            .filter(ps => ps.plan_id === plan.id)
                            .map(ps => services.find(s => s.id === ps.service_id))
                            .filter(Boolean);
                          if (linkedServices.length === 0) return null;
                          return (
                            <div className="py-2 border-b border-outline-variant/30">
                              <div className="flex items-center gap-2 text-on-surface-variant mb-2"><Scissors className="w-4 h-4 text-branding-primary" />Serviços inclusos</div>
                              <div className="flex flex-wrap gap-1">
                                {linkedServices.map(svc => (
                                  <span key={svc.id} className="text-xs bg-branding-primary/10 text-branding-primary px-2 py-1 rounded-full border border-branding-primary/20">{svc.name}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {(() => {
                          const items = allPlanItems.filter(pi => pi.plan_id === plan.id);
                          if (items.length === 0) return null;
                          const typeLabels = { service: "Serviço", product: "Produto", combo: "Combo" };
                          return (
                            <div className="py-2">
                              <div className="flex items-center gap-2 text-on-surface-variant mb-2"><FileText className="w-4 h-4 text-branding-primary" />Itens do plano</div>
                              <div className="space-y-1">
                                {items.map(item => (
                                  <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/30 last:border-0">
                                    <div className="flex items-center gap-1.5">
                                      <Badge className="text-[10px] px-1.5 py-0">{typeLabels[item.item_type] || item.item_type}</Badge>
                                      <span className="text-on-surface truncate max-w-[120px]">{item.name}</span>
                                      {item.manufacturer && <span className="text-[10px] text-outline truncate max-w-[80px]">· {item.manufacturer}</span>}
                                      {item.quantity > 1 && <span className="text-outline">x{item.quantity}</span>}
                                    </div>
                                    <span className="font-medium text-on-surface">R$ {(() => {
                                      const itemTotal = (item.price || 0) * (item.quantity || 1);
                                      const disc = item.discount_type === "percent"
                                        ? itemTotal * ((item.discount || 0) / 100)
                                        : (item.discount || 0);
                                      return (itemTotal - disc).toFixed(2);
                                    })()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-branding-primary/5 to-branding-secondary/5 px-6 py-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-branding-primary" /><span className="text-on-surface-variant text-sm">Por visita</span></div>
                        <span className="text-xl font-bold text-on-surface">R$ {plan.price?.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Total ({plan.session_count} visitas)</span>
                        <span className="text-sm font-semibold text-on-surface-variant">R$ {((plan.price || 0) * (plan.session_count || 0) - (plan.discount || 0)).toFixed(2)}</span>
                      </div>
                      {plan.discount > 0 && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-green-400">Desconto</span>
                          <span className="text-xs font-medium text-green-400">- R$ {plan.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {plan.professional && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-outline-variant">
                          <User className="w-3 h-3 text-outline" />
                          <span className="text-xs text-muted-foreground">{plan.professional}</span>
                        </div>
                      )}
                      {customersWithPlan.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-outline-variant space-y-2">
                          <p className="text-xs text-muted-foreground">Clientes neste plano:</p>
                          <div className="flex flex-wrap gap-1">
                            {customersWithPlan.slice(0, 3).map(s => (
                              <span key={s.id} className="text-xs bg-surface-container-low px-2 py-1 rounded-full text-on-surface">{s.name}</span>
                            ))}
                            {customersWithPlan.length > 3 && (
                              <span className="text-xs bg-surface-container-low px-2 py-1 rounded-full text-on-surface">+{customersWithPlan.length - 3}</span>
                            )}
                          </div>
                          {isAdmin && (() => {
                            const companiesInPlan = [...new Set(customersWithPlan.filter(s => s.company_id).map(s => s.company_id))];
                            return companiesInPlan.length > 0 ? (
                              <div>
                                <p className="text-xs text-muted-foreground">Empresas:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {companiesInPlan.map(cid => (
                                    <span key={cid} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full border border-amber-500/30">{getCompanyName(cid)}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={() => resetForm()}>
          <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {/* 1. Nome */}
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Corte Mensal" className="rounded-xl" required />
              </div>

              {/* 2. Empresa */}
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={formData.company_id || "global"} onValueChange={(v) => setFormData((prev) => ({ ...prev, company_id: v === "global" ? "" : v }))}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">🌐 Global (visível para todas as empresas)</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>🏢 {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Global = disponível para todos. Empresa específica = visível apenas para ele.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-300 font-medium">Plano exclusivo da sua empresa</span>
                </div>
              )}

              {/* 3. Itens do Plano (estilo nota fiscal) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Itens do Plano</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanItems(prev => [...prev, { id: null, name: "", item_type: "service", ref_id: null, price: 0, discount: 0, discount_type: "fixed", commission: 0, commission_type: "percent", quantity: 1, manufacturer: "" }])}
                    className="rounded-lg text-xs h-8 border-dashed border-branding-primary/40 text-branding-primary hover:bg-branding-primary/5 hover:border-branding-primary/60"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
                  </Button>
                </div>

                {planItems.length > 0 ? (
                  <div className="space-y-3">
                    {planItems.map((item, idx) => {
                      const filteredItems = item.item_type === "service"
                        ? services.filter(s => s.active !== false)
                        : item.item_type === "combo"
                          ? services.filter(s => s.active !== false && s.is_combo)
                          : services.filter(s => s.active !== false);
                      const itemTotal = ((item.price || 0) * (item.quantity || 1));
                      const discountValue = item.discount_type === "percent"
                        ? itemTotal * ((item.discount || 0) / 100)
                        : (item.discount || 0);
                      const finalTotal = itemTotal - discountValue;
                      return (
                        <div key={idx} className="bg-card border border-outline-variant rounded-xl p-4 hover:border-branding-primary/30 transition-colors space-y-3">
                          <div className="flex items-center gap-2">
                            <Select
                              value={item.item_type}
                              onValueChange={(v) => {
                                const newItems = [...planItems];
                                newItems[idx] = { ...newItems[idx], item_type: v, name: "", ref_id: null, price: 0 };
                                setPlanItems(newItems);
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg w-28 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="service">Serviço</SelectItem>
                                <SelectItem value="product">Produto</SelectItem>
                                <SelectItem value="combo">Combo</SelectItem>
                              </SelectContent>
                            </Select>

                            {item.item_type === "product" ? (
                              <div className="flex-1 flex items-center gap-2">
                                <Input
                                  value={item.name}
                                  onChange={(e) => {
                                    const newItems = [...planItems];
                                    newItems[idx] = { ...newItems[idx], name: e.target.value };
                                    setPlanItems(newItems);
                                  }}
                                  placeholder="Nome do produto"
                                  className="h-9 text-xs rounded-lg flex-1"
                                />
                                <Input
                                  value={item.manufacturer || ""}
                                  onChange={(e) => {
                                    const newItems = [...planItems];
                                    newItems[idx] = { ...newItems[idx], manufacturer: e.target.value };
                                    setPlanItems(newItems);
                                  }}
                                  placeholder="Fabricante"
                                  className="h-9 text-xs rounded-lg w-36"
                                />
                              </div>
                            ) : (
                              <Select
                                value={item.ref_id || ""}
                                onValueChange={(v) => {
                                  const selected = filteredItems.find(s => s.id === v);
                                  const newItems = [...planItems];
                                  newItems[idx] = {
                                    ...newItems[idx],
                                    ref_id: v,
                                    name: selected?.name || "",
                                    price: selected?.price || 0,
                                  };
                                  setPlanItems(newItems);
                                }}
                              >
                                <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredItems.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                  {filteredItems.length === 0 && (
                                    <SelectItem value="none" disabled>Nenhum item disponível</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-400 hover:text-red-400 hover:bg-red-500/100/10 flex-shrink-0"
                              onClick={() => setPlanItems(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground font-medium">Qtd</label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...planItems];
                                  newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 };
                                  setPlanItems(newItems);
                                }}
                                className="h-9 text-xs rounded-lg text-center"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground font-medium">Preço Unit. (R$)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => {
                                  const newItems = [...planItems];
                                  newItems[idx] = { ...newItems[idx], price: parseFloat(e.target.value) || 0 };
                                  setPlanItems(newItems);
                                }}
                                className="h-9 text-xs rounded-lg text-right"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground font-medium">Desconto</label>
                              <div className="flex h-9">
                                <div className="flex-1 min-w-0">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.discount}
                                    onChange={(e) => {
                                      const newItems = [...planItems];
                                      newItems[idx] = { ...newItems[idx], discount: parseFloat(e.target.value) || 0 };
                                      setPlanItems(newItems);
                                    }}
                                    className="h-full text-xs rounded-l-lg rounded-r-none text-right border-r-0"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...planItems];
                                    newItems[idx] = { ...newItems[idx], discount_type: newItems[idx].discount_type === "percent" ? "fixed" : "percent" };
                                    setPlanItems(newItems);
                                  }}
                                  style={item.discount_type === "percent"
                                    ? { backgroundColor: "#C8A97E", color: "#fff", borderColor: "#C8A97E" }
                                    : { backgroundColor: "#F3F4F6", color: "#374151", borderColor: "#E5E7EB" }}
                                  className="w-10 rounded-r-lg border flex-shrink-0 text-xs font-bold transition-all hover:opacity-80"
                                >
                                  {item.discount_type === "percent" ? "%" : "R$"}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground font-medium">Comissão</label>
                              <div className="flex h-9">
                                <div className="flex-1 min-w-0">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.commission}
                                    onChange={(e) => {
                                      const newItems = [...planItems];
                                      newItems[idx] = { ...newItems[idx], commission: parseFloat(e.target.value) || 0 };
                                      setPlanItems(newItems);
                                    }}
                                    className="h-full text-xs rounded-l-lg rounded-r-none text-right border-r-0"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...planItems];
                                    newItems[idx] = { ...newItems[idx], commission_type: newItems[idx].commission_type === "percent" ? "fixed" : "percent" };
                                    setPlanItems(newItems);
                                  }}
                                  style={item.commission_type === "percent"
                                    ? { backgroundColor: "#C8A97E", color: "#fff", borderColor: "#C8A97E" }
                                    : { backgroundColor: "#F3F4F6", color: "#374151", borderColor: "#E5E7EB" }}
                                  className="w-10 rounded-r-lg border flex-shrink-0 text-xs font-bold transition-all hover:opacity-80"
                                >
                                  {item.commission_type === "percent" ? "%" : "R$"}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-outline-variant/30">
                            <span className="text-xs text-muted-foreground">Subtotal</span>
                            <span className="text-sm font-bold text-on-surface">R$ {finalTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Resumo */}
                    <div className="bg-gradient-to-r from-branding-primary/5 to-branding-secondary/5 border border-branding-primary/10 rounded-xl p-4">
                      {(() => {
                        const totalPlan = planItems.reduce((sum, item) => {
                          const itemTotal = (item.price || 0) * (item.quantity || 1);
                          const disc = item.discount_type === "percent"
                            ? itemTotal * ((item.discount || 0) / 100)
                            : (item.discount || 0);
                          return sum + itemTotal - disc;
                        }, 0);
                        const visits = formData.session_count || 1;
                        const perVisit = totalPlan / visits;
                        return (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-branding-primary/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-branding-primary" />
                                </div>
                                <span className="text-xs text-on-surface-variant">
                                  <strong className="text-on-surface">{planItems.length}</strong> {planItems.length === 1 ? "item" : "itens"} · {" "}
                                  <strong className="text-on-surface">{planItems.reduce((sum, item) => sum + (item.quantity || 1), 0)}</strong> {planItems.reduce((sum, item) => sum + (item.quantity || 1), 0) === 1 ? "unidade" : "unidades"}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] text-muted-foreground block">Total do plano</span>
                                <span className="text-lg font-bold text-on-surface">R$ {totalPlan.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-branding-primary/10">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-branding-primary" />
                                <span className="text-xs text-on-surface-variant">Valor por visita ({visits}x)</span>
                              </div>
                              <span className="text-sm font-semibold text-branding-primary">R$ {perVisit.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-outline text-center py-6 border-2 border-dashed border-outline-variant rounded-xl bg-background">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-outline" />
                    Nenhum item adicionado.<br />
                    <span className="text-outline">Clique em "Adicionar Item" para começar.</span>
                  </p>
                )}
              </div>

              {/* 4. Profissional */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Profissional</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start rounded-xl text-left font-normal h-10", !formData.professional && "text-muted-foreground")}
                    >
                      {formData.professional || "Selecione um profissional..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar profissional..." className="h-9" />
                      <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-y-auto">
                        {professionals.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.full_name || p.email}
                            onSelect={() => {
                              setFormData((prev) => ({ ...prev, professional: p.full_name || p.email }));
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", formData.professional === (p.full_name || p.email) ? "opacity-100" : "opacity-0")}
                            />
                            <span className="flex-1">{p.full_name || p.email}</span>
                            {p.company_id && (
                              <span className="text-xs text-muted-foreground ml-2">{companies.find(c => c.id === p.company_id)?.name}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formData.professional && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setFormData((prev) => ({ ...prev, professional: "" }))}
                  >
                    Limpar seleção
                  </Button>
                )}
              </div>

              {/* 5. Duração + Quantidade de Visitas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duração</Label>
                  <Select value={formData.duration_mins.toString()} onValueChange={(v) => setFormData((prev) => ({ ...prev, duration_mins: parseInt(v) }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                      <SelectItem value="90">90 minutos</SelectItem>
                      <SelectItem value="120">120 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de Visitas</Label>
                  <Input type="number" min="1" value={formData.session_count} onChange={(e) => setFormData((prev) => ({ ...prev, session_count: parseInt(e.target.value) || 4 }))} className="rounded-xl" />
                </div>
              </div>

              {/* 6. Descrição */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Descrição</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva os detalhes do plano..."
                  rows={3}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-branding-primary/50 resize-none"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1 rounded-xl border-error/50 text-error hover:bg-error/10 hover:text-error/80">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 rounded-xl btn-branding">
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{deletingPlan?.name}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(deletingPlan?.id)} className="bg-error hover:bg-error/80 rounded-xl">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}