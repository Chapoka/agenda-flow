import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, Droplets, Calendar, Clock, CheckCircle, XCircle,
  AlertTriangle, CreditCard, ExternalLink, History, FileText, User, Users, BookOpen, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DependentsTab from "@/components/customers/DependentsTab";
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
import { toast } from "sonner";

export default function CustomerDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const customerId = urlParams.get("id");

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plan, setPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [guardian, setGuardian] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedAppointments, setSelectedAppointments] = useState(new Set());
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    const load = async () => {
      const [customers, customerAppointments, customerInvoices, allPlans, allCompanies] = await Promise.all([
        db.entities.Customer.filter({ id: customerId }),
        db.entities.Appointment.filter({ customer_id: customerId }),
        db.entities.Invoice.filter({ customer_id: customerId }),
        db.entities.Plan.list(),
        db.entities.Company.list(),
      ]);
      const found = customers[0];
      setCustomer(found);
      setPlans(allPlans);
      setCompanies(allCompanies);
      setAppointments(customerAppointments.sort((a, b) => b.date.localeCompare(a.date)));
      setInvoices(customerInvoices.sort((a, b) => b.created_at?.localeCompare(a.created_at)));
      if (found?.plan_id) {
        const foundPlan = allPlans.find(p => p.id === found.plan_id);
        if (foundPlan) setPlan(foundPlan);
      }
      if (found?.guardian_id) {
        const guardians = await db.entities.Customer.filter({ id: found.guardian_id });
        if (guardians.length > 0) setGuardian(guardians[0]);
      }
      setLoading(false);
    };
    load();
  }, [customerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-branding-primary/5 flex items-center justify-center">
        <Droplets className="w-8 h-8 text-branding-primary animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-branding-primary/5 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-on-surface-variant">Cliente não encontrado</p>
          <Button variant="ghost" onClick={() => window.history.back()} className="mt-4">
            <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const nextAppointment = appointments.find(l =>
    isAfter(parseISO(l.date), startOfDay(new Date())) &&
    !["cancelled", "present", "absent"].includes(l.status)
  );

  const today = startOfDay(new Date());
  const futureAppointments = appointments.filter(l =>
    !["cancelled"].includes(l.status) &&
    parseISO(l.date) >= today
  ).sort((a, b) => a.date.localeCompare(b.date));
  const pastAppointments = appointments.filter(l =>
    ["cancelled"].includes(l.status) || parseISO(l.date) < today
  ).sort((a, b) => b.date.localeCompare(a.date));

  const handleCancelAppointment = async (appointmentId) => {
    await db.entities.Appointment.update(appointmentId, { status: "cancelled" });
  };

  const handleBulkCancel = async () => {
    const ids = [...selectedAppointments];
    for (const id of ids) {
      await db.entities.Appointment.update(id, { status: "cancelled" });
    }
    setSelectedAppointments(new Set());
  };

  const executeCancel = async () => {
    if (!cancelConfirm) return;
    setCancelling(true);
    if (cancelConfirm.type === "single") {
      await handleCancelAppointment(cancelConfirm.appointment.id);
      toast.success("Serviço cancelado");
    } else {
      await handleBulkCancel();
      toast.success(`${cancelConfirm.count} serviços cancelados`);
    }
    const updatedAppointments = await db.entities.Appointment.filter({ customer_id: customerId });
    setAppointments(updatedAppointments.sort((a, b) => b.date.localeCompare(a.date)));
    setCancelConfirm(null);
    setCancelling(false);
  };

  const toggleSelect = (appointmentId) => {
    setSelectedAppointments(prev => {
      const next = new Set(prev);
      if (next.has(appointmentId)) next.delete(appointmentId);
      else next.add(appointmentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAppointments.size === futureAppointments.length) {
      setSelectedAppointments(new Set());
    } else {
      setSelectedAppointments(new Set(futureAppointments.map(l => l.id)));
    }
  };

  const pendingInvoice = invoices.find(inv => inv.status === "pending");
  const totalPresent = appointments.filter(l => l.status === "present").length;
  const totalCancelled = appointments.filter(l => l.status === "cancelled").length;
  const totalAbsent = appointments.filter(l => l.status === "absent").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-branding-primary/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => window.history.back()} className="mb-4">
            <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-2xl font-bold">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">{customer.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn(
                  customer.status === "active" ? "border-green-400 text-green-400" :
                  customer.status === "inactive" ? "border-outline text-muted-foreground" :
                  "border-amber-500/70 text-on-surface-variant"
                )}>
                  {customer.status === "active" ? "Ativo" : customer.status === "inactive" ? "Inativo" : "Pendente"}
                </Badge>
                {plan && <span className="text-sm text-muted-foreground">{plan.name}</span>}
                {guardian && (
                  <Badge className="bg-surface-container-low text-on-surface border-outline-variant">
                    👤 Dependente de {guardian.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 mb-6 w-fit">
          {[
            { id: "overview", label: "Visão Geral", icon: User },
            { id: "appointments", label: "Serviços", icon: BookOpen },
            { id: "dependents", label: "Dependentes", icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-card text-branding-primary shadow-sm" : "text-muted-foreground hover:text-on-surface"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dependents" && (
          <DependentsTab guardian={customer} plans={plans} companies={companies} />
        )}

        {activeTab === "appointments" && (
          <div className="space-y-6">
            {/* Future Appointments */}
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
                <h3 className="font-semibold text-on-surface flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-branding-primary" /> Serviços Futuros
                  <Badge variant="secondary" className="ml-1 text-xs">{futureAppointments.length}</Badge>
                </h3>
                {futureAppointments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-muted-foreground hover:text-branding-primary transition-colors"
                    >
                      {selectedAppointments.size === futureAppointments.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                    {selectedAppointments.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCancelConfirm({ type: "bulk", count: selectedAppointments.size })}
                        className="h-8 text-xs rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Cancelar ({selectedAppointments.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {futureAppointments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum serviço agendado</div>
              ) : (
                <div className="divide-y divide-outline-variant/30 max-h-80 overflow-y-auto">
                  {futureAppointments.map(appointment => (
                    <div key={appointment.id} className={cn("p-4 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors", selectedAppointments.has(appointment.id) && "bg-primary-container/20")}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedAppointments.has(appointment.id)}
                          onCheckedChange={() => toggleSelect(appointment.id)}
                          className="rounded"
                        />
                        <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">
                            {format(parseISO(appointment.date), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.start_time} • {appointment.duration_mins}min • {" "}
                             {(appointment.service_category || appointment.modality) ? (appointment.service_category || appointment.modality).charAt(0).toUpperCase() + (appointment.service_category || appointment.modality).slice(1) : "Serviço"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs",
                          appointment.status === "confirmed" ? "bg-primary-container/20 text-primary" : "bg-surface-container-low text-on-surface-variant"
                        )}>
                          {appointment.status === "confirmed" ? "Confirmada" : "Agendada"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/100/10 rounded-lg"
                          onClick={() => setCancelConfirm({ type: "single", appointment })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Appointments */}
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/30">
                <h3 className="font-semibold text-on-surface flex items-center gap-2">
                  <History className="w-4 h-4 text-branding-secondary" /> Histórico de Serviços
                </h3>
              </div>
              {pastAppointments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum serviço no histórico</div>
              ) : (
                <div className="divide-y divide-outline-variant/30 max-h-80 overflow-y-auto">
                  {pastAppointments.map(appointment => (
                    <div key={appointment.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
                          appointment.status === "present" ? "bg-green-500/20" :
                          appointment.status === "absent" ? "bg-error-container/20" :
                          appointment.status === "cancelled" ? "bg-surface-container-low" : "bg-primary-container/20"
                        )}>
                          {appointment.status === "present" ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                           appointment.status === "absent" ? <XCircle className="w-4 h-4 text-error" /> :
                           appointment.status === "cancelled" ? <XCircle className="w-4 h-4 text-muted-foreground" /> :
                           <Calendar className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">
                            {format(parseISO(appointment.date), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.start_time} • {appointment.duration_mins}min • {" "}
                             {(appointment.service_category || appointment.modality) ? (appointment.service_category || appointment.modality).charAt(0).toUpperCase() + (appointment.service_category || appointment.modality).slice(1) : "Serviço"}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("text-xs",
                        appointment.status === "present" ? "bg-green-500/20 text-green-400" :
                        appointment.status === "absent" ? "bg-error-container/20 text-error" :
                        appointment.status === "cancelled" ? "bg-surface-container-low text-muted-foreground" :
                        appointment.status === "confirmed" ? "bg-primary-container/20 text-primary" :
                        "bg-surface-container-low text-on-surface-variant"
                      )}>
                        {appointment.status === "present" ? "Presente" :
                         appointment.status === "absent" ? "Falta" :
                         appointment.status === "cancelled" ? "Cancelada" :
                         appointment.status === "confirmed" ? "Confirmada" : "Agendada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!cancelConfirm} onOpenChange={() => setCancelConfirm(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {cancelConfirm?.type === "single" ? "Cancelar serviço?" : "Cancelar serviços selecionados?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {cancelConfirm?.type === "single" ? (
                  <>O serviço de <strong>{cancelConfirm.appointment.start_time}</strong> do dia{" "}
                    <strong>{cancelConfirm.appointment.date ? format(parseISO(cancelConfirm.appointment.date), "dd/MM/yyyy") : ""}</strong> será cancelada.</>
                ) : (
                  <><strong>{cancelConfirm?.count}</strong> serviço(s) serão cancelados. Esta ação não pode ser desfeita.</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" disabled={cancelling}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); executeCancel(); }} disabled={cancelling} className="bg-error hover:bg-error/80 rounded-xl disabled:opacity-50">
                {cancelling ? "Cancelando..." : "Sim, cancelar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Credits */}
            <div className="bg-gradient-to-br from-branding-primary to-branding-secondary rounded-2xl p-5 text-white">
              <p className="text-sm opacity-80 mb-1">Saldo de serviços</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">{customer.current_credits || 0}</span>
                <span className="opacity-70 mb-1">de {plan?.session_count || "?"}</span>
              </div>
              {(customer.current_credits || 0) <= 1 && (
                <div className="mt-3 bg-card/20 rounded-xl p-2 flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
                  Créditos acabando!
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4 space-y-3">
              <h3 className="font-semibold text-on-surface text-sm">Frequência</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Presenças</span>
                <span className="font-medium text-green-400">{totalPresent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Faltas</span>
                <span className="font-medium text-red-400">{totalAbsent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cancelamentos</span>
                <span className="font-medium text-muted-foreground">{totalCancelled}</span>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4 space-y-2">
              <h3 className="font-semibold text-on-surface text-sm mb-3">Contato</h3>
              {customer.whatsapp && <p className="text-sm text-on-surface-variant">📱 {customer.whatsapp}</p>}
              {customer.email && <p className="text-sm text-on-surface-variant">✉️ {customer.email}</p>}
              {customer.cpf && <p className="text-sm text-on-surface-variant">🪪 {customer.cpf}</p>}
              {customer.birth_date && <p className="text-sm text-on-surface-variant">🎂 {format(parseISO(customer.birth_date), "dd/MM/yyyy")}</p>}
            </div>

            {/* Document */}
            {customer.medical_certificate_url && (
              <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4">
                <h3 className="font-semibold text-on-surface text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Atestado Médico
                </h3>
                <a href={customer.medical_certificate_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-branding-primary hover:underline">
                  <ExternalLink className="w-4 h-4" /> Ver documento
                </a>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending invoice */}
            {pendingInvoice && (
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <div className="flex-1">
                    <p className="font-medium text-on-surface">Fatura Pendente</p>
                    <p className="text-sm text-on-surface-variant">
                      R$ {pendingInvoice.value?.toFixed(2)} • Vence {pendingInvoice.due_date ? format(parseISO(pendingInvoice.due_date), "dd/MM") : "N/A"}
                    </p>
                  </div>
                  {pendingInvoice.asaas_url && (
                    <a href={pendingInvoice.asaas_url} target="_blank" rel="noopener noreferrer"
                      className="text-on-surface-variant hover:text-amber-200">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Next appointment */}
            {nextAppointment && (
              <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-5">
                <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-branding-primary" /> Próximo Serviço
                </h3>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xl font-bold text-on-surface">{format(parseISO(nextAppointment.date), "dd/MM")}</p>
                    <p className="text-sm text-muted-foreground capitalize">{format(parseISO(nextAppointment.date), "EEEE", { locale: ptBR })}</p>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{nextAppointment.start_time}</span>
                  </div>
                  <Badge className="bg-branding-primary/10 text-branding-primary">
                    {(nextAppointment.service_category || nextAppointment.modality) ? (nextAppointment.service_category || nextAppointment.modality).charAt(0).toUpperCase() + (nextAppointment.service_category || nextAppointment.modality).slice(1) : "Serviço"}
                  </Badge>
                </div>
              </div>
            )}

            {/* Invoices */}
            <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/30">
                <h3 className="font-semibold text-on-surface flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-branding-primary" /> Cobranças
                </h3>
              </div>
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma cobrança registrada</div>
              ) : (
                <div className="divide-y divide-outline-variant/30 max-h-64 overflow-y-auto">
                  {invoices.map(inv => (
                    <div key={inv.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-on-surface">R$ {inv.value?.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {inv.due_date ? format(parseISO(inv.due_date), "dd/MM/yyyy") : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs",
                          inv.status === "received" ? "bg-green-500/20 text-green-400" :
                          inv.status === "pending" ? "bg-amber-500/20 text-on-surface-variant" :
                          inv.status === "overdue" ? "bg-error-container/20 text-error" :
                          "bg-surface-container-low text-muted-foreground"
                        )}>
                          {inv.status === "received" ? "Pago" :
                           inv.status === "pending" ? "Pendente" :
                           inv.status === "overdue" ? "Vencido" : "Cancelado"}
                        </Badge>
                        {inv.asaas_url && (
                          <a href={inv.asaas_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-branding-primary">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
