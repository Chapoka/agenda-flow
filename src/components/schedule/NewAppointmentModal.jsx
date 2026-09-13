import { useState, useEffect, useMemo } from "react";
import { format, isToday, parseISO } from "date-fns";
import { Calendar, Clock, User, Star, RotateCcw, Users, Check, Scissors, Package, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const allTimeOptions = [];
for (let h = 0; h <= 23; h++) {
  allTimeOptions.push(`${h.toString().padStart(2, '0')}:00`);
  allTimeOptions.push(`${h.toString().padStart(2, '0')}:30`);
}

const APPOINTMENT_TYPES = [
  { value: "normal", label: "Normal", icon: Scissors, color: "border-branding-primary bg-branding-primary/5 text-branding-primary" },
  { value: "trial", label: "Experimental", icon: Star, color: "border-amber-500/70 bg-amber-500/10 text-amber-400" },
  { value: "makeup", label: "Reposição", icon: RotateCcw, color: "border-purple-500/70 bg-purple-500/10 text-purple-400" },
];

export default function NewAppointmentModal({ open, onClose, customers, plans = [], services = [], professionals = [], products = [], appointments = [], blockedTimes = [], selectedDate, selectedTime, onSubmit, isLoading, openingTime = "08:00", closingTime = "18:00" }) {
  const [appointmentType, setAppointmentType] = useState("normal");
  const [extraCustomerIds, setExtraCustomerIds] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [professionalOpen, setProfessionalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    service_id: "",
    professional_id: "",
    product_id: "",
    date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
    start_time: "08:00",
    duration_mins: 60,
    original_appointment_id: "",
  });

  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: format(selectedDate, "yyyy-MM-dd") }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime) {
      setFormData(prev => ({ ...prev, start_time: selectedTime }));
    }
  }, [selectedTime]);

  useEffect(() => {
    if (formData.date && timeOptions.length > 0 && !timeOptions.includes(formData.start_time)) {
      setFormData(prev => ({ ...prev, start_time: timeOptions[0] || "08:00" }));
    }
  }, [formData.date]);

  useEffect(() => {
    if (appointmentType !== "makeup") {
      setFormData(prev => ({ ...prev, original_appointment_id: "" }));
    }
  }, [appointmentType]);

  const activeServices = useMemo(() => services.filter(s => s.active !== false && s.type !== "product"), [services]);
  const activeProducts = useMemo(() => products.filter(p => p.active !== false && p.type === "product"), [products]);
  const activeProfessionals = useMemo(() => professionals.filter(p => {
    const rawRole = p.role || "";
    const role = rawRole === "teacher" ? "profissional" : rawRole;
    return p.active !== false && (role === "profissional" || p.is_professional === true);
  }), [professionals]);

  const filteredServicesForSearch = useMemo(() => {
    if (!serviceSearch.trim()) return activeServices;
    const s = serviceSearch.toLowerCase();
    return activeServices.filter(svc => svc.name?.toLowerCase().includes(s) || String(svc.price || "").includes(s) || svc.category?.toLowerCase().includes(s));
  }, [activeServices, serviceSearch]);

  const filteredProfessionalsForSearch = useMemo(() => {
    if (!professionalSearch.trim()) return activeProfessionals;
    const s = professionalSearch.toLowerCase();
    return activeProfessionals.filter(p => (p.full_name || p.email || "").toLowerCase().includes(s) || (p.phone || "").toLowerCase().includes(s));
  }, [activeProfessionals, professionalSearch]);

  const filteredProductsForSearch = useMemo(() => {
    if (!productSearch.trim()) return activeProducts;
    const s = productSearch.toLowerCase();
    return activeProducts.filter(p => p.name?.toLowerCase().includes(s) || String(p.price || "").includes(s));
  }, [activeProducts, productSearch]);

  const filteredCustomersForSearch = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase().trim();
    const numericSearch = search.replace(/\D/g, "");
    return customers.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(search);
      const emailMatch = c.email?.toLowerCase().includes(search);
      const cpfMatch = numericSearch && c.cpf?.replace(/\D/g, "").includes(numericSearch);
      const phoneMatch = numericSearch && (c.whatsapp?.replace(/\D/g, "").includes(numericSearch) || c.phone?.replace(/\D/g, "").includes(numericSearch));
      return nameMatch || emailMatch || cpfMatch || phoneMatch;
    });
  }, [customers, customerSearch]);

  const timeOptions = useMemo(() => {
    if (!formData.date) return allTimeOptions;
    try {
      const selected = parseISO(formData.date);
      if (isToday(selected)) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        return allTimeOptions.filter(t => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m >= currentMinutes;
        });
      }
    } catch {}
    return allTimeOptions;
  }, [formData.date]);

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(s => s.id === customerId);
    if (!customer) return setFormData(prev => ({ ...prev, customer_id: customerId, original_appointment_id: "" }));

    let service_id = formData.service_id;
    let duration_mins = formData.duration_mins;

    if (customer.plan_id) {
      const plan = plans.find(p => p.id === customer.plan_id);
      if (plan) {
        const matchingService = activeServices.find(s => s.category?.toLowerCase() === plan.modality?.toLowerCase());
        if (matchingService) {
          service_id = matchingService.id;
          duration_mins = matchingService.duration_mins || duration_mins;
        }
      }
    } else if (customer.custom_plan) {
      const matchingService = activeServices.find(s => s.category?.toLowerCase() === customer.custom_plan.modality?.toLowerCase());
      if (matchingService) {
        service_id = matchingService.id;
        duration_mins = matchingService.duration_mins || duration_mins;
      }
    }

    setFormData(prev => ({ ...prev, customer_id: customerId, service_id, duration_mins, original_appointment_id: "" }));

    const guardianIds = customer.guardian_id
      ? customers.filter(s => s.id !== customerId && s.guardian_id === customer.guardian_id).map(s => s.id)
      : customers.filter(s => s.id !== customerId && s.guardian_id === customerId).map(s => s.id);
    setExtraCustomerIds(prev => {
      const nonGuardian = prev.filter(id => !guardianIds.includes(id));
      return [...new Set([...guardianIds, ...nonGuardian])];
    });
  };

  const handleServiceChange = (serviceId) => {
    const service = activeServices.find(s => s.id === serviceId);
    if (service) {
      setFormData(prev => ({ ...prev, service_id: serviceId, duration_mins: service.duration_mins || prev.duration_mins }));
    } else {
      setFormData(prev => ({ ...prev, service_id: serviceId }));
    }
  };

  const selectedCustomer = customers.find(s => s.id === formData.customer_id);
  const sameGuardianCustomers = (() => {
    if (!selectedCustomer) return [];
    if (selectedCustomer.guardian_id) {
      return customers.filter(s =>
        s.id !== selectedCustomer.id &&
        s.guardian_id === selectedCustomer.guardian_id
      );
    }
    return customers.filter(s =>
      s.id !== selectedCustomer.id &&
      s.guardian_id === selectedCustomer.id
    );
  })();

  const allSelectedCustomers = [selectedCustomer, ...customers.filter(s => s.id !== formData.customer_id && extraCustomerIds.includes(s.id))].filter(Boolean);

  const toggleExtraCustomer = (customerId) => {
    setExtraCustomerIds(prev =>
      prev.includes(customerId) ? prev.filter(id => id !== customerId) : [...prev, customerId]
    );
  };

  const absentAppointments = useMemo(() => {
    if (appointmentType !== "makeup" || !formData.customer_id) return [];
    return appointments.filter(l =>
      l.customer_id === formData.customer_id &&
      (l.status === "absent" || l.status === "cancelled") &&
      !l.rescheduled
    );
  }, [appointmentType, formData.customer_id, appointments]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSlotOutOfHours = useMemo(() => {
    if (!openingTime || !closingTime) return false;
    return formData.start_time < openingTime || formData.start_time >= closingTime;
  }, [formData.start_time, openingTime, closingTime]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const [hours, minutes] = formData.start_time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + Number(formData.duration_mins);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    const newEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

    for (const s of allSelectedCustomers) {
      const conflict = appointments.find(l =>
        l.customer_id === s.id &&
        l.date === formData.date &&
        !["cancelled", "absent"].includes(l.status) &&
        formData.start_time < (l.end_time || "23:59") &&
        newEndTime > l.start_time
      );
      if (conflict) {
        toast.error(`${s.name} já tem agendamento nesse horário (${conflict.start_time} - ${conflict.end_time})`);
        return;
      }
    }

    const isBlockedForDate = (bt, dateStr) => {
      if (bt.recurrence_type === "daily") return true;
      if (bt.recurrence_type === "weekly") {
        const dow = new Date(dateStr + "T12:00:00").getDay();
        return Number(bt.recurrence_day_of_week) === dow;
      }
      if (bt.recurrence_type === "period") {
        return dateStr >= (bt.period_start_date || "") && dateStr <= (bt.period_end_date || "");
      }
      return bt.date === dateStr;
    };
    const blockedConflict = blockedTimes.find(bt =>
      isBlockedForDate(bt, formData.date) &&
      formData.start_time < bt.end_time &&
      newEndTime > bt.start_time
    );
    if (blockedConflict) {
      toast.error(`Horário bloqueado (${blockedConflict.start_time} - ${blockedConflict.end_time})${blockedConflict.description ? `: ${blockedConflict.description}` : ''}`);
      return;
    }

    const statusMap = { normal: "scheduled", trial: "trial", makeup: "makeup" };
    const typeMap = { normal: "plan", trial: "trial", makeup: "makeup" };

    const selectedService = activeServices.find(s => s.id === formData.service_id);

    const allData = allSelectedCustomers.map(s => {
      const submitData = {
        customer_id: s.id,
        date: formData.date,
        start_time: formData.start_time,
        duration_mins: Number(formData.duration_mins),
        customer_name: s.name || "",
        end_time: newEndTime,
        status: statusMap[appointmentType],
        service_performed: false,
        appointment_type: typeMap[appointmentType],
        service_category: (selectedService?.category || "outro").toLowerCase(),
        is_out_of_hours: isSlotOutOfHours,
      };
      if (formData.original_appointment_id) submitData.original_appointment_id = formData.original_appointment_id;
      if (formData.service_id) submitData.service_id = formData.service_id;
      if (formData.professional_id) submitData.professional_id = formData.professional_id;
      if (formData.product_id) submitData.product_id = formData.product_id;
      return submitData;
    });

    onSubmit(allData);
  };

  const handleClose = () => {
    setAppointmentType("normal");
    setExtraCustomerIds([]);
    setFormData({ customer_id: "", service_id: "", professional_id: "", product_id: "", date: "", start_time: selectedTime || "08:00", duration_mins: 60, original_appointment_id: "" });
    setCustomerSearch("");
    setCustomerOpen(false);
    setServiceSearch("");
    setServiceOpen(false);
    setProfessionalSearch("");
    setProfessionalOpen(false);
    setProductSearch("");
    setProductOpen(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Tipo de Agendamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface">Tipo de Agendamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {APPOINTMENT_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAppointmentType(type.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium",
                      appointmentType === type.value ? type.color : "border-outline-variant bg-card text-muted-foreground hover:border-outline"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reposição - Agendamentos perdidos/cancelados */}
          {appointmentType === "makeup" && !formData.customer_id && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-sm text-purple-300 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 flex-shrink-0" />
              Selecione o cliente para ver agendamentos de origem (faltas ou cancelamentos)
            </div>
          )}
          {appointmentType === "makeup" && formData.customer_id && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">
                Agendamento de origem <span className="text-muted-foreground font-normal">— opcional</span>
              </Label>
              {absentAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum agendamento perdido ou cancelado para este cliente</p>
              ) : (
                <Select value={formData.original_appointment_id} onValueChange={(v) => setFormData(prev => ({ ...prev, original_appointment_id: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o agendamento de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {absentAppointments.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.date} {l.start_time} — {l.status === "absent" ? "Falta" : "Cancelado"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Cliente - busca por nome, CPF, e-mail, telefone (igual ao de profissionais) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface">Cliente</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className={cn("w-full justify-between rounded-xl text-left font-normal h-10", !formData.customer_id && "text-muted-foreground")}
                >
                  <span className="truncate">
                    {formData.customer_id ? (customers.find(c => c.id === formData.customer_id)?.name || "Selecione o cliente") : "Selecione o cliente"}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por nome, CPF, e-mail ou telefone..." value={customerSearch} onValueChange={setCustomerSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredCustomersForSearch.map((cust) => (
                        <CommandItem
                          key={cust.id}
                          value={`${cust.name} ${cust.cpf || ""} ${cust.email || ""} ${cust.whatsapp || cust.phone || ""}`}
                          onSelect={() => {
                            handleCustomerChange(cust.id);
                            setCustomerOpen(false);
                            setCustomerSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.customer_id === cust.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cust.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[cust.cpf, cust.email, cust.whatsapp || cust.phone].filter(Boolean).join(" • ") || "Sem contato"}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.customer_id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => {
                  handleCustomerChange("");
                  setCustomerSearch("");
                }}
              >
                Limpar seleção
              </Button>
            )}
          </div>

          {/* Mesmo responsável */}
          {sameGuardianCustomers.length > 0 && (() => {
            const guardianIds = sameGuardianCustomers.map(s => s.id);
            const allSelected = guardianIds.every(id => extraCustomerIds.includes(id));
            return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-on-surface flex items-center gap-1.5">
                  <User className="w-4 h-4 text-purple-400" />
                  Mesmo responsável
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    if (allSelected) {
                      setExtraCustomerIds(prev => prev.filter(id => !guardianIds.includes(id)));
                    } else {
                      setExtraCustomerIds(prev => [...new Set([...prev, ...guardianIds])]);
                    }
                  }}
                  className="text-xs text-purple-400 hover:text-purple-200 font-medium"
                >
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-purple-500/30 rounded-xl p-2">
                {sameGuardianCustomers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleExtraCustomer(s.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      extraCustomerIds.includes(s.id)
                        ? "bg-purple-500/20 text-purple-300 font-medium"
                        : "text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        extraCustomerIds.includes(s.id)
                          ? "bg-purple-500/100 border-purple-500"
                          : "border-outline"
                      )}>
                        {extraCustomerIds.includes(s.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{s.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })()}

          {/* Outros clientes */}
          {formData.customer_id && (() => {
            const guardianIds = new Set(sameGuardianCustomers.map(s => s.id));
            const otherCustomers = customers.filter(s =>
              s.id !== formData.customer_id &&
              !guardianIds.has(s.id) &&
              s.status === "active"
            );
            if (otherCustomers.length === 0) return null;
            return (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface flex items-center gap-1.5">
                <Users className="w-4 h-4 text-branding-primary" />
                Outros clientes
                <span className="text-muted-foreground font-normal">— opcional</span>
              </Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-outline-variant rounded-xl p-2">
                {otherCustomers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleExtraCustomer(s.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      extraCustomerIds.includes(s.id)
                        ? "bg-branding-primary/10 text-branding-primary font-medium"
                        : "text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        extraCustomerIds.includes(s.id)
                          ? "bg-branding-primary border-branding-primary"
                          : "border-outline"
                      )}>
                        {extraCustomerIds.includes(s.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{s.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })()}

          {allSelectedCustomers.length > 1 && (
            <div className="flex items-center gap-2 p-2 bg-branding-primary/5 rounded-xl text-sm text-branding-primary">
              <Users className="w-4 h-4" />
              <span>{allSelectedCustomers.length} clientes serão agendados neste horário</span>
            </div>
          )}

          {/* Serviço - pesquisável */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface">Serviço</Label>
            <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={serviceOpen}
                  className={cn("w-full justify-between rounded-xl text-left font-normal h-10", !formData.service_id && "text-muted-foreground")}
                >
                  <span className="truncate">
                    {formData.service_id ? (activeServices.find(s => s.id === formData.service_id)?.name || "Selecione o serviço") : "Selecione o serviço"}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por serviço, categoria ou preço..." value={serviceSearch} onValueChange={setServiceSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredServicesForSearch.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço disponível</p>
                      ) : (
                        filteredServicesForSearch.map((svc) => (
                          <CommandItem
                            key={svc.id}
                            value={`${svc.name} ${svc.category || ""} ${svc.price || ""}`}
                            onSelect={() => {
                              handleServiceChange(svc.id);
                              setServiceOpen(false);
                              setServiceSearch("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.service_id === svc.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-muted-foreground" />{svc.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{svc.category || "Sem categoria"} • R$ {Number(svc.price || 0).toFixed(2)}</p>
                            </div>
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.service_id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => handleServiceChange("")}
              >
                Limpar seleção
              </Button>
            )}
          </div>

          {/* Profissional - pesquisável */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface">Profissional</Label>
            <Popover open={professionalOpen} onOpenChange={setProfessionalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={professionalOpen}
                  className={cn("w-full justify-between rounded-xl text-left font-normal h-10", !formData.professional_id && "text-muted-foreground")}
                >
                  <span className="truncate">
                    {formData.professional_id ? (activeProfessionals.find(p => p.id === formData.professional_id)?.full_name || activeProfessionals.find(p => p.id === formData.professional_id)?.email || "Selecione o profissional") : "Selecione o profissional"}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por profissional, e-mail ou telefone..." value={professionalSearch} onValueChange={setProfessionalSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredProfessionalsForSearch.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum profissional disponível</p>
                      ) : (
                        filteredProfessionalsForSearch.map((pro) => (
                          <CommandItem
                            key={pro.id}
                            value={`${pro.full_name || ""} ${pro.email || ""} ${pro.phone || ""}`}
                            onSelect={() => {
                              handleChange("professional_id", pro.id);
                              setProfessionalOpen(false);
                              setProfessionalSearch("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.professional_id === pro.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" />{pro.full_name || pro.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{pro.email || ""} {pro.phone ? `• ${pro.phone}` : ""}</p>
                            </div>
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.professional_id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => handleChange("professional_id", "")}
              >
                Limpar seleção
              </Button>
            )}
          </div>

          {/* Produto - pesquisável — opcional */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface flex items-center gap-1.5">
              <Package className="w-4 h-4 text-muted-foreground" />
              Produto
              <span className="text-muted-foreground font-normal">— opcional</span>
            </Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className={cn("w-full justify-between rounded-xl text-left font-normal h-10", !formData.product_id && "text-muted-foreground")}
                >
                  <span className="truncate">
                    {formData.product_id ? (activeProducts.find(p => p.id === formData.product_id)?.name || "Selecione o produto") : "Selecione o produto"}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por produto, preço..." value={productSearch} onValueChange={setProductSearch} className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          handleChange("product_id", "");
                          setProductOpen(false);
                          setProductSearch("");
                        }}
                        className="cursor-pointer"
                      >
                        <Check className={cn("mr-2 h-4 w-4", !formData.product_id ? "opacity-100" : "opacity-0")} />
                        <span>Nenhum produto</span>
                      </CommandItem>
                      {filteredProductsForSearch.map((prod) => (
                        <CommandItem
                          key={prod.id}
                          value={`${prod.name} ${prod.price || ""}`}
                          onSelect={() => {
                            handleChange("product_id", prod.id);
                            setProductOpen(false);
                            setProductSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.product_id === prod.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-muted-foreground" />{prod.name}</p>
                            <p className="text-xs text-muted-foreground truncate">R$ {Number(prod.price || 0).toFixed(2)}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Data & Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Data</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className="pl-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Horário</Label>
              <Select value={formData.start_time} onValueChange={(v) => handleChange("start_time", v)}>
                <SelectTrigger className={cn("rounded-xl", isSlotOutOfHours && "border-amber-500/70 bg-amber-500/10 text-amber-400")}>
                  <div className="flex items-center gap-2">
                    <Clock className={cn("w-4 h-4", isSlotOutOfHours ? "text-amber-400" : "text-muted-foreground")} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(time => {
                    const isOutOfRange = openingTime && closingTime && (time < openingTime || time >= closingTime);
                    return (
                      <SelectItem key={time} value={time} className={cn(isOutOfRange && "text-amber-400")}>
                        {time}
                        {isOutOfRange && " (fechado)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {isSlotOutOfHours && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Este horário está fora do horário de funcionamento ({openingTime || "08:00"} - {closingTime || "18:00"}). O agendamento será criado como exceção.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-on-surface">Duração</Label>
            <Select
              value={formData.duration_mins.toString()}
              onValueChange={(v) => handleChange("duration_mins", parseInt(v))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
                <SelectItem value="90">90 minutos</SelectItem>
                <SelectItem value="120">120 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!formData.customer_id || isLoading}
              className={cn("flex-1 rounded-xl",
                isSlotOutOfHours ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700" :
                appointmentType === "trial" ? "bg-gradient-to-r from-amber-500 to-amber-600" :
                appointmentType === "makeup" ? "bg-gradient-to-r from-purple-500 to-purple-600" :
                "btn-branding"
              )}
            >
              {isLoading ? "Agendando..." : isSlotOutOfHours ? "Agendar (Exceção)" : allSelectedCustomers.length > 1 ? `Agendar ${allSelectedCustomers.length} Agendamentos` : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
