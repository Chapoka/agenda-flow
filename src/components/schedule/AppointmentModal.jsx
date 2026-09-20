import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Clock, Calendar, CheckCircle, XCircle, AlertCircle, Trash2, RefreshCw, Users, Banknote, CreditCard, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadICS } from "@/lib/calendarService";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const statusConfig = {
  scheduled: { label: "Agendada", color: "text-branding-primary", bg: "bg-branding-primary/10" },
  confirmed: { label: "Confirmada", color: "text-branding-secondary", bg: "bg-branding-secondary/10" },
  present: { label: "Presente", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  absent: { label: "Falta", color: "text-red-400", bg: "bg-red-500/10" },
  cancelled: { label: "Cancelada", color: "text-on-surface-variant", bg: "bg-surface-container" },
  trial: { label: "Experimental", color: "text-amber-400", bg: "bg-amber-500/10" },
  makeup: { label: "Reposição", color: "text-purple-400", bg: "bg-purple-500/10" },
};

export default function AppointmentModal({ appointment, open, onClose, onUpdateStatus, onDelete, onReschedule, customers = [] }) {
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [tipAmount, setTipAmount] = useState(appointment?.tip_amount || 0);
  const [tipPaymentMethod, setTipPaymentMethod] = useState(appointment?.tip_payment_method || "cash");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  if (!appointment) return null;

  const groupAppointments = appointment.isGroup ? (appointment.groupAppointments || []) : [appointment];
  const isGrouped = appointment.isGroup && groupAppointments.length > 1;

  // Check if the appointment's customer is a guardian and find their dependents
  const customer = customers.find(s => s.id === appointment.customer_id);
  const dependentsOfGuardian = !isGrouped && customer && !customer.guardian_id
    ? customers.filter(s => s.guardian_id === customer.id && s.status === "active")
    : [];
  const showDependents = dependentsOfGuardian.length > 0;

  const handleStatusUpdate = async (newStatus, specificAppointment) => {
    setIsUpdating(true);
    const targetAppointment = specificAppointment || appointment;
    const extraData = newStatus === "present" && tipAmount > 0
      ? { tip_amount: tipAmount, tip_payment_method: tipPaymentMethod }
      : {};
    await onUpdateStatus(targetAppointment.id, newStatus, notes, extraData);
    setIsUpdating(false);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return;
    setIsUpdating(true);
    if (onReschedule) {
      await onReschedule(appointment, rescheduleDate, rescheduleTime);
    }
    setShowRescheduleForm(false);
    setIsUpdating(false);
    onClose();
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(appointment.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  const status = statusConfig[appointment.status] || statusConfig.scheduled;

  return (
    <React.Fragment>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Detalhes do Agendamento</span>
              {!isGrouped && (
                <span className={cn("text-xs px-2 py-1 rounded-full", status.bg, status.color)}>
                  {status.label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Customer Info */}
            {isGrouped ? (
              <div className="p-3 bg-surface-container-low rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-1">
                  <Users className="w-4 h-4 text-branding-primary" />
                  <span>Atendimento em grupo ({groupAppointments.length} clientes)</span>
                </div>
                {groupAppointments.map((gl, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {gl.customer_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-on-surface text-sm">{gl.customer_name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {(gl.service_category || gl.modality) ? (gl.service_category || gl.modality).charAt(0).toUpperCase() + (gl.service_category || gl.modality).slice(1) : "Serviço"} • {gl.duration_mins} min
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-semibold">
                  {appointment.customer_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-on-surface">{appointment.customer_name}</p>
                  <p className="text-sm text-on-surface-variant capitalize">
                    {(appointment.service_category || appointment.modality) ? (appointment.service_category || appointment.modality).charAt(0).toUpperCase() + (appointment.service_category || appointment.modality).slice(1) : "Serviço"}
                  </p>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-xl">
                <Calendar className="w-5 h-5 text-branding-primary" />
                <div>
                  <p className="text-xs text-on-surface-variant">Data</p>
                  <p className="font-medium text-on-surface">
                    {format(parseISO(appointment.date), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-xl">
                <Clock className="w-5 h-5 text-branding-secondary" />
                <div>
                  <p className="text-xs text-on-surface-variant">Horário</p>
                  <p className="font-medium text-on-surface">
                    {appointment.start_time} - {appointment.end_time}
                  </p>
                </div>
              </div>
            </div>

            {/* Duration - only show for single appointment */}
            {!isGrouped && (
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <span className="text-on-surface-variant">Duração</span>
                <span className="font-semibold text-on-surface">{appointment.duration_mins} minutos</span>
              </div>
            )}

            {/* Dependents of a Guardian */}
            {showDependents && (
              <div className="p-4 bg-purple-500/10 rounded-xl space-y-2 border border-purple-500/20">
                <p className="text-sm font-medium text-purple-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Dependentes vinculados: {dependentsOfGuardian.map(d => d.name).join(", ")}
                </p>
                <p className="text-xs text-purple-400">Os agendamentos destes dependentes aparecerão separadamente na agenda.</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-on-surface mb-2 block">
                Observações
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicionar observações..."
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>

            {/* Tip Section - only show when not yet present and not cancelled */}
            {appointment.status !== "cancelled" && appointment.status !== "present" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-200">Gorjeta (opcional)</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.50"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="pl-8 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[5, 10, 20].map(val => (
                      <Button
                        key={val}
                        size="sm"
                        variant="outline"
                        className="h-9 px-2 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/100/20"
                        onClick={() => setTipAmount(val)}
                      >
                        R${val}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTipPaymentMethod("cash")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      tipPaymentMethod === "cash"
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                        : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Dinheiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipPaymentMethod("pix")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      tipPaymentMethod === "pix"
                        ? "border-blue-500/70 bg-blue-500/10 text-blue-300"
                        : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipPaymentMethod("card")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      tipPaymentMethod === "card"
                        ? "border-purple-500/70 bg-purple-500/10 text-purple-300"
                        : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Cartão
                  </button>
                </div>
              </div>
            )}

            {/* Show existing tip if already present */}
            {appointment.status === "present" && appointment.tip_amount > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Gorjeta registrada</span>
                </div>
                <span className="font-semibold text-emerald-200">
                  R$ {Number(appointment.tip_amount).toFixed(2).replace(".", ",")}
                </span>
              </div>
            )}

            {/* Calendar Links */}
            {appointment.status !== "cancelled" && appointment.date && (
              <div className="p-3 bg-branding-primary/5 border border-branding-primary/10 rounded-xl space-y-2">
                <p className="text-xs font-medium text-branding-primary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Adicionar ao calendário
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-outline-variant/30"
                    onClick={() => downloadICS(appointment, null, null)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Baixar .ics
                  </Button>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent((appointment.service_category || appointment.modality) ? (appointment.service_category || appointment.modality).charAt(0).toUpperCase() + (appointment.service_category || appointment.modality).slice(1) : "Serviço")}&dates=${appointment.date?.replace(/-/g, "")}T${(appointment.start_time || "09:00").replace(":", "")}00/${appointment.date?.replace(/-/g, "")}T${(appointment.end_time || "09:30").replace(":", "")}00`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="h-7 text-xs border-outline-variant/30" type="button">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Google
                    </Button>
                  </a>
                  <a
                    href={`https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent((appointment.service_category || appointment.modality) ? (appointment.service_category || appointment.modality).charAt(0).toUpperCase() + (appointment.service_category || appointment.modality).slice(1) : "Serviço")}&startdt=${appointment.date}T${appointment.start_time || "09:00"}:00&enddt=${appointment.date}T${appointment.end_time || "09:30"}:00`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="h-7 text-xs border-outline-variant/30" type="button">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Outlook
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {appointment.status !== "cancelled" && (
              isGrouped ? (
                <div className="space-y-2 pt-2">
                  {groupAppointments.map((gl, idx) => (
                    <div key={idx} className="p-3 bg-surface-container-low rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-on-surface">{gl.customer_name}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          statusConfig[gl.status]?.bg || "bg-surface-container",
                          statusConfig[gl.status]?.color || "text-on-surface-variant"
                        )}>
                          {statusConfig[gl.status]?.label || "Agendada"}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {gl.status !== "present" && gl.status !== "cancelled" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate("present", gl)}
                            disabled={isUpdating}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-500/80 rounded-lg text-xs h-8"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Presença
                          </Button>
                        )}
                        {gl.status !== "absent" && gl.status !== "cancelled" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate("absent", gl)}
                            disabled={isUpdating}
                            variant="outline"
                            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/100/10 rounded-lg text-xs h-8"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Falta
                          </Button>
                        )}
                        {gl.status !== "cancelled" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate("cancelled", gl)}
                            disabled={isUpdating}
                            variant="ghost"
                            className="w-full border border-red-500/30 text-red-400 hover:bg-red-500/100/10 rounded-lg text-xs h-7 mt-1"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Cancelar agendamento de {gl.customer_name?.split(" ")[0]}
                          </Button>
                        )}
                        {gl.status === "cancelled" && (
                          <p className="text-xs text-on-surface-variant italic w-full text-center">Agendamento cancelado</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  {appointment.status !== "present" && (
                    <Button
                      onClick={() => handleStatusUpdate("present")}
                      disabled={isUpdating}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-500/80 rounded-xl"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marcar Presença
                    </Button>
                  )}
                  {appointment.status !== "absent" && (
                    <Button
                      onClick={() => handleStatusUpdate("absent")}
                      disabled={isUpdating}
                      variant="outline"
                      className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/100/10 rounded-xl"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Marcar Falta
                    </Button>
                  )}
                </div>
              )
            )}

            {/* Reschedule for absent appointments */}
            {appointment.status === "absent" && !appointment.rescheduled && (
              <div>
                {!showRescheduleForm ? (
                  <Button
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-300 hover:bg-amber-500/100/10 rounded-xl"
                    onClick={() => setShowRescheduleForm(true)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                     Reagendar este agendamento
                  </Button>
                ) : (
                  <div className="space-y-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <p className="text-sm font-medium text-amber-200">Reagendar agendamento para:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-on-surface-variant mb-1 block">Data</label>
                        <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-on-surface-variant mb-1 block">Horário</label>
                        <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="rounded-xl text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowRescheduleForm(false)} className="flex-1 rounded-xl text-sm">Cancelar</Button>
                      <Button
                        onClick={handleReschedule}
                        disabled={isUpdating || !rescheduleDate || !rescheduleTime}
                        className="flex-1 bg-amber-500/100 hover:bg-amber-600 rounded-xl text-sm"
                      >
                        {isUpdating ? "Salvando..." : "Confirmar"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {appointment.status === "absent" && appointment.rescheduled && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-300">
                <RefreshCw className="w-4 h-4" />
                Esta falta foi reagendada
              </div>
            )}

            {appointment.cancellation_reason && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-200">Motivo do cancelamento</p>
                  <p className="text-sm text-amber-300 mt-1">{appointment.cancellation_reason}</p>
                </div>
              </div>
            )}

            {/* Delete Button */}
            <div className="pt-4 border-t border-outline-variant/10">
              <Button
                variant="outline"
                className="w-full text-red-400 hover:bg-red-500/100/10 hover:text-red-300 border-red-500/30 rounded-xl"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                 Excluir Agendamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {isGrouped ? "estes agendamentos" : <>este agendamento de <strong>{appointment?.customer_name}</strong></>}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-error hover:bg-error/80"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>
  );
}
