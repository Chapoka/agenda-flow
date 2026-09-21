import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/api/dbClient";
import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isAfter, isBefore } from "date-fns";
import { LayoutGrid, List } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    db.auth.me().then(u => { setCurrentUser(u); setUserReady(true); }).catch(() => setUserReady(true));
  }, []);

  const rawRole = currentUser?.role;
  const normalizedRole = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const isSuperAdmin = normalizedRole === "super_admin";
  const isProfissional = normalizedRole === "profissional";
  const companyId = currentUser?.company_ids?.length ? currentUser.company_ids[0] : (currentUser?.company_id || null);

  if (!userReady) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-branding animate-spin">progress_activity</span>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminDashboard currentUser={currentUser} />;
  }

  return <SalonDashboard currentUser={currentUser} isProfissional={isProfissional} companyId={companyId} />;
}

/* ──────────────────────────────────────────────────────
   SUPER ADMIN DASHBOARD — métricas globais
   ────────────────────────────────────────────────────── */
function SuperAdminDashboard({ currentUser }) {
  const navigate = useNavigate();
  const now = new Date();
  const [companyView, setCompanyView] = useState("grid");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users-dashboard"],
    queryFn: () => db.entities.User.list(),
  });

  const { data: dashboardUserCompanies = [] } = useQuery({
    queryKey: ["user-companies-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("user_companies").select("user_id, company_id");
      return data || [];
    },
  });
  const dashboardUserCompanyMap = {};
  dashboardUserCompanies.forEach(uc => {
    if (!dashboardUserCompanyMap[uc.user_id]) dashboardUserCompanyMap[uc.user_id] = [];
    dashboardUserCompanyMap[uc.user_id].push(uc.company_id);
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-sa"],
    queryFn: () => db.entities.Customer.list(),
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices-all"],
    queryFn: () => db.entities.Invoice.list(),
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: ["appointments-sa"],
    queryFn: () => db.entities.Appointment.list("-date", 200),
  });

  const { data: customerCompanies = [] } = useQuery({
    queryKey: ["customer-companies-sa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_companies").select("customer_id, company_id");
      if (error) throw error;
      return data || [];
    },
  });

  const todaySchedule = allAppointments
    .filter(l => l.date === format(now, "yyyy-MM-dd"))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const periodRange = { start: startOfMonth(now), end: endOfMonth(now) };

  const totalCompanies = companies.filter(c => c.active !== false).length;
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(s => s.status === "active").length;
  const totalProfessionals = allUsers.filter(u => {
    const isProf = (u.role === "profissional" || u.role === "teacher" || u.is_professional === true) && u.active !== false;
    return isProf;
  }).length;

  const totalRevenue = allInvoices
    .filter(inv => {
      if (!inv.payment_date || inv.status !== "received") return false;
      const payDate = parseISO(inv.payment_date);
      return isAfter(payDate, periodRange.start) && isBefore(payDate, periodRange.end);
    })
    .reduce((sum, inv) => sum + (inv.value || 0), 0);

  const pendingInvoices = allInvoices.filter(inv => inv.status === "pending");

  const overdueInvoices = allInvoices.filter(inv => {
    if (inv.status !== "pending" || !inv.due_date) return false;
    return parseISO(inv.due_date) < now;
  });

  const lowCreditCustomers = customers.filter(s =>
    s.status === "active" && (s.current_credits || 0) <= 1 && s.current_credits !== undefined
  );

  const todayStr = format(now, "MM-dd");
  const birthdayCustomers = customers.filter(s => {
    if (!s.birth_date) return false;
    return format(parseISO(s.birth_date), "MM-dd") === todayStr;
  });

  const companyToCustomerIds = {};
  customerCompanies.forEach(cc => {
    if (!companyToCustomerIds[cc.company_id]) companyToCustomerIds[cc.company_id] = new Set();
    companyToCustomerIds[cc.company_id].add(cc.customer_id);
  });

  const companyStats = companies.filter(c => c.active !== false).map(company => {
    const junctionIds = companyToCustomerIds[company.id] || new Set();
    const coCustomers = customers.filter(s => junctionIds.has(s.id) || s.company_id === company.id);
    const coCustomerIds = new Set(coCustomers.map(s => s.id));
    const coInvoices = allInvoices.filter(inv => coCustomerIds.has(inv.customer_id));
    const coRevenue = coInvoices
      .filter(inv => {
        if (!inv.payment_date || inv.status !== "received") return false;
        const payDate = parseISO(inv.payment_date);
        return isAfter(payDate, periodRange.start) && isBefore(payDate, periodRange.end);
      })
      .reduce((sum, inv) => sum + (inv.value || 0), 0);
    return {
      ...company,
      customerCount: coCustomers.length,
      activeCustomers: coCustomers.filter(s => s.status === "active").length,
      teacherCount: allUsers.filter(u => {
        const isProf = (u.role === "profissional" || u.role === "teacher" || u.is_professional === true) && u.active !== false;
        const uIds = dashboardUserCompanyMap[u.id] || (u.company_ids || (u.company_id ? [u.company_id] : []));
        return isProf && uIds.includes(company.id);
      }).length,
      monthlyRevenue: coRevenue,
      pendingInvoices: coInvoices.filter(inv => inv.status === "pending").length,
    };
  }).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">

        {/* GREETING */}
        <div className="mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-text-main">
            {greeting}, {currentUser?.full_name || currentUser?.email || "Usuário"}
          </h1>
          <p className="text-text-muted mt-1">Visão geral de todas as empresas</p>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Total Empresas */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-branding p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Total de Empresas</p>
                <h3 className="text-3xl font-extrabold text-text-main">{totalCompanies}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-branding/10 flex items-center justify-center text-branding">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>store</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-branding">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>de {companies.length} total</span>
            </div>
          </div>

          {/* Faturamento Mensal */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-salon-success p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Faturamento Mensal</p>
                <h3 className="text-2xl lg:text-3xl font-extrabold text-text-main">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-salon-success/10 flex items-center justify-center text-salon-success">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-salon-success">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>este mês</span>
            </div>
          </div>

          {/* Total Clientes */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-salon-info p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Total de Clientes</p>
                <h3 className="text-3xl font-extrabold text-text-main">{activeCustomers}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-salon-info/10 flex items-center justify-center text-salon-info">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-text-muted">
              <span className="material-symbols-outlined text-sm">group</span>
              <span>de {totalCustomers} total</span>
            </div>
          </div>

          {/* Profissionais Ativos */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-[#c084fc] p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Profissionais Ativos</p>
                <h3 className="text-3xl font-extrabold text-text-main">{totalProfessionals}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc]">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-text-muted">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>todas as empresas</span>
            </div>
          </div>
        </div>

        {/* RESUMO POR EMPRESA */}
        {companyStats.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-main">Resumo por Empresa</h2>
              <div className="flex rounded-xl overflow-hidden flex-shrink-0 border border-border">
                <button onClick={() => setCompanyView("grid")} className={cn(
                  "px-3 py-2 transition-colors",
                  companyView === "grid" ? "bg-branding/10 text-text-main" : "text-text-muted hover:bg-surface-hover"
                )}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setCompanyView("list")} className={cn(
                  "px-3 py-2 transition-colors",
                  companyView === "list" ? "bg-branding/10 text-text-main" : "text-text-muted hover:bg-surface-hover"
                )}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {companyView === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {companyStats.map(company => (
                  <div key={company.id} className="bg-surface rounded-xl shadow-md border border-border p-5 hover:border-branding/30 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-branding/10 flex items-center justify-center text-branding">
                        <span className="material-symbols-outlined">store</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-main truncate">{company.name}</p>
                        <p className="text-xs text-text-muted">{company.active ? "Ativa" : "Inativa"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-hover rounded-lg p-3 text-center">
                        <span className="material-symbols-outlined text-branding text-sm block mb-1">group</span>
                        <p className="text-xl font-bold text-text-main">{company.activeCustomers}</p>
                        <p className="text-xs text-text-muted">Clientes</p>
                      </div>
                      <div className="bg-surface-hover rounded-lg p-3 text-center">
                        <span className="material-symbols-outlined text-salon-success text-sm block mb-1">payments</span>
                        <p className="text-sm font-bold text-salon-success">
                          R$ {company.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-text-muted">Faturamento</p>
                      </div>
                      <div className="bg-surface-hover rounded-lg p-3 text-center">
                        <span className="material-symbols-outlined text-[#c084fc] text-sm block mb-1">group</span>
                        <p className="text-xl font-bold text-text-main">{company.teacherCount}</p>
                        <p className="text-xs text-text-muted">Profissionais</p>
                      </div>
                      <div className="bg-surface-hover rounded-lg p-3 text-center">
                        <span className="material-symbols-outlined text-salon-error text-sm block mb-1">receipt_long</span>
                        <p className="text-xl font-bold text-text-main">{company.pendingInvoices}</p>
                        <p className="text-xs text-text-muted">Pendências</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden bg-surface border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="text-left px-5 py-3 font-semibold text-text-muted">Empresa</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-muted hidden sm:table-cell">Clientes</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-muted hidden md:table-cell">Profissionais</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-muted hidden lg:table-cell">Faturamento</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-muted hidden sm:table-cell">Pendências</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyStats.map(company => (
                        <tr key={company.id} className="transition-colors border-b border-border hover:bg-surface-hover">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-branding/10">
                                <span className="material-symbols-outlined text-branding text-sm">store</span>
                              </div>
                              <span className="font-medium text-text-main">{company.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center hidden sm:table-cell">
                            <span className="font-bold text-text-main">{company.activeCustomers}</span>
                            <span className="text-xs ml-1 text-text-muted">/ {company.customerCount}</span>
                          </td>
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            <span className="font-bold text-text-main">{company.teacherCount}</span>
                          </td>
                          <td className="px-4 py-4 text-center hidden lg:table-cell">
                            <span className="font-bold text-salon-success">
                              R$ {company.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center hidden sm:table-cell">
                            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              company.pendingInvoices > 0 ? "bg-salon-error/10 text-salon-error" : "bg-salon-success/10 text-salon-success"
                            )}>
                              {company.pendingInvoices}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              company.active ? "bg-salon-success/10 text-salon-success" : "bg-surface-container text-text-muted"
                            )}>
                              {company.active ? "Ativa" : "Inativa"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas */}
          <div className="bg-surface rounded-xl shadow-md border border-border p-5">
            <h3 className="text-lg font-semibold text-text-main mb-4">Alertas</h3>
            <div className="space-y-3">
              {overdueInvoices.length === 0 && lowCreditCustomers.length === 0 && birthdayCustomers.length === 0 ? (
                <div className="p-3 bg-salon-success/10 border border-salon-success/20 rounded-lg flex items-start gap-3">
                  <span className="material-symbols-outlined text-salon-success">check_circle</span>
                  <div>
                    <p className="font-medium text-text-main">Tudo em ordem!</p>
                    <p className="text-sm text-text-muted">Nenhum alerta no momento</p>
                  </div>
                </div>
              ) : (
                <>
                  {overdueInvoices.slice(0, 3).map(invoice => (
                    <div
                      key={invoice.id}
                      className="flex items-start gap-3 p-3 bg-salon-error/5 border border-salon-error/20 rounded-lg cursor-pointer hover:border-salon-error/50 transition-colors"
                      onClick={() => navigate(createPageUrl("Invoices"))}
                    >
                      <span className="material-symbols-outlined text-salon-error">error</span>
                      <div>
                        <p className="font-medium text-text-main">{invoice.customer_name || "Cobrança"}</p>
                        <p className="text-sm text-salon-error">
                          R$ {invoice.value?.toFixed(2)} — Vencida em {invoice.due_date ? format(parseISO(invoice.due_date), "dd/MM") : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {lowCreditCustomers.slice(0, 3).map(customer => (
                    <div
                      key={customer.id}
                      className="flex items-start gap-3 p-3 bg-salon-warning/5 border border-salon-warning/20 rounded-lg cursor-pointer hover:border-salon-warning/50 transition-colors"
                      onClick={() => navigate(createPageUrl(`Clientes?id=${customer.id}`))}
                    >
                      <span className="material-symbols-outlined text-salon-warning">warning</span>
                      <div>
                        <p className="font-medium text-text-main">{customer.name}</p>
                        <p className="text-sm text-salon-warning">
                          Plano para renovar — {customer.current_credits || 0} crédito(s)
                        </p>
                      </div>
                    </div>
                  ))}
                  {birthdayCustomers.slice(0, 2).map(customer => (
                    <div
                      key={customer.id}
                      className="flex items-start gap-3 p-3 bg-salon-info/5 border border-salon-info/20 rounded-lg cursor-pointer hover:border-salon-info/50 transition-colors"
                      onClick={() => navigate(createPageUrl(`Clientes?id=${customer.id}`))}
                    >
                      <span className="material-symbols-outlined text-salon-info">cake</span>
                      <div>
                        <p className="font-medium text-text-main">{customer.name}</p>
                        <p className="text-sm text-salon-info">Aniversário hoje!</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Agenda de Hoje */}
          <div className="bg-surface rounded-xl shadow-md border border-border p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text-main">Agenda de Hoje</h3>
              <button
                className="text-sm font-medium text-branding hover:underline"
                onClick={() => navigate(createPageUrl("Schedule"))}
              >
                Ver completa
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {todaySchedule.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-5xl text-text-muted block mb-2 opacity-40">event_busy</span>
                    <p className="text-sm text-text-muted">Nenhum agendamento para hoje</p>
                  </div>
                </div>
              ) : (
                todaySchedule.slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => navigate(createPageUrl("Schedule?view=day"))}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-branding/20 text-branding flex items-center justify-center font-bold text-sm">
                        {appointment.customer_name?.charAt(0) || "C"}
                      </div>
                      <div>
                        <p className="font-medium text-text-main">{appointment.customer_name}</p>
                        <p className="text-sm text-text-muted">{appointment.start_time}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                      appointment.status === "confirmed" && "bg-branding/20 text-branding",
                      appointment.status === "present" && "bg-salon-success/20 text-salon-success",
                      !["confirmed", "present"].includes(appointment.status) && "bg-surface-hover text-text-muted border border-border"
                    )}>
                      {appointment.status === "confirmed" ? "Confirmado" :
                       appointment.status === "present" ? "Presente" : "Agendado"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   SALON DASHBOARD — Admin + Profissional
   ────────────────────────────────────────────────────── */
function SalonDashboard({ currentUser, isProfissional, companyId }) {
  const navigate = useNavigate();
  const now = new Date();

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", companyId, isProfissional],
    queryFn: () => companyId
      ? db.entities.Customer.filter({ company_id: companyId })
      : db.entities.Customer.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users-salon"],
    queryFn: () => db.entities.User.list(),
  });

  const { data: salonUserCompanies = [] } = useQuery({
    queryKey: ["user-companies-salon"],
    queryFn: async () => {
      const { data } = await supabase.from("user_companies").select("user_id, company_id");
      return data || [];
    },
  });
  const salonUserCompanyMap = {};
  salonUserCompanies.forEach(uc => {
    if (!salonUserCompanyMap[uc.user_id]) salonUserCompanyMap[uc.user_id] = [];
    salonUserCompanyMap[uc.user_id].push(uc.company_id);
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices-salon"],
    queryFn: () => db.entities.Invoice.list(),
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: ["appointments-salon"],
    queryFn: () => db.entities.Appointment.list("-date", 200),
  });

  const customerIds = customers.map(s => s.id);
  const customerIdSet = new Set(customerIds);

  const invoices = companyId
    ? allInvoices.filter(inv => customerIdSet.has(inv.customer_id) || inv.company_id === companyId)
    : allInvoices;

  const appointments = companyId
    ? allAppointments.filter(l => customerIdSet.has(l.customer_id) || l.company_id === companyId)
    : allAppointments;

  const activeCustomers = customers.filter(s => s.status === "active").length;
  const activeProfessionals = allUsers.filter(u => {
    const isProf = (u.role === "profissional" || u.role === "teacher" || u.is_professional === true) && u.active !== false;
    const uIds = salonUserCompanyMap[u.id] || (u.company_ids || (u.company_id ? [u.company_id] : []));
    return isProf && (!companyId || uIds.includes(companyId));
  }).length;

  const periodRange = { start: startOfMonth(now), end: endOfMonth(now) };

  const monthlyRevenue = invoices
    .filter(inv => {
      if (!inv.payment_date || inv.status !== "received") return false;
      const payDate = parseISO(inv.payment_date);
      return isAfter(payDate, periodRange.start) && isBefore(payDate, periodRange.end);
    })
    .reduce((sum, inv) => sum + (inv.value || 0), 0);

  const todayAppointments = appointments.filter(l => l.date === format(now, "yyyy-MM-dd")).length;

  const lowCreditCustomers = customers.filter(s =>
    s.status === "active" && (s.current_credits || 0) <= 1
  );

  const pendingInvoices = invoices.filter(inv => inv.status === "pending");

  const overdueInvoices = invoices.filter(inv => {
    if (inv.status !== "pending" || !inv.due_date) return false;
    return parseISO(inv.due_date) < now;
  });

  const todayStr = format(now, "MM-dd");
  const birthdayCustomers = customers.filter(s => {
    if (!s.birth_date) return false;
    return format(parseISO(s.birth_date), "MM-dd") === todayStr;
  });

  const todaySchedule = appointments
    .filter(l => l.date === format(now, "yyyy-MM-dd"))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nextAppointment = todaySchedule.find(a => a.start_time > format(now, "HH:mm"));

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const rev = invoices
        .filter(inv => {
          if (!inv.payment_date || inv.status !== "received") return false;
          const payDate = parseISO(inv.payment_date);
          return isAfter(payDate, start) && isBefore(payDate, end);
        })
        .reduce((sum, inv) => sum + (inv.value || 0), 0);
      months.push({ label: format(d, "MMM"), value: rev });
    }
    return months;
  }, [invoices]);

  const chartMax = Math.max(...chartData.map(m => m.value), 1);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">

        {/* Greeting */}
        <div className="mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-on-surface">
            Olá, {currentUser?.full_name || currentUser?.email?.split("@")[0] || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Seja bem-vindo!</p>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Total de Clientes */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-branding p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Total de Clientes</p>
                <h3 className="text-3xl font-extrabold text-text-main">{activeCustomers}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-branding/10 flex items-center justify-center text-branding">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-branding">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>de {customers.length} total</span>
            </div>
          </div>

          {/* Faturamento Mensal */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-salon-success p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Faturamento Mensal</p>
                <h3 className="text-2xl lg:text-3xl font-extrabold text-text-main">
                  R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-salon-success/10 flex items-center justify-center text-salon-success">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-salon-success">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>este mês</span>
            </div>
          </div>

          {/* Agendamentos Hoje */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-salon-info p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Agendamentos Hoje</p>
                <h3 className="text-3xl font-extrabold text-text-main">{todayAppointments}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-salon-info/10 flex items-center justify-center text-salon-info">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-text-muted">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>{nextAppointment ? `Próximo às ${nextAppointment.start_time}` : "Nenhum agendado"}</span>
            </div>
          </div>

          {/* Profissionais Ativos */}
          <div className="bg-surface rounded-xl shadow-md border-l-4 border-l-[#c084fc] p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Profissionais Ativos</p>
                <h3 className="text-3xl font-extrabold text-text-main">{activeProfessionals}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc]">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-text-muted">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Todos presentes</span>
            </div>
          </div>
        </div>

        {/* MIDDLE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart Area */}
          <div className="lg:col-span-7 bg-surface rounded-xl shadow-md border border-border p-5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-text-main">Faturamento dos Últimos 6 Meses</h3>
            </div>
            <div className="flex-1 relative min-h-[250px] w-full rounded-lg overflow-hidden bg-bg border border-border">
              <div className="absolute bottom-0 left-0 w-full h-[80%] flex items-end justify-between px-4 pb-2">
                <div className="w-full h-full relative">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="salonChartGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--salon-primary))" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="rgb(var(--salon-primary))" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      fill="url(#salonChartGrad)"
                      points={chartData.map((m, i) => {
                        const x = (i / (chartData.length - 1)) * 100;
                        const y = 100 - (m.value / chartMax) * 80;
                        return `${x},${y}`;
                      }).join(" ") + " 100,100 0,100"}
                    />
                    <polyline
                      fill="none"
                      points={chartData.map((m, i) => {
                        const x = (i / (chartData.length - 1)) * 100;
                        const y = 100 - (m.value / chartMax) * 80;
                        return `${x},${y}`;
                      }).join(" ")}
                      stroke="rgb(var(--salon-primary))"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                    {chartData.map((m, i) => {
                      const x = (i / (chartData.length - 1)) * 100;
                      const y = 100 - (m.value / chartMax) * 80;
                      return <circle key={i} cx={x} cy={y} r="2" fill="rgb(var(--salon-primary))" />;
                    })}
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full flex justify-between px-6 text-xs text-text-muted border-t border-border pt-2">
                {chartData.map((m, i) => <span key={i}>{m.label}</span>)}
              </div>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="lg:col-span-5 bg-surface rounded-xl shadow-md border border-border p-5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-text-main">Próximos Agendamentos</h3>
              <button
                className="text-sm font-medium text-branding hover:underline"
                onClick={() => navigate(createPageUrl("Schedule"))}
              >
                Ver todos
              </button>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              {todaySchedule.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-5xl text-text-muted block mb-2 opacity-40">event_busy</span>
                    <p className="text-sm text-text-muted">Nenhum agendamento para hoje</p>
                  </div>
                </div>
              ) : (
                todaySchedule.slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => navigate(createPageUrl("Schedule?view=day"))}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-branding/20 text-branding flex items-center justify-center font-bold text-sm">
                        {appointment.customer_name?.charAt(0) || "C"}
                      </div>
                      <div>
                        <p className="font-medium text-text-main">{appointment.customer_name}</p>
                        <p className="text-sm text-text-muted">
                          {appointment.service_category ? appointment.service_category.charAt(0).toUpperCase() + appointment.service_category.slice(1) : "Serviço"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-text-main">{appointment.start_time}</p>
                      <span className={cn(
                        "inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                        appointment.status === "confirmed" && "bg-branding/20 text-branding",
                        appointment.status === "present" && "bg-salon-success/20 text-salon-success",
                        appointment.status === "absent" && "bg-salon-error/20 text-salon-error",
                        !["confirmed", "present", "absent"].includes(appointment.status) && "bg-surface-hover text-text-muted border border-border"
                      )}>
                        {appointment.status === "confirmed" ? "Confirmado" :
                         appointment.status === "present" ? "Presente" :
                         appointment.status === "absent" ? "Falta" : "Pendente"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas */}
          <div className="bg-surface rounded-xl shadow-md border border-border p-5">
            <h3 className="text-lg font-semibold text-text-main mb-4">Alertas</h3>
            <div className="space-y-3">
              {overdueInvoices.length === 0 && lowCreditCustomers.length === 0 && birthdayCustomers.length === 0 ? (
                <div className="p-3 bg-salon-success/10 border border-salon-success/20 rounded-lg flex items-start gap-3">
                  <span className="material-symbols-outlined text-salon-success">check_circle</span>
                  <div>
                    <p className="font-medium text-text-main">Tudo em ordem!</p>
                    <p className="text-sm text-text-muted">Nenhum alerta no momento</p>
                  </div>
                </div>
              ) : (
                <>
                  {overdueInvoices.slice(0, 3).map(invoice => (
                    <div
                      key={invoice.id}
                      className="flex items-start gap-3 p-3 bg-salon-error/5 border border-salon-error/20 rounded-lg cursor-pointer hover:border-salon-error/50 transition-colors"
                      onClick={() => navigate(createPageUrl("Invoices"))}
                    >
                      <span className="material-symbols-outlined text-salon-error">error</span>
                      <div>
                        <p className="font-medium text-text-main">{invoice.customer_name || "Cobrança"}</p>
                        <p className="text-sm text-salon-error">
                          R$ {invoice.value?.toFixed(2)} — Vencida em {invoice.due_date ? format(parseISO(invoice.due_date), "dd/MM") : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {lowCreditCustomers.slice(0, 3).map(customer => (
                    <div
                      key={customer.id}
                      className="flex items-start gap-3 p-3 bg-salon-warning/5 border border-salon-warning/20 rounded-lg cursor-pointer hover:border-salon-warning/50 transition-colors"
                      onClick={() => navigate(createPageUrl(`Clientes?id=${customer.id}`))}
                    >
                      <span className="material-symbols-outlined text-salon-warning">warning</span>
                      <div>
                        <p className="font-medium text-text-main">{customer.name}</p>
                        <p className="text-sm text-salon-warning">
                          Plano para renovar — {customer.current_credits || 0} crédito(s)
                        </p>
                      </div>
                    </div>
                  ))}
                  {birthdayCustomers.slice(0, 2).map(customer => (
                    <div
                      key={customer.id}
                      className="flex items-start gap-3 p-3 bg-salon-info/5 border border-salon-info/20 rounded-lg cursor-pointer hover:border-salon-info/50 transition-colors"
                      onClick={() => navigate(createPageUrl(`Clientes?id=${customer.id}`))}
                    >
                      <span className="material-symbols-outlined text-salon-info">cake</span>
                      <div>
                        <p className="font-medium text-text-main">{customer.name}</p>
                        <p className="text-sm text-salon-info">Aniversário hoje!</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-surface rounded-xl shadow-md border border-border p-5">
            <h3 className="text-lg font-semibold text-text-main mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => navigate(createPageUrl("Schedule"))}
                className="btn-branding py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Agendamento
              </button>
              <button
                onClick={() => navigate(createPageUrl("Clientes"), { state: { openNew: true } })}
                className="bg-transparent border border-border hover:border-branding hover:text-branding text-text-main py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">person_add</span>
                Cadastrar Cliente
              </button>
              <button
                onClick={() => navigate(createPageUrl("Invoices"))}
                className="bg-transparent border border-border hover:border-branding hover:text-branding text-text-main py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">description</span>
                Cobranças
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
