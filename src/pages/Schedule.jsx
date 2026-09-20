import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, CalendarDays, CalendarRange, Building2, Users, UserCog, Clock, AlertTriangle, Ban, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import DayCalendar from "@/components/schedule/DayCalendar";
import MonthCalendar from "@/components/schedule/MonthCalendar";
import AppointmentModal from "@/components/schedule/AppointmentModal";
import NewAppointmentModal from "@/components/schedule/NewAppointmentModal";
import RepeatAppointmentDialog from "@/components/schedule/RepeatAppointmentDialog";
import BusinessHoursModal from "@/components/schedule/BusinessHoursModal";
import BlockedTimesModal from "@/components/schedule/BlockedTimesModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { addWeeks, format as fnsFormat } from "date-fns";
import { syncToGoogleCalendar, syncToOutlookCalendar } from "@/lib/calendarService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getStoredCalendarTokens() {
  try {
    const userId = JSON.parse(localStorage.getItem("sb-agendaflow-auth-token") || "{}")?.user?.id;
    if (!userId) return null;
    const raw = localStorage.getItem(`calendar_tokens_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Schedule() {
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const [viewMode, setViewMode] = useState(urlParams.get("view") || "week"); // day, week, month
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const effectiveViewMode = isMobile && viewMode === "week" ? "day" : viewMode;
  const [currentUser, setCurrentUser] = useState(null);
  const [repeatAppointment, setRepeatAppointment] = useState(null);
  const [isCreatingRepeat, setIsCreatingRepeat] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  const [showBlockedTimes, setShowBlockedTimes] = useState(false);
  const [outOfHoursSlot, setOutOfHoursSlot] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    db.auth.me().then(async (user) => {
      if (user) {
        const { data: userCompanies } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", user.id);
        setCurrentUser({
          ...user,
          company_ids: userCompanies?.length > 0 ? userCompanies.map(uc => uc.company_id) : (user.company_ids?.length ? user.company_ids : (user.company_id ? [user.company_id] : [])),
        });
      }
    }).catch(() => {});
  }, []);

  const rawRole = currentUser?.role;
  const normalizedRole = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const isSuperAdmin = normalizedRole === "super_admin";
  const isAdmin = normalizedRole === "admin";
  const isProfissional = normalizedRole === "profissional";
  const companyId = currentUser?.company_id;
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState("all");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const [agendaListView, setAgendaListView] = useState("grade");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: !!currentUser,
  });

  // Effective company filter
  const effectiveCompanyId = (isProfissional && !isSuperAdmin) ? companyId : (selectedCompanyId !== "all" ? selectedCompanyId : null);

  // Company data for business hours
  const activeCompanyId = isSuperAdmin ? (selectedCompanyId !== "all" ? selectedCompanyId : null) : companyId;
  const fallbackCompanyId = currentUser?.company_ids?.[0] || (companies.length === 1 ? companies[0].id : null);
  const resolvedCompanyId = activeCompanyId || fallbackCompanyId;

  const currentCompany = (resolvedCompanyId ? companies.find(c => c.id === resolvedCompanyId) : null) || companies[0] || null;

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ data, targetCompanyId }) => {
      if (!targetCompanyId) throw new Error("Nenhuma empresa selecionada");
      const { error } = await supabase
        .from("companies")
        .update(data)
        .eq("id", targetCompanyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const createBlockedTimeMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from("blocked_times")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked_times"] });
    },
  });

  const userCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", effectiveCompanyId, isProfissional, isSuperAdmin, ...userCompanyIds],
    queryFn: async () => {
      if (effectiveCompanyId) {
        return db.entities.Customer.filter({ company_id: effectiveCompanyId, status: "active" });
      }
      if (isSuperAdmin) {
        return db.entities.Customer.filter({ status: "active" });
      }
      if (userCompanyIds.length > 0) {
        const allActive = await db.entities.Customer.filter({ status: "active" });
        return allActive.filter(c => {
          const sIds = c.company_ids?.length ? c.company_ids : (c.company_id ? [c.company_id] : []);
          return sIds.some(id => userCompanyIds.includes(id));
        });
      }
      return [];
    },
    enabled: !!currentUser,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => db.entities.Plan.list(),
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ["services"],
    queryFn: () => db.entities.Service.list(),
  });

  const { data: allStylistLevels = [] } = useQuery({
    queryKey: ["stylist_levels"],
    queryFn: () => db.entities.StylistLevel.list(),
  });

  const { data: allProServ = [] } = useQuery({
    queryKey: ["professional_services"],
    queryFn: () => db.entities.ProfessionalService.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => db.entities.User.list(),
  });

  // Profissionais para filtro (visível para admin/super_admin)
  const professionals = allUsers.filter(u => {
    const r = u.role === "teacher" ? "profissional" : u.role;
    const isProf = r === "profissional" || u.is_professional === true;
    if (!isProf) return false;
    // Filtra por empresa selecionada quando super_admin filtra por empresa
    if (selectedCompanyId !== "all") {
      const uIds = u.company_ids || (u.company_id ? [u.company_id] : []);
      return uIds.includes(selectedCompanyId);
    }
    if (!isSuperAdmin && userCompanyIds.length > 0) {
      const uIds = u.company_ids || (u.company_id ? [u.company_id] : []);
      return uIds.includes(companyId) || uIds.some(id => userCompanyIds.includes(id));
    }
    return true;
  });

  const { data: punchCards = [] } = useQuery({
    queryKey: ["punch_cards"],
    queryFn: () => db.entities.PunchCard.list(),
    enabled: !!currentUser,
  });

  const customerIds = customers.map(s => s.id);

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments", effectiveCompanyId, isProfissional, isSuperAdmin, customerIds.length],
    queryFn: async () => {
      const all = await db.entities.Appointment.list("-date", 500);
      if (effectiveCompanyId) {
        return all.filter(l => l.company_id ? l.company_id === effectiveCompanyId : customerIds.includes(l.customer_id));
      }
      if (isSuperAdmin) {
        return all;
      }
      if (userCompanyIds.length > 0) {
        return all.filter(l => {
          if (l.company_id) return userCompanyIds.includes(l.company_id);
          return customerIds.includes(l.customer_id);
        });
      }
      return [];
    },
    enabled: !!currentUser && (!effectiveCompanyId || customerIds.length > 0),
  });

  const { data: blockedTimes = [] } = useQuery({
    queryKey: ["blocked_times", effectiveCompanyId || resolvedCompanyId, ...userCompanyIds],
    queryFn: async () => {
      // Se filtro específico, busca só dele; senão busca de todas as empresas do usuário
      const idsToFetch = effectiveCompanyId ? [effectiveCompanyId] : (resolvedCompanyId ? [resolvedCompanyId] : userCompanyIds);
      if (idsToFetch.length === 0) return [];
      if (idsToFetch.length === 1) {
        const { data, error } = await supabase.from("blocked_times").select("*").eq("company_id", idsToFetch[0]);
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase.from("blocked_times").select("*").in("company_id", idsToFetch);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser && (!!effectiveCompanyId || !!resolvedCompanyId || userCompanyIds.length > 0),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data) => {
      // Support batch creation (array of appointments)
      const appointmentsArr = Array.isArray(data) ? data : [data];
      const results = [];
      for (const item of appointmentsArr) {
        const { original_appointment_id, ...appointmentData } = item;
        const created = await db.entities.Appointment.create({
          ...appointmentData,
          company_id: appointmentData.company_id || companyId || undefined,
        });
        if (original_appointment_id && item.appointment_type === "makeup") {
          await db.entities.Appointment.update(original_appointment_id, {
            rescheduled: true,
            rescheduled_appointment_id: created.id,
          });
        }
        results.push(created);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["trial_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["makeup_appointments"] });
      setShowNewAppointment(false);
      const count = Array.isArray(results) ? results.length : 1;
      toast.success(count > 1 ? `${count} agendamentos criados com sucesso!` : "Agendamento criado com sucesso!");

      // Sync to connected calendars
      const stored = getStoredCalendarTokens();
      if (stored && Array.isArray(results)) {
        results.forEach(appointment => {
          const customer = customers.find(s => s.id === appointment.customer_id);
          if (stored.google?.access_token) {
            syncToGoogleCalendar(appointment, customer, null, stored.google);
          }
          if (stored.microsoft?.access_token) {
            syncToOutlookCalendar(appointment, customer, null, stored.microsoft);
          }
          // Send confirmation email
          if (customer?.email) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (supabaseUrl) {
              fetch(`${supabaseUrl}/functions/v1/send-confirmation`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  to: customer.email,
                  customerName: customer.name,
                  serviceName: appointment.service_category === "corte" ? "Corte" : appointment.service_category === "barba" ? "Barba" : "Serviço",
                  date: appointment.date,
                  startTime: appointment.start_time,
                  endTime: appointment.end_time,
                  duration: appointment.duration_mins,
                  companyName: companies.find(c => c.id === appointment.company_id)?.name,
                  companyAddress: companies.find(c => c.id === appointment.company_id)?.address_street,
                }),
              }).catch(() => {});
            }
          }
        });
      }

      const first = Array.isArray(results) ? results[0] : results;
      if (first) {
        setRepeatAppointment(first);
      }
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Appointment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const updateCustomerCreditsMutation = useMutation({
    mutationFn: ({ id, credits }) => db.entities.Customer.update(id, { current_credits: credits }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const updatePunchCardMutation = useMutation({
    mutationFn: ({ id, used_services }) => db.entities.PunchCard.update(id, { used_services }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["punch_cards"] });
    },
  });

  const handleUpdateStatus = async (appointmentId, newStatus, notes, extraData = {}) => {
    const appointment = appointments.find(l => l.id === appointmentId);
    if (!appointment) return;

    const updateData = { status: newStatus, notes, ...extraData };

    if (newStatus === "present" && !appointment.service_performed) {
      const customer = customers.find(s => s.id === appointment.customer_id);
      const svcCategory = appointment.service_category || appointment.modality;
      
      // Check for active punch card first (matching service type)
      const activePunchCard = punchCards.find(pc =>
        pc.customer_id === appointment.customer_id &&
        pc.active !== false &&
        pc.used_services < pc.total_services &&
        (!pc.service_id || !svcCategory || pc.service_category === svcCategory || pc.service_type === svcCategory) &&
        (!pc.expires_at || new Date(pc.expires_at) > new Date())
      );

      if (activePunchCard) {
        await updatePunchCardMutation.mutateAsync({
          id: activePunchCard.id,
          used_services: activePunchCard.used_services + 1,
        });
        updateData.service_performed = true;
        updateData.punch_card_id = activePunchCard.id;
        const remaining = activePunchCard.total_services - activePunchCard.used_services - 1;
        toast.success(`Presença marcada! Punch card: ${remaining} serviço(s) restante(s)`);
      } else if (customer && customer.current_credits > 0) {
        await updateCustomerCreditsMutation.mutateAsync({
          id: customer.id,
          credits: customer.current_credits - 1,
        });
        updateData.service_performed = true;
        toast.success("Presença marcada e crédito debitado!");
      } else {
        toast.warning("Cliente sem créditos ou punch card disponível!");
      }

      // Calculate pricing: stylist level multiplier + commission
      const professional = appointment.professional_id
        ? allUsers.find(u => u.id === appointment.professional_id)
        : null;
      const stylistLevel = professional?.stylist_level_id
        ? allStylistLevels.find(l => l.id === professional.stylist_level_id)
        : null;
      const multiplier = Number(stylistLevel?.multiplier) || 1;

      const service = svcCategory
        ? allServices.find(s => s.category?.toLowerCase() === svcCategory.toLowerCase() || s.name?.toLowerCase()?.includes(svcCategory.toLowerCase()))
        : null;
      const basePrice = Number(service?.price) || 0;
      const finalPrice = basePrice * multiplier;

      // Get commission
      const proServ = professional
        ? allProServ.find(ps => ps.professional_id === professional.id && ps.service_id === service?.id)
        : null;
      const commissionPct = Number(proServ?.commission_pct) || Number(service?.comissao) || 0;
      const commissionValue = finalPrice * (commissionPct / 100);

      updateData.final_price = finalPrice;
      updateData.commission_value = commissionValue;
      updateData.stylist_level_id = professional?.stylist_level_id || null;
    } else if (newStatus === "absent" && appointment.service_performed) {
      // Restore credits/punch card if reversing from present
      const customer = customers.find(s => s.id === appointment.customer_id);
      if (appointment.punch_card_id) {
        const pc = punchCards.find(p => p.id === appointment.punch_card_id);
        if (pc && pc.used_services > 0) {
          await updatePunchCardMutation.mutateAsync({
            id: pc.id,
            used_services: pc.used_services - 1,
          });
        }
      } else if (customer) {
        await updateCustomerCreditsMutation.mutateAsync({
          id: customer.id,
          credits: (customer.current_credits || 0) + 1,
        });
      }
      updateData.service_performed = false;
      toast.info("Falta registrada — crédito restaurado");
    } else if (newStatus === "cancelled" && appointment.service_performed) {
      // Restore credits on cancellation too
      const customer = customers.find(s => s.id === appointment.customer_id);
      if (appointment.punch_card_id) {
        const pc = punchCards.find(p => p.id === appointment.punch_card_id);
        if (pc && pc.used_services > 0) {
          await updatePunchCardMutation.mutateAsync({
            id: pc.id,
            used_services: pc.used_services - 1,
          });
        }
      } else if (customer) {
        await updateCustomerCreditsMutation.mutateAsync({
          id: customer.id,
          credits: (customer.current_credits || 0) + 1,
        });
      }
      updateData.service_performed = false;
      toast.info("Cancelamento registrado — crédito restaurado");
    } else if (newStatus === "absent") {
      toast.info("Falta registrada");
    }

    await updateAppointmentMutation.mutateAsync({ id: appointmentId, data: updateData });
    setSelectedAppointment(null);
  };

  const isSlotOutOfHours = (time) => {
    if (!currentCompany?.opening_time || !currentCompany?.closing_time) return false;
    return time < currentCompany.opening_time || time >= currentCompany.closing_time;
  };

  const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const isDayOpen = (date) => {
    if (!currentCompany?.open_days?.length) return true;
    const dayKey = DAY_KEYS[date.getDay()];
    return currentCompany.open_days.includes(dayKey);
  };

  const isBlockedForDate = (bt, dateStr) => {
    if (bt.recurrence_type === "daily") return true;
    if (bt.recurrence_type === "weekly") return Number(bt.recurrence_day_of_week) === new Date(dateStr + "T12:00:00").getDay();
    if (bt.recurrence_type === "period") return dateStr >= (bt.period_start_date || "") && dateStr <= (bt.period_end_date || "");
    return bt.date === dateStr;
  };
  const isSlotBlocked = (date, time) => {
    const dateStr = fnsFormat(date, "yyyy-MM-dd");
    return blockedTimes.some(bt => isBlockedForDate(bt, dateStr) && time >= bt.start_time && time < bt.end_time);
  };

  const handleSlotClick = (date, time) => {
    if (!isDayOpen(date)) {
      toast.info("Esta empresa não funciona neste dia da semana");
      return;
    }
    if (isSlotBlocked(date, time)) {
      const dateStr = fnsFormat(date, "yyyy-MM-dd");
      const bt = blockedTimes.find(b => isBlockedForDate(b, dateStr) && time >= b.start_time && time < b.end_time);
      toast.error(`Horário bloqueado (${bt?.start_time} - ${bt?.end_time})${bt?.description ? `: ${bt.description}` : ""}`);
      return;
    }
    if (isSlotOutOfHours(time)) {
      setOutOfHoursSlot({ date, time });
      return;
    }
    setSelectedDate(date);
    setSelectedTime(time || null);
    setShowNewAppointment(true);
  };

  const handleConfirmOutOfHours = () => {
    if (outOfHoursSlot) {
      setSelectedDate(outOfHoursSlot.date);
      setSelectedTime(outOfHoursSlot.time);
      setShowNewAppointment(true);
      setOutOfHoursSlot(null);
    }
  };

  const deleteAppointmentMutation = useMutation({
    mutationFn: (appointmentId) => db.entities.Appointment.delete(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento excluído com sucesso!");
    },
  });

  const handleDeleteAppointment = async (appointmentId) => {
    await deleteAppointmentMutation.mutateAsync(appointmentId);
  };

  const handleBulkDeleteAppointments = async (appointmentIds) => {
    const count = appointmentIds.length;
    for (const id of appointmentIds) {
      await db.entities.Appointment.delete(id);
    }
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    toast.success(`${count} ${count === 1 ? "agendamento excluído" : "agendamentos excluídos"} com sucesso!`);
  };

  // Apply customer + professional filters on the client side
  const filteredAppointments = appointments.filter(l => {
    const matchCustomer = selectedCustomerId === "all" || l.customer_id === selectedCustomerId;
    const matchProfessional = selectedProfessionalId === "all" || l.professional_id === selectedProfessionalId || l.teacher_id === selectedProfessionalId;
    return matchCustomer && matchProfessional;
  });

  const handleRepeatAppointment = async (appointment, weeks) => {
    setIsCreatingRepeat(true);
    const appointmentDate = new Date(appointment.date + "T12:00:00");
    const promises = [];
    for (let i = 1; i <= weeks; i++) {
      const newDate = addWeeks(appointmentDate, i);
      promises.push(db.entities.Appointment.create({
        customer_id: appointment.customer_id,
        customer_name: appointment.customer_name,
        plan_id: appointment.plan_id,
        date: fnsFormat(newDate, "yyyy-MM-dd"),
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        duration_mins: appointment.duration_mins,
        service_category: appointment.service_category || appointment.modality,
        status: "scheduled",
        service_performed: false,
        appointment_type: "plan",
        company_id: appointment.company_id || companyId || undefined,
      }));
    }
    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    setRepeatAppointment(null);
    setIsCreatingRepeat(false);
    toast.success(`${weeks} agendamentos criados com sucesso!`);
  };

  const handleReschedule = async (appointment, newDate, newTime) => {
    // Calculate end time based on duration
    const [h, m] = newTime.split(":").map(Number);
    const endMinutes = h * 60 + m + (appointment.duration_mins || 60);
    const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
    const endM = String(endMinutes % 60).padStart(2, "0");

    // Mark original appointment as rescheduled
    await updateAppointmentMutation.mutateAsync({
      id: appointment.id,
      data: { rescheduled: true },
    });

    // Create new appointment (copy of original with new date/time)
    await createAppointmentMutation.mutateAsync({
      customer_id: appointment.customer_id,
      customer_name: appointment.customer_name,
      plan_id: appointment.plan_id,
      date: newDate,
      start_time: newTime,
      end_time: `${endH}:${endM}`,
      duration_mins: appointment.duration_mins,
      service_category: appointment.service_category || appointment.modality,
      status: "scheduled",
        notes: `Reagendamento do agendamento de ${appointment.date}`,
      company_id: appointment.company_id || companyId || undefined,
    });

    toast.success("Agendamento reagendado com sucesso!");
    setSelectedAppointment(null);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              Agenda
            </h1>
            <p className="text-on-surface-variant mt-1">Gerencie os agendamentos e atendimentos</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && companies.length > 0 && (
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-36 sm:w-48 rounded-xl border-outline-variant/30">
                  <Building2 className="w-4 h-4 mr-2 text-on-surface-variant flex-shrink-0" />
                  <SelectValue placeholder="Empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-36 sm:w-48 rounded-xl border-outline-variant/30">
                <Users className="w-4 h-4 mr-2 text-on-surface-variant flex-shrink-0" />
                <SelectValue placeholder="Clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {customers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(isAdmin || isSuperAdmin) && (
              <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                <SelectTrigger className="w-36 sm:w-48 rounded-xl border-outline-variant/30">
                  <UserCog className="w-4 h-4 mr-2 text-on-surface-variant flex-shrink-0" />
                  <SelectValue placeholder="Profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {professionals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(isAdmin || isSuperAdmin) && (
              <Button
                variant="outline"
                onClick={() => setShowBusinessHours(true)}
                className="rounded-xl border-outline-variant/30"
              >
                <Clock className="w-4 h-4 mr-2" />
                Horário
              </Button>
            )}
            {(isAdmin || isSuperAdmin) && (
              <Button
                variant="outline"
                onClick={() => setShowBlockedTimes(true)}
                className="rounded-xl border-outline-variant/30"
              >
                <Ban className="w-4 h-4 mr-2" />
                Bloquear Horário
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedDate(new Date());
                setSelectedTime(null);
                setShowNewAppointment(true);
              }}
              className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20"
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => setViewMode("day")}
            className={cn(
              "rounded-xl",
              viewMode === "day" && "btn-branding"
            )}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Dia
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => setViewMode("week")}
            className={cn(
              "rounded-xl",
              viewMode === "week" && "btn-branding"
            )}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Semana
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
            className={cn(
              "rounded-xl",
              viewMode === "month" && "btn-branding"
            )}
          >
            <CalendarRange className="w-4 h-4 mr-2" />
            Mês
          </Button>
        </div>

        {/* Calendar */}
        {effectiveViewMode === "day" && (
          <DayCalendar
            appointments={filteredAppointments}
            customers={customers}
            onAppointmentClick={setSelectedAppointment}
            onSlotClick={handleSlotClick}
            openingTime={currentCompany?.opening_time}
            closingTime={currentCompany?.closing_time}
            openDays={currentCompany?.open_days}
            blockedTimes={blockedTimes}
          />
        )}
        {effectiveViewMode === "week" && (
          <WeeklyCalendar
            appointments={filteredAppointments}
            customers={customers}
            onAppointmentClick={setSelectedAppointment}
            onSlotClick={handleSlotClick}
            openingTime={currentCompany?.opening_time}
            closingTime={currentCompany?.closing_time}
            openDays={currentCompany?.open_days}
            blockedTimes={blockedTimes}
            companies={companies}
            selectedCompanyId={isSuperAdmin ? selectedCompanyId : (companyId || null)}
          />
        )}
        {effectiveViewMode === "month" && (
          <MonthCalendar
            appointments={filteredAppointments}
            customers={customers}
            onAppointmentClick={setSelectedAppointment}
            onSlotClick={handleSlotClick}
            onDeleteAppointments={handleBulkDeleteAppointments}
          />
        )}

        {/* Agenda - Grade / Lista para super_admin e admin */}
        <div className="mt-8 bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Calendar className="w-5 h-5 text-branding-primary" />
              Lista de Agendamentos
              <span className="text-sm font-normal text-muted-foreground">({filteredAppointments.length})</span>
            </h3>
            <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm self-start">
              <button
                onClick={() => setAgendaListView("grade")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${agendaListView === "grade" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                title="Visualização em grade"
              >
                <LayoutGrid className="w-4 h-4" />
                Grade
              </button>
              <button
                onClick={() => setAgendaListView("lista")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${agendaListView === "lista" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                title="Visualização em lista"
              >
                <List className="w-4 h-4" />
                Lista
              </button>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado</p>
          ) : agendaListView === "grade" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map(appointment => {
                const customer = customers.find(c => c.id === appointment.customer_id);
                const professional = allUsers.find(u => u.id === appointment.professional_id);
                const company = companies.find(c => c.id === appointment.company_id);
                return (
                  <div key={appointment.id} onClick={() => setSelectedAppointment(appointment)} className="rounded-xl border border-outline-variant/30 p-4 hover:shadow-md transition-all cursor-pointer bg-background">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-on-surface truncate">{appointment.customer_name || customer?.name || "Cliente"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${appointment.status === "present" ? "bg-emerald-500/20 text-emerald-400" : appointment.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-300"}`}>{appointment.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{appointment.date} {appointment.start_time} - {appointment.end_time}</p>
                    {professional && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><UserCog className="w-3.5 h-3.5" />{professional.full_name || professional.email}</p>}
                    {isSuperAdmin && company && <p className="text-xs inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30"><Building2 className="w-3 h-3" />{company.name}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{appointment.service_category || appointment.modality || "Serviço"}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-outline-variant/30">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Profissional</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-medium hidden lg:table-cell">Empresa</th>}
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Data</th>
                    <th className="px-4 py-3 font-medium">Horário</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Serviço</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredAppointments.map(appointment => {
                    const customer = customers.find(c => c.id === appointment.customer_id);
                    const professional = allUsers.find(u => u.id === appointment.professional_id);
                    const company = companies.find(c => c.id === appointment.company_id);
                    return (
                      <tr key={appointment.id} onClick={() => setSelectedAppointment(appointment)} className="hover:bg-surface-container-low cursor-pointer">
                        <td className="px-4 py-3 font-medium text-on-surface">{appointment.customer_name || customer?.name || "-"}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{professional?.full_name || "-"}</td>
                        {isSuperAdmin && <td className="px-4 py-3 hidden lg:table-cell">{company ? <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5"><Building2 className="w-3 h-3" />{company.name}</span> : <span className="text-muted-foreground">—</span>}</td>}
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{appointment.date}</td>
                        <td className="px-4 py-3 text-muted-foreground">{appointment.start_time} - {appointment.end_time}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{appointment.service_category || appointment.modality || "-"}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${appointment.status === "present" ? "bg-emerald-500/20 text-emerald-400" : appointment.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-300"}`}>{appointment.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Appointment Details Modal */}
        <AppointmentModal
          appointment={selectedAppointment}
          open={!!selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdateStatus={handleUpdateStatus}
          onDelete={handleDeleteAppointment}
          onReschedule={handleReschedule}
          customers={customers}
        />

        {/* New Appointment Modal */}
        <NewAppointmentModal
          open={showNewAppointment}
          onClose={() => {
            setShowNewAppointment(false);
            setSelectedDate(null);
            setSelectedTime(null);
          }}
          customers={customers}
          plans={plans}
          services={allServices}
          professionals={allUsers}
          products={allServices}
          appointments={appointments}
          blockedTimes={blockedTimes}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          openingTime={currentCompany?.opening_time}
          closingTime={currentCompany?.closing_time}
          onSubmit={(data) => {
            const items = Array.isArray(data) ? data : [data];
            createAppointmentMutation.mutate(items.map(d => ({ ...d, company_id: d.company_id || companyId || undefined })));
          }}
          isLoading={createAppointmentMutation.isPending}
        />

        {/* Repeat Appointment Dialog */}
        <RepeatAppointmentDialog
          open={!!repeatAppointment}
          onClose={() => setRepeatAppointment(null)}
          appointment={repeatAppointment}
          onConfirm={handleRepeatAppointment}
          isLoading={isCreatingRepeat}
        />

        {/* Business Hours Modal */}
        <BusinessHoursModal
          open={showBusinessHours}
          onClose={() => setShowBusinessHours(false)}
          company={currentCompany}
          companies={isSuperAdmin ? companies : companies.filter(c => {
            const ids = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
            return ids.includes(c.id);
          })}
          companyId={companyId}
          isSuperAdmin={isSuperAdmin}
          onSave={(data, targetId) => updateCompanyMutation.mutateAsync({ data, targetCompanyId: targetId })}
        />

        {/* Blocked Times Modal */}
        <BlockedTimesModal
          open={showBlockedTimes}
          onClose={() => setShowBlockedTimes(false)}
          company={currentCompany}
          companies={isSuperAdmin ? companies : companies.filter(c => {
            const ids = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
            return ids.includes(c.id);
          })}
          companyId={companyId}
          isSuperAdmin={isSuperAdmin}
          onSave={(data) => createBlockedTimeMutation.mutateAsync(data)}
        />

        {/* Out of Hours Confirmation */}
        <Dialog open={!!outOfHoursSlot} onOpenChange={() => setOutOfHoursSlot(null)}>
          <DialogContent className="sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                Fora do Horário de Funcionamento
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2 text-sm text-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>O horário <strong>{outOfHoursSlot?.time}</strong> está fora do expediente (<strong>{currentCompany?.opening_time || "08:00"} - {currentCompany?.closing_time || "18:00"}</strong>). O agendamento será criado como <strong>exceção</strong> (cor laranja).</span>
            </div>
            <p className="text-sm text-on-surface-variant">Deseja agendar mesmo assim?</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setOutOfHoursSlot(null)} className="flex-1 rounded-xl">
                Cancelar
              </Button>
              <Button onClick={handleConfirmOutOfHours} className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
                Agendar (Exceção)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
