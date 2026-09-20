import { useState } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function EstablishmentTypesSection() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["establishment_types"],
    queryFn: async () => {
      try {
        const result = await db.entities.EstablishmentType.list();
        return result || [];
      } catch (e) {
        console.warn("Failed to load establishment_types, usando fallback", e);
        return [];
      }
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
  });

  const FALLBACK_TYPES = [
    { id: "fallback-atendimento_geral", name: "Atendimento Geral", slug: "atendimento_geral", _fallback: true },
    { id: "fallback-clinica_saude", name: "Clínica / Saúde", slug: "clinica_saude", _fallback: true },
    { id: "fallback-consultorio", name: "Consultório", slug: "consultorio", _fallback: true },
    { id: "fallback-studio", name: "Estúdio", slug: "estudio", _fallback: true },
  ];
  const displayTypes = types.length ? types : FALLBACK_TYPES;
  const isUsingFallback = types.length === 0 && !isLoading;

  const createMutation = useMutation({
    mutationFn: async (name) => {
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      return db.entities.EstablishmentType.create({ name: name.trim(), slug, active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establishment_types"] });
      setNewName("");
      toast.success("Tipo de estabelecimento criado!");
    },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => {
      const oldType = types.find(t => t.id === id);
      const oldSlug = oldType?.slug;
      const newSlug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const updated = await db.entities.EstablishmentType.update(id, { name: name.trim(), slug: newSlug });
      if (oldSlug && oldSlug !== newSlug) {
        const toUpdate = companies.filter(c => c.estabelecimento_tipo === oldSlug);
        for (const comp of toUpdate) {
          try { await db.entities.Company.update(comp.id, { estabelecimento_tipo: newSlug }); } catch {}
        }
        if (toUpdate.length) queryClient.invalidateQueries({ queryKey: ["companies"] });
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establishment_types"] });
      setEditingId(null);
      toast.success("Tipo de estabelecimento atualizado! Vínculos atualizados.");
    },
    onError: (e) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.EstablishmentType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establishment_types"] });
      toast.success("Tipo de estabelecimento removido!");
    },
    onError: (e) => toast.error(e.message || "Erro ao remover"),
  });

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleUpdate = () => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    if (String(editingId).startsWith("fallback-")) {
      createMutation.mutate(trimmed);
      setEditingId(null);
      setEditingName("");
      return;
    }
    updateMutation.mutate({ id: editingId, name: trimmed });
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-outline-variant/10">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-branding-primary/20">
            <Building2 className="w-5 h-5 text-branding-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Tipos de Estabelecimento</CardTitle>
            <CardDescription>Gerencie os tipos de estabelecimento disponíveis (somente super admin)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo tipo de estabelecimento"
            className="rounded-xl flex-1"
            />
          <Button
          type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-branding-primary hover:bg-branding-primary/90 shrink-0 px-6 min-w-[110px] disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </form>

        {isUsingFallback && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Tipos padrão exibidos. Clique em Adicionar para salvar no banco. Vínculos já contam empresas com `estabelecimento_tipo` existente.
          </p>
        )}
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Carregando...</p>
        ) : displayTypes.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-4">Nenhum tipo de estabelecimento cadastrado</p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {displayTypes.map((t) => {
              const linked = companies.filter(c => c.estabelecimento_tipo === t.slug);
              const count = linked.length;
              return (
              <div
                key={t.id}
                className="flex flex-col p-3 bg-surface-container-low rounded-xl gap-2"
              >
                <div className="flex items-center justify-between">
                {editingId === t.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                      className="h-7 rounded-lg text-sm"
                    />
                    <button onClick={handleUpdate} className="text-green-400 hover:text-green-300">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-on-surface-variant hover:text-on-surface">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-branding-primary flex-shrink-0" />
                    <span className="font-medium text-on-surface text-sm truncate">{t.name}</span>
                    <Badge variant="outline" className="text-xs text-on-surface-variant font-mono hidden sm:inline-flex">{t.slug}</Badge>
                    <Badge className={`${count > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-surface-container text-muted-foreground"} text-xs border`}>{count} vínculo{count !== 1 ? "s" : ""}</Badge>
                  </div>
                )}
                {editingId !== t.id && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-on-surface-variant hover:text-branding-primary"
                      onClick={() => { setEditingId(t.id); setEditingName(t.name); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${count > 0 || t._fallback ? "text-outline cursor-not-allowed opacity-40" : "text-on-surface-variant hover:text-red-400"}`}
                      onClick={() => {
                        if (t._fallback) {
                          toast.error("Tipo padrão não pode ser removido diretamente. Crie um novo tipo se necessário.");
                          return;
                        }
                        if (count > 0) {
                          toast.error(`Não é possível remover: ${count} empresa(s) vinculada(s) a este tipo. Altere o tipo das empresas primeiro.`);
                          return;
                        }
                        deleteMutation.mutate(t.id);
                      }}
                      title={t._fallback ? "Tipo padrão" : count > 0 ? `${count} empresa(s) vinculada(s)` : "Remover"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                </div>
                {count > 0 && editingId !== t.id && (
                  <div className="flex flex-wrap gap-1.5 pl-7">
                    {linked.slice(0, 3).map(c => (
                      <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full bg-branding-primary/10 text-branding-primary border border-branding-primary/20 truncate max-w-[140px]">{c.name}</span>
                    ))}
                    {linked.length > 3 && <span className="text-[11px] text-muted-foreground">+{linked.length - 3} mais</span>}
                    <a href="/Companies" className="text-[11px] text-branding-primary hover:underline ml-1">Ver empresas →</a>
                  </div>
                )}
                {count === 0 && editingId !== t.id && (
                  <p className="text-[11px] text-muted-foreground pl-7">Nenhuma empresa vinculada a este segmento</p>
                )}
              </div>
            )})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
