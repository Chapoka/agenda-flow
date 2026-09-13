import { useState, useEffect } from "react";
import { Scissors, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const ITEM_TYPES = [
  { value: "service", label: "Serviço", icon: Scissors, desc: "Corte, barba, manicure..." },
  { value: "product", label: "Produto", icon: Package, desc: "Shampoo, pomada, condicionador..." },
];

const CATEGORIES = [
  { value: "corte", label: "Corte", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "barba", label: "Barba", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { value: "coloracao", label: "Coloração", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "tratamento", label: "Tratamento", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "manicure", label: "Manicure/Pedicure", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "sobrancelha", label: "Sobrancelha", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "outro", label: "Outro", color: "bg-surface-container-low text-on-surface border-outline-variant" },
];

const EMPTY_FORM = {
  type: "service",
  service_type: "Normal",
  name: "",
  category: "Corte",
  duration_mins: 30,
  price: 0,
  preco_custo: 0,
  description: "",
  active: true,
  unidade_medida: "unidade",
  quantidade_estoque: 0,
  desconto: 0,
  comissao: 0,
};

export default function NewServiceModal({ open, onOpenChange, onSave, initialData, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  useEffect(() => {
    if (initialData) {
      const isCustom = initialData.category && !CATEGORIES.some(c => c.label === initialData.category);
      setForm({
        type: initialData.type || "service",
        service_type: initialData.service_type || "Normal",
        name: initialData.name || "",
        category: initialData.category || "Corte",
        duration_mins: initialData.duration_mins || 30,
        price: initialData.price || 0,
        preco_custo: initialData.preco_custo || 0,
        description: initialData.description || "",
        active: initialData.active !== false,
        unidade_medida: initialData.unidade_medida || "unidade",
        quantidade_estoque: initialData.quantidade_estoque || 0,
        desconto: initialData.desconto || 0,
        comissao: initialData.comissao || 0,
      });
      setIsCustomCategory(isCustom);
    } else {
      setForm(EMPTY_FORM);
      setIsCustomCategory(false);
    }
  }, [initialData, open]);

  const handleSave = () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    if (form.type === "service" && form.duration_mins < 5) return toast.error("Duração mínima: 5 min");
    if (form.type === "product" && form.quantidade_estoque < 0) return toast.error("Estoque não pode ser negativo");
    if (form.price < 0) return toast.error("Preço não pode ser negativo");
    if (form.preco_custo < 0) return toast.error("Preço de custo não pode ser negativo");
    if (!form.category) return toast.error("Categoria é obrigatória");
    onSave?.(form);
  };

  const isEditing = !!initialData?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Serviço / Produto" : "Novo Serviço / Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.type === "service" && (
            <div>
              <Label>Tipo de Serviço</Label>
              <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Pacote de serviço">Pacote de serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Corte degradê" />
          </div>

          {form.type === "service" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                {isCustomCategory ? (
                  <div className="flex gap-1.5">
                    <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Nome da categoria" autoFocus />
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs px-2" onClick={() => setIsCustomCategory(false)}>✕</Button>
                  </div>
                ) : (
                  <Select value={CATEGORIES.some(c => c.label === form.category) ? form.category : ""} onValueChange={v => {
                    if (v === "__new__") { setForm(f => ({ ...f, category: "" })); setIsCustomCategory(true); }
                    else setForm(f => ({ ...f, category: v }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (<SelectItem key={c.value} value={c.label}>{c.label}</SelectItem>))}
                      <SelectItem value="__new__">+ Criar nova...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Duração (min) *</Label>
                <Input type="number" min={5} step={5} value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          )}

          {form.type === "product" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade de Medida *</Label>
                <Select value={form.unidade_medida} onValueChange={v => setForm(f => ({ ...f, unidade_medida: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="L">Litro (L)</SelectItem>
                    <SelectItem value="ml">Mililitro (ml)</SelectItem>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="g">Grama (g)</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="peca">Peça</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estoque *</Label>
                <Input type="number" min={0} value={form.quantidade_estoque} onChange={e => setForm(f => ({ ...f, quantidade_estoque: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" min={0} max={100} step={0.5} value={form.desconto} onChange={e => setForm(f => ({ ...f, desconto: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <Input type="number" min={0} max={100} step={0.5} value={form.comissao} onChange={e => setForm(f => ({ ...f, comissao: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço de Custo (R$)</Label>
              <Input type="number" min={0} step={0.5} value={form.preco_custo} onChange={e => setForm(f => ({ ...f, preco_custo: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Preço de Venda (R$) *</Label>
              <Input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do item (opcional)" rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            <Label className="text-sm">Ativo</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-branding-primary text-white">
              {saving ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
