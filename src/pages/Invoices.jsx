import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useThemeMode } from "@/hooks/useThemeMode";
import { format, parseISO } from "date-fns";
import { 
  CreditCard, 
  Plus, 
  Search,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  FileText,
  LayoutGrid,
  List,
  Send,
  Trash2,
  RefreshCw,
  MessageSquare,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import InvoiceDetailModal from "../components/invoices/InvoiceDetailModal";
import NewInvoiceModal from "../components/invoices/NewInvoiceModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  received: { label: "Pago", icon: CheckCircle, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  overdue: { label: "Vencida", icon: AlertCircle, color: "bg-red-500/20 text-red-300 border-red-500/30" },
  cancelled: { label: "Cancelada", icon: XCircle, color: "bg-surface-container-low text-muted-foreground border-outline-variant" },
};

export default function Invoices() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const [search, setSearch] = useState("");
  const urlParams = new URLSearchParams(window.location.search);
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || "all");
  const [showNewModal, setShowNewModal] = useState(false);

  const [detailInvoice, setDetailInvoice] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [sortOrder, setSortOrder] = useState("recent");
  const [sendingInvoice, setSendingInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    db.auth.me().then(u => { setCurrentUser(u); setUserReady(true); }).catch(() => setUserReady(true));
  }, []);

  const rawRole = currentUser?.role;
  const normalizedRole = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const userCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
  const isSuperAdmin = normalizedRole === "super_admin";
  // Filter by company if user has company_ids (unless super_admin without company)
  const shouldFilterByCompany = userCompanyIds.length > 0 && !isSuperAdmin;

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", ...userCompanyIds],
    queryFn: () => db.entities.Customer.list(),
    enabled: userReady,
    select: (data) => shouldFilterByCompany
      ? data.filter(s => {
          const sIds = s.company_ids?.length ? s.company_ids : (s.company_id ? [s.company_id] : []);
          return sIds.some(id => userCompanyIds.includes(id));
        })
      : data,
  });

  const customerIds = customers.map(s => s.id);

  const { data: allInvoices = [], isLoading } = useQuery({
    queryKey: ["invoices", ...userCompanyIds],
    queryFn: () => db.entities.Invoice.list("-created_at"),
    enabled: userReady,
  });

  // Para profissional/empresa: filtrar por company_id diretamente.
  // Fallback: inclui também cobranças sem company_id mas cujo cliente pertence à empresa.
  const invoices = shouldFilterByCompany
    ? allInvoices.filter(inv => userCompanyIds.includes(inv.company_id) || (!inv.company_id && customerIds.includes(inv.customer_id)))
    : allInvoices;

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => db.entities.Plan.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: isSuperAdmin,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => db.entities.Appointment.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const handleSendInvoice = async (invoice) => {
    const customer = customers.find(s => s.id === invoice.customer_id);
    const compId = customer?.company_id || (customer?.company_ids || [])[0];
    if (!customer?.whatsapp || !compId) {
      toast.error("Cliente sem WhatsApp ou empresa configurados");
      return;
    }
    setSendingInvoice(invoice.id);
    try {
      const plan = plans.find(p => p.id === invoice.plan_id);
      const customerObj = customers.find(s => s.id === invoice.customer_id);
      let planDetails = "";
      if (plan) {
        const modalityLabel = plan.modality === "corte" ? "Corte" : plan.modality === "barba" ? "Barba" : plan.modality || "";
        planDetails += `\n✂️ Tipo: ${modalityLabel}`;
        planDetails += `\n📚 Total de serviços: ${plan.session_count || "-"}`;
        planDetails += `\n💵 Valor por serviço: R$ ${plan.price?.toFixed(2) || "-"}`;
      } else if (customerObj?.custom_plan) {
        const cp = customerObj.custom_plan;
        const modalityLabel = cp.modality === "corte" ? "Corte" : cp.modality === "barba" ? "Barba" : cp.modality || "";
        planDetails += `\n✂️ Tipo: ${modalityLabel}`;
        planDetails += `\n📚 Total de serviços: ${cp.total_services || "-"}`;
        planDetails += `\n💵 Valor por serviço: R$ ${cp.price_per_service?.toFixed(2) || "-"}`;
      }
      const message = `Olá, ${customer.name}! 💳\n\nSua cobrança está disponível:\n\n📋 Plano: *${invoice.plan_name || "Cobrança"}*${planDetails}\n\n💰 Valor total: *R$ ${invoice.value?.toFixed(2)}*\n📅 Vencimento: ${invoice.due_date ? new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR") : "-"}${invoice.asaas_url ? `\n\n🔗 Clique para pagar:\n${invoice.asaas_url}` : ""}\n\nQualquer dúvida, estamos à disposição! ✂️`;
      const res = await db.functions.invoke("whatsappSend", {
        company_id: compId,
        phone: customer.whatsapp,
        message,
      });
      if (res.data?.ok) toast.success("Cobrança enviada via WhatsApp!");
      else toast.error(res.data?.error || "Erro ao enviar mensagem");
    } catch (e) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSendingInvoice(null);
    }
  };

  const handleDeleteInvoice = async () => {
    const invoice = deletingInvoice;
    setDeletingLoading(true);
    try {
      const customer = customers.find(s => s.id === invoice.customer_id);

      // 1. Cancelar assinatura no Asaas (se existir)
      const compId = customer?.company_id || (customer?.company_ids || [])[0];
      if (customer?.asaas_subscription_id && compId) {
        try {
          await db.functions.invoke("asaasCustomer", {
            action: "cancel_subscription",
            subscription_id: customer.asaas_subscription_id,
            company_id: compId,
          });
        } catch (_) {}
        // Remover subscription_id do cliente
        await db.entities.Customer.update(customer.id, { asaas_subscription_id: null });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }

      // 2. Cancelar cobrança avulsa no Asaas (se não for assinatura)
      if (invoice.asaas_id && !customer?.asaas_subscription_id) {
        try {
          await db.functions.invoke("asaasCustomer", {
            action: "delete_payment",
            payment_id: invoice.asaas_id,
            company_id: compId,
          });
        } catch (_) {}
      }

      // 3. Manter pagamentos recebidos — só excluir cobranças pendentes/vencidas
      if (invoice.status !== "received") {
        await db.entities.Invoice.delete(invoice.id);
      } else {
        // Mantém pagamentos recebidos, apenas marca como cancelado no registro
        // (não exclui para preservar histórico financeiro)
      }

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setDeletingInvoice(null);
      toast.success("Assinatura removida com sucesso!");
    } catch (e) {
      toast.error(e.message || "Erro ao remover assinatura");
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoice) => {
    await updateMutation.mutateAsync({ 
      id: invoice.id, 
      data: { 
        status: "received", 
        payment_date: format(new Date(), "yyyy-MM-dd") 
      } 
    });

    // Add credits to customer (support custom_plan too)
    const customer = customers.find(s => s.id === invoice.customer_id);
    if (customer) {
      let creditsToAdd = 0;
      if (customer.custom_plan) {
        creditsToAdd = customer.custom_plan.total_services || customer.custom_plan.frequency_count || 0;
      } else {
        const plan = plans.find(p => p.id === invoice.plan_id || p.id === customer.plan_id);
        creditsToAdd = plan?.session_count || 0;
      }
      await db.entities.Customer.update(customer.id, {
        current_credits: (customer.current_credits || 0) + creditsToAdd
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }

    toast.success("Pagamento registrado e créditos adicionados!");
  };

  const handleSyncAsaas = async () => {
    // Sincroniza status das cobranças com Asaas na subconta da empresa
    const invoicesWithAsaas = invoices.filter(inv => inv.asaas_id && inv.status !== "received" && inv.status !== "cancelled");
    if (invoicesWithAsaas.length === 0) { toast.info("Nenhuma cobrança pendente com ID Asaas para sincronizar."); return; }
    setSyncing(true);
    let updated = 0;
    try {
      // Usa a action list_charges para buscar todas as cobranças da subconta da empresa
      const res = await db.functions.invoke("asaasCustomer", {
        action: "list_charges",
        company_id: userCompanyIds[0] || null,
        limit: 100,
      });
      const asaasCharges = res.data?.charges || [];

      // Sincroniza cada cobrança local que tem asaas_id
      for (const inv of invoicesWithAsaas) {
        const asaasCharge = asaasCharges.find(c => c.id === inv.asaas_id);
        if (!asaasCharge) continue;
        const statusMap = { PENDING: "pending", RECEIVED: "received", CONFIRMED: "received", OVERDUE: "overdue", CANCELLED: "cancelled", REFUNDED: "cancelled" };
        const newStatus = statusMap[asaasCharge.status] || inv.status;
        if (newStatus !== inv.status) {
          await db.entities.Invoice.update(inv.id, {
            status: newStatus,
            payment_date: asaasCharge.paymentDate || null,
            asaas_url: asaasCharge.invoiceUrl || asaasCharge.bankSlipUrl || inv.asaas_url,
          });
          updated++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(updated > 0 ? `${updated} cobrança(s) sincronizada(s) com sucesso!` : "Tudo já está atualizado!");
    } catch (e) {
      toast.error(e.message || "Erro ao sincronizar com Asaas");
    } finally {
      setSyncing(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.asaas_id?.includes(search);
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.customer_name || "").localeCompare(b.customer_name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.customer_name || "").localeCompare(a.customer_name || "", "pt-BR");
    if (sortOrder === "plano-asc") {
      const pa = a.plan_name || (customers.find(s => s.id === a.customer_id)?.custom_plan ? "Plano Personalizado" : "-");
      const pb = b.plan_name || (customers.find(s => s.id === b.customer_id)?.custom_plan ? "Plano Personalizado" : "-");
      return pa.localeCompare(pb, "pt-BR");
    }
    if (sortOrder === "plano-desc") {
      const pa = a.plan_name || (customers.find(s => s.id === a.customer_id)?.custom_plan ? "Plano Personalizado" : "-");
      const pb = b.plan_name || (customers.find(s => s.id === b.customer_id)?.custom_plan ? "Plano Personalizado" : "-");
      return pb.localeCompare(pa, "pt-BR");
    }
    if (sortOrder === "empresa-asc") {
      const getCID = (inv) => {
        const st = customers.find(s => s.id === inv.customer_id);
        return inv.company_id || st?.company_id || (st?.company_ids || [])[0] || "";
      };
      const ca = companies.find(c => c.id === getCID(a))?.name || "";
      const cb = companies.find(c => c.id === getCID(b))?.name || "";
      return ca.localeCompare(cb, "pt-BR");
    }
    if (sortOrder === "empresa-desc") {
      const getCID = (inv) => {
        const st = customers.find(s => s.id === inv.customer_id);
        return inv.company_id || st?.company_id || (st?.company_ids || [])[0] || "";
      };
      const ca = companies.find(c => c.id === getCID(a))?.name || "";
      const cb = companies.find(c => c.id === getCID(b))?.name || "";
      return cb.localeCompare(ca, "pt-BR");
    }
    if (sortOrder === "value-desc") return (b.value || 0) - (a.value || 0);
    if (sortOrder === "value-asc") return (a.value || 0) - (b.value || 0);
    if (sortOrder === "recent") return new Date(b.created_at || b.due_date || 0) - new Date(a.created_at || a.due_date || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || a.due_date || 0) - new Date(b.created_at || b.due_date || 0);
    if (sortOrder === "due-asc") return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    if (sortOrder === "due-desc") return new Date(b.due_date || 0) - new Date(a.due_date || 0);
    if (sortOrder === "status-asc") return (a.status || "").localeCompare(b.status || "", "pt-BR");
    if (sortOrder === "status-desc") return (b.status || "").localeCompare(a.status || "", "pt-BR");
    return 0;
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedInvoices.map(i => i.id)));
    }
  };

  const handleBulkSend = async () => {
    const toSend = sortedInvoices.filter(i => selectedIds.has(i.id));
    if (toSend.length === 0) return;
    setBulkSending(true);
    let ok = 0;
    let fail = 0;
    for (const invoice of toSend) {
      const customer = customers.find(s => s.id === invoice.customer_id);
      const compIdBulk = customer?.company_id || (customer?.company_ids || [])[0];
      if (!customer?.whatsapp || !compIdBulk) { fail++; continue; }
      try {
        const plan = plans.find(p => p.id === invoice.plan_id);
        let planDetails = "";
        if (plan) {
        const modalityLabel = plan.modality === "corte" ? "Corte" : plan.modality === "barba" ? "Barba" : plan.modality || "";
          planDetails += `\n✂️ Tipo: ${modalityLabel}`;
          planDetails += `\n📚 Serviços: ${plan.session_count || "-"}`;
        }
        const message = `Olá, ${customer.name}! 💳\n\nSua cobrança está disponível:\n\n📋 Plano: *${invoice.plan_name || "Cobrança"}*${planDetails}\n\n💰 Valor: *R$ ${invoice.value?.toFixed(2)}*\n📅 Vencimento: ${invoice.due_date ? new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR") : "-"}${invoice.asaas_url ? `\n\n🔗 Pagar: ${invoice.asaas_url}` : ""}\n\nQualquer dúvida, estamos à disposição! ✂️`;
        const res = await db.functions.invoke("whatsappSend", {
          company_id: compIdBulk,
          phone: customer.whatsapp,
          message,
        });
        if (res.data?.ok) ok++; else fail++;
      } catch (_) { fail++; }
    }
    setBulkSending(false);
    setSelectedIds(new Set());
    if (ok > 0) toast.success(`${ok} cobrança(s) enviada(s) com sucesso!`);
    if (fail > 0) toast.error(`${fail} cobrança(s) não puderam ser enviadas`);
  };

  return (
    <div className={cn("min-h-screen", theme.pageBg)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" style={{ color: theme.cardText }}>
              <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              Cobranças
            </h1>
            <p className="mt-1" style={{ color: theme.mutedText }}>Gerencie faturas e pagamentos</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSyncAsaas}
              disabled={syncing}
              className="rounded-xl border-branding-primary/30 text-branding-primary hover:bg-branding-primary/5"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              {syncing ? "Sincronizando..." : "Sincronizar Asaas"}
            </Button>
            <Button
              onClick={() => setShowNewModal(true)}
              className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Cobrança
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl border-outline-variant"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="received">Pagos</SelectItem>
                  <SelectItem value="overdue">Vencidas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="rounded-xl">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes ↓</SelectItem>
                  <SelectItem value="oldest">Mais antigos ↑</SelectItem>
                  <SelectItem value="name-asc">Cliente A → Z</SelectItem>
                  <SelectItem value="name-desc">Cliente Z → A</SelectItem>
                  <SelectItem value="plano-asc">Plano A → Z</SelectItem>
                  <SelectItem value="plano-desc">Plano Z → A</SelectItem>
                  <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
                  <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
                  <SelectItem value="value-desc">Maior valor ↓</SelectItem>
                  <SelectItem value="value-asc">Menor valor ↑</SelectItem>
                  <SelectItem value="due-asc">Vencimento ↑</SelectItem>
                  <SelectItem value="due-desc">Vencimento ↓</SelectItem>
                  <SelectItem value="status-asc">Status A → Z</SelectItem>
                  <SelectItem value="status-desc">Status Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex border border-outline-variant rounded-xl overflow-hidden flex-shrink-0">
              <button onClick={() => setViewMode("list")} className={cn("px-3 py-2 transition-colors", viewMode === "list" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("grid")} className={cn("px-3 py-2 transition-colors", viewMode === "grid" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-branding-primary text-white rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{selectedIds.size} cobrança(s) selecionada(s)</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkSend}
                disabled={bulkSending}
                className="rounded-xl bg-card text-branding-primary hover:bg-card/90 font-semibold"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                {bulkSending ? "Enviando..." : "Enviar via WhatsApp"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl text-white hover:bg-card/20"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Table / Grid */}
        {viewMode === "list" ? (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="bg-background">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={sortedInvoices.length > 0 && selectedIds.size === sortedInvoices.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Cliente {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>
                  <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "plano-asc" ? "plano-desc" : "plano-asc")}><span className="inline-flex items-center gap-1">Plano {sortOrder === "plano-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "plano-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>
                  {isSuperAdmin && <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "empresa-asc" ? "empresa-desc" : "empresa-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "empresa-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "empresa-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>}
                  <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "value-desc" ? "value-asc" : "value-desc")}><span className="inline-flex items-center gap-1">Valor {sortOrder === "value-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "value-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>
                  <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "due-asc" ? "due-desc" : "due-asc")}><span className="inline-flex items-center gap-1">Vencimento {sortOrder === "due-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "due-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>
                  <TableHead className="cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "status-asc" ? "status-desc" : "status-asc")}><span className="inline-flex items-center gap-1">Status {sortOrder === "status-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "status-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><div className="h-12 bg-surface-container-low animate-pulse rounded" /></TableCell></TableRow>
                  ))
                ) : sortedInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12"><CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Nenhuma cobrança encontrada</p></TableCell></TableRow>
                ) : sortedInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={invoice.id} className={cn("hover:bg-surface-container-low", selectedIds.has(invoice.id) && "bg-branding-primary/5")}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(invoice.id)}
                          onCheckedChange={() => toggleSelect(invoice.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-medium text-sm">{invoice.customer_name?.charAt(0)?.toUpperCase()}</div>
                          <div>
                            <span className="font-medium text-on-surface">{invoice.customer_name}</span>
                            {(() => {
                              const st = customers.find(s => s.id === invoice.customer_id);
                              if (st?.guardian_id) {
                                const guardian = customers.find(s => s.id === st.guardian_id);
                                if (guardian) return (
                                  <p className="text-xs text-purple-400">👤 Resp: {guardian.name}</p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <span>{invoice.plan_name || (customers.find(s => s.id === invoice.customer_id)?.custom_plan ? "Plano Personalizado" : "-")}</span>
                          {(invoice.plan_name === "Plano Personalizado" || (!invoice.plan_name && customers.find(s => s.id === invoice.customer_id)?.custom_plan)) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Personalizado</span>
                          )}
                        </div>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-on-surface-variant text-xs">
                          {(() => {
                            const st = customers.find(s => s.id === invoice.customer_id);
                            const cid = invoice.company_id || st?.company_id || (st?.company_ids || [])[0];
                            if (!cid) return <span className="text-purple-400 font-medium">Global</span>;
                            const co = companies.find(c => c.id === cid);
                            return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">{co?.name || cid}</span>;
                          })()}
                        </TableCell>
                      )}
                      <TableCell className="font-semibold text-on-surface">R$ {invoice.value?.toFixed(2)}</TableCell>
                      <TableCell className="text-on-surface-variant">{invoice.due_date ? format(parseISO(invoice.due_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell><Badge className={cn("border gap-1", status.color)}><StatusIcon className="w-3 h-3" />{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetailInvoice(invoice)} className="rounded-lg text-xs"><FileText className="w-3 h-3 mr-1" />Detalhes</Button>
                          {invoice.status === "pending" && (<Button size="sm" onClick={() => handleMarkAsPaid(invoice)} className="bg-emerald-500 hover:bg-emerald-500/80 rounded-lg text-xs"><CheckCircle className="w-3 h-3 mr-1" />Confirmar</Button>)}
                          {invoice.status === "pending" && (<Button size="sm" variant="outline" onClick={() => handleSendInvoice(invoice)} disabled={sendingInvoice === invoice.id} className="rounded-lg text-xs border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10"><Send className="w-3 h-3 mr-1" />{sendingInvoice === invoice.id ? "..." : "Enviar"}</Button>)}
                          {invoice.asaas_url && (<Button size="sm" variant="outline" asChild className="rounded-lg text-xs"><a href={invoice.asaas_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 mr-1" />Link</a></Button>)}
                          {invoice.status !== "received" && (<Button size="sm" variant="outline" onClick={() => setDeletingInvoice(invoice)} className="rounded-lg text-xs text-red-400 border-red-500/30 hover:bg-red-500/100/10"><Trash2 className="w-3 h-3 mr-1" />Excluir</Button>)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? Array(6).fill(0).map((_, i) => <div key={i} className="bg-card rounded-2xl p-5 animate-pulse h-40" />) :
            sortedInvoices.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-card rounded-2xl border border-outline-variant/30">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma cobrança encontrada</p>
              </div>
            ) : sortedInvoices.map((invoice) => {
              const status = statusConfig[invoice.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const planName = invoice.plan_name || (customers.find(s => s.id === invoice.customer_id)?.custom_plan ? "Plano Personalizado" : "-");
              const isCustom = invoice.plan_name === "Plano Personalizado" || (!invoice.plan_name && customers.find(s => s.id === invoice.customer_id)?.custom_plan);
              return (
                <div key={invoice.id} className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-5 hover:shadow-md transition-all flex flex-col gap-4">
                  {/* Header: avatar + nome + badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {invoice.customer_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface text-sm leading-tight truncate">{invoice.customer_name}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground truncate">{planName}</p>
                          {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium flex-shrink-0">Custom</span>}
                        </div>
                        {isSuperAdmin && (() => {
                          const st = customers.find(s => s.id === invoice.customer_id);
                          const cid = invoice.company_id || st?.company_id || (st?.company_ids || [])[0];
                          if (!cid) return <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">Global</span>;
                          const co = companies.find(c => c.id === cid);
                          return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30"><Building2 className="w-3 h-3" />{co?.name || cid.slice(0,8)}</span>;
                        })()}
                        {(() => {
                          const st = customers.find(s => s.id === invoice.customer_id);
                          if (st?.guardian_id) {
                            const guardian = customers.find(s => s.id === st.guardian_id);
                            if (guardian) return <p className="text-xs text-purple-400 truncate">👤 {guardian.name}</p>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <Badge className={cn("border gap-1 flex-shrink-0", status.color)}>
                      <StatusIcon className="w-3 h-3" />{status.label}
                    </Badge>
                  </div>

                  {/* Valor + Vencimento */}
                  <div className="flex items-end justify-between border-t border-outline-variant/30 pt-3">
                    <span className="text-2xl font-bold text-on-surface">R$ {invoice.value?.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {invoice.due_date ? format(parseISO(invoice.due_date), "dd/MM/yyyy") : "-"}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetailInvoice(invoice)} className="rounded-lg text-xs">
                      <FileText className="w-3 h-3 mr-1" />Detalhes
                    </Button>
                    {invoice.status === "pending" && (
                      <Button size="sm" onClick={() => handleMarkAsPaid(invoice)} className="bg-emerald-500 hover:bg-emerald-500/80 rounded-lg text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />Confirmar
                      </Button>
                    )}
                    {invoice.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => handleSendInvoice(invoice)} disabled={sendingInvoice === invoice.id} className="rounded-lg text-xs border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10">
                        <Send className="w-3 h-3 mr-1" />{sendingInvoice === invoice.id ? "..." : "Enviar"}
                      </Button>
                    )}
                    {invoice.asaas_url && (
                      <Button size="sm" variant="outline" asChild className="rounded-lg text-xs">
                        <a href={invoice.asaas_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 mr-1" />Link</a>
                      </Button>
                    )}
                    {invoice.status !== "received" && (
                      <Button size="sm" variant="outline" onClick={() => setDeletingInvoice(invoice)} className="rounded-lg text-xs text-red-400 border-red-500/30 hover:bg-red-500/100/10">
                        <Trash2 className="w-3 h-3 mr-1" />Excluir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Invoice Modal */}
        <NewInvoiceModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          customers={customers}
          plans={plans}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
        />

        {/* Detail Modal */}
        {detailInvoice && (
          <InvoiceDetailModal
            invoice={detailInvoice}
            customer={customers.find(s => s.id === detailInvoice.customer_id)}
            appointments={appointments}
            onClose={() => setDetailInvoice(null)}
          />
        )}

        {/* Delete Invoice / Cancel Subscription Dialog */}
        <AlertDialog open={!!deletingInvoice} onOpenChange={() => !deletingLoading && setDeletingInvoice(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover assinatura</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover a assinatura de <strong>{deletingInvoice?.customer_name}</strong>?
                <br /><br />
                A assinatura será cancelada no Asaas e os pagamentos já efetuados serão mantidos no histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" disabled={deletingLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteInvoice}
                disabled={deletingLoading}
                className="bg-error hover:bg-error/80 rounded-xl"
              >
                {deletingLoading ? "Removendo..." : "Remover assinatura"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}