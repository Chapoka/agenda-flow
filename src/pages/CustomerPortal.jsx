import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/api/dbClient";
import { format, parseISO, isAfter, isBefore, startOfDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Droplets,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Loader2,
  ExternalLink,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const cancellationReasons = [
  { value: "medical", label: "Motivo Médico" },
  { value: "travel", label: "Viagem" },
  { value: "work", label: "Compromisso de Trabalho" },
  { value: "personal", label: "Assunto Pessoal" },
  { value: "other", label: "Outro" },
];

const TABS = [
  { id: "services", label: "Serviços", icon: Droplets },
  { id: "scheduled", label: "Agendadas", icon: Calendar },
  { id: "history", label: "Histórico", icon: History },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
];

export default function CustomerPortal() {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [dependents, setDependents] = useState([]);
  const [viewingCustomerId, setViewingCustomerId] = useState(null); // null = self
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plan, setPlan] = useState(null);
  const [services, setServices] = useState([]);
  const [salonInfo, setSalonInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("services");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-login: busca cliente pelo email do usuário autenticado
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const customers = await db.entities.Customer.filter({ email: session.user.email });
          const found = customers.find(s => s.portal_enabled === true || s.portalEnabled === true);
          if (found) {
            sessionStorage.setItem("portal_customer_id", found.id);
            await loadForCustomer(found);
          }
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    if (!loginEmail) { setLoginError("Informe seu e-mail."); return; }
    if (loginPassword !== "123456") { setLoginError("Senha incorreta."); return; }
    setLoggingIn(true);
    const normalizedEmail = loginEmail.trim().toLowerCase();
    const customers = await db.entities.Customer.filter({ email: normalizedEmail });
    if (customers.length === 0) {
      setLoginError("E-mail não encontrado. Verifique com seu profissional.");
      setLoggingIn(false);
      return;
    }
    const found = customers.find(s => s.portal_enabled === true || s.portalEnabled === true);
    if (!found) {
      setLoginError("Acesso ao portal não está liberado. Fale com seu profissional.");
      setLoggingIn(false);
      return;
    }
    // Atualiza o e-mail no cadastro se estiver vazio
    if (!found.email || found.email !== normalizedEmail) {
      await db.entities.Customer.update(found.id, { email: normalizedEmail });
    }
    sessionStorage.setItem("portal_customer_id", found.id);
    await loadForCustomer(found);
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("portal_customer_id");
    setCustomer(null);
    setDependents([]);
    setViewingCustomerId(null);
    setAppointments([]);
    setInvoices([]);
    setPlan(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    try { await supabase.auth.signOut(); } catch (_) {}
  };

  const loadForCustomer = async (foundCustomer) => {
    setCustomer(foundCustomer);
    // Busca dependentes (clientes onde guardian_id = foundCustomer.id)
    const deps = await db.entities.Customer.filter({ guardian_id: foundCustomer.id });
    setDependents(deps);
    setViewingCustomerId(null);
    await loadCustomerData(foundCustomer.id);
  };

  const loadCustomerData = async (customerId) => {
    const [customerAppointments, customerInvoices, targetCustomer, salonServices, companyData] = await Promise.all([
      db.entities.Appointment.filter({ customer_id: customerId }),
      db.entities.Invoice.filter({ customer_id: customerId }),
      db.entities.Customer.filter({ id: customerId }),
      db.entities.Service.list(),
      db.entities.Company.list(),
    ]);
    setAppointments(customerAppointments.sort((a, b) => a.date.localeCompare(b.date)));
    setInvoices(customerInvoices.sort((a, b) => b.due_date?.localeCompare(a.due_date) || 0));
    setServices(salonServices.filter(s => s.active !== false && s.type === "service"));
    if (companyData.length > 0) setSalonInfo(companyData[0]);
    // Atualiza o dependente nos arrays se for um dependente
    if (targetCustomer.length > 0) {
      const updated = targetCustomer[0];
      if (customerId === customer?.id) {
        setCustomer(updated);
      } else {
        setDependents((prev) => prev.map((d) => (d.id === customerId ? updated : d)));
      }
      if (updated.plan_id) {
        const plans = await db.entities.Plan.filter({ id: updated.plan_id });
        if (plans.length > 0) setPlan(plans[0]);
        else setPlan(null);
      } else {
        setPlan(null);
      }
    } else {
      setPlan(null);
    }
  };

  const switchToCustomer = (customerId) => {
    setViewingCustomerId(customerId);
    loadCustomerData(customerId);
  };

  const currentViewCustomer = viewingCustomerId
    ? dependents.find((d) => d.id === viewingCustomerId) || customer
    : customer;

  const today = startOfDay(new Date());
  const [nextAppointmentsMonth, setNextAppointmentsMonth] = useState(new Date());

  const scheduledAppointments = appointments.filter(
    (l) => isAfter(parseISO(l.date), today) && !["cancelled"].includes(l.status)
  );

  const nextAppointmentsMonthStart = startOfMonth(nextAppointmentsMonth);
  const nextAppointmentsMonthEnd = endOfMonth(nextAppointmentsMonth);
  const appointmentsInSelectedMonth = appointments.filter((l) => {
    const d = parseISO(l.date);
    return d >= nextAppointmentsMonthStart && d <= nextAppointmentsMonthEnd && !["cancelled"].includes(l.status);
  });

  const historyAppointments = appointments
    .filter((l) => isBefore(parseISO(l.date), today) || ["present", "absent", "cancelled"].includes(l.status))
    .reverse();

  const pendingInvoices = invoices.filter((inv) => inv.status === "pending" || inv.status === "overdue");

  const handleConfirmPresence = async (appointment) => {
    await db.entities.Appointment.update(appointment.id, { status: "confirmed" });
    toast.success("Presença confirmada!");
    const targetId = viewingCustomerId || customer?.id;
    if (targetId) await loadCustomerData(targetId);
  };

  const handleCancelAppointment = async () => {
    if (!cancelReason) {
      toast.error("Selecione o motivo do cancelamento");
      return;
    }
    setCancelling(true);
    const reasonLabel = cancellationReasons.find((r) => r.value === cancelReason)?.label || cancelReason;
    const fullReason = cancelDetails ? `${reasonLabel}: ${cancelDetails}` : reasonLabel;
    await db.entities.Appointment.update(cancellingAppointment.id, {
      status: "cancelled",
      cancellation_reason: fullReason,
    });
    toast.success("Serviço cancelado com sucesso");
    setShowCancelModal(false);
    setCancellingAppointment(null);
    setCancelReason("");
    setCancelDetails("");
    setCancelling(false);
    const targetId = viewingCustomerId || customer?.id;
    if (targetId) await loadCustomerData(targetId);
  };

  const statusLabel = {
    scheduled: "Agendada",
    confirmed: "Confirmada",
    present: "Presente",
    absent: "Falta",
    cancelled: "Cancelada",
  };

  const statusClass = {
    scheduled: "bg-blue-100 text-blue-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    present: "bg-emerald-100 text-emerald-700",
    absent: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  const invoiceStatusLabel = {
    pending: "Pendente",
    received: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado",
  };

  const invoiceStatusClass = {
    pending: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-branding-primary/5 via-white to-branding-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-branding-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!customer) {
    return (
      <div className="min-h-screen bg-background text-on-background font-body-md overflow-x-hidden flex items-center justify-center relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary-container/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-8 z-10 px-6">
          {/* Brand & Header */}
          <div className="text-center space-y-3 fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-surface border border-outline-variant/30 shadow-lg mb-4">
              <span
                className="material-symbols-outlined text-4xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                spa
              </span>
            </div>
            <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg gradient-text">
              Portal do Cliente
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Acesse seus serviços, histórico e pagamentos
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-surface p-6 sm:p-8 rounded-xl shadow-lg border border-outline-variant/20 fade-in-up delay-100">
            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/20 text-error text-sm border border-error-container/30 flex items-center gap-2">
                <span className="text-error text-xs font-bold">!</span>
                {loginError}
              </div>
            )}

            <div className="space-y-5">
              {/* Email Input */}
              <div className="space-y-1">
                <label className="block font-label-md text-label-md text-on-surface">E-mail</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-lg">mail</span>
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="block w-full pl-10 pr-3 py-3 bg-surface-container-highest border border-outline-variant/50 rounded-lg text-on-surface placeholder-outline focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="block font-label-md text-label-md text-on-surface">Senha</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-lg">lock</span>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="block w-full pl-10 pr-10 py-3 bg-surface-container-highest border border-outline-variant/50 rounded-lg text-on-surface placeholder-outline focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg font-label-md text-label-md text-white gradient-btn shadow-lg disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-2"
                >
                  {loggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loggingIn ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(10px);
          }
          .delay-100 { animation-delay: 100ms; }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .gradient-text {
            background: linear-gradient(to right, rgb(var(--salon-primary)), rgb(var(--salon-primary-hover)));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .gradient-btn {
            background: linear-gradient(135deg, rgb(var(--salon-primary)) 0%, rgb(var(--salon-primary-hover)) 100%);
            transition: all 0.2s ease-in-out;
          }
          .gradient-btn:hover {
            transform: scale(1.02);
            box-shadow: 0 0 15px rgb(var(--salon-primary) / 0.5);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-branding-primary/5 via-white to-branding-secondary/5">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-branding-primary/20">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Olá, {customer.name?.split(" ")[0]}!</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>

          {/* Dependent selector */}
          {dependents.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => switchToCustomer(customer.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  !viewingCustomerId
                    ? "bg-branding-primary text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                {customer.name?.split(" ")[0]}
              </button>
              {dependents.map((dep) => (
                <button
                  key={dep.id}
                  onClick={() => switchToCustomer(dep.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    viewingCustomerId === dep.id
                      ? "bg-branding-primary text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {dep.name?.split(" ")[0]}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>



        {/* Credits Card */}
        {currentViewCustomer?.id && (
          <div className="bg-gradient-to-br from-branding-primary to-branding-secondary rounded-3xl p-6 mb-6 shadow-lg shadow-branding-primary/20">
            <div className="text-center text-white">
              <p className="text-sm opacity-80 mb-1">
                {viewingCustomerId ? `Saldo de ${currentViewCustomer.name?.split(" ")[0]}` : "Seu saldo de serviços"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-bold">{currentViewCustomer.current_credits || 0}</span>
                <span className="text-lg opacity-80">de {plan?.session_count || 4}</span>
              </div>
              <p className="text-sm opacity-80 mt-2">{plan?.name || "Plano não definido"}</p>
            </div>
            {(currentViewCustomer.current_credits || 0) <= 1 && (
              <div className="mt-4 bg-white/20 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
                <p className="text-sm text-white">
                  Créditos acabando! Entre em contato para renovar.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Próximas Aulas por Mês */}
        <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-branding-primary" />
              Serviços de {format(nextAppointmentsMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setNextAppointmentsMonth((m) => subMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setNextAppointmentsMonth((m) => addMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {appointmentsInSelectedMonth.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum serviço neste mês</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {appointmentsInSelectedMonth.map((appointment) => (
                <div
                  key={appointment.id}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl px-2 py-2 min-w-[52px] w-[52px]",
                    statusClass[appointment.status] ? statusClass[appointment.status].replace("text-", "bg-").replace("bg-", "bg-") : "bg-branding-primary/10",
                    "bg-branding-primary/10"
                  )}
                >
                  <span className="text-sm font-bold text-branding-primary leading-none">
                    {format(parseISO(appointment.date), "dd")}
                  </span>
                  <span className="text-[10px] text-branding-primary/70 leading-none uppercase mt-0.5">
                    {format(parseISO(appointment.date), "MMM", { locale: ptBR })}
                  </span>
                  <span className="text-[10px] text-gray-600 font-medium mt-1 leading-none capitalize text-center">
                    {format(parseISO(appointment.date), "EEE", { locale: ptBR }).replace(".", "")}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-none mt-0.5">
                    {appointment.start_time}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-none">
                    {appointment.duration_mins}min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invoice alert */}
        {pendingInvoices.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <CreditCard className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-amber-900">
                  {pendingInvoices.length === 1 ? "Fatura Pendente" : `${pendingInvoices.length} Faturas Pendentes`}
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  R$ {pendingInvoices[0].value?.toFixed(2)}{" "}
                  {pendingInvoices[0].due_date && `• Vence em ${format(parseISO(pendingInvoices[0].due_date), "dd/MM")}`}
                </p>
                {pendingInvoices[0].asaas_url && (
                  <Button asChild size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700 rounded-xl">
                    <a href={pendingInvoices[0].asaas_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Pagar Agora
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Viewing label */}
        {viewingCustomerId && currentViewCustomer && (
          <div className="text-center mb-3">
            <Badge className="bg-branding-primary/10 text-branding-primary text-sm px-4 py-1.5">
              Visualizando dados de {currentViewCustomer.name}
            </Badge>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-5 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-branding-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Serviços Disponíveis */}
        {activeTab === "services" && (
          <div className="space-y-4">
            {salonInfo && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{salonInfo.branding_app_name || "Empresa"}</h3>
                {salonInfo.address && <p className="text-sm text-gray-500">{salonInfo.address}</p>}
                {salonInfo.phone && <p className="text-sm text-gray-500">Tel: {salonInfo.phone}</p>}
              </div>
            )}
            {services.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <Droplets className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhum serviço disponível</p>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                  <div key={svc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{svc.name}</p>
                      <p className="text-sm text-gray-500">
                        {Math.floor((svc.duration_mins || 0) / 60)}h{(svc.duration_mins || 0) % 60 > 0 ? ` ${(svc.duration_mins || 0) % 60}min` : ""} • {svc.category}
                      </p>
                    </div>
                    <span className="font-bold text-branding-primary">R$ {Number(svc.price || 0).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Aulas Agendadas */}
        {activeTab === "scheduled" && (
          <div className="space-y-3">
            {scheduledAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhum serviço agendado</p>
                <p className="text-sm text-gray-500 mt-1">Entre em contato para agendar seu próximo serviço</p>
              </div>
            ) : (
              scheduledAppointments.map((appointment) => (
                <div key={appointment.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {format(parseISO(appointment.date), "dd/MM")}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {format(parseISO(appointment.date), "EEEE", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{appointment.start_time}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{appointment.duration_mins} min</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-branding-primary/10 text-branding-primary">
                      {appointment.service_category ? appointment.service_category.charAt(0).toUpperCase() + appointment.service_category.slice(1) : "Serviço"}
                    </Badge>
                    <Badge className={statusClass[appointment.status] || "bg-gray-100 text-gray-500"}>
                      {statusLabel[appointment.status] || appointment.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleConfirmPresence(appointment)}
                      disabled={appointment.status === "confirmed"}
                      className="btn-branding rounded-xl h-11 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCancellingAppointment(appointment);
                        setShowCancelModal(true);
                      }}
                      className="rounded-xl h-11 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Histórico de Serviços */}
        {activeTab === "history" && (
          <div>
            {historyAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <History className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhum serviço no histórico</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                {historyAppointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          appointment.status === "present" ? "bg-emerald-100" :
                          appointment.status === "absent" ? "bg-red-100" : "bg-gray-100"
                        )}
                      >
                        {appointment.status === "present" ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : appointment.status === "absent" ? (
                          <XCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(appointment.date), "dd/MM/yyyy")}
                        </p>
                        <p className="text-sm text-gray-500">
                          {appointment.start_time} • {appointment.duration_mins} min •{" "}
                          {appointment.service_category ? appointment.service_category.charAt(0).toUpperCase() + appointment.service_category.slice(1) : "Serviço"}
                        </p>
                        {appointment.cancellation_reason && (
                          <p className="text-xs text-gray-500 mt-0.5">{appointment.cancellation_reason}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={statusClass[appointment.status] || "bg-gray-100 text-gray-500"}>
                      {statusLabel[appointment.status] || appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Histórico de Pagamentos */}
        {activeTab === "payments" && (
          <div>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <CreditCard className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma cobrança encontrada</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {invoice.plan_name || "Plano"}
                        </p>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">
                          R$ {invoice.value?.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {invoice.due_date
                            ? `Vencimento: ${format(parseISO(invoice.due_date), "dd/MM/yyyy")}`
                            : "Sem data de vencimento"}
                        </p>
                        {invoice.payment_date && (
                          <p className="text-sm text-emerald-600 mt-0.5">
                            Pago em: {format(parseISO(invoice.payment_date), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={invoiceStatusClass[invoice.status] || "bg-gray-100 text-gray-500"}>
                          {invoiceStatusLabel[invoice.status] || invoice.status}
                        </Badge>
                        {invoice.asaas_url && (invoice.status === "pending" || invoice.status === "overdue") && (
                          <a
                            href={invoice.asaas_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-branding-primary flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pagar
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle>Cancelar Serviço</DialogTitle>
            <DialogDescription>Por favor, informe o motivo do cancelamento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {cancellationReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={cancelDetails}
                onChange={(e) => setCancelDetails(e.target.value)}
                placeholder="Adicione uma observação..."
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancelDetails("");
                }}
                className="flex-1 rounded-xl"
                disabled={cancelling}
              >
                Voltar
              </Button>
              <Button
                onClick={handleCancelAppointment}
                disabled={cancelling || !cancelReason}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
              >
                {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}