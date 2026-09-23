import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServerSupabase, createAuthSupabase } from "./lib/supabase.js";
import asaasRouter from "./routes/asaas.js";
import whatsappRouter from "./routes/whatsapp.js";
import emailRouter from "./routes/email.js";
import authRouter from "./routes/auth.js";
import cepRouter from "./routes/cep.js";
import cnpjRouter from "./routes/cnpj.js";
import migrateRouter from "./routes/migrate.js";
import settingsRouter from "./routes/settings.js";

const PORT = process.env.PORT || 3001;
const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "..", "dist");

// Segurança básica sem quebrar SaaS (credenciais fáceis mantidas por enquanto)
app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "100kb" }));

// Serve frontend static files BEFORE auth middleware
app.use(express.static(distPath));

// CEP lookup is public (no auth needed)
app.use("/api/cep", cepRouter);

// CNPJ lookup is public (no auth needed)
app.use("/api/cnpj", cnpjRouter);

// Health endpoint is public
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Auth middleware - only for API routes
app.use("/api", async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = rawToken?.trim() || null;

  if (!token) {
    return res.status(401).json({ error: "Token de acesso não fornecido", code: "NO_TOKEN" });
  }

  const sb = createServerSupabase();

  // Allow service_role key for server-to-server calls
  if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    req.user = { role: "service_role", email: "server@api" };
    req.supabase = sb;
    return next();
  }

  // Usa cliente com URL pública para validar o JWT (emitido pelo host público)
  // Evita "Token inválido ou expirado" quando SUPABASE_INTERNAL_URL está inacessível
  const authSb = createAuthSupabase();
  try {
    // Timeout de 8s para não travar o request se o Supabase estiver lento
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // Supabase JS não expõe signal diretamente, mas o fetch global respeita AbortController via global.fetch
    // Fallback: chama getUser e trata erro de rede
    const { data: { user }, error } = await authSb.auth.getUser(token);
    clearTimeout(timeout);
    if (error || !user) {
      console.warn(`[auth] getUser falhou: ${error?.message || "no user"} - token ${token.slice(0,12)}...`);
      return res.status(401).json({ error: "Token inválido ou expirado", code: "INVALID_TOKEN", detail: error?.message });
    }
    req.user = user;
    req.supabase = sb; // usa cliente interno para queries DB (mais rápido)
    next();
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    console.error(`[auth] Erro ao validar token${isAbort ? " (timeout)" : ""}:`, err?.message || err);
    return res.status(401).json({ error: "Token inválido ou expirado", code: "TOKEN_VALIDATION_FAILED", detail: err?.message });
  }
});

// RBAC Middleware - fetch user profile with role
async function attachUserRole(req, res, next) {
  if (req.user?.role === "service_role") {
    req.userRole = "service_role";
    return next();
  }

  try {
    const { data: profile, error } = await req.supabase
      .from("users")
      .select("role, company_id")
      .eq("id", req.user.id)
      .single();

    if (error || !profile) {
      return res.status(403).json({ error: "Perfil de usuário não encontrado" });
    }

    const { data: userCompanies } = await req.supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", req.user.id);

    req.userRole = profile.role === "teacher" ? "professor" : profile.role;
    req.userCompanyId = profile.company_id;
    req.userCompanyIds = (userCompanies || []).map(uc => uc.company_id);
    if (req.userCompanyIds.length === 0 && profile.company_id) {
      req.userCompanyIds = [profile.company_id];
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar perfil do usuário" });
  }
}

// Role-based access middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.user?.role === "service_role") return next();
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: "Acesso negado: permissão insuficiente" });
    }
    next();
  };
}

// Company access middleware - ensures user belongs to the company
function requireCompanyAccess(req, res, next) {
  if (req.user?.role === "service_role") return next();
  
  const companyId = req.body?.company_id || req.query?.company_id || req.params?.companyId;
  
  if (!companyId) {
    // If no company_id specified, allow if user has any company
    if (req.userCompanyIds?.length > 0) return next();
    return res.status(403).json({ error: "Empresa não especificada" });
  }

  if (req.userCompanyIds?.includes(companyId)) return next();
  
  return res.status(403).json({ error: "Acesso negado: usuário não pertence a esta empresa" });
}

// Super admin only middleware
const requireSuperAdmin = requireRole("super_admin");

// Admin or super admin
const requireAdmin = requireRole("super_admin", "admin");

// Professional (professor) or above
const requireProfessional = requireRole("super_admin", "admin", "professor");

// Apply role middleware to routes
app.use("/api/asaas", attachUserRole, requireProfessional, asaasRouter);
app.use("/api/whatsapp", attachUserRole, requireProfessional, whatsappRouter);
app.use("/api/send-email", attachUserRole, requireProfessional, emailRouter);
app.use("/api/auth", attachUserRole, authRouter);
app.use("/api/migrate", attachUserRole, requireAdmin, migrateRouter);
app.use("/api/settings", attachUserRole, requireSuperAdmin, settingsRouter);

// SPA fallback - serve index.html for non-API routes
app.use((req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Static files: ${distPath}`);
});