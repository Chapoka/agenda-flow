import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, User, Clock, Droplets, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const timeSlots = [];
for (let h = 0; h <= 23; h++) {
  timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
  timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
}

const statusColors = {
  scheduled: "bg-branding-primary/20 border-branding-primary text-branding-primary",
  confirmed: "bg-branding-secondary/20 border-branding-secondary text-branding-secondary",
  present: "bg-emerald-500/20 border-emerald-500 text-emerald-300",
  absent: "bg-red-500/20 border-red-500/70 text-red-400",
  cancelled: "bg-surface-container border-outline-variant/50 text-on-surface-variant line-through",
  trial: "bg-amber-500/20 border-amber-500 text-amber-300",
  makeup: "bg-pink-100 border-pink-500 text-pink-700",
};

const serviceCategoryLabels = {
  corte: "Corte",
  barba: "Barba",
};

// Group appointments that share the same date, time, and guardian
const groupAppointments = (appointments, customers) => {
  const grouped = [];
  const used = new Set();
  const guardianIds = new Set(customers.filter(s => customers.some(other => other.guardian_id === s.id)).map(s => s.id));

  for (let i = 0; i < appointments.length; i++) {
    if (used.has(i)) continue;
    const appointment = appointments[i];
    const customer = customers.find(s => s.id === appointment.customer_id);
    const guardianId = customer?.guardian_id || appointment.customer_id;

    const sameSlot = [appointment];
    for (let j = i + 1; j < appointments.length; j++) {
      if (used.has(j)) continue;
      const other = appointments[j];
      if (other.date === appointment.date && other.start_time === appointment.start_time) {
        const otherCustomer = customers.find(s => s.id === other.customer_id);
        const otherGuardianId = otherCustomer?.guardian_id || other.customer_id;
        if (otherGuardianId === guardianId) {
          sameSlot.push(other);
          used.add(j);
        }
      }
    }
    used.add(i);

    if (sameSlot.length > 1) {
      const dependents = sameSlot.filter(l => {
        const s = customers.find(st => st.id === l.customer_id);
        return s?.guardian_id;
      });
      if (dependents.length > 0) {
        const updatedDependents = dependents.map(l => {
          const s = customers.find(st => st.id === l.customer_id);
          return { ...l, customer_name: s?.name || l.customer_name };
        });
        const names = updatedDependents.map(l => l.customer_name).filter(Boolean);
        const displayName = names.length <= 2 ? names.join(" / ") : `${names[0]} +${names.length - 1}`;
        grouped.push({
          ...updatedDependents[0],
          isGroup: true,
          groupAppointments: updatedDependents,
          customer_name: displayName,
          groupCount: updatedDependents.length,
        });
        continue;
      }
    }

    if (sameSlot.length === 1 && guardianIds.has(appointment.customer_id)) {
      continue;
    }

    if (sameSlot.length === 1) {
      const s = customers.find(st => st.id === appointment.customer_id);
      grouped.push({ ...appointment, isGroup: false, customer_name: s?.name || appointment.customer_name });
    } else {
      const updatedSlot = sameSlot.map(l => {
        const s = customers.find(st => st.id === l.customer_id);
        return { ...l, customer_name: s?.name || l.customer_name };
      });
      const names = updatedSlot.map(l => l.customer_name).filter(Boolean);
      const displayName = names.length <= 2 ? names.join(" / ") : `${names[0]} +${names.length - 1}`;
      grouped.push({
        ...appointment,
        isGroup: true,
        groupAppointments: updatedSlot,
        customer_name: displayName,
        groupCount: updatedSlot.length,
      });
    }
  }
  return grouped;
};

