import { useState } from "react";
import { db } from "@/api/dbClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, PaintBucket, Image, Type, ChevronDown, ChevronUp, Building2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CompanyBrandingCard({ company }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState({
    branding_app_name: company.branding_app_name || "",
    branding_logo_url: company.branding_logo_url || "",
    branding_primary_color: company.branding_primary_color || "#0077b6",
    branding_secondary_color: company.branding_secondary_color || "#2a9d8f",
    branding_accent_color: company.branding_accent_color || "#1e293b",
    branding_background_color: company.branding_background_color || "#f8fafc",
  });

  const saveMutation = useMutation({
    mutationFn: (data) => db.entities.Company.update(company.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["userCompany", company.id] });
      toast.success(`Marca de ${company.name} salva!`);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao salvar");
    },
  });

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const primary = form.branding_primary_color || "#0077b6";
  const secondary = form.branding_secondary_color || "#2a9d8f";
  const accent = form.branding_accent_color || "#1e293b";
  const background = form.branding_background_color || "#f8fafc";

  const [uploading, setUploading] = useState(false);

  return (
    <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface-container-low">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors"
      >
        <div className="flex items-center gap-3">
          {form.branding_logo_url ? (
            <img src={form.branding_logo_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-outline-variant/20" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, display: form.branding_logo_url ? 'none' : 'flex' }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-on-surface">{company.name}</p>
            <p className="text-xs text-on-surface-variant">
              {form.branding_app_name || "AgendaFlow"} • Cores e logo
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
      </button>

      {open && (
        <div className="border-t border-outline-variant/20 p-5 space-y-5 bg-surface-container/50">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Type className="w-4 h-4 text-on-surface-variant" />
              <p className="font-semibold text-on-surface">Nome do App</p>
            </div>
            <Input
              value={form.branding_app_name}
              onChange={e => setField("branding_app_name", e.target.value)}
              placeholder="AgendaFlow"
              className="rounded-xl bg-surface-container-lowest text-sm"
            />
            <p className="text-xs text-on-surface-variant mt-1">Exibido no canto superior esquerdo do menu</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-on-surface-variant" />
              <p className="font-semibold text-on-surface">Logo</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={form.branding_logo_url}
                onChange={e => setField("branding_logo_url", e.target.value)}
                placeholder="URL da imagem"
                className="rounded-xl bg-surface-container-lowest text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-xl"
                disabled={uploading}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await db.integrations.Core.UploadFile({ file });
                      setField("branding_logo_url", result.file_url);
                    } catch (err) {
                      toast.error("Erro ao fazer upload: " + (err.message || err));
                    } finally {
                      setUploading(false);
                    }
                  };
                  input.click();
                }}
              >
                {uploading ? "Enviando..." : <><Upload className="w-4 h-4 mr-1" />Upload</>}
              </Button>
            </div>
            {form.branding_logo_url && (
              <div className="mt-2 p-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20 inline-flex items-center gap-2">
                <img src={form.branding_logo_url} alt="Preview" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <button type="button" onClick={() => setField("branding_logo_url", "")} className="text-xs text-error hover:underline">Remover</button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <PaintBucket className="w-4 h-4 text-on-surface-variant" />
              <p className="font-semibold text-on-surface">Cores da Marca</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-on-surface-variant mb-1 block">Primária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primary}
                    onChange={e => setField("branding_primary_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-outline-variant/30 cursor-pointer"
                  />
                  <Input
                    value={primary}
                    onChange={e => setField("branding_primary_color", e.target.value)}
                    className="rounded-xl bg-surface-container-lowest text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-on-surface-variant mb-1 block">Secundária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondary}
                    onChange={e => setField("branding_secondary_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-outline-variant/30 cursor-pointer"
                  />
                  <Input
                    value={secondary}
                    onChange={e => setField("branding_secondary_color", e.target.value)}
                    className="rounded-xl bg-surface-container-lowest text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-on-surface-variant mb-1 block">Destaque</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accent}
                    onChange={e => setField("branding_accent_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-outline-variant/30 cursor-pointer"
                  />
                  <Input
                    value={accent}
                    onChange={e => setField("branding_accent_color", e.target.value)}
                    className="rounded-xl bg-surface-container-lowest text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-on-surface-variant mb-1 block">Fundo</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background}
                    onChange={e => setField("branding_background_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-outline-variant/30 cursor-pointer"
                  />
                  <Input
                    value={background}
                    onChange={e => setField("branding_background_color", e.target.value)}
                    className="rounded-xl bg-surface-container-lowest text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl border border-outline-variant/20" style={{ background: accent }}>
              <p className="text-xs text-white/60 mb-3">Pré-visualização do menu:</p>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  {form.branding_logo_url ? (
                    <img src={form.branding_logo_url} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-5 h-5 bg-surface-container-lowest/30 rounded" />
                  )}
                </div>
                <span className="font-bold text-white text-sm">{form.branding_app_name || "AgendaFlow"}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: primary }}>
                <div className="w-3 h-3 bg-surface-container-lowest/30 rounded" />
                <span className="text-xs text-white">Menu ativo</span>
              </div>
              <div className="mt-2 flex gap-2">
                <div className="px-2 py-1 rounded text-xs text-white" style={{ background: secondary }}>Secundária</div>
                <div className="px-2 py-1 rounded text-xs text-white" style={{ background: accent }}>Destaque</div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="w-full rounded-xl"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Marca
          </Button>
        </div>
      )}
    </div>
  );
}
