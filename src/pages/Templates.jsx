import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { 
  MessageSquare, 
  Plus,
  Save,
  Send,
  Smartphone,
  CheckCircle,
  DollarSign,
  Calendar as CalendarIcon,
  AlertTriangle,
  Sparkles,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const triggerTypes = [
  { value: "welcome", label: "Boas-vindas", icon: Sparkles },
  { value: "payment_link", label: "Link de Pagamento", icon: DollarSign },
  { value: "service_confirmation", label: "Confirmação de Serviço", icon: CalendarIcon },
  { value: "low_credits", label: "Créditos Baixos", icon: AlertTriangle },
  { value: "monthly_billing", label: "Cobrança Mensal (dia 28)", icon: CheckCircle },
  { value: "service_cancelled", label: "Serviço Cancelado pelo Profissional", icon: XCircle },
];

const variables = [
  { value: "{nome_cliente}", label: "Nome do Cliente" },
  { value: "{data_servico}", label: "Data do Serviço" },
  { value: "{horario_servico}", label: "Horário" },
  { value: "{modalidade}", label: "Tipo de Serviço" },
  { value: "{saldo_creditos}", label: "Saldo de Créditos" },
  { value: "{valor_plano}", label: "Valor do Plano" },
  { value: "{link_pagamento}", label: "Link de Pagamento" },
  { value: "{link_portal}", label: "Link do Portal" },
  { value: "{servicos_realizados}", label: "Serviços Realizados" },
  { value: "{servicos_cancelados}", label: "Serviços Cancelados" },
  { value: "{total_servicos}", label: "Total de Serviços" },
  { value: "{vencimento}", label: "Data de Vencimento" },
];

const defaultMessages = {
  service_confirmation: `Olá, {nome_cliente}! ✂️

Lembrando seu serviço de {modalidade} amanhã, {data_servico} às {horario_servico}.

Por favor, confirme sua presença ou avise se não puder ir pelo portal:
🔗 {link_portal}

👤 Acesse com seu e-mail e a senha *123456*

Você ainda tem {saldo_creditos} crédito(s) restante(s).

Até lá! 💙`,
  low_credits: `Oi, {nome_cliente}! 👋

Seu saldo está baixo: apenas {saldo_creditos} serviço(s) restante(s).

Renove seu plano e continue aproveitando! ✂️

Acesse seu portal:
🔗 {link_portal}
👤 E-mail + senha *123456*`,
  welcome: `Bem-vindo(a) à AgendaFlow, {nome_cliente}! 🎉

Estamos muito felizes em tê-lo(a) conosco! 💙

Acesse seu portal do cliente para ver seus serviços e faturas:
🔗 {link_portal}
👤 Use seu e-mail e a senha *123456*

Qualquer dúvida, estamos à disposição!`,
  payment_link: `Olá, {nome_cliente}! 💳

Sua fatura no valor de R$ {valor_plano} está disponível.

Clique para pagar: {link_pagamento}

Ou acesse o portal para ver todas as suas faturas:
🔗 {link_portal}
👤 E-mail + senha *123456*`,
  monthly_billing: `Olá, {nome_cliente}! ✂️

Resumo dos seus serviços deste mês:

✅ *Realizados:* {servicos_realizados} serviços
❌ *Cancelados:* {servicos_cancelados} serviços
📊 *Total:* {total_servicos} serviços

💰 *Valor:* R$ {valor_plano}
📅 *Vencimento:* {vencimento}

🔗 *Pague pelo link:* {link_pagamento}

Ou acesse o portal: {link_portal}
👤 E-mail + senha *123456*`,
  service_cancelled: `Olá, {nome_cliente}! 😊

Gostaríamos de informar que o seu serviço de {modalidade} do dia *{data_servico}* às *{horario_servico}* foi cancelado pelo profissional.

Pedimos desculpas pelo inconveniente. Em breve entraremos em contato para reagendar. 🤝

Qualquer dúvida, estamos à disposição! 💙`
};

export default function Templates() {
  const queryClient = useQueryClient();
  const { companyId, isProfissional, isSuperAdmin, ready } = useCurrentUser();
  const [selectedTrigger, setSelectedTrigger] = useState("service_confirmation");
  const [messageText, setMessageText] = useState(defaultMessages.service_confirmation);
  const [isEnabled, setIsEnabled] = useState(true);
  const [sendBefore, setSendBefore] = useState("24");
  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const [testCompanyId, setTestCompanyId] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', companyId, isProfissional],
    queryFn: async () => {
      const all = await db.entities.Template.list();
      if (companyId && !isSuperAdmin) return all.filter(t => t.company_id === companyId);
      return all;
    },
    enabled: ready,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-for-test'],
    queryFn: () => db.entities.Company.filter({ active: true }),
    enabled: ready && !isProfissional,
  });

  // Set default testCompanyId when companies load
  useEffect(() => {
    if (!isProfissional && !testCompanyId && companies.length > 0) {
      setTestCompanyId(companies[0].id);
    }
    }, [companies, isProfissional]);

  // Reload displayed template when templates finish loading
  useEffect(() => {
    if (templates.length > 0) {
      const existing = templates.find(t =>
        t.trigger === selectedTrigger &&
        (isProfissional ? t.company_id === companyId : true)
      );
      if (existing) {
        setMessageText(existing.message);
        setIsEnabled(existing.enabled ?? true);
        setSendBefore(existing.send_before_hours?.toString() || "24");
      }
    }
  }, [templates]);  

  const effectiveCompanyId = isProfissional ? companyId : (testCompanyId || null);



  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Match existing template scoped to same company_id
      const existing = templates.find(t =>
        t.trigger === selectedTrigger &&
        (isProfissional ? t.company_id === companyId : true)
      );
      if (existing) {
        return db.entities.Template.update(existing.id, data);
      } else {
        return db.entities.Template.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success("Template salvo com sucesso!");
    },
  });

  const handleInsertVariable = (variable) => {
    setMessageText(prev => prev + " " + variable);
  };

  const handleTriggerChange = (trigger) => {
    setSelectedTrigger(trigger);
    // Professors: match only their company's template; Admins: match first found
    const existing = templates.find(t =>
      t.trigger === trigger &&
      (isProfissional ? t.company_id === companyId : true)
    );
    if (existing) {
      setMessageText(existing.message);
      setIsEnabled(existing.enabled);
      setSendBefore(existing.send_before_hours?.toString() || "24");
    } else {
      setMessageText(defaultMessages[trigger] || "");
      setIsEnabled(true);
      setSendBefore("24");
    }
  };

  const handleSave = () => {
    // Teachers always save with their own company_id
    // Admins save without company_id (global) unless they have one
    const saveCompanyId = isProfissional && !isSuperAdmin ? (companyId || undefined) : (companyId || undefined);
    saveMutation.mutate({
      trigger: selectedTrigger,
      message: messageText,
      enabled: isEnabled,
      send_before_hours: selectedTrigger === "service_confirmation" ? parseInt(sendBefore) : undefined,
      company_id: saveCompanyId,
    });
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      toast.error("Digite um número de WhatsApp para teste");
      return;
    }
    if (!effectiveCompanyId) {
      toast.error("Selecione uma empresa para o teste.");
      return;
    }
    setIsSendingTest(true);
    try {
      const previewText = messageText
        .replace(/{nome_cliente}/g, "João Silva")
        .replace(/{modalidade}/g, "Corte")
        .replace(/{data_servico}/g, "15/01")
        .replace(/{horario_servico}/g, "09:00")
        .replace(/{saldo_creditos}/g, "3")
        .replace(/{valor_plano}/g, "280,00")
        .replace(/{link_portal}/g, "link.app.com/portal")
        .replace(/{link_pagamento}/g, "asaas.com/b/xxx")
        .replace(/{servicos_realizados}/g, "10")
        .replace(/{servicos_cancelados}/g, "2")
        .replace(/{total_servicos}/g, "12")
        .replace(/{vencimento}/g, "05/04/2025");

      const res = await db.functions.invoke("whatsappSend", {
        company_id: effectiveCompanyId,
        phone: testPhone,
        message: previewText,
      });

      if (res.data?.ok) {
        toast.success(`Mensagem de teste enviada para ${testPhone}!`);
      } else {
        const errMsg = res.data?.error || "Erro ao enviar. Verifique a configuração do WhatsApp nas Configurações.";
        toast.error(errMsg, { duration: 8000 });
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || "Erro ao enviar mensagem de teste.";
      toast.error(errMsg, { duration: 8000 });
    } finally {
      setIsSendingTest(false);
    }
  };

  const selectedTriggerData = triggerTypes.find(t => t.value === selectedTrigger);
  const TriggerIcon = selectedTriggerData?.icon || MessageSquare;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E]">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            Templates WhatsApp
          </h1>
          <p className="text-on-surface-variant mt-1">Personalize mensagens automáticas</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Trigger Selection */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <Label className="text-sm font-medium text-on-surface mb-3 block">
                Gatilho de Automação
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {triggerTypes.map((trigger) => {
                  const Icon = trigger.icon;
                  const isActive = selectedTrigger === trigger.value;
                  
                  return (
                    <button
                      key={trigger.value}
                      onClick={() => handleTriggerChange(trigger.value)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-left",
                        isActive 
                          ? "border-branding-primary bg-branding-primary/10" 
                          : "border-outline-variant/30 hover:border-outline-variant/50"
                      )}
                    >
                      <Icon className={cn(
                        "w-5 h-5 mb-2",
                        isActive ? "text-branding-primary" : "text-on-surface-variant"
                      )} />
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-branding-primary" : "text-on-surface"
                      )}>
                        {trigger.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Automation Settings */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-sm font-medium text-on-surface">Ativar Automação</Label>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Enviar automaticamente quando o gatilho for ativado
                  </p>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              {selectedTrigger === "service_confirmation" && (
                <div className="mt-4">
                  <Label className="text-sm font-medium text-on-surface">Enviar antes do serviço</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={sendBefore}
                      onChange={(e) => setSendBefore(e.target.value)}
                      className="w-20 rounded-xl"
                      min="1"
                    />
                    <span className="text-sm text-on-surface-variant">horas antes</span>
                  </div>
                </div>
              )}
            </div>

            {/* Variables */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <Label className="text-sm font-medium text-on-surface mb-3 block">
                Variáveis Dinâmicas
              </Label>
              <div className="flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <button
                    key={variable.value}
                    onClick={() => handleInsertVariable(variable.value)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-branding-primary/10 text-branding-primary text-xs font-medium hover:bg-branding-primary/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {variable.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-3">
                Clique para inserir variáveis na mensagem
              </p>
            </div>

            {/* Message Editor */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <Label className="text-sm font-medium text-on-surface mb-3 block">
                Texto da Mensagem
              </Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="rounded-xl resize-none font-mono text-sm"
                rows={10}
                placeholder="Digite sua mensagem..."
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-on-surface-variant">
                  {messageText.length} / 1024 caracteres
                </span>
              </div>
            </div>

            {/* Test Section */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <Label className="text-sm font-medium text-on-surface mb-3 block">
                Enviar Teste
              </Label>
              <div className="space-y-3">
                {!isProfissional && companies.length > 0 && (
                  <div>
                    <Label className="text-xs text-on-surface-variant mb-1 block">Empresa (WhatsApp da empresa)</Label>
                    <Select value={testCompanyId || ""} onValueChange={setTestCompanyId}>
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
                <div className="flex gap-3">
                  <Input
                    type="tel"
                    placeholder="5511999999999"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSendingTest ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
                <p className="text-xs text-on-surface-variant">Número com DDI+DDD, ex: 5511999999999</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1 btn-branding rounded-xl"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Template"}
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-branding-primary" />
                <Label className="text-sm font-medium text-on-surface">
                  Pré-visualização WhatsApp
                </Label>
              </div>

              {/* Phone Mockup */}
              <div className="relative w-full max-w-[320px] mx-auto aspect-[9/16] rounded-[2.5rem] border-8 border-on-surface bg-[#0b141a] overflow-hidden shadow-2xl">
                {/* Status Bar */}
                <div className="h-6 flex justify-between items-center px-6 pt-2 text-[10px] text-white/80">
                  <span>14:30</span>
                  <div className="flex gap-1">
                    <span>📶</span>
                    <span>📡</span>
                    <span>🔋</span>
                  </div>
                </div>

                {/* Chat Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#202c33]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white text-xs font-bold">
                    A
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">AgendaFlow</span>
                    <p className="text-[9px] text-white/60">online</p>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="relative bg-[#0b141a] h-[calc(100%-80px)] p-4 overflow-y-auto">
                  {/* Background Pattern */}
                  <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
                      backgroundSize: '10px 10px'
                    }}
                  />
                  
                  <div className="relative z-10 flex flex-col items-end gap-2">
                    <div className="max-w-[85%] bg-[#005c4b] text-white rounded-lg p-3 text-[11px] shadow-md relative">
                      <div className="absolute top-0 right-[-8px] w-0 h-0 border-l-[10px] border-l-[#005c4b] border-b-[10px] border-b-transparent" />
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {messageText
                          .replace(/{nome_cliente}/g, "João Silva")
                          .replace(/{modalidade}/g, "Corte")
                          .replace(/{data_servico}/g, "15/01")
                          .replace(/{horario_servico}/g, "09:00")
                          .replace(/{saldo_creditos}/g, "3")
                          .replace(/{valor_plano}/g, "280,00")
                          .replace(/{link_portal}/g, "link.app.com/...")
                          .replace(/{link_pagamento}/g, "asaas.com/...")
                          .replace(/{servicos_realizados}/g, "10")
                          .replace(/{servicos_cancelados}/g, "2")
                          .replace(/{total_servicos}/g, "12")
                          .replace(/{vencimento}/g, "05/04/2025")}
                      </div>
                      <div className="flex justify-end items-center gap-1 mt-1 text-[9px] opacity-70">
                        <span>14:30</span>
                        <span className="text-[#53bdeb]">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}