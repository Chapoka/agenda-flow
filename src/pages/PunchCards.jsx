import { useState } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  MoreVertical,
  Edit,
  Trash2,
  Building2,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, isAfter, isBefore } from "date-fns";

const EMPTY_FORM = {
  customer_id: "",
  service_id: "",
  total_services: 10,
  price_paid: 0,
  name: "Punch Card",
  notes: "",
  expires_at: "",
};

export default function PunchCards() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const { companyId, isSuperAdmin, isAdmin, ready } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [viewMode, setViewMode] = useState("grid");
  const [sortOrder, setSortOrder] = useState("recent");
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deletingCard, setDeletingCard] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const effectiveCompanyId = companyId;

  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["punch_cards", effectiveCompanyId],
    queryFn: () => db.entities.PunchCard.list("-created_at"),
    enabled: ready,
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => db.entities.Customer.list(),
    enabled: ready,
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ["services", effectiveCompanyId],
    queryFn: () => db.entities.Service.list(),
    enabled: ready,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: ready && isSuperAdmin,
  });
  const getCompanyName = (cid) => allCompanies.find(c => c.id === cid)?.name || "—";

  const cards = effectiveCompanyId
    ? allCards.filter(c => c.company_id === effectiveCompanyId)
    : allCards;

  const customers = effectiveCompanyId
    ? allCustomers.filter(s => {
        const sIds = s.company_ids?.length ? s.company_ids : (s.company_id ? [s.company_id] : []);
        return sIds.includes(effectiveCompanyId);
      })
    : allCustomers;

  const services = effectiveCompanyId
    ? allServices.filter(s => s.company_id === effectiveCompanyId)
    : allServices;

  const now = new Date();

  const filteredCards = cards.filter(card => {
    const matchSearch = !search ||
      card.name?.toLowerCase().includes(search.toLowerCase()) ||
      card.customer_name?.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (filterStatus === "active") {
      matchStatus = card.active !== false && card.used_services < card.total_services
        && (!card.expires_at || isAfter(parseISO(card.expires_at), now));
    } else if (filterStatus === "used") {
      matchStatus = card.used_services >= card.total_services;
    } else if (filterStatus === "expired") {
      matchStatus = card.expires_at && isBefore(parseISO(card.expires_at), now)
        && card.used_services < card.total_services;
    } else if (filterStatus === "all") {
      matchStatus = true;
    }

    return matchSearch && matchStatus;
  });

  const createCard = useMutation({
    mutationFn: (data) => {
      const service = services.find(s => s.id === data.service_id);
      return db.entities.PunchCard.create({
        ...data,
        company_id: effectiveCompanyId,
        price_per_service: data.total_services > 0 ? data.price_paid / data.total_services : 0,
        service_category: service?.category || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["punch_cards"]);
      toast.success("Punch card criado!");
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error("Erro ao criar: " + err.message),
  });

  const updateCard = useMutation({
    mutationFn: ({ id, ...data }) => db.entities.PunchCard.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["punch_cards"]);
      toast.success("Punch card atualizado!");
      setShowForm(false);
      setEditingCard(null);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteCard = useMutation({
    mutationFn: (id) => db.entities.PunchCard.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["punch_cards"]);
      toast.success("Punch card removido!");
      setDeletingCard(null);
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  const handleSave = () => {
    if (!form.customer_id) return toast.error("Selecione o cliente");
    if (form.total_services < 1) return toast.error("Mínimo 1 serviço");
    if (form.price_paid < 0) return toast.error("Valor não pode ser negativo");

    if (editingCard) {
      updateCard.mutate({ id: editingCard.id, ...form });
    } else {
      createCard.mutate(form);
    }
  };

  const openEdit = (card) => {
    setEditingCard(card);
    setForm({
      customer_id: card.customer_id || "",
      service_id: card.service_id || "",
      total_services: card.total_services || 10,
      price_paid: card.price_paid || 0,
      name: card.name || "Punch Card",
      notes: card.notes || "",
      expires_at: card.expires_at || "",
    });
    setShowForm(true);
  };

  const getCustomerName = (customerId) => {
    const s = allCustomers.find(st => st.id === customerId);
    return s?.name || "Cliente";
  };

  const getServiceName = (serviceId) => {
    const s = services.find(sv => sv.id === serviceId);
    return s?.name || "Todos os serviços";
  };

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.name || "").localeCompare(a.name || "", "pt-BR");
    if (sortOrder === "cliente-asc") return (a.customer_name || getCustomerName(a.customer_id) || "").localeCompare(b.customer_name || getCustomerName(b.customer_id) || "", "pt-BR");
    if (sortOrder === "cliente-desc") return (b.customer_name || getCustomerName(b.customer_id) || "").localeCompare(a.customer_name || getCustomerName(a.customer_id) || "", "pt-BR");
    if (sortOrder === "empresa-asc") return (a.company_id ? getCompanyName(a.company_id) : "").localeCompare(b.company_id ? getCompanyName(b.company_id) : "", "pt-BR");
    if (sortOrder === "empresa-desc") return (b.company_id ? getCompanyName(b.company_id) : "").localeCompare(a.company_id ? getCompanyName(a.company_id) : "", "pt-BR");
    if (sortOrder === "servico-asc") return (a.service_id ? getServiceName(a.service_id) : "Todos").localeCompare(b.service_id ? getServiceName(b.service_id) : "Todos", "pt-BR");
    if (sortOrder === "servico-desc") return (b.service_id ? getServiceName(b.service_id) : "Todos").localeCompare(a.service_id ? getServiceName(a.service_id) : "Todos", "pt-BR");
    if (sortOrder === "progresso-asc") return (a.used_services || 0) - (b.used_services || 0);
    if (sortOrder === "progresso-desc") return (b.used_services || 0) - (a.used_services || 0);
    if (sortOrder === "expira-asc") return new Date(a.expires_at || "9999-12-31") - new Date(b.expires_at || "9999-12-31");
    if (sortOrder === "expira-desc") return new Date(b.expires_at || "9999-12-31") - new Date(a.expires_at || "9999-12-31");
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortOrder === "value-desc") return (b.price_paid || 0) - (a.price_paid || 0);
    if (sortOrder === "value-asc") return (a.price_paid || 0) - (b.price_paid || 0);
    return 0;
  });

  const totalActive = cards.filter(c => c.active !== false && c.used_services < c.total_services).length;
  const totalRemaining = cards.reduce((sum, c) => {
    if (c.active === false || c.used_services >= c.total_services) return sum;
    if (c.expires_at && isBefore(parseISO(c.expires_at), now)) return sum;
    return sum + (c.total_services - c.used_services);
  }, 0);

  return (
    <div className={cn("max-w-6xl mx-auto p-4 sm:p-6 space-y-6", theme.pageBg)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: theme.cardText }}>Punch Cards</h1>
          <p className="text-sm mt-1" style={{ color: theme.mutedText }}>Gerencie os cartões pré-pagos dos seus clientes</p>
        </div>
        <Button
          onClick={() => { setEditingCard(null); setForm(EMPTY_FORM); setShowForm(true); }}
          className="bg-branding-primary text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Punch Card
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-branding-primary" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Ativos</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>{totalActive}</span>
        </div>
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Serviços Restantes</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>{totalRemaining}</span>
        </div>
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Total Vendidos</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>
            R$ {cards.reduce((sum, c) => sum + (Number(c.price_paid) || 0), 0).toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Buscar por nome ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="used">Usados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Punch Card A → Z</SelectItem>
            <SelectItem value="name-desc">Punch Card Z → A</SelectItem>
            <SelectItem value="cliente-asc">Cliente A → Z</SelectItem>
            <SelectItem value="cliente-desc">Cliente Z → A</SelectItem>
            <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
            <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
            <SelectItem value="servico-asc">Serviço A → Z</SelectItem>
            <SelectItem value="servico-desc">Serviço Z → A</SelectItem>
            <SelectItem value="progresso-desc">Progresso ↓</SelectItem>
            <SelectItem value="progresso-asc">Progresso ↑</SelectItem>
            <SelectItem value="value-desc">Maior valor ↓</SelectItem>
            <SelectItem value="value-asc">Menor valor ↑</SelectItem>
            <SelectItem value="expira-asc">Expira ↑</SelectItem>
            <SelectItem value="expira-desc">Expira ↓</SelectItem>
            <SelectItem value="recent">Mais recentes ↓</SelectItem>
            <SelectItem value="oldest">Mais antigos ↑</SelectItem>
          </SelectContent>
        </Select>
        <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "grid" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
            title="Visualização em grade"
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
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : sortedCards.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 mx-auto text-on-surface-variant mb-3" />
          <p className="text-on-surface-variant">Nenhum punch card encontrado</p>
          <Button
            onClick={() => { setEditingCard(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="mt-4 bg-branding-primary text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Criar primeiro punch card
          </Button>
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-outline-variant/30">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Punch Card {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "cliente-asc" ? "cliente-desc" : "cliente-asc")}><span className="inline-flex items-center gap-1">Cliente {sortOrder === "cliente-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "cliente-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  {isSuperAdmin && <th className="px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "empresa-asc" ? "empresa-desc" : "empresa-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "empresa-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "empresa-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>}
                  <th className="px-4 py-3 font-medium hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "servico-asc" ? "servico-desc" : "servico-asc")}><span className="inline-flex items-center gap-1">Serviço {sortOrder === "servico-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "servico-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "progresso-desc" ? "progresso-asc" : "progresso-desc")}><span className="inline-flex items-center gap-1">Progresso {sortOrder === "progresso-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "progresso-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "value-desc" ? "value-asc" : "value-desc")}><span className="inline-flex items-center gap-1">Valor {sortOrder === "value-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "value-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "expira-asc" ? "expira-desc" : "expira-asc")}><span className="inline-flex items-center gap-1">Expira {sortOrder === "expira-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "expira-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {sortedCards.map(card => {
                  const remaining = card.total_services - card.used_services;
                  const progress = card.total_services > 0 ? (card.used_services / card.total_services) * 100 : 0;
                  const isExpired = card.expires_at && isBefore(parseISO(card.expires_at), now);
                  const isUsed = remaining <= 0;
                  const isActive = card.active !== false && !isUsed && !isExpired;
                  return (
                    <tr key={card.id} className={`hover:bg-surface-container-low transition-colors ${!isActive ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 font-medium text-on-surface">{card.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{card.customer_name || getCustomerName(card.customer_id)}</td>
                      {isSuperAdmin && <td className="px-4 py-3 hidden lg:table-cell">{card.company_id ? <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5"><Building2 className="w-3 h-3" />{getCompanyName(card.company_id)}</span> : <span className="text-muted-foreground">—</span>}</td>}
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{card.service_id ? getServiceName(card.service_id) : "Todos"}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 h-2 bg-surface-container rounded-full overflow-hidden"><div className={cn("h-full rounded-full", isUsed ? "bg-emerald-500" : isExpired ? "bg-amber-500" : "bg-branding-primary")} style={{ width: `${Math.min(progress, 100)}%` }} /></div><span className="text-xs text-muted-foreground">{card.used_services}/{card.total_services}</span></div></td>
                      <td className="px-4 py-3 hidden sm:table-cell font-medium">R$ {Number(card.price_paid || 0).toFixed(2).replace(".", ",")}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{card.expires_at ? format(parseISO(card.expires_at), "dd/MM/yyyy") : "—"}</td>
                      <td className="px-4 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(card)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem><DropdownMenuItem onClick={() => setDeletingCard(card)} className="text-red-400"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCards.map(card => {
            const remaining = card.total_services - card.used_services;
            const progress = card.total_services > 0 ? (card.used_services / card.total_services) * 100 : 0;
            const isExpired = card.expires_at && isBefore(parseISO(card.expires_at), now);
            const isUsed = remaining <= 0;
            const isActive = card.active !== false && !isUsed && !isExpired;

            return (
              <div
                key={card.id}
                className={cn(
                  "rounded-xl border p-4 transition-all hover:shadow-md",
                  !isActive && "opacity-60"
                )}
                style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold",
                      isActive ? "bg-branding-primary/10 text-branding-primary" :
                      isUsed ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-amber-500/20 text-amber-400"
                    )}>
                      {isUsed ? <CheckCircle className="w-5 h-5" /> :
                       isExpired ? <AlertTriangle className="w-5 h-5" /> :
                       <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-on-surface text-sm flex items-center gap-1.5 flex-wrap">
                        {card.name}
                        {isSuperAdmin && card.company_id && <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5"><Building2 className="w-3 h-3" />{getCompanyName(card.company_id)}</span>}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {card.customer_name || getCustomerName(card.customer_id)}
                        {card.service_id && ` • ${getServiceName(card.service_id)}`}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-surface-container">
                        <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(card)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeletingCard(card)} className="text-red-400">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                    <span>{card.used_services} usado(s) de {card.total_services}</span>
                    <span>{remaining} restante(s)</span>
                  </div>
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isUsed ? "bg-emerald-500/100" :
                        isExpired ? "bg-amber-500/100" :
                        "bg-branding-primary"
                      )}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <span>R$ {Number(card.price_paid || 0).toFixed(2).replace(".", ",")}</span>
                    {card.total_services > 0 && (
                      <span className="text-on-surface-variant">
                        (R$ {(Number(card.price_paid || 0) / card.total_services).toFixed(2).replace(".", ",")}/serviço)
                      </span>
                    )}
                  </div>
                  {card.expires_at && (
                    <span className={cn(
                      "flex items-center gap-1",
                      isExpired ? "text-amber-400 font-medium" : ""
                    )}>
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(card.expires_at), "dd/MM/yyyy")}
                      {isExpired && " (expirado)"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Editar Punch Card" : "Novo Punch Card"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Punch Card *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: 10 Cortes"
              />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serviço (opcional)</Label>
              <Select value={form.service_id || "all"} onValueChange={v => setForm(f => ({ ...f, service_id: v === "all" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Todos os serviços" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {services.filter(s => s.active !== false).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — R$ {Number(s.price || 0).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total de Serviços *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.total_services}
                  onChange={e => setForm(f => ({ ...f, total_services: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>Valor Pago (R$) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.price_paid}
                  onChange={e => setForm(f => ({ ...f, price_paid: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            {form.total_services > 0 && form.price_paid > 0 && (
              <div className="bg-branding-primary/5 rounded-lg p-2 text-xs text-branding-primary">
                Valor por serviço: R$ {(form.price_paid / form.total_services).toFixed(2).replace(".", ",")}
              </div>
            )}
            <div>
              <Label>Data de Expiração (opcional)</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações (opcional)"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-branding-primary text-white">
                {editingCard ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <AlertDialog open={!!deletingCard} onOpenChange={() => setDeletingCard(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir punch card?</AlertDialogTitle>
            <AlertDialogDescription>
              O punch card "{deletingCard?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCard.mutate(deletingCard.id)}
              className="bg-error text-white hover:bg-error/80"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
