import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Building2, MapPin, Phone, User, MessageCircle, Image } from "lucide-react";
import { toast } from "sonner";
import { formatPhone, formatCPF, formatCNPJ } from "@/utils/formatters";

const emptyForm = {
  name: "", cnpj: "", cpf_document: "", tipo: "", estabelecimento_tipo: "", razao_social: "", situacao_cadastral: "",
  data_abertura: "", capital_social: "", porte: "", cnae_principal: "",
  natureza_juridica: "", cep: "", uf: "", cidade: "", bairro: "",
  logradouro: "", numero: "", complemento: "", phone: "", email: "",
  owner_email: "", owner_name: "", owner_phone: "", owner_cpf: "", active: true, has_branch: false,
};

const FALLBACK_ESTABLISHMENT_TYPES = {
  barbearia: "Barbearia",
  clinica_estetica: "Clínica / Estética",
  salao_beleza: "Empresa de Beleza",
  studio_manicure: "Studio / Manicure",
};

function validateCpf(cpf) {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10));
}

function formatCep(value) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatCurrency(value) {
  if (value === "" || value == null) return "";
  const n = Number(value);
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CompanyFormModal({ editing, form, setForm, onClose, onSave, saving }) {
  const getInitialDocType = () => {
    if (editing?.cpf_document) return "cpf";
    if (editing?.cnpj) return "cnpj";
    return "cnpj";
  };
  const [docType, setDocType] = useState(getInitialDocType);
  const [docValue, setDocValue] = useState(() => {
    if (editing?.cpf_document) return editing.cpf_document;
    if (editing?.cnpj) return editing.cnpj;
    return "";
  });
  const [looking, setLooking] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const { data: establishmentTypesData = [] } = useQuery({
    queryKey: ["establishment_types"],
    queryFn: () => db.entities.EstablishmentType.list(),
  });
  const ESTABLISHMENT_TYPES = establishmentTypesData.length
    ? Object.fromEntries(establishmentTypesData.map(t => [t.slug, t.name]))
    : FALLBACK_ESTABLISHMENT_TYPES;
  const establishmentTypesList = establishmentTypesData.length
    ? establishmentTypesData.map(t => ({ slug: t.slug, name: t.name }))
    : Object.entries(FALLBACK_ESTABLISHMENT_TYPES).map(([slug, name]) => ({ slug, name }));

  useEffect(() => {
    if (editing) {
      setDocType(getInitialDocType());
      setDocValue(editing.cpf_document || editing.cnpj || "");
    }
  }, [editing?.id]);

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      const newErrors = { ...fieldErrors };
      let changed = false;
      for (const key of Object.keys(newErrors)) {
        if (form[key] && String(form[key]).trim() !== "") {
          delete newErrors[key];
          changed = true;
        }
      }
      if (changed) setFieldErrors(newErrors);
    }
  }, [form]);

  const handleCepLookup = async (cepValue) => {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await db.functions.invoke("lookupCep", { cep: clean });
      const data = res.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setForm((prev) => ({
        ...prev,
        logradouro: data.street ?? prev.logradouro,
        bairro: data.neighborhood ?? prev.bairro,
        cidade: data.city ?? prev.cidade,
        uf: data.state ?? prev.uf,
      }));
    } catch {
      toast.error("Erro ao consultar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const onCepChange = (e) => {
    const formatted = formatCep(e.target.value);
    setForm((prev) => ({ ...prev, cep: formatted }));
    if (formatted.replace(/\D/g, "").length === 8) {
      handleCepLookup(formatted);
    }
  };

  const handleLookup = async () => {
    if (!docValue) return toast.error("Informe o documento");
    const cleanDoc = docValue.replace(/\D/g, "");
    if (docType === "cpf" && !validateCpf(cleanDoc)) {
      return toast.error("CPF inválido");
    }
    if (docType === "cnpj" && cleanDoc.length !== 14) {
      return toast.error("CNPJ deve ter 14 dígitos");
    }
    setLooking(true);
    try {
      const res = await db.functions.invoke("lookupCnpj", {
        document: cleanDoc,
        type: docType,
      });
      const data = res.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setForm((prev) => ({
        ...prev,
        cnpj: docType === "cnpj" ? (data.cnpj ?? cleanDoc) : prev.cnpj,
        cpf_document: docType === "cpf" ? cleanDoc : prev.cpf_document,
        tipo: data.tipo ?? prev.tipo,
        razao_social: data.razao_social ?? prev.razao_social,
        name: data.nome_fantasia ?? prev.name,
        situacao_cadastral: data.situacao_cadastral ?? prev.situacao_cadastral,
        data_abertura: data.data_abertura ?? prev.data_abertura,
        capital_social: data.capital_social ?? prev.capital_social,
        porte: data.porte ?? prev.porte,
        cnae_principal: data.cnae_principal ?? prev.cnae_principal,
        natureza_juridica: data.natureza_juridica ?? prev.natureza_juridica,
        cep: data.cep ?? prev.cep,
        uf: data.uf ?? prev.uf,
        cidade: data.cidade ?? prev.cidade,
        bairro: data.bairro ?? prev.bairro,
        logradouro: data.logradouro ?? prev.logradouro,
        numero: data.numero ?? prev.numero,
        complemento: data.complemento ?? prev.complemento,
        email: data.email ?? prev.email,
        phone: data.telefone ?? prev.phone,
      }));
      toast.success("Dados preenchidos automaticamente!");
    } catch (err) {
      toast.error("Erro ao consultar documento");
    } finally {
      setLooking(false);
    }
  };

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
          <Building2 className="w-5 h-5 text-branding-primary" />
          {editing ? "Editar Empresa" : "Nova Empresa"}
        </h3>

        {/* Consulta de documento */}
        <div className="bg-background rounded-xl p-4 space-y-3 border border-outline-variant/30">
          <Label className="text-sm font-semibold">Consultar Documento</Label>
          <div className="flex gap-2">
            <select
              value={docType}
              onChange={(e) => {
                const newType = e.target.value;
                if (newType === "cpf") {
                  setDocValue(form.cpf_document || "");
                } else {
                  setDocValue(form.cnpj || "");
                }
                setDocType(newType);
              }}
              className="rounded-xl border border-input bg-card px-3 text-sm h-9"
            >
              <option value="cnpj">CNPJ</option>
              <option value="cpf">CPF</option>
            </select>
            <Input
              value={docType === "cnpj" ? formatCNPJ(docValue) : formatCPF(docValue)}
              onChange={(e) => setDocValue(e.target.value.replace(/\D/g, ""))}
              placeholder={docType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
              className="rounded-xl flex-1"
            />
            <Button
              onClick={handleLookup}
              disabled={looking}
              className="rounded-xl btn-branding"
            >
              {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Consultar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            CNPJ preenche os dados cadastrais. CPF é salvo no campo do responsável.
          </p>
        </div>

        {/* Dados Cadastrais */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Dados Cadastrais
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>{docType === "cpf" ? "CPF da Empresa" : "CNPJ"}</Label>
              <Input
                value={docType === "cpf" ? formatCPF(form.cpf_document || "") : formatCNPJ(form.cnpj)}
                onChange={(e) => {
                  const clean = e.target.value.replace(/\D/g, "");
                  if (docType === "cpf") {
                    setForm((prev) => ({ ...prev, cpf_document: clean }));
                  } else {
                    setForm((prev) => ({ ...prev, cnpj: clean }));
                  }
                }}
                placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select value={form.tipo} onChange={set("tipo")} className="rounded-xl border border-input bg-card text-on-surface px-3 h-9 text-sm w-full">
                <option value="">Selecione</option>
                <option value="MATRIZ">Matriz</option>
                <option value="FILIAL">Filial</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className={fieldErrors.estabelecimento_tipo ? "text-red-500" : ""}>Tipo de Estabelecimento *</Label>
              <select
                value={form.estabelecimento_tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, estabelecimento_tipo: e.target.value }))}
                className={`rounded-xl border bg-card px-3 h-9 text-sm w-full ${
                  fieldErrors.estabelecimento_tipo
                    ? "border-red-500 text-red-500"
                    : "border-input text-on-surface"
                }`}
              >
                <option value="">Selecione o tipo</option>
                {establishmentTypesList.map(({ slug, name }) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">Tipos gerenciados em Configurações → Tipos de Estabelecimento (super admin)</p>
            </div>

            {/* Logo upload */}
            <div className="space-y-1 col-span-2">
              <Label className="flex items-center gap-1.5"><Image className="w-4 h-4" /> Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.branding_logo_url || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, branding_logo_url: e.target.value }))}
                  placeholder="URL da logo"
                  className="rounded-xl bg-card text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-xl"
                  onClick={async () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        const result = await db.integrations.Core.UploadFile({ file });
                        setForm((prev) => ({ ...prev, branding_logo_url: result.file_url }));
                      } catch (err) {
                        toast.error("Erro ao fazer upload: " + (err.message || err));
                      }
                    };
                    input.click();
                  }}
                >
                  <Image className="w-4 h-4 mr-1" />
                  Upload
                </Button>
              </div>
              {form.branding_logo_url && (
                <div className="mt-2 p-2 bg-background rounded-xl border inline-flex items-center gap-2">
                  <img
                    src={form.branding_logo_url}
                    alt="Preview"
                    className="h-10 object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, branding_logo_url: "" }))}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Situação Cadastral</Label>
              <Input value={form.situacao_cadastral} onChange={set("situacao_cadastral")} placeholder="ATIVA" className="rounded-xl" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Razão Social</Label>
              <Input value={form.razao_social} onChange={set("razao_social")} placeholder="Razão social" className="rounded-xl" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className={fieldErrors.name ? "text-red-500" : ""}>Nome Fantasia *</Label>
              <Input
                value={form.name}
                onChange={set("name")}
                placeholder="Nome da empresa"
                className={`rounded-xl ${fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1">
              <Label>Data de Abertura</Label>
              <Input type="date" value={form.data_abertura} onChange={set("data_abertura")} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Capital Social</Label>
              <Input
                value={form.capital_social === "" || form.capital_social == null ? "" : formatCurrency(form.capital_social)}
                onChange={(e) => setForm((prev) => ({ ...prev, capital_social: e.target.value.replace(/[^\d.,]/g, "") }))}
                placeholder="0,00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Porte</Label>
              <Input value={form.porte} onChange={set("porte")} placeholder="ME, EPP, DEMAIS" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Natureza Jurídica</Label>
              <Input value={form.natureza_juridica} onChange={set("natureza_juridica")} placeholder="Natureza jurídica" className="rounded-xl" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>CNAE Principal</Label>
              <Input value={form.cnae_principal} onChange={set("cnae_principal")} placeholder="CNAE principal" className="rounded-xl" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Endereço
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CEP</Label>
              <div className="relative">
                <Input value={formatCep(form.cep)} onChange={onCepChange} placeholder="00000-000" className="rounded-xl pr-9" />
                {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-branding-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CEP para preencher o endereço</p>
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input value={form.uf} onChange={set("uf")} placeholder="SP" className="rounded-xl" maxLength={2} />
            </div>
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={set("cidade")} placeholder="Cidade" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={set("bairro")} placeholder="Bairro" className="rounded-xl" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Logradouro</Label>
              <Input value={form.logradouro} onChange={set("logradouro")} placeholder="Rua, avenida" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Número</Label>
              <Input value={form.numero} onChange={set("numero")} placeholder="Nº" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Complemento</Label>
              <Input value={form.complemento} onChange={set("complemento")} placeholder="Complemento" className="rounded-xl" />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Phone className="w-4 h-4" /> Contato
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={formatPhone(form.phone || "")}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "") }))}
                placeholder="(00) 00000-0000"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="empresa@email.com" className="rounded-xl" />
            </div>
          </div>
        </div>

        {/* Responsável */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <User className="w-4 h-4" /> Responsável
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Nome do Responsável</Label>
              <Input value={form.owner_name} onChange={set("owner_name")} placeholder="Nome do responsável" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>CPF do Responsável</Label>
              <Input
                value={formatCPF(form.owner_cpf || "")}
                onChange={(e) => setForm((prev) => ({ ...prev, owner_cpf: e.target.value.replace(/\D/g, "") }))}
                placeholder="000.000.000-00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail do Responsável</Label>
              <Input type="email" value={form.owner_email} onChange={set("owner_email")} placeholder="admin@email.com" className="rounded-xl" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Telefone / WhatsApp do Responsável</Label>
              <div className="flex gap-2">
                <Input
                  value={formatPhone(form.owner_phone || "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, owner_phone: e.target.value.replace(/\D/g, "") }))}
                  placeholder="(00) 00000-0000"
                  className="rounded-xl flex-1"
                />
                {form.owner_phone && form.owner_phone.replace(/\D/g, "").length >= 10 && (
                  <a
                    href={`https://wa.me/55${form.owner_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#25D366] text-white px-4 text-sm font-medium hover:bg-[#1ebe5d] transition-colors"
                    title="Abrir no WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-on-surface">Status</h4>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-background px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="text-sm font-medium cursor-pointer">Empresa ativa</Label>
                <p className="text-xs text-muted-foreground">{form.active ? "Empresa visível e operacional" : "Empresa desativada / inativa"}</p>
              </div>
              <Switch id="active" checked={!!form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-background px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="has_branch" className="text-sm font-medium cursor-pointer">Possui filial</Label>
                <p className="text-xs text-muted-foreground">Indica que a empresa tem filiais</p>
              </div>
              <Switch id="has_branch" checked={!!form.has_branch} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, has_branch: checked }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2 sticky bottom-0 bg-card pb-1">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
          <Button
            onClick={() => {
              const required = {
                name: "Nome Fantasia",
                estabelecimento_tipo: "Tipo de Estabelecimento",
              };
              const errors = {};
              for (const [key, label] of Object.entries(required)) {
                if (!form[key] || String(form[key]).trim() === "") {
                  errors[key] = label;
                }
              }
              if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                toast.error("Preencha os campos obrigatórios destacados");
                return;
              }
              setFieldErrors({});
              onSave();
            }}
            disabled={saving}
            className="flex-1 btn-branding rounded-xl"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}