import { useState, useEffect } from "react";
import { Clock, Save, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DAYS_OF_WEEK = [
  { key: "dom", label: "Dom", full: "Domingo" },
  { key: "seg", label: "Seg", full: "Segunda" },
  { key: "ter", label: "Ter", full: "Terça" },
  { key: "qua", label: "Qua", full: "Quarta" },
  { key: "qui", label: "Qui", full: "Quinta" },
  { key: "sex", label: "Sex", full: "Sexta" },
  { key: "sab", label: "Sáb", full: "Sábado" },
];

const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h <= 23; h++) {
    options.push(`${h.toString().padStart(2, "0")}:00`);
    options.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return options;
};

const timeOptions = generateTimeOptions();

export default function BusinessHoursModal({ open, onClose, company, companies = [], companyId, isSuperAdmin, onSave }) {
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [openDays, setOpenDays] = useState(["seg", "ter", "qua", "qui", "sex", "sab"]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveCompany = company || companies.find(c => c.id === selectedCompanyId);
  const showCompanySelect = isSuperAdmin || companies.length > 1;

  useEffect(() => {
    if (open) {
      if (company) {
        setOpeningTime(company.opening_time || "");
        setClosingTime(company.closing_time || "");
        setOpenDays(company.open_days || []);
        setSelectedCompanyId(company.id);
      } else if (companies.length === 1) {
        setSelectedCompanyId(companies[0].id);
        setOpeningTime(companies[0].opening_time || "");
        setClosingTime(companies[0].closing_time || "");
        setOpenDays(companies[0].open_days || []);
      } else if (companyId && companies.find(c => c.id === companyId)) {
        const c = companies.find(co => co.id === companyId);
        setSelectedCompanyId(companyId);
        setOpeningTime(c?.opening_time || "");
        setClosingTime(c?.closing_time || "");
        setOpenDays(c?.open_days || []);
      } else {
        setOpeningTime("");
        setClosingTime("");
        setOpenDays([]);
      }
    }
  }, [open, company, companyId, companies]);

  const handleCompanyChange = (id) => {
    setSelectedCompanyId(id);
    const c = companies.find(co => co.id === id);
    if (c) {
      setOpeningTime(c.opening_time || "");
      setClosingTime(c.closing_time || "");
      setOpenDays(c.open_days || []);
    } else {
      setOpeningTime("");
      setClosingTime("");
      setOpenDays([]);
    }
  };

  const toggleDay = (dayKey) => {
    setOpenDays(prev =>
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    );
  };

  const targetCompanyId = company?.id || selectedCompanyId;

  const handleClear = async () => {
    const targets = isSuperAdmin && selectedCompanyId === "all"
      ? companies
      : (company ? [company] : (selectedCompanyId ? companies.filter(c => c.id === selectedCompanyId) : []));
    // Para admin, companies já está filtrado para só suas empresas em Schedule.jsx:885, então "Todas" são só suas
    const effectiveTargets = targets.length ? targets : (companies.length ? [companies[0]] : []);
    if (!effectiveTargets.length) {
      toast.error("Selecione uma empresa");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(effectiveTargets.map(c => onSave({ opening_time: null, closing_time: null, open_days: [] }, c.id)));
      toast.success(`Horário limpo para ${effectiveTargets.length} empresa(s)`);
      onClose();
    } catch (err) {
      toast.error("Erro ao limpar: " + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!targetCompanyId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    if (!openingTime || !closingTime) {
      toast.error("Selecione abertura e fechamento");
      return;
    }
    if (openingTime >= closingTime) {
      toast.error("O horário de abertura deve ser anterior ao horário de fechamento");
      return;
    }
    if (openDays.length === 0) {
      toast.error("Selecione pelo menos um dia de funcionamento");
      return;
    }
    setSaving(true);
    try {
      await onSave({ opening_time: openingTime, closing_time: closingTime, open_days: openDays }, targetCompanyId);
      toast.success("Horário de funcionamento atualizado!");
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar horário: " + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const noCompany = !targetCompanyId && companies.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-branding-primary" />
            Horário de Funcionamento
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
              <Label className="text-sm font-medium text-on-surface">Dias de Funcionamento</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      openDays.includes(day.key)
                        ? "bg-branding-primary text-white"
                        : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Abertura</Label>
              <Select value={openingTime} onValueChange={setOpeningTime}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={`open-${t}`} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">Fechamento</Label>
              <Select value={closingTime} onValueChange={setClosingTime}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={`close-${t}`} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-xl bg-branding-primary/5 border border-branding-primary/20 text-sm text-branding-primary flex items-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                {openingTime && closingTime ? (
                  <>
                    Horário: <strong>{openingTime} - {closingTime}</strong>
                    {openDays.length > 0 && openDays.length < 7 && (
                      <span className="block text-xs mt-0.5 opacity-70">
                        {openDays.map(d => DAYS_OF_WEEK.find(day => day.key === d)?.full).filter(Boolean).join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="opacity-70">Nenhum horário configurado</span>
                )}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Cancelar
          </Button>
          {!noCompany && (
            <>
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={saving}
                className="flex-1 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar horário
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl btn-branding"
              >
                {saving ? "Salvando..." : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
