import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, Phone, Mail, MapPin, FileText, CreditCard, Upload, Calendar, Building2, Users, Loader2, Search, X, Plus, AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { db, setCustomerCompanies } from "@/api/dbClient";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logger } from "@/lib/debugLogger";
import CompanyMultiSelect from "@/components/settings/CompanyMultiSelect";
import { formatPhone, formatCPF, formatCEP } from "@/utils/formatters";

const InputWithIcon = ({ icon: Icon, label, id, ...props }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-on-surface">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input {...props} className="pl-10 rounded-xl border-outline-variant focus:border-branding-primary focus:ring-branding-primary" />
    </div>
  </div>
);

export default function CustomerForm({ customer, plans, companies = [], customers = [], onSubmit, onCancel, isLoading, isTeacher, teacherCompanyId, guardianMode = false, guardianName = "", isSuperAdmin = false }) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    logger.info("CustomerForm props", {
      customer: customer ? { id: customer.id, name: customer.name, guardian_id: customer.guardian_id, status: customer.status } : null,
      customersCount: customers.length,
      customersSummary: customers.map(c => ({ id: c.id, name: c.name, guardian_id: c.guardian_id, status: c.status })),
      isEditing: !!customer,
    });
  }, [customer, customers]);

  const normalizeCustomer = (cust) => {
    if (!cust) return null;
    return {
      ...cust,
      name: cust.name ?? "",
      cpf: cust.cpf ?? "",
      rg: cust.rg ?? "",
      email: cust.email ?? "",
      whatsapp: cust.whatsapp ?? "",
      guardian_id: cust.guardian_id ?? cust.guardianId ?? "",
      billing_mode: cust.billing_mode ?? cust.billingMode ?? "individual",
      company_ids: cust.company_ids ?? cust.companyIds ?? [],
      custom_plan: cust.custom_plan ?? cust.customPlan ?? null,
      plan_id: cust.plan_id ?? cust.planId ?? "",
      current_credits: cust.current_credits ?? cust.currentCredits ?? 0,
      access_token: cust.access_token ?? cust.accessToken ?? null,
      medical_certificate_url: cust.medical_certificate_url ?? cust.medicalCertificateUrl ?? null,
      portal_enabled: cust.portal_enabled ?? cust.portalEnabled ?? true,
      teacher_id: cust.teacher_id ?? cust.teacherId ?? null,
      address_street: cust.address_street ?? cust.addressStreet ?? "",
      address_number: cust.address_number ?? cust.addressNumber ?? "",
      address_complement: cust.address_complement ?? cust.addressComplement ?? "",
      address_neighborhood: cust.address_neighborhood ?? cust.addressNeighborhood ?? "",
      address_city: cust.address_city ?? cust.addressCity ?? "",
      address_state: cust.address_state ?? cust.addressState ?? "",
      address_zipcode: cust.address_zipcode ?? cust.addressZipcode ?? "",
      birth_date: cust.birth_date ?? cust.birthDate ?? "",
      notes: cust.notes ?? "",
    };
  };

  const determineInitialType = () => {
    if (!customer) return "independent";
    const norm = normalizeCustomer(customer);
    if (norm.guardian_id) return "dependent";
    if (customers.some(c => (c.guardian_id ?? c.guardianId) === customer.id)) return "guardian";
    return "independent";
  };

  const [customerType, setCustomerType] = useState(determineInitialType());
  const [cepLoading, setCepLoading] = useState(false);

  const initialCustomer = normalizeCustomer(customer);
  const [formData, setFormData] = useState(() => {
    if (initialCustomer) return initialCustomer;
    try {
      const saved = localStorage.getItem("form_draft_customer");
      return saved ? JSON.parse(saved) : {
        name: "",
        cpf: "",
        rg: "",
        email: "",
        whatsapp: "",
        birth_date: "",
        address_street: "",
        address_number: "",
        address_complement: "",
        address_neighborhood: "",
        address_city: "",
        address_state: "",
        address_zipcode: "",
        plan_id: "",
        company_ids: [],
        notes: "",
        medical_certificate_url: "",
        custom_plan: null,
        billing_mode: "individual",
        guardian_id: "",
        portal_enabled: true,
      };
    } catch {
      return {
        name: "", cpf: "", rg: "", email: "", whatsapp: "", birth_date: "",
        address_street: "", address_number: "", address_complement: "",
        address_neighborhood: "", address_city: "", address_state: "", address_zipcode: "",
        plan_id: "", company_ids: [], notes: "", medical_certificate_url: "",
        custom_plan: null, billing_mode: "individual", guardian_id: "", portal_enabled: true,
      };
    }
  });

  useEffect(() => {
    if (!initialCustomer) {
      localStorage.setItem("form_draft_customer", JSON.stringify(formData));
    }
  }, [formData, initialCustomer]);

  const [dependentIds, setDependentIds] = useState(
    initialCustomer ? customers.filter(c => (c.guardian_id ?? c.guardianId) === initialCustomer.id).map(c => c.id) : []
  );
  const [dependentSearch, setDependentSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [planType, setPlanType] = useState(initialCustomer?.custom_plan ? "custom" : "standard");
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [guardianFormData, setGuardianFormData] = useState({
    name: "",
    cpf: "",
    whatsapp: "",
    email: "",
  });
  const [guardianLoading, setGuardianLoading] = useState(false);

  const handleGuardianChange = (field, value) => {
    setGuardianFormData(prev => ({ ...prev, [field]: value }));
  };

  const createGuardian = async () => {
    const { name, cpf, whatsapp, email } = guardianFormData;
    if (!name?.trim() || !cpf?.trim() || !whatsapp?.trim()) {
      toast.error("Nome, CPF e WhatsApp são obrigatórios para o responsável");
      return null;
    }

    setGuardianLoading(true);
    try {
      const accessToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      // Determina empresa do responsável: usa teacherCompanyId (admin de 1 empresa) ou company_ids selecionados
      const guardianCompanyIds = isTeacher
        ? (teacherCompanyId ? [teacherCompanyId] : [])
        : (formData.company_ids || []);
      const guardianCompanyId = guardianCompanyIds[0] || null;
      const guardian = await db.entities.Customer.create({
        name: name.trim(),
        cpf: cpf.replace(/\D/g, ""),
        whatsapp: whatsapp.replace(/\D/g, ""),
        email: email?.trim() || null,
        access_token: accessToken,
        current_credits: 0,
        status: "active",
        company_id: guardianCompanyId,
        billing_mode: "individual",
        portal_enabled: false,
      });
      // Garante vínculo multi-tenant via junction (RLS usa customer_companies)
      if (guardianCompanyIds.length > 0) {
        try {
          await setCustomerCompanies(guardian.id, guardianCompanyIds);
        } catch (e) {
          logger.warn("Falha ao vincular responsável à empresa", e);
        }
      }
      
logger.info("Guardian created via mini-form", guardian);
      toast.success("Responsável cadastrado com sucesso!");
      
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      
      setGuardianFormData({ name: "", cpf: "", whatsapp: "", email: "" });
      setShowGuardianModal(false);
      
      return guardian;
    } catch (err) {
      logger.error("Error creating guardian", err);
      toast.error("Erro ao cadastrar responsável: " + (err?.message || "tente novamente"));
      return null;
    } finally {
      setGuardianLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      handleChange("medical_certificate_url", file_url);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const lookupCep = async (cep) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await db.functions.invoke('lookupCep', { cep: clean });
      const data = response.data;
      if (!data.error) {
        setFormData(prev => ({
          ...prev,
          address_street: data.street,
          address_neighborhood: data.neighborhood,
          address_city: data.city,
          address_state: data.state,
        }));
      }
    } catch (_) {
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (e) => {
    const formatted = formatCEP(e.target.value);
    handleChange("address_zipcode", formatted);
    if (formatted.replace(/\D/g, '').length === 8) {
      lookupCep(formatted);
    }
  };

  const handleTypeChange = (type) => {
    setCustomerType(type);
    if (type === "independent") {
      handleChange("guardian_id", "");
      handleChange("billing_mode", "individual");
      setDependentIds([]);
    } else if (type === "dependent") {
      setDependentIds([]);
      handleChange("billing_mode", "consolidated");
    } else if (type === "guardian") {
      handleChange("guardian_id", "");
      handleChange("billing_mode", "individual");
    }
  };

  const availableGuardians = customers.filter(c => {
    const guardianId = c.guardian_id ?? c.guardianId;
    return c.id !== (customer?.id ?? initialCustomer?.id) && c.status !== "inactive" && !guardianId;
  });

  useEffect(() => {
    console.log("[CustomerForm] All customers:", customers.map(c => ({
      id: c.id,
      name: c.name,
      guardian_id: c.guardian_id,
      guardianId: c.guardianId,
      status: c.status
    })));
  }, [customers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    logger.group("CustomerForm handleSubmit");
    logger.info("formData", formData);
    logger.info("customerType", customerType);
    logger.info("dependentIds", dependentIds);
    logger.info("customer (editing)", customer ? { id: customer.id, name: customer.name } : null);
    
    if (formData.guardian_id) {
      const selectedGuardian = customers.find(c => c.id === formData.guardian_id);
      logger.info("Guardian validation", { 
        guardian_id: formData.guardian_id, 
        selectedGuardian: selectedGuardian ? { id: selectedGuardian.id, name: selectedGuardian.name, guardian_id: selectedGuardian.guardian_id } : null 
      });
      if (selectedGuardian?.guardian_id) {
        logger.warn("VALIDATION FAILED: dependent cannot be guardian");
        return toast.error("Um dependente não pode ser responsável financeiro.");
      }
    }
    
    if (!formData.name?.trim()) {
      return toast.error("O campo Nome é obrigatório");
    }

    const normalizeValue = (value) => (value ?? "").toString().replace(/\D/g, "").trim();
    const normalizeRG = (value) => (value ?? "").toString().replace(/\s+/g, "").trim().toUpperCase();

    const cpfValue = normalizeValue(formData.cpf);
    const rgValue = normalizeRG(formData.rg);
    const phoneValue = normalizeValue(formData.whatsapp);

    const duplicated = customers.filter(c => c.id !== customer?.id);

    const isIndependentOrGuardian = customerType === "independent" || customerType === "guardian";
    const hasPlanOrBilling = formData.plan_id || formData.custom_plan || formData.billing_mode === "consolidated";
    const needsEmail = formData.portal_enabled || hasPlanOrBilling;

    if (customerType === "guardian" && !phoneValue) {
      return toast.error("WhatsApp é obrigatório para responsáveis.");
    }

    if (isIndependentOrGuardian && needsEmail) {
      if (!cpfValue) {
        return toast.error("CPF é obrigatório para clientes com plano ou cobrança.");
      }
      if (!phoneValue) {
        return toast.error("WhatsApp é obrigatório para clientes com plano ou cobrança.");
      }
      if (!formData.email?.trim()) {
        return toast.error("E-mail é obrigatório para clientes com plano, cobrança ou portal habilitado.");
      }
    }

    if (customerType === "dependent" && !formData.guardian_id) {
      return toast.error("Selecione o responsável financeiro para o dependente.");
    }

    const hasPlan = formData.plan_id || formData.custom_plan;
    if (customerType === "dependent" && hasPlan && !formData.guardian_id) {
      return toast.error("Dependente com plano precisa ter responsável financeiro. Selecione um ou cadastre um novo.");
    }

    if (formData.guardian_id) {
      const selectedGuardian = customers.find(c => c.id === formData.guardian_id);
      if (selectedGuardian?.guardian_id) {
        return toast.error("Um dependente não pode ser responsável financeiro de outro cliente.");
      }
    }

    if (cpfValue && duplicated.some(c => normalizeValue(c.cpf) === cpfValue)) {
      return toast.error("CPF já cadastrado. Verifique se o cliente já existe.");
    }
    if (rgValue && duplicated.some(c => normalizeRG(c.rg) === rgValue)) {
      return toast.error("RG já cadastrado. Verifique se o cliente já existe.");
    }
    if (phoneValue && duplicated.some(c => normalizeValue(c.whatsapp) === phoneValue)) {
      return toast.error("Telefone/WhatsApp já cadastrado. Verifique se o cliente já existe.");
    }

    const finalData = { ...formData };
    if (customerType === "independent") {
      finalData.guardian_id = "";
      finalData.billing_mode = "individual";
    } else if (customerType === "dependent") {
      finalData.billing_mode = "consolidated";
    }
    
    logger.info("FINAL DATA to onSubmit", finalData);
    logger.info("dependentIds for guardian", customerType === "guardian" ? dependentIds : []);
    logger.groupEnd();
    localStorage.removeItem("form_draft_customer");
    localStorage.removeItem("form_draft_customer_open");
    onSubmit(finalData, customerType === "guardian" ? dependentIds : []);
  };

  const isDependent = customerType === "dependent";
  const isGuardian = customerType === "guardian";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Customer Type Selection */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-branding-primary" />
          Tipo de Cliente
        </h3>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "independent", label: "Independente", desc: "Cliente com cobrança própria" },
            { value: "guardian", label: "Responsável", desc: "Responsável financeiro por outros clientes" },
            { value: "dependent", label: "Dependente", desc: "Vinculado a um responsável financeiro" },
          ].map(opt => (
            <label
              key={opt.value}
              className={cn(
                "flex-1 min-w-[180px] cursor-pointer rounded-xl border-2 p-4 transition-all",
                customerType === opt.value
                  ? "border-branding-primary bg-branding-primary/5 shadow-sm"
                  : "border-outline-variant hover:border-outline"
              )}
            >
              <input
                type="radio"
                name="customer_type"
                value={opt.value}
                checked={customerType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
                className="sr-only"
              />
              <p className={cn("font-medium text-sm", customerType === opt.value ? "text-branding-primary" : "text-on-surface")}>
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Guardian section */}
      {isGuardian && (
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
          <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Dependentes
          </h3>
          
          {/* Currently linked dependents */}
          {dependentIds.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">{dependentIds.length} dependente(s) vinculado(s):</p>
              <div className="flex flex-wrap gap-2">
                {dependentIds.map(id => {
                  const dep = customers.find(c => c.id === id);
                  if (!dep) return null;
                  return (
                    <Badge
                      key={id}
                      className="bg-purple-500/20 text-purple-300 border-purple-500/30 pl-3 pr-1.5 py-1.5 gap-1.5 text-sm"
                    >
                      {dep.name}
                      <button
                        type="button"
                        onClick={() => setDependentIds(prev => prev.filter(did => did !== id))}
                        className="ml-1 hover:bg-purple-500/30 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + add dependents */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Buscar cliente para vincular como dependente:</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={dependentSearch}
                onChange={(e) => setDependentSearch(e.target.value)}
                placeholder="Buscar por nome ou CPF..."
                className="pl-10 rounded-xl border-outline-variant"
              />
            </div>
            
            {dependentSearch.trim().length >= 2 && (() => {
              const cleanSearch = dependentSearch.toLowerCase().replace(/\D/g, "");
              const results = customers.filter(c => {
                if (c.id === customer?.id) return false;
                if (c.guardian_id && c.guardian_id !== customer?.id) return false;
                if (dependentIds.includes(c.id)) return false;
                if (c.status === "inactive") return false;
                const nameMatch = c.name?.toLowerCase().includes(dependentSearch.toLowerCase());
                const cpfMatch = c.cpf?.replace(/\D/g, "").includes(cleanSearch);
                return nameMatch || cpfMatch;
              });
              
              return results.length > 0 ? (
                <div className="border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/30 max-h-48 overflow-y-auto">
                  {results.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setDependentIds(prev => [...prev, c.id]);
                        setDependentSearch("");
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-purple-500/100/10 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-on-surface">{c.name}</p>
                        {c.cpf && <p className="text-xs text-muted-foreground">CPF: {c.cpf}</p>}
                      </div>
                      <Plus className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
              );
            })()}
          </div>
        </div>
      )}

      {/* Dependent section */}
      {isDependent && (
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
          <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Responsável Financeiro
          </h3>
          <Select
            value={formData.guardian_id || ""}
            onValueChange={(v) => {
              handleChange("guardian_id", v);
              handleChange("billing_mode", "consolidated");
            }}
          >
            <SelectTrigger className="rounded-xl border-outline-variant">
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const getGuardianId = (c) => c.guardian_id ?? c.guardianId;
                const guardians = customers.filter(c =>
                  c.id !== (customer?.id ?? initialCustomer?.id) &&
                  c.status !== "inactive" &&
                  !getGuardianId(c)
                );
                if (guardians.length !== availableGuardians.length) {
                  console.warn("[CustomerForm] Guardian list mismatch - forcing re-filter", {
                    availableGuardians: availableGuardians.map(g => g.name),
                    freshGuardians: guardians.map(g => g.name)
                  });
                }
                return guardians.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
          
          {(() => {
            const getGuardianId = (c) => c.guardian_id ?? c.guardianId;
            const guardiansCount = customers.filter(c =>
              c.id !== (customer?.id ?? initialCustomer?.id) &&
              c.status !== "inactive" &&
              !getGuardianId(c)
            ).length;
            
            if (guardiansCount === 0) {
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setShowGuardianModal(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Cadastrar Responsável Financeiro
                </Button>
              );
            }
            return null;
          })()}
          
          <p className="text-xs text-muted-foreground mt-2">As cobranças serão feitas no responsável selecionado.</p>
        </div>
      )}

      {/* Personal Info */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <h3 className="text-lg font-semibold text-on-surface mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-branding-primary" />
          Dados Pessoais
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <InputWithIcon
              icon={User}
              label="Nome Completo *"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <InputWithIcon
            icon={CreditCard}
            label="CPF"
            value={formData.cpf}
            onChange={(e) => handleChange("cpf", formatCPF(e.target.value))}
            placeholder="000.000.000-00"
          />

          <InputWithIcon
            icon={FileText}
            label="RG"
            value={formData.rg}
            onChange={(e) => handleChange("rg", e.target.value)}
            placeholder="Digite o RG"
          />

          <InputWithIcon
            icon={Calendar}
            label="Data de Nascimento"
            type="date"
            value={formData.birth_date}
            onChange={(e) => handleChange("birth_date", e.target.value)}
          />

          <div>
            <InputWithIcon
              icon={Mail}
              label={`E-mail${isDependent || (!formData.portal_enabled && !formData.plan_id && !formData.custom_plan && formData.billing_mode !== "consolidated") ? "" : " *"}`}
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="email@exemplo.com"
              required={!isDependent && (formData.portal_enabled || formData.plan_id || formData.custom_plan || formData.billing_mode === "consolidated")}
            />
            {!isDependent && !formData.email && (formData.portal_enabled || formData.plan_id || formData.custom_plan || formData.billing_mode === "consolidated") && (
              <p className="text-xs text-muted-foreground mt-1 ml-1">
                Sem e-mail o cliente perderá acesso ao Portal e à cobrança recorrente.
              </p>
            )}
          </div>

          <InputWithIcon
            icon={Phone}
            label={`WhatsApp${isDependent ? "" : " *"}`}
            value={formData.whatsapp}
            onChange={(e) => handleChange("whatsapp", formatPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            required={!isDependent}
          />

          {isTeacher ? (
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-medium text-on-surface flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Empresa
              </Label>
              <div className="px-3 py-2 rounded-xl border border-outline-variant bg-muted/30 text-on-surface text-sm">
                {companies.find((c) => c.id === teacherCompanyId)?.name || teacherCompanyId || "—"}
              </div>
            </div>
          ) : !isSuperAdmin ? (
            (() => {
              const assignedId = formData.company_ids?.[0] || customer?.company_id || customer?.companyId || companies[0]?.id || teacherCompanyId;
              const assignedName = companies.find((c) => c.id === assignedId)?.name || assignedId || "—";
              return (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-medium text-on-surface flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Empresa
                  </Label>
                  <div className="px-3 py-2 rounded-xl border border-outline-variant bg-muted/30 text-on-surface text-sm">
                    {assignedName}
                  </div>
                  <p className="text-xs text-muted-foreground">Cliente vinculado automaticamente à sua empresa — somente super admin pode alterar para outras empresas</p>
                </div>
              );
            })()
          ) : (
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-medium text-on-surface flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Empresa / Filial *
              </Label>
              <CompanyMultiSelect
                companies={companies}
                selectedIds={formData.company_ids || []}
                onChange={(ids) => handleChange("company_ids", ids)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <h3 className="text-lg font-semibold text-on-surface mb-6 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-branding-secondary" />
          Endereço
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-on-surface">CEP</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={formData.address_zipcode}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  className="pl-10 rounded-xl border-outline-variant focus:border-branding-primary focus:ring-branding-primary"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-branding-primary animate-spin" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CEP para preencher o endereço automaticamente</p>
            </div>
          </div>

          <div className="md:col-span-3">
            <Label className="text-sm font-medium text-on-surface mb-2 block">Rua</Label>
            <Input
              value={formData.address_street}
              onChange={(e) => handleChange("address_street", e.target.value)}
              placeholder="Nome da rua"
              className="rounded-xl border-outline-variant"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Número</Label>
            <Input
              value={formData.address_number}
              onChange={(e) => handleChange("address_number", e.target.value)}
              placeholder="Nº"
              className="rounded-xl border-outline-variant"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Complemento</Label>
            <Input
              value={formData.address_complement}
              onChange={(e) => handleChange("address_complement", e.target.value)}
              placeholder="Apto, Bloco..."
              className="rounded-xl border-outline-variant"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Bairro</Label>
            <Input
              value={formData.address_neighborhood}
              onChange={(e) => handleChange("address_neighborhood", e.target.value)}
              placeholder="Bairro"
              className="rounded-xl border-outline-variant"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Cidade</Label>
            <Input
              value={formData.address_city}
              onChange={(e) => handleChange("address_city", e.target.value)}
              placeholder="Cidade"
              className="rounded-xl border-outline-variant"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Estado</Label>
            <Select value={formData.address_state} onValueChange={(v) => handleChange("address_state", v)}>
              <SelectTrigger className="rounded-xl border-outline-variant">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Plan & Documents */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <h3 className="text-lg font-semibold text-on-surface mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-branding-primary" />
          Plano e Documentos
        </h3>

        {/* Warning for dependents without guardian trying to add plan */}
        {isDependent && !formData.guardian_id && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Atenção:</p>
              <p>Dependente precisa ter um responsável financeiro para poder ter um plano.</p>
              <p>Selecione um responsável acima ou cadastre um novo clicando em "Cadastrar Responsável Financeiro".</p>
            </div>
          </div>
        )}

        {/* Billing mode - only for dependents */}
        {guardianMode && (
          <div className="mb-4">
            <Label className="text-sm font-medium text-on-surface mb-2 block">Modo de Cobrança</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="individual"
                  checked={formData.billing_mode === "individual"}
                  onChange={() => handleChange("billing_mode", "individual")}
                  className="w-4 h-4 text-branding-primary"
                />
                <span className="text-on-surface">Cobrança Individual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="consolidated"
                  checked={formData.billing_mode === "consolidated"}
                  onChange={() => handleChange("billing_mode", "consolidated")}
                  className="w-4 h-4 text-branding-primary"
                />
                <span className="text-on-surface">Junto ao Responsável ({guardianName})</span>
              </label>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Plan Type Selection */}
          <div>
            <Label className="text-sm font-medium text-on-surface mb-3 block">Tipo de Plano</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="standard"
                  checked={planType === "standard"}
                  onChange={(e) => {
                    setPlanType(e.target.value);
                    handleChange("custom_plan", null);
                  }}
                  className="w-4 h-4 text-branding-primary"
                />
                <span className="text-on-surface">Plano Padrão</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="custom"
                  checked={planType === "custom"}
                  onChange={(e) => {
                    setPlanType(e.target.value);
                    handleChange("plan_id", "");
                    handleChange("custom_plan", {
                      modality: "corte",
                      duration_mins: 60,
                      price_per_service: 0,
                      frequency_type: "weekly",
                      frequency_count: 2,
                      total_services: 8
                    });
                  }}
                  className="w-4 h-4 text-branding-primary"
                />
                <span className="text-on-surface">Plano Personalizado</span>
              </label>
            </div>
          </div>

          {/* Standard Plan */}
          {planType === "standard" && (
            <div>
              <Label className="text-sm font-medium text-on-surface mb-2 block">Plano</Label>
              <Select value={formData.plan_id} onValueChange={(v) => handleChange("plan_id", v)}>
                <SelectTrigger className="rounded-xl border-outline-variant">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.duration_mins}min - R$ {plan.price?.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Plan */}
          {planType === "custom" && formData.custom_plan && (
            <div className="space-y-4 p-4 bg-background rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">Tipo de Serviço</Label>
                  <Select 
                    value={formData.custom_plan.modality} 
                    onValueChange={(v) => handleChange("custom_plan", {...formData.custom_plan, modality: v})}
                  >
                    <SelectTrigger className="rounded-xl border-outline-variant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corte">Corte</SelectItem>
                      <SelectItem value="barba">Barba</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">Duração do Serviço</Label>
                  <Select 
                    value={formData.custom_plan.duration_mins.toString()} 
                    onValueChange={(v) => handleChange("custom_plan", {...formData.custom_plan, duration_mins: parseInt(v)})}
                  >
                    <SelectTrigger className="rounded-xl border-outline-variant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                      <SelectItem value="90">90 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">Valor por Serviço (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.custom_plan.price_per_service}
                    onChange={(e) => handleChange("custom_plan", {...formData.custom_plan, price_per_service: parseFloat(e.target.value) || 0})}
                    className="rounded-xl border-outline-variant"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">Frequência</Label>
                  <Select 
                    value={formData.custom_plan.frequency_type} 
                    onValueChange={(v) => {
                      const count = formData.custom_plan.frequency_count || 1;
                      const total = v === "weekly" ? count * 4 : v === "daily" ? count * 30 : count;
                      handleChange("custom_plan", {...formData.custom_plan, frequency_type: v, total_services: total});
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-outline-variant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">
                    Quantas vezes por {formData.custom_plan.frequency_type === "weekly" ? "semana" : formData.custom_plan.frequency_type === "daily" ? "dia" : "mês"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.custom_plan.frequency_count}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 1;
                      const type = formData.custom_plan.frequency_type;
                      const total = type === "weekly" ? count * 4 : type === "daily" ? count * 30 : count;
                      handleChange("custom_plan", {...formData.custom_plan, frequency_count: count, total_services: total});
                    }}
                    className="rounded-xl border-outline-variant"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-on-surface mb-2 block">Total de Serviços por mês</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.custom_plan.total_services}
                    onChange={(e) => handleChange("custom_plan", {...formData.custom_plan, total_services: parseInt(e.target.value) || 1})}
                    className="rounded-xl border-outline-variant"
                  />
                  {formData.custom_plan.frequency_type === "weekly" && (
                    <p className="text-xs text-muted-foreground mt-1">{formData.custom_plan.frequency_count || 1}x/semana × 4 semanas = {(formData.custom_plan.frequency_count || 1) * 4} serviços</p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-card rounded-lg border border-outline-variant">
                <p className="text-sm font-medium text-on-surface mb-1">Resumo do Plano</p>
                <div className="flex items-center justify-between text-sm text-on-surface-variant">
                  <span>Valor Total Estimado:</span>
                  <span className="font-bold text-branding-primary text-lg">
                    R$ {((formData.custom_plan.price_per_service || 0) * (formData.custom_plan.total_services || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium text-on-surface mb-2 block">Documento</Label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-outline-variant rounded-xl p-4 hover:border-branding-primary transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-branding-primary">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {uploading ? "Enviando..." : formData.medical_certificate_url ? "Arquivo enviado" : "Fazer upload"}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {formData.medical_certificate_url && (
                <a 
                  href={formData.medical_certificate_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-branding-primary hover:underline"
                >
                  Ver arquivo
                </a>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label className="text-sm font-medium text-on-surface mb-2 block">Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Observações sobre o cliente..."
              className="rounded-xl border-outline-variant resize-none"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Portal Access */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-outline-variant/30">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-branding-primary" />
          Portal do Cliente
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Acesso ao Portal</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.email
                ? `Acessa com ${formData.email} e senha padrão 123456`
                : "Informe o e-mail do cliente para liberar o portal"}
            </p>
          </div>
          <Switch
            checked={formData.portal_enabled || false}
            onCheckedChange={(v) => handleChange("portal_enabled", v)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="rounded-xl px-6"
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="rounded-xl px-6 btn-branding"
          disabled={isLoading}
        >
          {isLoading ? "Salvando..." : customer ? "Atualizar Cliente" : "Cadastrar Cliente"}
        </Button>
      </div>

      {/* Guardian Creation Modal */}
      {showGuardianModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-500" />
                Cadastrar Responsável Financeiro
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGuardianModal(false)}
                className="text-muted-foreground hover:text-on-surface-variant"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant">
                O dependente precisa de um responsável financeiro. Cadastre um novo responsável:
              </p>
              
              <div className="space-y-4">
                <InputWithIcon
                  icon={User}
                  label="Nome Completo *"
                  value={guardianFormData.name}
                  onChange={(e) => handleGuardianChange("name", e.target.value)}
                  placeholder="Nome do responsável"
                  required
                />
                
                <InputWithIcon
                  icon={CreditCard}
                  label="CPF *"
                  value={guardianFormData.cpf}
                  onChange={(e) => handleGuardianChange("cpf", formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                />
                
                <InputWithIcon
                  icon={Phone}
                  label="WhatsApp *"
                  value={guardianFormData.whatsapp}
                  onChange={(e) => handleGuardianChange("whatsapp", formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  required
                />
                
                <InputWithIcon
                  icon={Mail}
                  label="E-mail"
                  type="email"
                  value={guardianFormData.email}
                  onChange={(e) => handleGuardianChange("email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
                <Button
                  variant="outline"
                  onClick={() => setShowGuardianModal(false)}
                  disabled={guardianLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={createGuardian}
                  disabled={guardianLoading}
                  className="btn-branding"
                >
                  {guardianLoading ? "Cadastrando..." : "Cadastrar Responsável"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
