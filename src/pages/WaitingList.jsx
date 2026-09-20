import { useState } from "react";
import { db } from "@/api/dbClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { formatPhone } from "@/utils/formatters";
import { 
  ListOrdered, 
  Plus, 
  Search,
  MessageCircle,
  Calendar,
  Filter,
  UserPlus,
  Clock,
  Building2,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function WaitingList() {
  const queryClient = useQueryClient();
  const { companyId, isProfissional, isSuperAdmin } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [sortOrder, setSortOrder] = useState("recent");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    whatsapp: "",
    modality: "corte",
    duration_mins: 60,
    preferred_days: [],
    priority: "normal",
    notes: "",
    company_id: companyId || null,
  });

  const { data: waitingList = [], isLoading } = useQuery({
    queryKey: ["waiting_list", companyId, isProfissional],
    queryFn: async () => {
      const all = await (db.entities.WaitingList?.list("-created_at") || Promise.resolve([]));
      if (companyId && !isSuperAdmin) return all.filter(i => i.company_id === companyId);
      return all;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.entities.Company.list(),
    enabled: isSuperAdmin,
  });
  const getCompanyName = (cid) => companies.find(c => c.id === cid)?.name || "—";

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", companyId, isProfissional],
    queryFn: () => companyId && !isSuperAdmin
      ? db.entities.Customer.filter({ status: "active", company_id: companyId })
      : db.entities.Customer.filter({ status: "active" }),
  });

  /** @type {import("@tanstack/react-query").UseMutationOptions<unknown, unknown, typeof formData>} */
  const createMutation = useMutation({
    mutationFn: async (data) => db.entities.WaitingList.create({ ...data, company_id: companyId || data?.company_id || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting_list"] });
      setShowAddModal(false);
      setFormData({
        customer_name: "",
        whatsapp: "",
        modality: "corte",
        duration_mins: 60,
        preferred_days: [],
        priority: "normal",
        notes: "",
        company_id: companyId || null,
      });
      toast.success("Cliente adicionado à fila!");
    },
  });

  /** @type {import("@tanstack/react-query").UseMutationOptions<boolean, unknown, string>} */
  const removeMutation = useMutation({
    mutationFn: async (id) => db.entities.WaitingList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting_list"] });
      toast.success("Removido da fila!");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDayToggle = (dayIndex) => {
    const current = formData.preferred_days || [];
    if (current.includes(dayIndex)) {
      setFormData({ ...formData, preferred_days: current.filter(d => d !== dayIndex) });
    } else {
      setFormData({ ...formData, preferred_days: [...current, dayIndex] });
    }
  };

  const filteredList = waitingList.filter(item => {
    const matchesSearch = item.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesModality = modalityFilter === "all" || item.modality === modalityFilter;
    return matchesSearch && matchesModality;
  });

  const sortedList = [...filteredList].sort((a, b) => {
    if (sortOrder === "name-asc") return (a.customer_name || "").localeCompare(b.customer_name || "", "pt-BR");
    if (sortOrder === "name-desc") return (b.customer_name || "").localeCompare(a.customer_name || "", "pt-BR");
    if (sortOrder === "empresa-asc") return (a.company_id ? getCompanyName(a.company_id) : "").localeCompare(b.company_id ? getCompanyName(b.company_id) : "", "pt-BR");
    if (sortOrder === "empresa-desc") return (b.company_id ? getCompanyName(b.company_id) : "").localeCompare(a.company_id ? getCompanyName(a.company_id) : "", "pt-BR");
    if (sortOrder === "servico-asc") return (a.modality || "").localeCompare(b.modality || "", "pt-BR");
    if (sortOrder === "servico-desc") return (b.modality || "").localeCompare(a.modality || "", "pt-BR");
    if (sortOrder === "duracao-asc") return (a.duration_mins || 0) - (b.duration_mins || 0);
    if (sortOrder === "duracao-desc") return (b.duration_mins || 0) - (a.duration_mins || 0);
    if (sortOrder === "whatsapp-asc") return (a.whatsapp || "").localeCompare(b.whatsapp || "", "pt-BR");
    if (sortOrder === "whatsapp-desc") return (b.whatsapp || "").localeCompare(a.whatsapp || "", "pt-BR");
    if (sortOrder === "prioridade-asc") return (a.priority || "").localeCompare(b.priority || "", "pt-BR");
    if (sortOrder === "prioridade-desc") return (b.priority || "").localeCompare(a.priority || "", "pt-BR");
    if (sortOrder === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return 0;
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
                <ListOrdered className="w-6 h-6 text-white" />
              </div>
              Fila de Espera
            </h1>
            <p className="text-muted-foreground mt-1">{filteredList.length} pessoa(s) aguardando vaga</p>
          </div>
          
          <Button
            onClick={() => setShowAddModal(true)}
            className="btn-branding rounded-xl shadow-lg shadow-branding-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adicionar à Fila
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl border-outline-variant"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="rounded-xl">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo de Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="corte">Corte (legado)</SelectItem>
                  <SelectItem value="barba">Barba (legado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="rounded-xl">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Cliente A → Z</SelectItem>
                  <SelectItem value="name-desc">Cliente Z → A</SelectItem>
                  <SelectItem value="empresa-asc">Empresa A → Z</SelectItem>
                  <SelectItem value="empresa-desc">Empresa Z → A</SelectItem>
                  <SelectItem value="servico-asc">Serviço A → Z</SelectItem>
                  <SelectItem value="servico-desc">Serviço Z → A</SelectItem>
                  <SelectItem value="duracao-asc">Duração ↑</SelectItem>
                  <SelectItem value="duracao-desc">Duração ↓</SelectItem>
                  <SelectItem value="whatsapp-asc">WhatsApp A → Z</SelectItem>
                  <SelectItem value="whatsapp-desc">WhatsApp Z → A</SelectItem>
                  <SelectItem value="prioridade-asc">Prioridade A → Z</SelectItem>
                  <SelectItem value="prioridade-desc">Prioridade Z → A</SelectItem>
                  <SelectItem value="recent">Mais recentes ↓</SelectItem>
                  <SelectItem value="oldest">Mais antigos ↑</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm self-start sm:self-auto">
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
          </div>
        </div>

        {/* Waiting List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-2xl p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : sortedList.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-12 text-center">
            <ListOrdered className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">Fila vazia</h3>
            <p className="text-muted-foreground mb-6">Nenhum cliente aguardando vaga no momento</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="btn-branding rounded-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adicionar Primeiro
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-outline-variant/30">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "name-asc" ? "name-desc" : "name-asc")}><span className="inline-flex items-center gap-1">Cliente {sortOrder === "name-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "name-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    {isSuperAdmin && <th className="px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "empresa-asc" ? "empresa-desc" : "empresa-asc")}><span className="inline-flex items-center gap-1">Empresa {sortOrder === "empresa-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "empresa-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>}
                    <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "servico-asc" ? "servico-desc" : "servico-asc")}><span className="inline-flex items-center gap-1">Serviço {sortOrder === "servico-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "servico-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "duracao-asc" ? "duracao-desc" : "duracao-asc")}><span className="inline-flex items-center gap-1">Duração {sortOrder === "duracao-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "duracao-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "whatsapp-asc" ? "whatsapp-desc" : "whatsapp-asc")}><span className="inline-flex items-center gap-1">WhatsApp {sortOrder === "whatsapp-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "whatsapp-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-on-surface select-none" onClick={() => setSortOrder(prev => prev === "prioridade-asc" ? "prioridade-desc" : "prioridade-asc")}><span className="inline-flex items-center gap-1">Prioridade {sortOrder === "prioridade-asc" ? <ArrowUp className="w-3.5 h-3.5" /> : sortOrder === "prioridade-desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}</span></th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {sortedList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-bold text-sm">{index+1}</div></td>
                      <td className="px-4 py-3 font-medium text-on-surface">{item.customer_name}</td>
                      {isSuperAdmin && <td className="px-4 py-3 hidden lg:table-cell">{item.company_id ? <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{getCompanyName(item.company_id)}</Badge> : <span className="text-muted-foreground">—</span>}</td>}
                      <td className="px-4 py-3 hidden md:table-cell"><Badge className="border bg-branding-primary/10 text-branding-primary border-branding-primary/20">{item.modality ? item.modality.charAt(0).toUpperCase() + item.modality.slice(1) : "Serviço"}</Badge></td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{item.duration_mins}min</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{item.whatsapp || "—"}</td>
                      <td className="px-4 py-3">{item.priority === "urgent" ? <Badge className="bg-red-500/20 text-red-300">Urgente</Badge> : <Badge variant="outline">{item.priority}</Badge>}</td>
                      <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => removeMutation.mutate(item.id)} className="rounded-lg text-xs text-red-400">Remover</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedList.map((item, index) => (
              <div 
                key={item.id}
                className="bg-card rounded-2xl shadow-sm border border-outline-variant/30 p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      {item.priority === "urgent" && (
                        <Badge className="mt-2 bg-red-500/20 text-red-300 text-xs">
                          Urgente
                        </Badge>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-on-surface flex items-center gap-2 flex-wrap">
                        {item.customer_name}
                        {isSuperAdmin && item.company_id && <Badge variant="outline" className="text-[11px] bg-amber-500/20 text-amber-300 border-amber-500/30 inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{getCompanyName(item.company_id)}</Badge>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge className="border bg-branding-primary/10 text-branding-primary border-branding-primary/20">
                          {item.modality ? item.modality.charAt(0).toUpperCase() + item.modality.slice(1) : "Serviço"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {item.duration_mins}min
                        </Badge>
                        {item.whatsapp && (
                          <span className="text-sm text-on-surface-variant flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {item.whatsapp}
                          </span>
                        )}
                      </div>
                      
                      {item.preferred_days && item.preferred_days.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div className="flex gap-1">
                            {daysOfWeek.map((day, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold",
                                  item.preferred_days.includes(idx)
                                    ? "bg-branding-primary text-white"
                                    : "bg-surface-container-low text-muted-foreground"
                                )}
                              >
                                {day.charAt(0)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-sm text-on-surface-variant mb-4 bg-background p-3 rounded-lg">
                    {item.notes}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    className="btn-branding rounded-lg"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Ativar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeMutation.mutate(item.id)}
                    className="rounded-lg ml-auto"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar à Fila de Espera</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Digite o nome"
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: formatPhone(e.target.value) })}
                  placeholder="(11) 99999-9999"
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Serviço</Label>
                  <Select 
                    value={formData.modality} 
                    onValueChange={(v) => setFormData({ ...formData, modality: v })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="corte">Corte (legado)</SelectItem>
                      <SelectItem value="barba">Barba (legado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duração</Label>
                  <Select 
                    value={formData.duration_mins.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, duration_mins: parseInt(v) })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dias Preferidos</Label>
                <div className="flex gap-2">
                  {daysOfWeek.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDayToggle(idx)}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-bold transition-all",
                        formData.preferred_days?.includes(idx)
                          ? "bg-branding-primary text-white"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {day.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="flexible">Flexível</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 rounded-xl btn-branding"
                >
                  {createMutation.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}