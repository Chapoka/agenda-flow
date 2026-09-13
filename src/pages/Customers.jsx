import { useState, useEffect } from "react";
import { db, setCustomerCompanies, getCustomerCompanies } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Users,
  Plus,
  Search,
  Phone,
  CreditCard,
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  LayoutGrid,
  List,
  Calendar,
  Clock,
  BookOpen,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { format, parseISO, startOfDay } from "date-fns";
import AsaasSubscriptionModal from "@/components/customers/AsaasSubscriptionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import CustomerForm from "@/components/customers/CustomerForm";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger, logCustomer, logCustomersArray } from "@/lib/debugLogger";

export default function Customers() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [showForm, setShowForm] = useState(() => {
    try { return localStorage.getItem("form_draft_customer_open") === "true"; } catch { return false; }
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingCompanyIds, setEditingCompanyIds] = useState([]);

  useEffect(() => {
    if (editingCustomer) {
      getCustomerCompanies(editingCustomer.id)
        .then(ids => setEditingCompanyIds(ids || []))
        .catch(() => setEditingCompanyIds([]));
    }
  }, [editingCustomer]);

  // Invalidate customers when form opens to get fresh guardian_id data
  useEffect(() => {
    if (showForm) {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  }, [showForm, queryClient]);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [confirmAction, setConfirmAction] = useState("delete");
  const [subscriptionCustomer, setSubscriptionCustomer] = useState(null);
  const [scheduleCustomer, setScheduleCustomer] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isMobile = useIsMobile();

  const effectiveViewMode = isMobile ? "grid" : viewMode;

  useEffect(() => {
    db.auth.me().then(u => { setCurrentUser(u); setUserReady(true); }).catch(() => setUserReady(true));
  }, []);

  useEffect(() => {
    if (location.state?.openNew) {
      setShowForm(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("form_draft_customer_open", String(showForm));
  }, [showForm]);

  const rawRole = currentUser?.role;
  const normalizedRole = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const userCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
  const isSuperAdmin = normalizedRole === "super_admin";
  const isProfissional = normalizedRole === "profissional";
  const isAdmin = normalizedRole === "admin";
  const showCompanyColumn = isSuperAdmin || (isAdmin && userCompanyIds.length > 1);


  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", ...userCompanyIds, isProfissional],
    queryFn: async () => {
      logger.api("FETCH customers list");
      const result = await db.entities.Customer.list("-created_at");
      logger.api("FETCH customers response", result);
      return result;
    },
    enabled: userReady,
    select: (data) => {
      logger.data("RAW customers from DB", data);
      const shouldFilter = userCompanyIds.length > 0 && !isSuperAdmin;
      const filtered = shouldFilter
        ? data.filter(s => {
            const rawIds = s.company_ids ?? s.companyIds ?? s.company_id ?? s.companyId;
            const sIds = Array.isArray(rawIds) ? rawIds : (rawIds ? [rawIds] : []);
            return sIds.some(id => userCompanyIds.includes(id));
          })
        : data;
      logger.data("FILTERED customers (after company filter)", filtered);
      logCustomersArray(filtered, "Customers for UI");
      return filtered;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      logger.api("FETCH plans");
      const result = await db.entities.Plan.list();
      logger.api("FETCH plans response", result);
      return result;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      logger.api("FETCH companies");
      const result = await db.entities.Company.list();
      logger.api("FETCH companies response", result);
      return result;
    },
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: ["appointments-all"],
    queryFn: async () => {
      logger.api("FETCH appointments");
      const result = await db.entities.Appointment.list("-date", 2000);
      logger.api("FETCH appointments response", result);
      return result;
    },
  });

  // Compute per-customer appointment stats
  const appointmentStats = {};
  const today = startOfDay(new Date());
  allAppointments.forEach(l => {
    if (!appointmentStats[l.customer_id]) {
      appointmentStats[l.customer_id] = { total: 0, future: 0, present: 0, absent: 0, nextAppointment: null, lastAppointment: null };
    }
    const stats = appointmentStats[l.customer_id];
    stats.total++;
    if (l.status === "present") stats.present++;
    if (l.status === "absent") stats.absent++;

    const appointmentDate = parseISO(l.date);
    if (appointmentDate >= today && !["cancelled"].includes(l.status)) {
      stats.future++;
      if (!stats.nextAppointment || appointmentDate < parseISO(stats.nextAppointment.date)) {
        stats.nextAppointment = l;
      }
    }
    if (!stats.lastAppointment || appointmentDate > parseISO(stats.lastAppointment.date)) {
      stats.lastAppointment = l;
    }
  });

  const getCompanyName = (companyId) => {
    const c = companies.find(c => c.id === companyId);
    return c ? c.name : null;
  };

  // Set of customer IDs that are responsibles (have dependents)
  const guardianIds = new Set(customers.filter(s => s.guardian_id).map(s => s.guardian_id));

  const createMutation = useMutation({
    mutationFn: async (data) => {
      logger.mutation("CREATE customer", data);
      const accessToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      let credits = 0;
      if (data.custom_plan) {
        credits = data.custom_plan.total_services || 0;
      } else if (data.plan_id) {
        const plan = plans.find(p => p.id === data.plan_id);
        credits = plan?.session_count || 0;
      }
      const result = await db.entities.Customer.create({
        ...data,
        access_token: accessToken,
        current_credits: credits,
        status: "active",
      });
      logger.mutation("CREATE customer result", result);
      return result;
    },
    onError: (err) => {
      toast.error("Erro ao cadastrar cliente: " + (err?.message || "verifique os dados"));
    },
    onSuccess: (result) => {
      logger.mutation("CREATE customer success", result);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      logger.mutation("UPDATE customer", { id, data });
      const result = await db.entities.Customer.update(id, data);
      logger.mutation("UPDATE customer result", result);
      return result;
    },
    onError: (err) => {
      toast.error("Erro ao atualizar cliente: " + (err?.message || "verifique os dados"));
    },
    onSuccess: (result) => {
      logger.mutation("UPDATE customer success", result);
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (customer) => {
      logger.mutation("DELETE customer", customer);
      // Cancelar assinatura no Asaas se existir
      const compId = customer.company_id || (customer.company_ids || [])[0];
      if (customer.asaas_subscription_id && compId) {
        try {
          await db.functions.invoke("asaasCustomer", {
            action: "cancel_subscription",
            subscription_id: customer.asaas_subscription_id,
            company_id: compId,
          });
        } catch (_) {}
      }

      // Se o cliente for responsável, desvincula dependentes antes de excluir
      const dependentCustomers = customers.filter(s => s.guardian_id === customer.id);
      if (dependentCustomers.length > 0) {
        await Promise.all(dependentCustomers.map(dep =>
          db.entities.Customer.update(dep.id, { guardian_id: null, billing_mode: "individual" })
        ));
      }

      await db.entities.Customer.delete(customer.id);
      logger.mutation("DELETE customer success", { id: customer.id });
    },
    onError: (err) => toast.error("Erro ao excluir cliente: " + (err?.message || "tente novamente")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeletingCustomer(null);
      toast.success("Cliente excluído com sucesso!");
    },
  });

  const inactivateMutation = useMutation({
    mutationFn: async (customer) => {
      logger.mutation("INACTIVATE customer", customer);
      await db.entities.Customer.update(customer.id, { status: "inactive" });
      const compId = customer.company_id || (customer.company_ids || [])[0];
      if (customer.asaas_subscription_id && compId) {
        try {
          await db.functions.invoke("asaasCustomer", {
            action: "cancel_subscription",
            subscription_id: customer.asaas_subscription_id,
            company_id: compId,
          });
        } catch (_) {}
        await db.entities.Customer.update(customer.id, { asaas_subscription_id: null });
      }
      logger.mutation("INACTIVATE customer success", { id: customer.id });
    },
    onError: (err) => toast.error("Erro ao inativar cliente: " + (err?.message || "tente novamente")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeletingCustomer(null);
      toast.success("Cliente movido para inativo com sucesso!");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      logger.mutation("TOGGLE STATUS customer", { id, status });
      await db.entities.Customer.update(id, { status });
      // Cancel Asaas subscription when deactivating
      if (status === "inactive") {
        const customer = customers.find(s => s.id === id);
        const compId = customer?.company_id || (customer?.company_ids || [])[0];
        if (customer?.asaas_subscription_id && compId) {
          try {
            await db.functions.invoke("asaasCustomer", {
              action: "cancel_subscription",
              subscription_id: customer.asaas_subscription_id,
              company_id: compId,
            });
          } catch (_) {}
          await db.entities.Customer.update(id, { asaas_subscription_id: null });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const handleSubmit = async (data, dependentIds = []) => {
    try {
      logger.group("handleSubmit START");
      logger.info("Input data", data);
      logger.info("Dependent IDs", dependentIds);
      logger.info("Current customers state", customers.map(c => ({ id: c.id, name: c.name, guardian_id: c.guardian_id })));
      
      // Validate: a dependent cannot be a guardian for another customer
      if (data.guardian_id) {
        const selectedGuardian = customers.find(c => c.id === data.guardian_id);
        logger.info("Guardian validation", { guardian_id: data.guardian_id, selectedGuardian: selectedGuardian ? { id: selectedGuardian.id, name: selectedGuardian.name, guardian_id: selectedGuardian.guardian_id } : null });
        if (selectedGuardian?.guardian_id) {
          logger.warn("VALIDATION FAILED: dependent cannot be guardian");
          toast.error("Um dependente não pode ser responsável financeiro de outro cliente.");
          return;
        }
      }
      // Lista suspensa (primário) + check filial/franquia (secundários)
      // Cliente aparece na empresa selecionada; se check marcado, também nas secundárias
      let allCompanyIds = data.company_ids || [];
      // Profissional: força primário como sua empresa, mas mantém extras se check filial marcado
      if (isProfissional) {
        const primary = userCompanyIds[0] || allCompanyIds[0] || null;
        const extras = allCompanyIds.filter(id => id !== primary);
        allCompanyIds = primary ? [primary, ...extras] : extras;
      }
      // Garante que admin só vincula a empresas que possui (RLS também valida)
      if (!isSuperAdmin) {
        allCompanyIds = allCompanyIds.filter(id => userCompanyIds.includes(id));
      }
      // Validação: se admin só tem uma empresa aquele cliente será daquela empresa que ele tem acesso
      if (allCompanyIds.length === 0 && !isSuperAdmin && userCompanyIds.length === 1) {
        allCompanyIds = [...userCompanyIds];
      }
      const companyId = allCompanyIds[0] || null;
      if (!companyId) {
        toast.error("Selecione a empresa para vincular o cliente. Cliente aparecerá somente na empresa selecionada.");
        return;
      }

      // Build payload with only columns that exist in the customers table
      const finalData = {
        name: data.name,
        cpf: data.cpf || null,
        rg: data.rg || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        birth_date: data.birth_date || null,
        address_street: data.address_street || null,
        address_number: data.address_number || null,
        address_complement: data.address_complement || null,
        address_neighborhood: data.address_neighborhood || null,
        address_city: data.address_city || null,
        address_state: data.address_state || null,
        address_zipcode: data.address_zipcode || null,
        plan_id: data.plan_id || null,
        custom_plan: data.custom_plan || null,
        current_credits: data.current_credits || 0,
        access_token: data.access_token || null,
        status: data.status || "active",
        notes: data.notes || null,
        teacher_id: data.teacher_id || null,
        guardian_id: data.guardian_id || null,
        billing_mode: data.billing_mode || "individual",
        portal_enabled: data.portal_enabled ?? true,
        company_id: companyId,
        medical_certificate_url: data.medical_certificate_url || null,
      };
      logger.info("Final payload to send", finalData);
      logger.groupEnd();

      if (editingCustomer) {
        const updatedCustomer = await updateMutation.mutateAsync({ id: editingCustomer.id, data: finalData });
        await setCustomerCompanies(editingCustomer.id, allCompanyIds);
        // Update dependent customers' guardian_id
        if (dependentIds.length > 0) {
          await Promise.all(dependentIds.map(depId =>
            db.entities.Customer.update(depId, {
              guardian_id: editingCustomer.id,
              billing_mode: "consolidated",
            })
          ));
        }
        // Remove guardian from customers no longer selected as dependents
        const currentDependents = customers.filter(s => s.guardian_id === editingCustomer.id);
        const removedDependents = currentDependents.filter(s => !dependentIds.includes(s.id));
        if (removedDependents.length > 0) {
          await Promise.all(removedDependents.map(s =>
            db.entities.Customer.update(s.id, { guardian_id: null, billing_mode: "individual" })
          ));
        }
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        setEditingCustomer(null);
        setShowForm(false);

        // Envia WhatsApp com dados do portal se foi habilitado agora
        const portalJustEnabled = (finalData.portal_enabled === true || finalData.portalEnabled === true)
          && !(editingCustomer.portal_enabled === true || editingCustomer.portalEnabled === true);
        if (portalJustEnabled && updatedCustomer.whatsapp && companyId) {
          const portalUrl = `${window.location.origin}/CustomerPortal`;
          const msg = [
            `Olá ${updatedCustomer.name}!`,
            ``,
            `Seu acesso ao Portal do Cliente foi liberado!`,
            ``,
            `E-mail: ${updatedCustomer.email || finalData.email}`,
            `Senha: 123456`,
            ``,
            `Acesse: ${portalUrl}`,
            ``,
            `No portal você pode acompanhar seus agendamentos, histórico de serviços e pagamentos.`,
          ].join("\n");
          try {
            await db.functions.invoke("whatsappSend", {
              company_id: companyId,
              phone: updatedCustomer.whatsapp,
              message: msg,
            });
          } catch (_) {}
        }

        if ((updatedCustomer.plan_id || updatedCustomer.custom_plan) && !updatedCustomer.asaas_subscription_id) {
          setSubscriptionCustomer(updatedCustomer);
        } else {
          toast.success("Cliente atualizado com sucesso!");
        }
      } else {
        const created = await createMutation.mutateAsync(finalData);
        await setCustomerCompanies(created.id, allCompanyIds);
        // Update dependent customers' guardian_id to the newly created customer
        if (dependentIds.length > 0) {
          await Promise.all(dependentIds.map(depId =>
            db.entities.Customer.update(depId, {
              guardian_id: created.id,
              billing_mode: "consolidated",
            })
          ));
        }
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        setShowForm(false);

        // Envia WhatsApp com dados do portal se habilitado
        const portalEnabled = finalData.portal_enabled === true || finalData.portalEnabled === true;
        if (portalEnabled && created.whatsapp && companyId) {
          const portalUrl = `${window.location.origin}/CustomerPortal`;
          const msg = [
            `Olá ${created.name}!`,
            ``,
            `Seu acesso ao Portal do Cliente foi liberado!`,
            ``,
            `E-mail: ${created.email || finalData.email}`,
            `Senha: 123456`,
            ``,
            `Acesse: ${portalUrl}`,
            ``,
            `No portal você pode acompanhar seus agendamentos, histórico de serviços e pagamentos.`,
          ].join("\n");
          try {
            await db.functions.invoke("whatsappSend", {
              company_id: companyId,
              phone: created.whatsapp,
              message: msg,
            });
          } catch (_) {}
        }

        if (created.plan_id || created.custom_plan) {
          setSubscriptionCustomer(created);
        } else {
          toast.success("Cliente cadastrado com sucesso!");
        }
      }
    } catch (err) {
      toast.error("Erro ao salvar cliente: " + (err?.message || "tente novamente"));
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const normalizedSearch = search.toLowerCase().trim();
    const numericSearch = search.replace(/\D/g, "");
    const matchesSearch = !normalizedSearch || [
      customer.name,
      customer.email,
      customer.cpf,
      customer.rg,
      customer.whatsapp,
    ].some(value => value?.toString().toLowerCase().includes(normalizedSearch)) ||
      (numericSearch && [customer.cpf, customer.whatsapp].some(value => value?.replace(/\D/g, "").includes(numericSearch)));
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPlanName = (customer) => {
    if (customer.custom_plan) {
      return "Plano Personalizado";
    }
    const plan = plans.find(p => p.id === customer.plan_id);
    return plan?.name || "-";
  };

  const getCompanyNamesStr = (customer) => {
    const compIds = customer.company_ids?.length ? customer.company_ids : (customer.company_id ? [customer.company_id] : (customer.companyId ? [customer.companyId] : []));
    return compIds.map(id => getCompanyName(id)).filter(Boolean).join(", ") || "";
  };

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.name || "").localeCompare(a.name || "", "pt-BR");
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortOrder === "credits-desc") return (b.current_credits || 0) - (a.current_credits || 0);
    if (sortOrder === "credits-asc") return (a.current_credits || 0) - (b.current_credits || 0);
    if (sortOrder === "plan-asc") return getPlanName(a).localeCompare(getPlanName(b), "pt-BR");
    if (sortOrder === "plan-desc") return getPlanName(b).localeCompare(getPlanName(a), "pt-BR");
    if (sortOrder === "company-asc") return getCompanyNamesStr(a).localeCompare(getCompanyNamesStr(b), "pt-BR");
    if (sortOrder === "company-desc") return getCompanyNamesStr(b).localeCompare(getCompanyNamesStr(a), "pt-BR");
    if (sortOrder === "whatsapp-asc") return (a.whatsapp || "").localeCompare(b.whatsapp || "", "pt-BR");
    if (sortOrder === "whatsapp-desc") return (b.whatsapp || "").localeCompare(a.whatsapp || "", "pt-BR");
    if (sortOrder === "agendas-desc") return (appointmentStats[b.id]?.total || 0) - (appointmentStats[a.id]?.total || 0);
    if (sortOrder === "agendas-asc") return (appointmentStats[a.id]?.total || 0) - (appointmentStats[b.id]?.total || 0);
    if (sortOrder === "status-asc") return (a.status || "").localeCompare(b.status || "", "pt-BR");
    if (sortOrder === "status-desc") return (b.status || "").localeCompare(a.status || "", "pt-BR");
    return 0;
  });

  if (showForm) {
    return (
      <div className={cn("min-h-screen", theme.pageBg)}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          <Button
            variant="ghost"
            onClick={() => {
              setShowForm(false);
              setEditingCustomer(null);
              localStorage.removeItem("form_draft_customer_open");
            }}
            className="mb-6"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6" style={{ color: theme.cardText }}>
            {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
          </h1>

          <CustomerForm
            customer={editingCustomer ? { ...editingCustomer, company_ids: editingCompanyIds } : null}
            plans={plans}
            companies={companies}
            customers={customers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
            isTeacher={isProfissional}
            teacherCompanyId={userCompanyIds[0]}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", theme.pageBg)}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3" style={{ color: theme.cardText }}>
              <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="truncate">Clientes</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: theme.mutedText }}>{filteredCustomers.length} cliente(s) encontrado(s)</p>
          </div>
          
          <Button
            onClick={() => setShowForm(true)}
            className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20 w-full sm:w-auto flex-shrink-0"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 overflow-x-auto">
              {[{ value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }, { value: "all", label: "Todos" }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn("px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap", statusFilter === opt.value ? "bg-card text-branding-primary shadow-sm" : "text-muted-foreground hover:text-on-surface")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-44 sm:w-48 rounded-xl border-outline-variant text-sm h-9">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Cliente A → Z</SelectItem>
                  <SelectItem value="name-desc">Cliente Z → A</SelectItem>
                  <SelectItem value="plan-asc">Plano A → Z</SelectItem>
                  <SelectItem value="plan-desc">Plano Z → A</SelectItem>
                  <SelectItem value="company-asc">Empresa A → Z</SelectItem>
                  <SelectItem value="company-desc">Empresa Z → A</SelectItem>
                  <SelectItem value="whatsapp-asc">WhatsApp A → Z</SelectItem>
                  <SelectItem value="whatsapp-desc">WhatsApp Z → A</SelectItem>
                  <SelectItem value="credits-desc">Créditos ↓</SelectItem>
                  <SelectItem value="credits-asc">Créditos ↑</SelectItem>
                  <SelectItem value="agendas-desc">Agendas ↓</SelectItem>
                  <SelectItem value="agendas-asc">Agendas ↑</SelectItem>
                  <SelectItem value="status-asc">Status A → Z</SelectItem>
                  <SelectItem value="status-desc">Status Z → A</SelectItem>
                  <SelectItem value="recent">Mais recentes ↓</SelectItem>
                  <SelectItem value="oldest">Mais antigos ↑</SelectItem>
                </SelectContent>
              </Select>
              <div className="hidden sm:flex border border-outline-variant rounded-xl overflow-hidden flex-shrink-0">
                <button onClick={() => setViewMode("grid")} className={cn("px-3 py-2 transition-colors", viewMode === "grid" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("list")} className={cn("px-3 py-2 transition-colors", viewMode === "list" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 mt-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 sm:pl-10 rounded-xl border-outline-variant text-sm"
              />
            </div>
            <div className="flex sm:hidden border border-outline-variant rounded-xl overflow-hidden flex-shrink-0">
              <button onClick={() => setViewMode("grid")} className={cn("px-2.5 py-2 transition-colors", viewMode === "grid" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-2 transition-colors", viewMode === "list" ? "bg-branding-primary text-white" : "hover:bg-surface-container-low")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card rounded-2xl p-4 sm:p-6 animate-pulse">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-outline-variant" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-outline-variant rounded w-3/4 mb-2" />
                    <div className="h-3 bg-outline-variant rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-8 sm:p-12 text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {search ? "Tente buscar por outro termo" : "Comece cadastrando seu primeiro cliente"}
            </p>
            {!search && (
              <Button
                onClick={() => setShowForm(true)}
                className="btn-branding rounded-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Cliente
              </Button>
            )}
          </div>
        ) : effectiveViewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedCustomers.map(customer => (
              <div key={customer.id} className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4 sm:p-6 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-base sm:text-lg font-semibold flex-shrink-0">
                      {customer.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-on-surface text-sm sm:text-base truncate">{customer.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-sm text-muted-foreground">{getPlanName(customer)}</p>
                        {customer.custom_plan && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Personalizado</span>
                        )}
                        {customer.guardian_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Dependente</span>
                        )}
                        {guardianIds.has(customer.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Responsável</span>
                        )}
                      </div>
                      {showCompanyColumn && (() => {
                        const compIds = customer.company_ids?.length ? customer.company_ids : (customer.company_id ? [customer.company_id] : (customer.companyId ? [customer.companyId] : []));
                        if (!compIds.length) return null;
                        return (
                          <p className="text-xs text-branding-primary flex items-center gap-1 mt-0.5">
                            {compIds.map(id => getCompanyName(id)).filter(Boolean).join(", ")}
                          </p>
                        );
                      })()}
                      {customer.guardian_id && (() => {
                        const g = customers.find(s => s.id === customer.guardian_id);
                        return g ? <p className="text-xs text-orange-600 mt-0.5">Resp: {g.name}</p> : null;
                      })()}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl(`CustomerDetail?id=${customer.id}`)}>
                          <ChevronLeft className="w-4 h-4 mr-2 rotate-180" />Ver resumo
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingCustomer(customer); setShowForm(true); }}>
                        <Edit className="w-4 h-4 mr-2" />Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDeletingCustomer(customer); setConfirmAction("delete"); }} className="text-error">
                        <Trash2 className="w-4 h-4 mr-2" />Excluir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDeletingCustomer(customer); setConfirmAction("inactive"); }} className="text-orange-600">
                        <XCircle className="w-4 h-4 mr-2" />Mover para inativo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <Phone className="w-4 h-4 text-muted-foreground" />{customer.whatsapp || "-"}
                    </div>
                    {customer.portal_enabled && (
                    <div className="flex items-center gap-2 text-xs text-branding-primary">
                      <Users className="w-3.5 h-3.5" />
                      Portal ativo
                    </div>
                    )}
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-on-surface-variant">Créditos:</span>
                    </div>
                    <Badge className={cn("font-semibold", (customer.current_credits || 0) <= 1 ? "bg-error-container/20 text-error" : "bg-green-500/20 text-green-400")}>
                      {customer.current_credits || 0} serviço(s)
                    </Badge>
                  </div>
                  {(() => {
                    const stats = appointmentStats[customer.id];
                    if (!stats?.nextAppointment && !stats?.lastAppointment) return null;
                    return (
                      <div className="pt-2 border-t border-outline-variant/30 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Serviços: {stats.total} ({stats.present} presenças, {stats.absent} faltas)</span>
                        </div>
                        {stats.nextAppointment && (
                          <div className="flex items-center gap-2 text-xs text-branding-primary">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Próxima: {format(parseISO(stats.nextAppointment.date), "dd/MM")} às {stats.nextAppointment.start_time}</span>
                          </div>
                        )}
                        {stats.lastAppointment && !stats.nextAppointment && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Última: {format(parseISO(stats.lastAppointment.date), "dd/MM")}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-outline-variant/30 flex items-center justify-between">
                  <Badge variant="outline" className={cn(customer.status === "active" ? "border-green-400 text-green-400" : customer.status === "inactive" ? "border-outline text-muted-foreground" : "border-amber-500/70 text-amber-300")}>
                    {customer.status === "active" ? "Ativo" : customer.status === "inactive" ? "Inativo" : "Pendente"}
                  </Badge>
                  <Switch checked={customer.status === "active"} onCheckedChange={(checked) => toggleStatusMutation.mutate({ id: customer.id, status: checked ? "active" : "inactive" })} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}> <span className="inline-flex items-center gap-1">Cliente {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "plan-asc" ? "plan-desc" : "plan-asc")}><span className="inline-flex items-center gap-1">Plano {sortOrder === "plan-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "plan-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  {showCompanyColumn && <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "company-asc" ? "company-desc" : "company-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "company-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "company-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>}
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "whatsapp-asc" ? "whatsapp-desc" : "whatsapp-asc")}><span className="inline-flex items-center gap-1">WhatsApp {sortOrder === "whatsapp-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "whatsapp-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "credits-desc" ? "credits-asc" : "credits-desc")}><span className="inline-flex items-center gap-1">Créditos {sortOrder === "credits-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "credits-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "agendas-desc" ? "agendas-asc" : "agendas-desc")}><span className="inline-flex items-center gap-1">Agendas {sortOrder === "agendas-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "agendas-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="text-left px-4 py-3 font-medium text-on-surface-variant cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "status-asc" ? "status-desc" : "status-asc")}><span className="inline-flex items-center gap-1">Status {sortOrder === "status-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "status-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="text-right px-4 py-3 font-medium text-on-surface-variant">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {sortedCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {customer.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-medium text-on-surface">{customer.name}</span>
                        {customer.portal_enabled && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-branding-primary/10 text-branding-primary font-medium">Portal</span>
                        )}
                        </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-on-surface-variant">{getPlanName(customer)}</span>
                        {customer.custom_plan && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Personalizado</span>
                        )}
                        {customer.guardian_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Dependente</span>
                        )}
                        {guardianIds.has(customer.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Responsável</span>
                        )}
                      </div>
                    </td>
                    {showCompanyColumn && <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {(() => {
                        const compIds = customer.company_ids?.length ? customer.company_ids : (customer.company_id ? [customer.company_id] : (customer.companyId ? [customer.companyId] : []));
                        if (!compIds.length) return "-";
                        return compIds.map(id => getCompanyName(id)).filter(Boolean).join(", ");
                      })()}
                    </td>}
                    <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{customer.whatsapp || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("font-semibold", (customer.current_credits || 0) <= 1 ? "bg-error-container/20 text-error" : "bg-green-500/20 text-green-400")}>
                        {customer.current_credits || 0}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const stats = appointmentStats[customer.id];
                        if (!stats) return <span className="text-muted-foreground text-xs">-</span>;
                        return (
                          <div className="text-xs space-y-0.5">
                            <span className="text-on-surface-variant">{stats.total} serviços ({stats.present}P / {stats.absent}F)</span>
                            {stats.nextAppointment && (
                              <div className="text-branding-primary">
                                Próx: {format(parseISO(stats.nextAppointment.date), "dd/MM")} {stats.nextAppointment.start_time}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={customer.status === "active"} onCheckedChange={(checked) => toggleStatusMutation.mutate({ id: customer.id, status: checked ? "active" : "inactive" })} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`CustomerDetail?id=${customer.id}`)}>
                              <ChevronLeft className="w-4 h-4 mr-2 rotate-180" />Ver resumo
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingCustomer(customer); setShowForm(true); }}>
                            <Edit className="w-4 h-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDeletingCustomer(customer); setConfirmAction("delete"); }} className="text-error">
                            <Trash2 className="w-4 h-4 mr-2" />Excluir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDeletingCustomer(customer); setConfirmAction("inactive"); }} className="text-orange-600">
                            <XCircle className="w-4 h-4 mr-2" />Mover para inativo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Asaas Subscription Modal */}
        {subscriptionCustomer && (
          <AsaasSubscriptionModal
            customer={subscriptionCustomer}
            plans={plans}
            companyId={userCompanyIds[0]}
            onClose={() => {
              const customer = subscriptionCustomer;
              setSubscriptionCustomer(null);
              setScheduleCustomer(customer);
            }}
          />
        )}

        {/* Sugestão de agendamento */}
        <AlertDialog open={!!scheduleCustomer} onOpenChange={() => setScheduleCustomer(null)}>
          <AlertDialogContent className="rounded-2xl sm:max-w-sm">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <AlertDialogTitle>Agendar serviços?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                <strong>{scheduleCustomer?.name}</strong> foi cadastrado com sucesso! Deseja ir para a Agenda agora para agendar os serviços?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => { setScheduleCustomer(null); toast.success("Cliente cadastrado com sucesso!"); }}>
                Agora não
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl btn-branding"
                onClick={() => { setScheduleCustomer(null); navigate(createPageUrl("Schedule")); }}
              >
                <Calendar className="w-4 h-4 mr-2" />Ir para Agenda
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Action Confirmation */}
        <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction === "delete" ? "Excluir cliente?" : "Mover cliente para inativo?"}</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{deletingCustomer?.name}</strong> {confirmAction === "delete" ? "será excluído permanentemente." : "será movido para inativo e não aparecerá mais na lista de ativos."}
                {deletingCustomer?.asaas_subscription_id && (
                  <><br /><br />A assinatura ativa no Asaas também será cancelada.</>
                )}
                {confirmAction === "delete" && customers.some(s => s.guardian_id === deletingCustomer?.id) && (
                  <><br /><br />Dependentes vinculados serão desvinculados automaticamente.</>
                )}
                <br /><br />
                {confirmAction === "delete" ? "Essa ação não pode ser desfeita." : "O histórico de serviços e cobranças será mantido. Você pode reativar o cliente a qualquer momento."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmAction === "delete" ? deleteMutation.mutate(deletingCustomer) : inactivateMutation.mutate(deletingCustomer)}
                disabled={confirmAction === "delete" ? deleteMutation.isPending : inactivateMutation.isPending}
                className={confirmAction === "delete" ? "bg-error hover:bg-error/80 rounded-xl" : "bg-orange-600 hover:bg-orange-700 rounded-xl"}
              >
                {confirmAction === "delete"
                  ? (deleteMutation.isPending ? "Excluindo..." : "Excluir cliente")
                  : (inactivateMutation.isPending ? "Movendo..." : "Mover para inativo")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}