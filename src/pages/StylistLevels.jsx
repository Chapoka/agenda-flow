import { useState } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  Award,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  DollarSign,
  Users,
  Building2,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEVEL_PRESETS = [
  { name: "Júnior", slug: "junior", multiplier: 1.0, color: "#60a5fa" },
  { name: "Pleno", slug: "pleno", multiplier: 1.25, color: "#34d399" },
  { name: "Sênior", slug: "senior", multiplier: 1.5, color: "#fbbf24" },
  { name: "Master", slug: "master", multiplier: 2.0, color: "#f472b6" },
  { name: "Premium", slug: "premium", multiplier: 2.5, color: "#a78bfa" },
];

const EMPTY_LEVEL = { name: "", slug: "", multiplier: 1.0, color: "#6366f1" };

export default function StylistLevels() {
  const queryClient = useQueryClient();
  const theme = useThemeMode();
  const { companyId, isSuperAdmin, isAdmin, ready } = useCurrentUser();

  const [showForm, setShowForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [deletingLevel, setDeletingLevel] = useState(null);
  const [levelForm, setLevelForm] = useState(EMPTY_LEVEL);
  const [viewMode, setViewMode] = useState("grid");
  const [sortOrder, setSortOrder] = useState("name-asc");

  const effectiveCompanyId = companyId;

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ["stylist_levels", effectiveCompanyId],
    queryFn: () => db.entities.StylistLevel.list("sort_order"),
    enabled: ready,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => db.entities.User.list(),
    enabled: ready,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: ready && isSuperAdmin,
  });
  const getCompanyName = (cid) => allCompanies.find(c => c.id === cid)?.name || "—";

  const companyLevels = effectiveCompanyId
    ? levels.filter(l => l.company_id === effectiveCompanyId)
    : levels;

  const usersByLevel = {};
  allUsers.forEach(u => {
    if (u.stylist_level_id) {
      usersByLevel[u.stylist_level_id] = (usersByLevel[u.stylist_level_id] || 0) + 1;
    }
  });

  const sortedLevels = [...companyLevels].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.name || "").localeCompare(a.name || "", "pt-BR");
    if (sortOrder === "empresa-asc") return (a.company_id ? getCompanyName(a.company_id) : "").localeCompare(b.company_id ? getCompanyName(b.company_id) : "", "pt-BR");
    if (sortOrder === "empresa-desc") return (b.company_id ? getCompanyName(b.company_id) : "").localeCompare(a.company_id ? getCompanyName(a.company_id) : "", "pt-BR");
    if (sortOrder === "multiplier-desc") return (b.multiplier || 0) - (a.multiplier || 0);
    if (sortOrder === "multiplier-asc") return (a.multiplier || 0) - (b.multiplier || 0);
    if (sortOrder === "profissionais-desc") return (usersByLevel[b.id] || 0) - (usersByLevel[a.id] || 0);
    if (sortOrder === "profissionais-asc") return (usersByLevel[a.id] || 0) - (usersByLevel[b.id] || 0);
    if (sortOrder === "status-asc") return (a.active !== false ? 1 : 0) - (b.active !== false ? 1 : 0);
    if (sortOrder === "status-desc") return (b.active !== false ? 1 : 0) - (a.active !== false ? 1 : 0);
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return 0;
  });

  const createLevel = useMutation({
    mutationFn: (data) => db.entities.StylistLevel.create({ ...data, company_id: effectiveCompanyId }),
    onSuccess: () => {
      queryClient.invalidateQueries(["stylist_levels"]);
      toast.success("Nível criado!");
      setShowForm(false);
      setLevelForm(EMPTY_LEVEL);
    },
    onError: (err) => toast.error("Erro ao criar nível: " + err.message),
  });

  const updateLevel = useMutation({
    mutationFn: ({ id, ...data }) => db.entities.StylistLevel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["stylist_levels"]);
      toast.success("Nível atualizado!");
      setShowForm(false);
      setEditingLevel(null);
      setLevelForm(EMPTY_LEVEL);
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => db.entities.StylistLevel.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries(["stylist_levels"]),
  });

  const deleteLevel = useMutation({
    mutationFn: (id) => db.entities.StylistLevel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["stylist_levels"]);
      toast.success("Nível removido!");
      setDeletingLevel(null);
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  const handleSave = () => {
    if (!levelForm.name) return toast.error("Nome é obrigatório");
    if (levelForm.multiplier < 0.5) return toast.error("Multiplicador mínimo: 0.5x");
    if (levelForm.multiplier > 5) return toast.error("Multiplicador máximo: 5.0x");

    if (editingLevel) {
      updateLevel.mutate({ id: editingLevel.id, ...levelForm });
    } else {
      createLevel.mutate(levelForm);
    }
  };

  const openEdit = (level) => {
    setEditingLevel(level);
    setLevelForm({
      name: level.name || "",
      slug: level.slug || "",
      multiplier: level.multiplier || 1.0,
      color: level.color || "#6366f1",
    });
    setShowForm(true);
  };

  const applyPreset = (preset) => {
    setLevelForm(f => ({
      ...f,
      name: preset.name,
      slug: preset.slug,
      multiplier: preset.multiplier,
      color: preset.color,
    }));
  };

  const activeLevels = companyLevels.filter(l => l.active !== false);
  const maxMultiplier = activeLevels.length
    ? Math.max(...activeLevels.map(l => Number(l.multiplier) || 1))
    : 1;

  return (
    <div className={cn("max-w-4xl mx-auto p-4 sm:p-6 space-y-6", theme.pageBg)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: theme.cardText }}>Níveis do Profissional</h1>
          <p className="text-sm mt-1" style={{ color: theme.mutedText }}>Defina níveis de atendimento com multiplicadores de preço</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-44 rounded-xl border-outline-variant text-sm h-9">
              <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nível A → Z</SelectItem>
              <SelectItem value="name-desc">Nível Z → A</SelectItem>
              <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
              <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
              <SelectItem value="multiplier-desc">Maior multiplicador ↓</SelectItem>
              <SelectItem value="multiplier-asc">Menor multiplicador ↑</SelectItem>
              <SelectItem value="profissionais-desc">Mais profissionais ↓</SelectItem>
              <SelectItem value="profissionais-asc">Menos profissionais ↑</SelectItem>
              <SelectItem value="status-asc">Inativo → Ativo</SelectItem>
              <SelectItem value="status-desc">Ativo → Inativo</SelectItem>
              <SelectItem value="recent">Mais recentes ↓</SelectItem>
              <SelectItem value="oldest">Mais antigos ↑</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "grid" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
              title="Visualização em grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "list" ? "bg-branding-primary text-white" : "text-muted-foreground hover:text-on-surface"}`}
              title="Visualização em lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={() => { setEditingLevel(null); setLevelForm(EMPTY_LEVEL); setShowForm(true); }}
            className="bg-branding-primary text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Nível
          </Button>
          </div>
      </div>

      {/* Info card */}
      <div className="bg-gradient-to-r from-branding-primary/5 to-branding-secondary/5 rounded-xl border border-branding-primary/10 p-4">
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 text-branding-primary mt-0.5" />
          <div className="text-sm text-on-surface-variant">
            <p className="font-medium text-on-surface mb-1">Como funciona os níveis</p>
            <p>Cada profissional pode ser vinculado a um nível. O multiplicador do nível é aplicado sobre o preço base do serviço.
            Por exemplo, se um corte custa R$ 50 e o profissional é "Sênior" (1.5x), o cliente paga R$ 75.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-branding-primary" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Níveis Ativos</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>{activeLevels.length}</span>
        </div>
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Maior Multiplicador</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>{maxMultiplier.toFixed(1)}x</span>
        </div>
        <div className="rounded-xl border p-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs" style={{ color: theme.mutedText }}>Profissionais</span>
          </div>
          <span className="text-xl font-bold" style={{ color: theme.cardText }}>
            {Object.values(usersByLevel).reduce((a, b) => a + b, 0)}
          </span>
        </div>
      </div>

      {/* Level Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : sortedLevels.length === 0 ? (
        <div className="text-center py-12">
          <Award className="w-12 h-12 mx-auto text-on-surface-variant mb-3" />
          <p className="text-on-surface-variant">Nenhum nível configurado</p>
          <p className="text-xs text-on-surface-variant mt-1">Crie níveis para diferenciar preços por profissional</p>
          <Button
            onClick={() => { setEditingLevel(null); setLevelForm(EMPTY_LEVEL); setShowForm(true); }}
            className="mt-4 bg-branding-primary text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Criar primeiro nível
          </Button>
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-outline-variant/30">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Nível {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  {isSuperAdmin && <th className="px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "empresa-asc" ? "empresa-desc" : "empresa-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "empresa-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "empresa-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>}
                  <th className="px-4 py-3 font-medium hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "multiplier-desc" ? "multiplier-asc" : "multiplier-desc")}><span className="inline-flex items-center gap-1">Multiplicador {sortOrder === "multiplier-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "multiplier-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "profissionais-desc" ? "profissionais-asc" : "profissionais-desc")}><span className="inline-flex items-center gap-1">Profissionais {sortOrder === "profissionais-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : sortOrder === "profissionais-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "status-asc" ? "status-desc" : "status-asc")}><span className="inline-flex items-center gap-1">Status {sortOrder === "status-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "status-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {sortedLevels.map(level => {
                  const userCount = usersByLevel[level.id] || 0;
                  const isActive = level.active !== false;
                  return (
                    <tr key={level.id} className={`hover:bg-surface-container-low transition-colors ${!isActive ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: level.color || "#6366f1" }}>{Number(level.multiplier || 1).toFixed(1)}x</div>
                          <span className="font-medium text-on-surface">{level.name}</span>
                        </div>
                      </td>
                      {isSuperAdmin && <td className="px-4 py-3 hidden lg:table-cell">{level.company_id ? <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{getCompanyName(level.company_id)}</Badge> : <span className="text-muted-foreground">—</span>}</td>}
                      <td className="px-4 py-3 hidden sm:table-cell font-medium">x{Number(level.multiplier || 1).toFixed(2)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{userCount} profissional{userCount !== 1 ? "is" : ""}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={(v) => toggleActive.mutate({ id: level.id, active: v })} /><Badge className={isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-container-low text-muted-foreground"}>{isActive ? "Ativo" : "Inativo"}</Badge></div></td>
                      <td className="px-4 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(level)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem><DropdownMenuItem onClick={() => setDeletingLevel(level)} className="text-red-400"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLevels.map(level => {
            const userCount = usersByLevel[level.id] || 0;
            const isActive = level.active !== false;
            return (
              <div
                key={level.id}
                className={cn(
                  "rounded-xl border p-4 transition-all hover:shadow-md",
                  !isActive && "opacity-60"
                )}
                style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: level.color || "#6366f1" }}
                    >
                      {level.multiplier ? `${Number(level.multiplier).toFixed(1)}x` : "1.0x"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-on-surface flex items-center gap-2 flex-wrap">
                        {level.name}
                        {isSuperAdmin && level.company_id && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30 inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{getCompanyName(level.company_id)}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        Multiplicador: <span className="font-medium">{Number(level.multiplier || 1).toFixed(2)}x</span>
                        {userCount > 0 && (
                          <span className="ml-2 text-branding-primary">
                            • {userCount} profissional{userCount > 1 ? "éis" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Price preview */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-on-surface-variant mr-2">
                      <span>R$ 50</span>
                      <span>→</span>
                      <span className="font-semibold text-on-surface">
                        R$ {(50 * Number(level.multiplier || 1)).toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <Switch
                      checked={isActive}
                      onCheckedChange={(v) => toggleActive.mutate({ id: level.id, active: v })}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                          <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(level)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingLevel(level)} className="text-red-400">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Presets */}
            {!editingLevel && (
              <div>
                <Label className="text-xs text-on-surface-variant mb-2 block">Predefinições rápidas</Label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_PRESETS.map(preset => (
                    <button
                      key={preset.slug}
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-medium hover:border-outline-variant/50 transition-colors"
                      style={{ borderLeftColor: preset.color, borderLeftWidth: 3 }}
                    >
                      {preset.name} ({preset.multiplier}x)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Nome *</Label>
              <Input
                value={levelForm.name}
                onChange={e => setLevelForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Sênior"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Multiplicador *</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={5}
                  step={0.25}
                  value={levelForm.multiplier}
                  onChange={e => setLevelForm(f => ({ ...f, multiplier: parseFloat(e.target.value) || 1 }))}
                />
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {levelForm.multiplier >= 1
                    ? `+${((levelForm.multiplier - 1) * 100).toFixed(0)}% sobre o preço base`
                    : `${((1 - levelForm.multiplier) * 100).toFixed(0)}% de desconto`
                  }
                </p>
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={levelForm.color}
                    onChange={e => setLevelForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={levelForm.color}
                    onChange={e => setLevelForm(f => ({ ...f, color: e.target.value }))}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Price preview */}
            <div className="bg-surface-container-low rounded-lg p-3 text-sm">
              <p className="text-on-surface-variant mb-1">Preview de preço (serviço de R$ 50,00):</p>
              <p className="text-xl font-bold text-on-surface">
                R$ {(50 * Number(levelForm.multiplier || 1)).toFixed(2).replace(".", ",")}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-branding-primary text-white">
                {editingLevel ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <AlertDialog open={!!deletingLevel} onOpenChange={() => setDeletingLevel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nível?</AlertDialogTitle>
            <AlertDialogDescription>
              O nível "{deletingLevel?.name}" será removido.
              {usersByLevel[deletingLevel?.id] > 0 && (
                <span className="block mt-1 text-amber-400 font-medium">
                  {usersByLevel[deletingLevel.id]} profissional(is) vinculados perderão o nível.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLevel.mutate(deletingLevel.id)}
              className="bg-error text-white hover:bg-error/80"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