export default function WeeklyCalendar({ appointments, customers = [], onAppointmentClick, onSlotClick, openingTime, closingTime, openDays, blockedTimes = [], companies = [], selectedCompanyId = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [closedPopup, setClosedPopup] = useState(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const isAllCompanies = !selectedCompanyId || selectedCompanyId === "all";
  const isDayOpen = (date) => {
    if (isAllCompanies) return true;
    if (!openDays?.length) return true;
    return openDays.includes(DAY_KEYS[date.getDay()]);
  };

  const isSlotOutOfHours = (time) => {
    if (isAllCompanies) return false;
    if (!openingTime || !closingTime) return false;
    return time < openingTime || time >= closingTime;
  };

  const isSlotClosedForAll = (date, time) => {
    if (!isAllCompanies || !companies.length) return false;
    const closed = getClosedCompaniesForSlot(date, time);
    return closed.length > 0;
  };

  const getClosedCompaniesForSlot = (date, time) => {
    if (!isAllCompanies || !companies.length) return [];
    const dayKey = DAY_KEYS[date.getDay()];
    return companies.filter(c => {
      const cOpenDays = c.open_days;
      const cOpening = c.opening_time;
      const cClosing = c.closing_time;
      if (cOpenDays?.length && !cOpenDays.includes(dayKey)) return true;
      if (cOpening && cClosing && (time < cOpening || time >= cClosing)) return true;
      return false;
    });
  };

  const isBlockedForDate = (bt, dateStr) => {
    if (bt.recurrence_type === "daily") return true;
    if (bt.recurrence_type === "weekly") return Number(bt.recurrence_day_of_week) === new Date(dateStr + "T12:00:00").getDay();
    if (bt.recurrence_type === "period") return dateStr >= (bt.period_start_date || "") && dateStr <= (bt.period_end_date || "");
    return bt.date === dateStr;
  };
  const getBlockedForDay = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return blockedTimes.filter(bt => isBlockedForDate(bt, dateStr));
  };
  const getBlockedTop = (startTime) => {
    const [h, m] = startTime.split(':').map(Number);
    const idx = timeSlots.findIndex(s => s === `${String(h).padStart(2,'0')}:${m===0?'00':'30'}`);
    return idx >=0 ? idx*48 : 0;
  };
  const getBlockedHeight = (start, end) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh*60+em)-(sh*60+sm);
    return Math.max(24, (mins/30)*48 - 4);
  };

  const getAppointmentsForDay = (date) => {
    const filtered = appointments.filter(appointment => 
      isSameDay(parseISO(appointment.date), date)
    );
    return groupAppointments(filtered, customers);
  };

  const getSlotHeight = (duration) => {
    const baseHeight = 48;
    return (duration / 30) * baseHeight;
  };

  const getSlotTop = (startTime) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startIndex = timeSlots.findIndex(slot => slot === `${hours.toString().padStart(2, '0')}:${minutes === 0 ? '00' : '30'}`);
    return startIndex >= 0 ? startIndex * 48 : 0;
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">
          {format(weekStart, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg px-4"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Business Hours Legend - sempre visível para debug */}
      <div className="px-4 py-2 border-b border-outline-variant/10 flex items-center gap-4 text-xs text-on-surface-variant flex-wrap">
        {openingTime && closingTime ? (
          <span className="font-medium text-on-surface">Horário: {openingTime} - {closingTime}</span>
        ) : (
          <span className="font-medium text-amber-400">Horário não configurado (usando 08:00-18:00)</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: "rgba(220,38,38,0.28)", borderColor: "rgba(220,38,38,0.45)" }}></span>
          <span>Fora do expediente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-outline-variant/30" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}></span>
          <span>Dentro do expediente</span>
        </div>
        {openingTime && closingTime && (
          <span className="text-[11px] text-amber-400 ml-2">• Exceções ficam em laranja</span>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-8 border-b border-outline-variant/10">
            <div className="p-3 text-center text-sm font-medium text-on-surface-variant border-r border-outline-variant/10">
              Horário
            </div>
            {weekDays.map((day, i) => {
              const dayOpen = isDayOpen(day);
              return (
              <div 
                key={i} 
                className={cn(
                  "p-3 text-center border-r border-outline-variant/10 last:border-r-0",
                  isSameDay(day, new Date()) && "bg-branding-primary/5"
                )}
              >
                <p className={cn("text-xs font-medium uppercase", dayOpen ? "text-on-surface-variant" : "text-error")}>
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className={cn(
                  "text-lg font-semibold mt-1",
                  isSameDay(day, new Date()) ? "text-branding-primary" : dayOpen ? "text-on-surface" : "text-error/60"
                )}>
                  {format(day, "d")}
                </p>
                {!dayOpen && <p className="text-[9px] text-error mt-0.5">Fechado</p>}
              </div>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="relative grid grid-cols-8" style={{ height: timeSlots.length * 48 }}>
            {/* Time Labels */}
            <div className="border-r border-outline-variant/10">
              {timeSlots.map((time, i) => {
                const outOfHours = isSlotOutOfHours(time);
                return (
                  <div 
                    key={time} 
                    className={cn(
                      "h-12 px-3 flex items-start justify-end pt-1 text-xs border-b",
                      outOfHours ? "text-red-300 font-semibold border-red-500/20" : "text-on-surface-variant border-outline-variant/10"
                    )}
                    style={outOfHours ? { backgroundColor: "rgba(220,38,38,0.22)" } : {}}
                  >
                    {i % 2 === 0 && time}
                  </div>
                );
              })}
            </div>

            {/* Day Columns */}
            {weekDays.map((day, dayIndex) => {
              const dayAppointments = getAppointmentsForDay(day);
              const dayIsOpen = isDayOpen(day);
              
              return (
                <div 
                  key={dayIndex} 
                  className={cn(
                    "relative border-r border-outline-variant/10 last:border-r-0",
                    isSameDay(day, new Date()) && "bg-branding-primary/5"
                  )}
                >
                  {/* Grid Lines */}
                  {timeSlots.map((time, i) => {
                    const outOfHours = isSlotOutOfHours(time);
                    const isAllClosed = isAllCompanies && isSlotClosedForAll(day, time);
                    const showClosed = (!isAllCompanies && outOfHours && dayIsOpen) || (isAllCompanies && isSlotClosedForAll(day, time));
                    return (
                      <div
                        key={i}
                        className={cn(
                          "h-12 border-b transition-colors relative",
                          !dayIsOpen
                            ? "cursor-not-allowed border-outline-variant/10"
                            : showClosed ? "cursor-pointer border-red-500/20" : "cursor-pointer border-outline-variant/10 hover:bg-branding-primary/5"
                        )}
                        style={
                          !dayIsOpen ? { backgroundColor: "rgba(100,100,100,0.18)" } 
                          : showClosed ? { backgroundColor: "rgba(220,38,38,0.30)" } 
                          : {}
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAllCompanies && isAllClosed) {
                            setClosedPopup({ date: day, time, companies: getClosedCompaniesForSlot(day, time) });
                            return;
                          }
                          if (dayIsOpen && !showClosed) onSlotClick && onSlotClick(day, time);
                          else if (dayIsOpen && showClosed && !isAllCompanies) onSlotClick && onSlotClick(day, time);
                        }}
                      >
                        {showClosed && (
                          <div className={`absolute inset-0 flex items-center justify-center ${isAllCompanies ? "cursor-pointer" : "pointer-events-none"}`} onClick={isAllCompanies ? (e) => { e.stopPropagation(); setClosedPopup({ date: day, time, companies: getClosedCompaniesForSlot(day, time) }); } : undefined}>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80" style={{ backgroundColor: "rgba(220,38,38,0.45)", color: "#fecaca" }}>Fechado</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Closed Day Overlay */}
                  {!dayIsOpen && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="bg-gray-200/80 dark:bg-gray-700/80 rounded-lg px-3 py-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-300">
                        Fechado
                      </div>
                    </div>
                  )}

                  {/* Blocked Times */}
                  {getBlockedForDay(day).map((bt, idx) => (
                    <div
                      key={`bt-${bt.id || idx}`}
                      className="absolute left-1 right-1 rounded-md border border-zinc-500/30 px-1.5 py-0.5 flex items-center gap-1 overflow-hidden pointer-events-none"
                      style={{
                        top: getBlockedTop(bt.start_time),
                        height: getBlockedHeight(bt.start_time, bt.end_time),
                        backgroundColor: "rgba(113,113,122,0.30)",
                        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 12px)",
                      }}
                    >
                      <Ban className="w-3 h-3 text-zinc-200 flex-shrink-0" />
                      <span className="text-[10px] font-medium text-zinc-100 truncate">{bt.description || "Bloqueado"}</span>
                    </div>
                  ))}

                {/* Appointments */}
                {dayAppointments.map((appointment) => {
                  const isException = appointment.is_out_of_hours || isSlotOutOfHours(appointment.start_time);
                  return (
                    <HoverCard key={appointment.id} openDelay={200}>
                      <HoverCardTrigger asChild>
                        <div
                          className={cn(
                            "absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden",
                            isException ? "bg-amber-500/25 border-amber-500 text-amber-200" : statusColors[appointment.status]
                          )}
                          style={{
                            top: getSlotTop(appointment.start_time),
                            height: getSlotHeight(appointment.duration_mins) - 4,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick?.(appointment);
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-medium truncate">
                            <div className="flex items-center gap-1 truncate">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{appointment.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {appointment.isGroup && (
                                <span className="bg-surface-container-lowest/60 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                                  {appointment.groupCount}
                                </span>
                              )}
                              {appointment.status === "present" && "✓"}
                              {appointment.status === "absent" && "✗"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs opacity-80 mt-0.5">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>{appointment.start_time} • {serviceCategoryLabels[appointment.service_category] || appointment.service_category}</span>
                            {appointment.is_out_of_hours && <span className="ml-1 text-[9px] font-bold bg-amber-500 text-white px-1 py-0.5 rounded">EXCEÇÃO</span>}
                          </div>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-56 sm:w-72 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30">
                        <div className="space-y-3">
                          {appointment.isGroup ? (
                            <>
                              <div>
                                <p className="font-semibold text-on-surface text-sm mb-1">Atendimento em grupo ({appointment.groupCount} clientes)</p>
                                <p className="text-xs text-on-surface-variant">
                                  {format(parseISO(appointment.date), "dd 'de' MMMM", { locale: ptBR })}
                                </p>
                              </div>
                              <div className="space-y-1.5 pt-2 border-t border-outline-variant/10">
                                {appointment.groupAppointments.map((gl, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm text-on-surface">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                      {gl.customer_name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <span>{gl.customer_name}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-semibold">
                                  {appointment.customer_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-on-surface">{appointment.customer_name}</p>
                                  <p className="text-xs text-on-surface-variant">
                                    {format(parseISO(appointment.date), "dd 'de' MMMM", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-on-surface-variant">
                                <Droplets className="w-4 h-4 text-branding-primary" />
                                <span>Tipo de Agendamento:</span>
                              </div>
                              <span className="font-medium text-on-surface">
                                {serviceCategoryLabels[appointment.service_category] || appointment.service_category}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-on-surface-variant">
                                <Clock className="w-4 h-4 text-branding-secondary" />
                                <span>Horário:</span>
                              </div>
                              <span className="font-medium text-on-surface">
                                {appointment.start_time} - {appointment.end_time}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="text-on-surface-variant">Duração:</span>
                              <span className="font-medium text-on-surface">
                                {appointment.duration_mins} minutos
                              </span>
                            </div>
                          </div>

                          {appointment.notes && (
                             <div className="pt-2 border-t border-outline-variant/10">
                               <p className="text-xs text-on-surface-variant mb-1">Observações:</p>
                               <p className="text-sm text-on-surface">{appointment.notes}</p>
                             </div>
                           )}
                           {appointment.is_out_of_hours && (
                             <div className="pt-2 border-t border-amber-500/20">
                               <p className="text-xs font-semibold text-amber-400">⚠ Agendamento fora do horário (exceção)</p>
                             </div>
                           )}
                         </div>
                       </HoverCardContent>
                     </HoverCard>
                  );
                })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!closedPopup} onOpenChange={() => setClosedPopup(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Horário Fechado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {closedPopup && `Horário ${closedPopup.time} do dia ${format(closedPopup.date, "dd/MM/yyyy")} está fechado para:`}
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {closedPopup?.companies?.map(c => (
              <div key={c.id} className="p-2 bg-surface-container-low rounded-lg text-sm font-medium">{c.name} {c.opening_time && c.closing_time ? `(${c.opening_time}-${c.closing_time})` : ""}</div>
            ))}
            {closedPopup?.companies?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa fechada neste horário</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
