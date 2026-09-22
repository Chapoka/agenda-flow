import { useState, useEffect } from "react";
import { db } from "@/api/dbClient";
import { supabase, getValidAccessToken } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Key,
  Save,
  Eye,
  EyeOff,
  Users,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Shield,
  Building2,
  List,
  Layers,
  Crown,
  UserCog,
  Phone,
  User,
  LayoutGrid,
  Search,
} from "lucide-react";
import { formatPhone, formatCPF, formatRG } from "@/utils/formatters";
import CompanyIntegrationCard from "@/components/settings/CompanyIntegrationCard";
import EstablishmentTypesSection from "@/components/settings/EstablishmentTypesSection";
import AsaasSubaccountsModal from "@/components/settings/AsaasSubaccountsModal";
import CompanyMultiSelect from "@/components/settings/CompanyMultiSelect";
import LoginImagesCard from "@/components/settings/LoginImagesCard";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import PageNotFound from "@/lib/PageNotFound";

export default function Settings() {
  const queryClient = useQueryClient();
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [showWhatsappToken, setShowWhatsappToken] = useState(false);
  const [showUserModal, setShowUserModal] = useState(() => {
    try { return localStorage.getItem("form_draft_user_open") === "true"; } catch { return false; }
  });
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    asaas_master_api_key: "",
    asaas_master_environment: "sandbox",
    asaas_api_key: "",
    asaas_environment: "sandbox",
    whatsapp_token: "",
    whatsapp_phone_id: "",
    app_url: "",
  });
  const [showMasterKey, setShowMasterKey] = useState(false);

  const [userFormData, setUserFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("form_draft_user");
      return saved ? JSON.parse(saved) : {
        full_name: "", email: "", password: "", whatsapp: "", cpf: "", rg: "",
        birth_date: "", role: "profissional", company_ids: [], is_master: false, is_professional: true,
      };
    } catch {
      return {
        full_name: "", email: "", password: "", whatsapp: "", cpf: "", rg: "",
        birth_date: "", role: "profissional", company_ids: [], is_master: false, is_professional: true,
      };
    }
  });

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [foundCustomer, setFoundCustomer] = useState(null);
  const [foundCustomerHasUser, setFoundCustomerHasUser] = useState(false);
  const [showImportCustomerModal, setShowImportCustomerModal] = useState(false);
  const [importEmailChecked, setImportEmailChecked] = useState("");
  const [existingUserFound, setExistingUserFound] = useState(null);
  const [showExistingUserModal, setShowExistingUserModal] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [subaccountsCompany, setSubaccountsCompany] = useState(null);
  const [userViewMode, setUserViewMode] = useState("list");
  const [companySearch, setCompanySearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    localStorage.setItem("form_draft_user_open", String(showUserModal));
    if (showUserModal) {
      // Nunca persistir senha em localStorage (evita vazamento via XSS)
      const { password: _pw, ...safeData } = userFormData;
      localStorage.setItem("form_draft_user", JSON.stringify(safeData));
    }
  }, [userFormData, showUserModal]);

  useEffect(() => {
    db.auth.me().then(async (user) => {
      if (user?.id) {
        const { data: userCompanies } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", user.id);
        setCurrentUser({
          ...user,
          company_ids: (userCompanies || []).map(uc => uc.company_id),
        });
      } else {
        setCurrentUser(user);
      }
    }).catch(() => {});
  }, []);

  const rawRole = currentUser?.role;
  // Backward compat
  const role = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";
  const isProfissional = role === "profissional";

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => db.entities.Settings.list(),
    enabled: isSuperAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const userList = await db.entities.User.list("-created_at");
      if (!userList.length) return userList;
      const { data: userCompanies } = await supabase.from("user_companies").select("user_id, company_id");
      const companyMap = {};
      (userCompanies || []).forEach(uc => {
        if (!companyMap[uc.user_id]) companyMap[uc.user_id] = [];
        companyMap[uc.user_id].push(uc.company_id);
      });
      return userList.map(u => ({ ...u, company_ids: companyMap[u.id] || [] }));
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", isSuperAdmin, ...(currentUser?.company_ids || [])],
    queryFn: () => db.entities.Company.list(),
    select: (data) => {
      if (isSuperAdmin) return data;
      const ids = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
      if (ids.length === 0) return [];
      return data.filter(c => ids.includes(c.id));
    },
  });

  const { data: allStylistLevels = [] } = useQuery({
    queryKey: ["stylist_levels"],
    queryFn: () => db.entities.StylistLevel.list(),
  });

  const currentUserCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);

  const { data: allCustomers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const all = await db.entities.Customer.list();
      if (isSuperAdmin) return all;
      if (currentUserCompanyIds.length > 0) {
        return all.filter(c => {
          const sIds = c.company_ids?.length ? c.company_ids : (c.company_id ? [c.company_id] : []);
          return sIds.some(id => currentUserCompanyIds.includes(id));
        });
      }
      return [];
    },
  });

  const customerEmailSet = new Set(allCustomers.map(c => c.email).filter(Boolean));

  const getCompanyName = (companyId) => {
    const c = companies.find(c => c.id === companyId);
    return c ? c.name : null;
  };

  // Filter users based on role:
  // - Super admin: sees all users
  // - Admin: sees only professionals/clientes from their companies
  // - Profissional: sees only professionals/clientes from their company

  const companyLevels = currentUserCompanyIds.length
    ? allStylistLevels.filter(l => currentUserCompanyIds.includes(l.company_id))
    : allStylistLevels;
  const visibleUsers = isSuperAdmin
    ? users.filter(u => {
        const uRole = u.role === "teacher" ? "profissional" : u.role === "user" ? "cliente" : u.role;
        return ["super_admin","admin","profissional"].includes(uRole);
      })
    : isAdmin
      ? users.filter(u => {
          const uRole = u.role === "teacher" ? "profissional" : u.role === "user" ? "cliente" : u.role;
          const uIds = u.company_ids?.length ? u.company_ids : (u.company_id ? [u.company_id] : []);
          return ["admin","profissional"].includes(uRole) && currentUserCompanyIds.some(cid => uIds.includes(cid));
        })
      : [];

  const filteredCompanies = companies.filter(c => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.cidade?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.cnpj?.includes(q);
  });
  const filteredUsers = visibleUsers.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  // Paginação - 5 por página + scroll
  const companyTotalPages = Math.ceil(filteredCompanies.length / PAGE_SIZE) || 1;
  const userTotalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedCompanies = filteredCompanies.slice((companyPage - 1) * PAGE_SIZE, companyPage * PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);

  useEffect(() => { setCompanyPage(1); }, [companySearch]);
  useEffect(() => { setUserPage(1); }, [userSearch]);
  useEffect(() => { if (companyPage > companyTotalPages) setCompanyPage(companyTotalPages); }, [companyTotalPages, companyPage]);
  useEffect(() => { if (userPage > userTotalPages) setUserPage(userTotalPages); }, [userTotalPages, userPage]);

  useEffect(() => {
    if (settings.length > 0) {
      const settingsMap = {};
      settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setFormData(prev => ({
        ...prev,
        asaas_master_api_key: settingsMap.asaas_master_api_key || "",
        asaas_master_environment: settingsMap.asaas_master_environment || "sandbox",
        asaas_api_key: settingsMap.asaas_api_key || "",
        asaas_environment: settingsMap.asaas_environment || "sandbox",
        whatsapp_token: settingsMap.whatsapp_token || "",
        whatsapp_phone_id: settingsMap.whatsapp_phone_id || "",
        app_url: settingsMap.app_url || "",
      }));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const keys = Object.keys(data);
      
      for (const key of keys) {
        const existing = settings.find(s => s.key === key);
        if (existing) {
          await db.entities.Settings.update(existing.id, { value: data[key] });
        } else {
          await db.entities.Settings.create({ key, value: data[key] });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const saveUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Helper para token fresco (evita Token expirado ao salvar)
      const getFreshToken = async () => {
        try {
          const tok = await getValidAccessToken();
          if (tok) return tok;
        } catch {}
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) return session.access_token;
        try { const { data: r } = await supabase.auth.refreshSession(); return r?.session?.access_token || null; } catch { return null; }
      };
      if (editingUser) {
        // Admin editando outro admin da mesma empresa -> usar API que valida mesma empresa e bypassa RLS
        const isEditingSelf = editingUser.id === currentUser?.id;
        const shouldUseApi = !isSuperAdmin && isAdmin && !isEditingSelf;
        if (shouldUseApi) {
          const freshToken = await getFreshToken();
          const res = await fetch(`${window.location.origin}/api/auth/admin-update-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${freshToken || ""}`,
            },
            body: JSON.stringify({
              user_id: editingUser.id,
              full_name: userData.full_name || null,
              email: userData.email || null,
              whatsapp: userData.whatsapp || null,
              role: userData.role,
              cpf: userData.cpf || null,
              rg: userData.rg || null,
              birth_date: userData.birth_date || null,
              is_master: userData.is_master || false,
              is_professional: userData.is_professional || false,
              phone: userData.whatsapp || null,
              company_ids: userData.company_ids || [],
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Erro ao atualizar usuário");
          return editingUser;
        }
        // Super_admin ou self-edit -> direto via RLS (super_admin bypassa, self-edit permitido por auth.uid()=id)
        const cleanData = {
          full_name: userData.full_name || null,
          email: userData.email || null,
          whatsapp: userData.whatsapp || null,
          role: userData.role,
          cpf: userData.cpf || null,
          rg: userData.rg || null,
          birth_date: userData.birth_date || null,
          is_master: userData.is_master || false,
          is_professional: userData.is_professional || false,
        };
        const { error: updateError } = await supabase
          .from("users")
          .update(cleanData)
          .eq("id", editingUser.id);
        if (updateError) throw updateError;
        // Preserva vínculos existentes e adiciona novos (não apaga tudo para não perder se RLS falhar)
        if (userData.company_ids !== undefined) {
          const { data: existing } = await supabase.from("user_companies").select("company_id").eq("user_id", editingUser.id);
          const existingIds = new Set((existing || []).map(r => r.company_id));
          const desiredIds = new Set(userData.company_ids || []);
          const toAdd = [...desiredIds].filter(id => !existingIds.has(id));
          const toRemove = [...existingIds].filter(id => !desiredIds.has(id));
          if (toRemove.length) {
            const { error: delErr } = await supabase.from("user_companies").delete().in("company_id", toRemove).eq("user_id", editingUser.id);
            if (delErr) throw delErr;
          }
          if (toAdd.length) {
            const rows = toAdd.map(company_id => ({ user_id: editingUser.id, company_id }));
            const { error: insErr } = await supabase.from("user_companies").upsert(rows, { onConflict: "user_id,company_id" });
            if (insErr) throw insErr;
          }
        }
        return editingUser;
      } else {
        if (!userData.password || userData.password.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres");
        }
        const freshToken2 = await getFreshToken();
        const res = await fetch(`${window.location.origin}/api/auth/admin-create-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${freshToken2 || ""}`,
          },
          body: JSON.stringify({
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name || "",
            role: userData.role || "cliente",
            company_ids: userData.company_ids || [],
            whatsapp: userData.whatsapp || "",
            cpf: userData.cpf || "",
            rg: userData.rg || "",
            birth_date: userData.birth_date || "",
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Erro ao criar usuário");

        if (result.user_id && userData.company_ids?.length) {
          await supabase.from("user_companies").delete().eq("user_id", result.user_id);
          const rows = userData.company_ids.map(company_id => ({
            user_id: result.user_id,
            company_id,
          }));
          await supabase.from("user_companies").insert(rows);
        }

        if (result.user_id && userData.is_professional) {
          await supabase.from("users").update({ is_professional: true }).eq("id", result.user_id);
        }

        const roleLabel = userData.role === "super_admin" ? "Super Admin" : userData.role === "admin" ? "Administrador" : userData.role === "profissional" ? "Profissional" : "Cliente";
        await db.entities.AuditLog.create({
          action: "create",
          entity_type: "User",
          category: "system",
          description: `Usuário ${userData.email} criado como ${roleLabel}`,
          user_name: currentUser?.full_name || currentUser?.email,
          user_email: currentUser?.email,
        });
        return result;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      const isAlsoClient = customerEmailSet.has(userFormData.email);
      if (editingUser) {
        toast.success("Usuário atualizado!");
      } else if (isAlsoClient) {
        toast.success("Usuário criado! Este usuário também possui cadastro como cliente — dois perfis ativos.");
      } else {
        toast.success("Usuário criado com sucesso!");
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ full_name: "", email: "", password: "", whatsapp: "", cpf: "", rg: "", birth_date: "", role: "profissional", company_ids: [], is_master: false, is_professional: true });
      localStorage.removeItem("form_draft_user");
      localStorage.removeItem("form_draft_user_open");
    },
    onError: (error) => {
      console.error("saveUserMutation error:", error);
      let msg = error?.message || error?.error?.message || "Erro ao salvar usuário";
      if (msg.includes("NO_TOKEN") || msg.includes("Token de acesso não fornecido")) {
        msg = "Sessão expirada. Faça login novamente e tente outra vez.";
      } else if (msg.includes("INVALID_TOKEN") || msg.includes("Token inválido") || msg.includes("expirado")) {
        msg = "Sessão expirada. A página vai atualizar sua sessão — tente novamente em 2 segundos.";
        // tenta refresh silencioso
        supabase.auth.refreshSession().catch(()=>{});
      } else if (msg.includes("already been registered") || msg.includes("already registered")) {
        msg = "Este e-mail já está registrado como usuário do sistema. Tente editar o usuário existente.";
      }
      toast.error(msg);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      // Tenta via servidor (mais confiável, usa service_role)
      try {
        let delToken = null;
        try { delToken = await getValidAccessToken(); } catch {}
        if (!delToken) { const { data: { session } } = await supabase.auth.getSession(); delToken = session?.access_token || null; }
        const res = await fetch(`${window.location.origin}/api/auth/admin-delete-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${delToken || ""}`,
          },
          body: JSON.stringify({ user_id: userId }),
        });
        if (res.ok) return;
        console.warn("admin-delete-user failed, falling back to client-side delete");
      } catch (e) {
        console.warn("admin-delete-user error, falling back:", e);
      }

      // Fallback: client-side
      await supabase.from("user_companies").delete().eq("user_id", userId);
      await db.entities.User.delete(userId);
      await supabase.rpc("delete_user_direct", { p_user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário excluído!");
    },
    onError: (error) => {
      console.error("deleteUserMutation error:", error);
      toast.error("Erro ao excluir usuário: " + (error?.message || ""));
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ id, active }) => {
      // Admin só pode alterar outro admin da mesma empresa -> usar API que valida
      if (!isSuperAdmin && isAdmin && id !== currentUser?.id) {
        let togToken = null;
        try { togToken = await getValidAccessToken(); } catch {}
        if (!togToken) { const { data: { session } } = await supabase.auth.getSession(); togToken = session?.access_token || null; }
        const res = await fetch(`${window.location.origin}/api/auth/admin-update-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${togToken || ""}`,
          },
          body: JSON.stringify({ user_id: id, active }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Erro ao alterar status");
        return result;
      }
      // Super_admin ou self (super_admin) usa RLS direto
      if (!isSuperAdmin && id === currentUser?.id) {
        throw new Error("Admin não pode alterar o próprio status");
      }
      return db.entities.User.update(id, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleOpenUserModal = (user = null) => {
    // Bloqueio: admin não pode editar a si mesmo nesta lista
    if (user && !isSuperAdmin && isAdmin && user.id === currentUser?.id) {
      toast.error("Admin não pode alterar o próprio perfil por aqui");
      return;
    }
    setImportEmailChecked("");
    setFoundCustomer(null);
    setFoundCustomerHasUser(false);
    setExistingUserFound(null);
    setShowExistingUserModal(false);
    if (user) {
      setEditingUser(user);
      setUserFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        password: "",
        whatsapp: user.whatsapp || "",
        cpf: user.cpf || "",
        rg: user.rg || "",
        birth_date: user.birth_date || "",
        role: user.role || "cliente",
        company_ids: user.company_ids || [],
        is_master: user.is_master || false,
        is_professional: user.is_professional || user.role === "profissional" || false,
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        full_name: "", email: "", password: "", whatsapp: "", cpf: "", rg: "", birth_date: "",
        role: "profissional",
        company_ids: isSuperAdmin ? [] : currentUserCompanyIds.length ? [currentUserCompanyIds[0]] : [],
        is_master: false,
        is_professional: true,
      });
    }
    setShowUserModal(true);
  };

  const isEditingUserDirty = () => {
    if (!editingUser) return true;
    return (
      userFormData.full_name !== (editingUser.full_name || "") ||
      userFormData.email !== (editingUser.email || "") ||
      userFormData.whatsapp !== (editingUser.whatsapp || "") ||
      userFormData.cpf !== (editingUser.cpf || "") ||
      userFormData.rg !== (editingUser.rg || "") ||
      userFormData.birth_date !== (editingUser.birth_date || "") ||
      userFormData.role !== (editingUser.role || "cliente") ||
      (userFormData.is_master || false) !== (editingUser.is_master || false) ||
      (userFormData.is_professional || false) !== (editingUser.is_professional || false) ||
      JSON.stringify(userFormData.company_ids) !== JSON.stringify(editingUser.company_ids || [])
    );
  };

  const handleSaveUser = () => {
    if (!userFormData.email) {
      toast.error("Email é obrigatório");
      return;
    }
    if (editingUser && !isEditingUserDirty()) {
      toast.info("Nenhuma alteração efetuada");
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ full_name: "", email: "", password: "", whatsapp: "", cpf: "", rg: "", birth_date: "", role: "profissional", company_ids: [], is_master: false, is_professional: true });
      localStorage.removeItem("form_draft_user");
      localStorage.removeItem("form_draft_user_open");
      return;
    }
    saveUserMutation.mutate(userFormData);
  };

  const handleCheckCustomerEmail = async (email) => {
    if (!email || !email.includes("@") || editingUser) return;
    if (email === importEmailChecked) return;
    setImportEmailChecked(email);
    setShowUserModal(false);
    try {
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("id, name, email, whatsapp, cpf, rg, birth_date")
        .eq("email", email)
        .maybeSingle();

      if (custErr) {
        console.error("Error checking customer:", custErr);
      }

      if (customer) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, full_name, email, role")
          .eq("email", email)
          .maybeSingle();
        setFoundCustomer(customer);
        setFoundCustomerHasUser(!!existingUser);
        setShowImportCustomerModal(true);
        return;
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        if (existingUser.full_name) {
          const { data: customerByName } = await supabase
            .from("customers")
            .select("id, name, email, whatsapp, cpf, rg, birth_date")
            .ilike("name", existingUser.full_name)
            .maybeSingle();

          if (customerByName) {
            setFoundCustomer(customerByName);
            setFoundCustomerHasUser(true);
            setShowImportCustomerModal(true);
            return;
          }
        }

        setExistingUserFound(existingUser);
        setShowExistingUserModal(true);
        return;
      }

      setShowUserModal(true);
    } catch (e) {
      console.error("handleCheckCustomerEmail error:", e);
      setShowUserModal(true);
    }
  };

  const handleImportCustomer = () => {
    if (!foundCustomer) return;
    setUserFormData(prev => ({
      ...prev,
      full_name: foundCustomer.name || prev.full_name,
      whatsapp: foundCustomer.whatsapp || prev.whatsapp,
      cpf: foundCustomer.cpf || prev.cpf,
      rg: foundCustomer.rg || prev.rg,
      birth_date: foundCustomer.birth_date || prev.birth_date,
      role: "admin",
    }));
    setShowImportCustomerModal(false);
    setFoundCustomer(null);
    setFoundCustomerHasUser(false);
    if (foundCustomerHasUser) {
      toast.success("Dados do cliente importados! Salve para atualizar o usuário existente.");
    } else {
      toast.success("Dados do cliente importados! O usuário terá dois perfis: administrador e cliente.");
    }
  };

  const handleDeleteUser = (userId) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleOpenResetPassword = (user) => {
    setResetTargetUser(user);
    setNewPassword("");
    setMustChangeOnLogin(false);
    setShowNewPassword(false);
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    try {
      // Garante token fresco (evita Token inválido ou expirado)
      await supabase.auth.refreshSession().catch(()=>{});
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        toast.error("Sessão expirada, faça login novamente");
        return;
      }
      const response = await fetch(`${window.location.origin}/api/auth/admin-reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession?.access_token}`,
        },
        body: JSON.stringify({
          user_id: resetTargetUser.id,
          new_password: newPassword,
          must_change_password: mustChangeOnLogin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
      }

      // Clear temp_password after successful reset (password was changed)
      try {
        await supabase
          .from("users")
          .update({ temp_password: null })
          .eq("id", resetTargetUser.id);
      } catch (clearErr) {
        console.warn("Failed to clear temp_password:", clearErr);
      }

      // Invalidate users query so that the UI updates
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Senha redefinida com sucesso!");
      setShowResetPasswordModal(false);
    } catch (err) {
      toast.error("Erro ao redefinir senha: " + (err.message || err));
    }
  };

  // While loading user, show nothing (prevent flash of Settings for profissionais)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-outline-variant border-t-branding-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Block profissionais from accessing Settings — show 404 Page Not Found
  if (isProfissional) {
    return <PageNotFound />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-branding-primary/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-branding-primary to-branding-secondary">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">Configure as integrações do sistema</p>
        </div>

        <div className="space-y-6">
          {/* Asaas Master Account - Super Admin only */}
          {isSuperAdmin && (
            <Card className="rounded-2xl shadow-sm border border-outline-variant/30 bg-surface-container-low">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-tertiary/10">
                    <Key className="w-5 h-5 text-tertiary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Conta Mestre Asaas</CardTitle>
                    <CardDescription>
                      Chave da sua conta principal. As subcontas das empresas serão criadas através dela.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-on-surface">Chave de API (Conta Mestre)</Label>
                  <div className="relative">
                    <Input
                      type={showMasterKey ? "text" : "password"}
                      value={formData.asaas_master_api_key}
                      onChange={e => setFormData(f => ({ ...f, asaas_master_api_key: e.target.value }))}
                      placeholder="$aas_xxxxxxxxxxxxxxxx"
                      className="pr-10 rounded-xl bg-card"
                    />
                    <button type="button" onClick={() => setShowMasterKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showMasterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => saveMutation.mutate({ asaas_master_api_key: formData.asaas_master_api_key })}
                  disabled={saveMutation.isPending}
                  className="bg-branding-primary hover:bg-branding-primary/90 rounded-xl"
                >
                  {saveMutation.isPending ? "Salvando..." : <><Save className="w-4 h-4 mr-2" />Salvar Conta Mestre</>}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Portal URL - Super Admin only */}
          {isSuperAdmin && (
            <Card className="rounded-2xl shadow-sm border border-outline-variant/30 bg-surface-container-low">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">URL do Portal do Cliente</CardTitle>
                    <CardDescription>
                      Usada nos links enviados por WhatsApp. Ex: https://seu-app.db.app
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-on-surface">URL do app (sem barra no final)</Label>
                  <Input
                    type="url"
                    value={formData.app_url}
                    onChange={e => setFormData(f => ({ ...f, app_url: e.target.value }))}
                    placeholder="https://seu-app.db.app"
                    className="rounded-xl bg-card"
                  />
{formData.app_url && (
                      <p className="text-xs text-primary">Link que será enviado: <strong>{formData.app_url}/portalcliente</strong></p>
                    )}
                </div>
                <Button
                  onClick={() => saveMutation.mutate({ app_url: formData.app_url })}
                  disabled={saveMutation.isPending}
                  className="bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />Salvar URL
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Integrations per company - Super Admin only */}
          {isSuperAdmin && companies.length > 0 && (
            <Card className="rounded-2xl shadow-sm border border-outline-variant/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-branding-primary/10">
                      <Building2 className="w-5 h-5 text-branding-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Integrações por Empresa</CardTitle>
                      <CardDescription>Asaas e WhatsApp configurados individualmente para cada empresa</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa por nome, cidade ou CNPJ..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                  {paginatedCompanies.map(company => (
                    <div key={company.id}>
                      <CompanyIntegrationCard company={company} />
                      <div className="mt-1 flex justify-end">
                        <button
                          onClick={() => setSubaccountsCompany(company)}
                          className="text-xs text-branding-primary hover:underline flex items-center gap-1 px-2 py-1"
                        >
                          <List className="w-3 h-3" /> Gerenciar Subcontas Asaas
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</p>
                  )}
                </div>
                {companyTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-3">
                    <Button variant="outline" size="sm" disabled={companyPage === 1} onClick={() => setCompanyPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-lg">Anterior</Button>
                    {Array.from({ length: companyTotalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCompanyPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${companyPage === page ? "bg-branding-primary text-white" : "bg-card border border-outline-variant hover:bg-surface-container-low"}`}
                      >
                        {page}
                      </button>
                    ))}
                    <Button variant="outline" size="sm" disabled={companyPage === companyTotalPages} onClick={() => setCompanyPage(p => Math.min(companyTotalPages, p + 1))} className="h-8 px-3 rounded-lg">Próxima</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2 text-right">{filteredCompanies.length} de {companies.length} empresa(s) • Página {companyPage} de {companyTotalPages} • limite 5 por página</p>
              </CardContent>
            </Card>
          )}

          {/* Profissional/Admin: show own company integration (read-only summary) */}
          {(isProfissional || isAdmin) && (currentUser?.company_ids?.length || currentUser?.company_id) && (
            <Card className="rounded-2xl shadow-sm border border-outline-variant/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-branding-primary/10">
                    <Building2 className="w-5 h-5 text-branding-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Integrações da Empresa</CardTitle>
                    <CardDescription>Configurações Asaas e WhatsApp da sua empresa</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {companies.filter(c => {
                  const cIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
                  return cIds.includes(c.id);
                }).map(company => (
                  <CompanyIntegrationCard key={company.id} company={company} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Fotos da Tela de Entrada (Login) */}
          {isSuperAdmin && (
            <LoginImagesCard />
          )}

          {/* Users Management */}
          {(isSuperAdmin || isAdmin) && (
          <Card className="rounded-2xl shadow-sm border border-outline-variant/30">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-branding-secondary/10">
                    <Users className="w-5 h-5 text-branding-secondary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Usuários do Sistema</CardTitle>
                    <CardDescription>Gerencie os usuários que têm acesso ao sistema</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="inline-flex rounded-xl border border-outline-variant bg-card p-1 shadow-sm">
                    <button
                      onClick={() => setUserViewMode("list")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${userViewMode === "list" ? "bg-branding-secondary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                      title="Visualização em lista"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setUserViewMode("grid")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${userViewMode === "grid" ? "bg-branding-secondary text-white" : "text-muted-foreground hover:text-on-surface"}`}
                      title="Visualização em grade"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    onClick={() => handleOpenUserModal()}
                    className="bg-branding-secondary hover:bg-branding-secondary/90 rounded-xl flex-1 sm:flex-none"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário por nome, e-mail ou perfil..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <div className="max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
              {userViewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paginatedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-on-surface flex items-center gap-1.5 truncate">
                            <span className="truncate">{user.full_name || "Sem nome"}</span>
                            {user.is_master && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-tertiary/20 text-tertiary text-xs font-semibold flex-shrink-0">
                                <Crown className="w-3 h-3" />
                                Master
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.role === "super_admin" ? "bg-secondary/20 text-secondary" :
                          user.role === "admin" ? "bg-tertiary/20 text-tertiary" :
                          user.role === "profissional" ? "bg-primary/20 text-primary" :
                          "bg-surface-container-high text-on-surface-variant"
                        }`}>
                          {user.role === "super_admin" ? "Super Admin" : user.role === "admin" ? "Administrador" : user.role === "profissional" ? "Profissional" : "Cliente"}
                        </span>
                        {customerEmailSet.has(user.email) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                            <User className="w-3 h-3" />
                            Também cliente
                          </span>
                        )}
                      </div>
                      {(() => {
                        const cIds = user.company_ids?.length ? user.company_ids : (user.company_id ? [user.company_id] : []);
                        if (cIds.length === 0) return null;
                        return (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            🏢 {cIds.map(id => getCompanyName(id)).filter(Boolean).join(", ") || cIds[0]}
                          </p>
                        );
                      })()}
                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.active !== false}
                            onCheckedChange={(checked) =>
                              toggleUserActiveMutation.mutate({ id: user.id, active: checked })
                            }
                            title={user.active !== false ? "Ativo" : "Inativo"}
                          />
                          <span className="text-xs text-muted-foreground">{user.active !== false ? "Ativo" : "Inativo"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenUserModal(user)}
                            className="text-on-surface-variant hover:text-branding-primary h-8 w-8"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={!isSuperAdmin}
                            className={!isSuperAdmin ? "text-outline cursor-not-allowed h-8 w-8" : "text-on-surface-variant hover:text-red-400 h-8 w-8"}
                            title={!isSuperAdmin ? "Somente Super Admin pode excluir" : "Excluir"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 col-span-full">Nenhum usuário cadastrado</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-branding-primary to-branding-secondary flex items-center justify-center text-white font-semibold">
                          {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-on-surface flex items-center gap-1.5">
                            {user.full_name || "Sem nome"}
                            {user.is_master && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary/20 text-tertiary text-xs font-semibold">
                                <Crown className="w-3 h-3" />
                                Master
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {(() => {
                            const cIds = user.company_ids?.length ? user.company_ids : (user.company_id ? [user.company_id] : []);
                            if (cIds.length === 0) return null;
                            return (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                                🏢 {cIds.map(id => getCompanyName(id)).filter(Boolean).join(", ") || cIds[0]}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
 <span className={`px-2 py-1 text-xs rounded-full ${
                          user.role === "super_admin" ? "bg-secondary/20 text-secondary" :
                          user.role === "admin" ? "bg-tertiary/20 text-tertiary" :
                          user.role === "profissional" ? "bg-primary/20 text-primary" :
                          "bg-surface-container-high text-on-surface-variant"
                         }`}>
                          {user.role === "super_admin" ? "Super Admin" : user.role === "admin" ? "Administrador" : user.role === "profissional" ? "Profissional" : "Cliente"}
                         </span>
                        {customerEmailSet.has(user.email) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                            <User className="w-3 h-3" />
                            Também cliente
                          </span>
                        )}
                        <Switch
                          checked={user.active !== false}
                          onCheckedChange={(checked) =>
                            toggleUserActiveMutation.mutate({ id: user.id, active: checked })
                          }
                          title={user.active !== false ? "Ativo" : "Inativo"}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenUserModal(user)}
                          className="text-on-surface-variant hover:text-branding-primary"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                            disabled={!isSuperAdmin}
                            className={!isSuperAdmin ? "text-outline cursor-not-allowed" : "text-on-surface-variant hover:text-red-400"}
                            title={!isSuperAdmin ? "Somente Super Admin pode excluir" : "Excluir"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</p>
                  )}
                </div>
              )}
              </div>
              {userTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-3">
                  <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-lg">Anterior</Button>
                  {Array.from({ length: userTotalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setUserPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${userPage === page ? "bg-branding-secondary text-white" : "bg-card border border-outline-variant hover:bg-surface-container-low"}`}
                    >
                      {page}
                    </button>
                  ))}
                  <Button variant="outline" size="sm" disabled={userPage === userTotalPages} onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))} className="h-8 px-3 rounded-lg">Próxima</Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-right">{filteredUsers.length} de {visibleUsers.length} usuário(s) • Página {userPage} de {userTotalPages} • limite 5 por página {userSearch && `filtrados por "${userSearch}"`}</p>
            </CardContent>
           </Card>
           )}

          {/* Tipos de Estabelecimento - vinculado ao campo empresas.estabelecimento_tipo */}
          {isSuperAdmin && <EstablishmentTypesSection />}

          {/* No global save button needed - per-company cards have their own save */}
        </div>

        {/* Reset Password Modal */}
        {showResetPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-sm w-full p-6 space-y-4">
              <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-branding-primary" />
                Redefinir Senha
              </h3>
              <p className="text-sm text-muted-foreground">
                Defina uma nova senha temporária para <strong>{resetTargetUser?.full_name || resetTargetUser?.email}</strong>.
              </p>

              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-tertiary/10 border border-tertiary/20 rounded-xl">
                <input
                  type="checkbox"
                  checked={mustChangeOnLogin}
                  onChange={(e) => setMustChangeOnLogin(e.target.checked)}
                  className="w-4 h-4 text-branding-primary"
                />
                <div>
                  <p className="text-sm font-medium text-on-surface">Solicitar troca no próximo login</p>
                  <p className="text-xs text-on-surface-variant">O usuário deverá criar uma nova senha ao entrar</p>
                </div>
              </label>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowResetPasswordModal(false)} className="flex-1 rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleResetPassword}
                  className="flex-1 bg-branding-primary hover:bg-branding-primary/90 rounded-xl"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Import Customer Modal */}
        {showImportCustomerModal && foundCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-card rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-branding-primary" />
                {foundCustomerHasUser ? "Cliente e Usuário Encontrado" : "Cliente Encontrado"}
              </h3>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-sm text-on-surface">
                {foundCustomerHasUser ? (
                  <>
                    <p>Este e-mail já está cadastrado como <strong>cliente</strong> e também como <strong>usuário do sistema</strong>.</p>
                    <p className="mt-1">Deseja importar os dados do cliente para atualizar o usuário?</p>
                  </>
                ) : (
                  <>
                    <p>Este e-mail já está cadastrado como <strong>cliente</strong>.</p>
                    <p className="mt-1">Deseja importar os dados e salvar como <strong>cliente e administrador</strong>?</p>
                  </>
                )}
                {foundCustomer && foundCustomer.email !== importEmailChecked && (
                  <p className="mt-2 text-xs text-tertiary font-medium">
                    ⚠️ Cliente encontrado pelo nome "{foundCustomer.name}". E-mail do cliente: {foundCustomer.email || "não informado"}
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-xs">
                  <li className="flex items-center gap-1.5"><span className="font-semibold text-primary">●</span> <strong>Administrador</strong> — acesso ao painel do sistema</li>
                  <li className="flex items-center gap-1.5"><span className="font-semibold text-emerald-400">●</span> <strong>Cliente</strong> — acesso ao portal do cliente com cobranças</li>
                </ul>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs text-muted-foreground font-medium mb-2">Dados que serão importados:</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium text-on-surface">{foundCustomer.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span className="font-medium text-on-surface">{foundCustomer.whatsapp || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF:</span>
                  <span className="font-medium text-on-surface">{foundCustomer.cpf || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RG:</span>
                  <span className="font-medium text-on-surface">{foundCustomer.rg || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data de Nasc.:</span>
                  <span className="font-medium text-on-surface">{foundCustomer.birth_date || "-"}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowImportCustomerModal(false); setFoundCustomer(null); setFoundCustomerHasUser(false); setShowUserModal(true); }} className="flex-1 rounded-xl">
                  {foundCustomerHasUser ? "Não, deixar como está" : "Não, cadastrar novo"}
                </Button>
                <Button onClick={() => { handleImportCustomer(); setShowUserModal(true); }} className="flex-1 bg-branding-primary hover:bg-branding-primary/90 rounded-xl">
                  {foundCustomerHasUser ? "Sim, importar dados" : "Sim, importar"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Existing User Modal */}
        {showExistingUserModal && existingUserFound && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-card rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-tertiary" />
                Usuário Já Cadastrado
              </h3>
              <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl p-3 text-sm text-on-surface">
                <p>Este e-mail já está registrado como <strong>usuário do sistema</strong>.</p>
                <p className="mt-1">Deseja editar o usuário existente ou cadastrar um novo?</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs text-muted-foreground font-medium mb-2">Dados do usuário encontrado:</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium text-on-surface">{existingUserFound.full_name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-medium text-on-surface">{existingUserFound.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Perfil:</span>
                  <span className="font-medium text-on-surface">
                    {existingUserFound.role === "super_admin" ? "Super Admin" :
                     existingUserFound.role === "admin" ? "Administrador" :
                     existingUserFound.role === "profissional" ? "Profissional" : "Cliente"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowExistingUserModal(false); setExistingUserFound(null); setShowUserModal(true); }} className="flex-1 rounded-xl">
                  Cadastrar Novo
                </Button>
                <Button onClick={() => {
                  const user = users.find(u => u.id === existingUserFound.id);
                  setShowExistingUserModal(false);
                  setExistingUserFound(null);
                  if (user) handleOpenUserModal(user);
                }} className="flex-1 bg-branding-primary hover:bg-branding-primary/90 rounded-xl">
                  Editar Usuário
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-on-surface">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </h3>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={userFormData.full_name}
                    onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                    placeholder="João da Silva"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="joao@exemplo.com"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> WhatsApp</Label>
                  <Input
                    value={userFormData.whatsapp}
                    onChange={(e) => setUserFormData({ ...userFormData, whatsapp: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="rounded-xl"
                  />
                </div>

                {!editingUser && (
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="rounded-xl"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input
                      value={userFormData.cpf}
                      onChange={(e) => setUserFormData({ ...userFormData, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input
                      value={userFormData.rg}
                      onChange={(e) => setUserFormData({ ...userFormData, rg: formatRG(e.target.value) })}
                      placeholder="00.000.000-0"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={userFormData.birth_date}
                    onChange={(e) => setUserFormData({ ...userFormData, birth_date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Perfil</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(isSuperAdmin
                      ? [
                          { value: "super_admin", label: "Super Admin", color: "purple" },
                          { value: "admin", label: "Admin", color: "amber" },
                          { value: "profissional", label: "Profissional", color: "blue" },
                        ]
                      : isAdmin
                        ? [
                            { value: "admin", label: "Admin", color: "amber" },
                            { value: "profissional", label: "Profissional", color: "blue" },
                          ]
                        : [
                            { value: "profissional", label: "Profissional", color: "blue" },
                          ]
                    ).map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, role: value })}
                        className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          userFormData.role === value
                            ? color === "purple" ? "border-secondary bg-secondary/10 text-secondary"
                            : color === "amber" ? "border-tertiary bg-tertiary/10 text-tertiary"
                            : color === "blue" ? "border-primary bg-primary/10 text-primary"
                            : "border-outline bg-surface-container-low text-on-surface"
                            : "border-outline-variant text-muted-foreground hover:border-outline"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company multi-select dropdown */}
                {(isSuperAdmin || isAdmin) && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Empresa</Label>
                    <CompanyMultiSelect
                      companies={isSuperAdmin ? companies : companies.filter(c => currentUserCompanyIds.includes(c.id))}
                      selectedIds={userFormData.company_ids}
                      onChange={(ids) => setUserFormData({ ...userFormData, company_ids: ids })}
                    />
                  </div>
                )}

                {/* Professional toggle */}
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <input
                    type="checkbox"
                    checked={userFormData.is_professional || false}
                    onChange={(e) => setUserFormData({ ...userFormData, is_professional: e.target.checked })}
                    className="w-4 h-4 text-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-on-surface flex items-center gap-1.5">
                      <UserCog className="w-4 h-4" />
                      É profissional
                    </p>
                    <p className="text-xs text-on-surface-variant">Permitirá agendar este usuário como profissional nos atendimentos</p>
                  </div>
                </label>

                {/* Master toggle - only super_admin */}
                {isSuperAdmin && editingUser && (
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-tertiary/10 border border-tertiary/20 rounded-xl">
                    <input
                      type="checkbox"
                      checked={userFormData.is_master || false}
                      onChange={(e) => setUserFormData({ ...userFormData, is_master: e.target.checked })}
                      className="w-4 h-4 text-tertiary"
                    />
                    <div>
                      <p className="text-sm font-medium text-on-surface flex items-center gap-1.5">
                        <Crown className="w-4 h-4" />
                        Master da Conta
                      </p>
                      <p className="text-xs text-on-surface-variant">Responsável pelo recebimento de cobranças. Não pode ser excluído.</p>
                    </div>
                  </label>
                )}

                {editingUser && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserModal(false);
                        handleOpenResetPassword(editingUser);
                      }}
                      className="flex items-center gap-2 text-sm text-branding-primary hover:underline"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Redefinir senha
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUserModal(false);
                    localStorage.removeItem("form_draft_user");
                    localStorage.removeItem("form_draft_user_open");
                  }}
                  className="flex-1 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveUser}
                  disabled={saveUserMutation.isPending || (!editingUser && (!userFormData.email || !userFormData.password || userFormData.password.length < 6))}
                  className="flex-1 bg-branding-secondary hover:bg-branding-secondary/90 rounded-xl"
                >
                  {saveUserMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {subaccountsCompany && (
        <AsaasSubaccountsModal
          company={subaccountsCompany}
          onClose={() => setSubaccountsCompany(null)}
        />
      )}
    </div>
  );
}