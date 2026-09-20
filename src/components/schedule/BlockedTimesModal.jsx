import { useState, useEffect } from "react";
import { Clock, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h <= 23; h++) {
    options.push(`${h.toString().padStart(2, "0")}:00`);
    options.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return options;
};

const timeOptions = generateTimeOptions();

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export default function BlockedTimesModal({ open, onClose, company, companies = [], companyId, isSuperAdmin, onSave }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [description, setDescription] = useState("");
  const [blockAllBarbers, setBlockAllBarbers] = useState(true);
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState("1");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveCompany = company || companies.find(c => c.id === selectedCompanyId);
  const showCompanySelect = isSuperAdmin || companies.length > 1;

  useEffect(() => {
    if (open) {
      if (company) {
        setSelectedCompanyId(company.id);
      } else if (companies.length === 1) {
        setSelectedCompanyId(companies[0].id);
      } else if (companyId && companies.find(c => c.id === companyId)) {
        setSelectedCompanyId(companyId);
      }
      setSelectedDate(new Date());
      setStartTime("08:00");
      setEndTime("18:00");
      setDescription("");
      setBlockAllBarbers(true);
      setRecurrenceType("none");
      setSelectedDayOfWeek("1");
      setPeriodStartDate("");
      setPeriodEndDate("");
    }
  }, [open, company, companyId, companies]);

  const handleCompanyChange = (id) => {
    setSelectedCompanyId(id);
  };

  const targetCompanyId = company?.id || selectedCompanyId;

  const handleSave = async () => {
    if (!targetCompanyId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    if (!selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    if (startTime >= endTime) {
      toast.error("O horário de início deve ser anterior ao horário de fim");
      return;
    }
    if (recurrenceType === "period" && (!periodStartDate || !periodEndDate)) {
      toast.error("Defina o período de repetição");
      return;
    }

    setSaving(true);
    try {
      const blockedTimeData = {
        company_id: targetCompanyId,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        description,
        block_all_barbers: blockAllBarbers,
        recurrence_type: recurrenceType,
        recurrence_day_of_week: recurrenceType === "weekly" ? parseInt(selectedDayOfWeek) : null,
        period_start_date: recurrenceType === "period" ? periodStartDate : null,
        period_end_date: recurrenceType === "period" ? periodEndDate : null,
      };

      await onSave(blockedTimeData);
      toast.success("Horário bloqueado com sucesso!");
      onClose();
    } catch (err) {
      toast.error("Erro ao bloquear horário: " + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const noCompany = !targetCompanyId && companies.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400" />
            Adicionar horário bloqueado
          </DialogTitle>
        </DialogHeader>

        {noCompany ? (
          <div className="py-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Nenhuma empresa vinculada à sua conta. Fale com o suporte.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {showCompanySelect && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-on-surface">Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Data</Label>
              <div className="rounded-xl border border-outline-variant/30 p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-on-surface">Horário de Início</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="rounded-xl">
                    <Clock className="w-4 h-4 mr-2 text-on-surface-variant" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={`start-${t}`} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-on-surface">Horário de Fim</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="rounded-xl">
                    <Clock className="w-4 h-4 mr-2 text-on-surface-variant" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={`end-${t}`} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Descrição</Label>
              <Input
                placeholder="Ex: Horário de almoço"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <Checkbox
                id="blockAllBarbers"
                checked={blockAllBarbers}
                onCheckedChange={setBlockAllBarbers}
              />
              <Label htmlFor="blockAllBarbers" className="text-sm font-medium text-on-surface cursor-pointer">
                Bloquear este horário para TODOS OS PROFISSIONAIS
              </Label>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-on-surface">Opções</Label>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="weekly"
                    checked={recurrenceType === "weekly"}
                    onCheckedChange={(checked) => setRecurrenceType(checked ? "weekly" : "none")}
                  />
                  <Label htmlFor="weekly" className="text-sm text-on-surface-variant cursor-pointer">
                    Repetir este bloqueio de horário UM DIA DA SEMANA
                  </Label>
                </div>

                {recurrenceType === "weekly" && (
                  <div className="ml-8">
                    <Select value={selectedDayOfWeek} onValueChange={setSelectedDayOfWeek}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="daily"
                    checked={recurrenceType === "daily"}
                    onCheckedChange={(checked) => setRecurrenceType(checked ? "daily" : "none")}
                  />
                  <Label htmlFor="daily" className="text-sm text-on-surface-variant cursor-pointer">
                    Repetir este bloqueio de horário TODOS OS DIAS
                  </Label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="period"
                    checked={recurrenceType === "period"}
                    onCheckedChange={(checked) => setRecurrenceType(checked ? "period" : "none")}
                  />
                  <Label htmlFor="period" className="text-sm text-on-surface-variant cursor-pointer">
                    Bloquear um PERÍODO ESPECÍFICO
                  </Label>
                </div>

                {recurrenceType === "period" && (
                  <div className="ml-8 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-on-surface-variant">Data Início</Label>
                      <Input
                        type="date"
                        value={periodStartDate}
                        onChange={(e) => setPeriodStartDate(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-on-surface-variant">Data Fim</Label>
                      <Input
                        type="date"
                        value={periodEndDate}
                        onChange={(e) => setPeriodEndDate(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Cancelar
          </Button>
          {!noCompany && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? "Salvando..." : (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  Bloquear horário
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
