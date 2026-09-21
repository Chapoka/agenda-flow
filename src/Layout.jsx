import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  ListOrdered,
  MessageSquare,
  History,
  Building2,
   Loader2,
  Award,
  Link2,
  UserCog,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/api/dbClient";
import { useThemeMode, useToggleTheme } from "@/hooks/useThemeMode";
import { useQuery } from "@tanstack/react-query";

const allNavItems = [
  { name: "Dashboard",       icon: LayoutDashboard, page: "Dashboard",   roles: ["super_admin","admin","profissional"] },
  { name: "Agenda",          icon: Calendar,        page: "Schedule",    roles: ["super_admin","admin","profissional"] },
  { name: "Clientes",        icon: Users,           page: "Clientes",    roles: ["super_admin","admin","profissional"] },
  { name: "Profissionais",   icon: UserCog,         page: "Profissionais", roles: ["super_admin","admin"] },
  { name: "Planos",          icon: Package,         page: "Plans",       roles: ["super_admin","admin"] },
  { name: "Punch Cards",      icon: CreditCard,      page: "PunchCards",  roles: ["super_admin","admin"] },
  { name: "Produtos e Serviços", icon: Package,       page: "Services",    roles: ["super_admin","admin","profissional"] },
  { name: "Níveis",            icon: Award,           page: "StylistLevels", roles: ["super_admin","admin"] },
  { name: "Cobranças",       icon: CreditCard,      page: "Invoices",    roles: ["super_admin","admin"] },
  { name: "Fila de Espera",  icon: ListOrdered,     page: "WaitingList", roles: ["super_admin","admin","profissional"] },
  { name: "Templates",       icon: MessageSquare,   page: "Templates",   roles: ["super_admin","admin"] },
  { name: "Empresas",          icon: Building2,       page: "Companies",   roles: ["super_admin","admin"] },
  { name: "Calendário",       icon: Link2,           page: "CalendarSettings", roles: ["super_admin","admin"] },
  { name: "Logs",            icon: History,         page: "AuditLogs",   roles: ["super_admin"] },
  { name: "Configurações",   icon: Settings,        page: "Settings",    roles: ["super_admin","admin"] },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Fetch current user
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("users").select("*, user_companies(company_id)").eq("id", session.user.id).maybeSingle();
      if (!data) return session.user;
      return {
        ...data,
        company_ids: data.user_companies?.map(uc => uc.company_id) || (data.company_id ? [data.company_id] : []),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's company branding (reacts to cache invalidation)
  const userCompanyIds = currentUser?.company_ids?.length ? currentUser.company_ids : (currentUser?.company_id ? [currentUser.company_id] : []);
  const userCompanyId = userCompanyIds[0];
  const isSuperAdmin = currentUser?.role === "super_admin";

  const { data: userCompany, isLoading: companyLoading } = useQuery({
    queryKey: ["userCompany", userCompanyId],
    queryFn: () => db.entities.Company.get(userCompanyId),
    enabled: !!userCompanyId,
    staleTime: 0,
  });

  // Super admin sem empresa vinculada: busca automática removida — usa branding padrão

  const effectiveCompany = userCompany;

  // Compute branding from company or defaults
  const defaultBranding = useMemo(() => ({
    appName: "AgendaFlow", logoUrl: null,
    primaryColor: "#b7005e", secondaryColor: "#db2777",
    accentColor: "#1a1c1c", backgroundColor: "#f9f9f9",
  }), []);

  const branding = effectiveCompany
    ? {
        appName: effectiveCompany.branding_app_name || effectiveCompany.name || "AgendaFlow",
        logoUrl: effectiveCompany.branding_logo_url,
        primaryColor: effectiveCompany.branding_primary_color || "#b7005e",
        secondaryColor: effectiveCompany.branding_secondary_color || "#db2777",
        accentColor: effectiveCompany.branding_accent_color || "#1a1c1c",
        backgroundColor: effectiveCompany.branding_background_color || "#f9f9f9",
      }
    : defaultBranding;

  const theme = useThemeMode();
  const toggleTheme = useToggleTheme();
  const loading = userLoading || (userCompanyId && companyLoading);

  useEffect(() => {
    const root = document.documentElement;
    const p = branding.primaryColor;
    const s = branding.secondaryColor;
    const a = branding.accentColor;
    const b = branding.backgroundColor;
    const toRgb = (hex) => {
      const c = hex.replace("#", "");
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `${r} ${g} ${b}`;
    };
    root.style.setProperty("--branding-primary", toRgb(p));
    root.style.setProperty("--branding-secondary", toRgb(s));
    root.style.setProperty("--branding-accent", toRgb(a));
    root.style.setProperty("--branding-background", toRgb(b));
    root.style.setProperty("--branding-primary-hex", p);
    root.style.setProperty("--branding-secondary-hex", s);
    root.style.setProperty("--branding-accent-hex", a);
    root.style.setProperty("--branding-background-hex", b);
  }, [branding]);

  const handleLogout = () => {
    supabase.auth.signOut();
    window.location.href = "/login";
  };

  const publicPages = ["CustomerPortal", "Portalcliente"];
  if (publicPages.includes(currentPageName)) {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.contentBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.contentBg }}>
        <a href="/login" className="hover:underline" style={{ color: theme.cardText }}>Ir para o login</a>
      </div>
    );
  }

  const rawRole = currentUser.role || "cliente";
  const role = rawRole === "teacher" ? "profissional" : rawRole === "user" ? "cliente" : rawRole;

  if (role === "cliente") {
    window.location.href = createPageUrl("Portalcliente");
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.contentBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  const navItems = allNavItems.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (item.page === "Companies" && !isSuperAdmin && userCompanyIds.length <= 1) return false;
    return true;
  });
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Administrador" : "Profissional";

  const roleBadgeStyle = theme.isDark
    ? role === "super_admin"
      ? { background: "rgba(168,85,247,0.25)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.3)" }
      : role === "admin"
      ? { background: "rgba(245,158,11,0.25)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.3)" }
      : { background: `${branding.primaryColor}33`, color: branding.primaryColor, border: `1px solid ${branding.primaryColor}44` }
    : role === "super_admin"
      ? { background: "rgba(168,85,247,0.1)", color: "#7c3aed", border: "1px solid rgba(168,85,247,0.2)" }
      : role === "admin"
      ? { background: "rgba(183,0,94,0.1)", color: "#b7005e", border: "1px solid rgba(183,0,94,0.2)" }
      : { background: `${branding.primaryColor}15`, color: branding.primaryColor, border: `1px solid ${branding.primaryColor}30` };

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: theme.contentBg }}>
      {/* Mobile Header */}
      <div className={cn(
        "lg:hidden fixed top-0 left-0 right-0 backdrop-blur-xl border-b px-4 py-3 transition-all duration-300",
        sidebarOpen ? "z-30" : "z-50"
      )} style={{
        background: theme.isDark ? "rgba(12,12,12,0.85)" : "rgba(255,255,255,0.85)",
        borderColor: theme.sidebarBorder,
      }}>
        <div className="flex items-center justify-between">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  background: theme.sidebarActive,
                  boxShadow: `0 4px 15px ${branding.primaryColor}40`,
                }}
              >
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <Calendar className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
            <span className="font-bold" style={{ color: theme.cardText }}>{branding.appName}</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ color: theme.sidebarText }}
            >
              {theme.isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl transition-colors"
              style={{ color: theme.sidebarText, background: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 backdrop-blur-sm" style={{ background: theme.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)" }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 lg:z-40 h-full w-64 transform transition-transform duration-300 lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        boxShadow: theme.isDark ? "4px 0 24px rgba(0,0,0,0.4)" : "4px 0 24px rgba(0,0,0,0.03)",
      }}>
        {/* Sidebar top glow accent */}
        <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{
          background: `radial-gradient(ellipse at top center, ${branding.primaryColor}08, transparent 70%)`,
        }} />

        <div className="p-5 flex-1 flex flex-col overflow-hidden relative">
          {/* Logo */}
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 mb-1 group hover:opacity-90 transition-opacity">
            <div className="relative">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105"
                style={{
                  background: theme.sidebarActive,
                  boxShadow: `0 8px 24px ${branding.primaryColor}30`,
                }}
              >
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="" className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <Calendar className="w-6 h-6 text-white" />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm leading-tight truncate" style={{ color: theme.cardText }}>{branding.appName}</h1>
              <p className="text-xs mt-0.5" style={{ color: theme.sidebarText }}>Gestão de Agendamentos</p>
            </div>
          </Link>

          {/* Role badge */}
          <div className="mb-5 mt-3">
            <span className="text-xs px-3 py-1 rounded-full font-semibold inline-block" style={roleBadgeStyle}>
              {roleLabel}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px mb-4" style={{ background: `linear-gradient(90deg, transparent, ${theme.sidebarBorder}, transparent)` }} />

          {/* Navigation */}
          <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm relative group"
                  style={isActive ? {
                    background: theme.sidebarActive,
                    color: theme.sidebarTextActive,
                    boxShadow: `0 4px 16px ${branding.primaryColor}25`,
                  } : {
                    color: theme.sidebarText,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = theme.sidebarHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0 transition-colors")} style={{ color: isActive ? "white" : undefined }} />
                  <span className={cn("truncate", isActive ? "font-semibold" : "font-medium")}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User + Logout */}
        <div className="p-4 border-t" style={{ borderColor: theme.sidebarBorder }}>
          {/* Divider */}

          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{
              background: theme.sidebarActive,
              color: "white",
              boxShadow: `0 4px 12px ${branding.primaryColor}25`,
            }}>
              {(currentUser.full_name || currentUser.email || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: theme.cardText }}>{currentUser.full_name || "Usuário"}</p>
              <p className="text-xs truncate" style={{ color: theme.sidebarText }}>{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium mb-1"
            style={{ color: theme.sidebarText }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.sidebarHover;
              e.currentTarget.style.color = theme.sidebarTextActive;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.sidebarText;
            }}
          >
            {theme.isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {theme.isDark ? "Tema Claro" : "Tema Escuro"}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
            style={{ color: theme.sidebarText }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.06)";
              e.currentTarget.style.color = "#EF4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.sidebarText;
            }}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn("transition-all duration-300 lg:ml-64 pt-16 lg:pt-0 min-h-screen")} style={{ background: theme.contentBg }}>
        {children}
      </main>
    </div>
  );
}
