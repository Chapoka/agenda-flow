import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server/.env if they are not set
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim();
      if (key && value && !process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    });
  }
} catch (e) {
  console.error("Erro ao carregar .env do servidor:", e);
}

const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Loga qual rede está usando (interna = sem internet, mais rápido)
if (!process.env.SUPABASE_INTERNAL_URL) {
  console.warn("[supabase] SUPABASE_INTERNAL_URL não definido, usando VITE_SUPABASE_URL (via internet) - defina http://agendaflow-supabase-kong:8000 no EasyPanel");
} else {
  console.log(`[supabase] Conectado via rede interna: ${supabaseUrl}`);
}

export function createServerSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_INTERNAL_URL (ou VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecondLimit: 1 } },
  });
}

// Reads the master Asaas API key from the settings table
export async function getMasterAsaasKey(sb) {
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", "asaas_master_api_key")
    .single();
  return data?.value || null;
}

// Reads company-level integration config
export async function getCompanyIntegration(sb, companyId) {
  const { data } = await sb
    .from("company_integrations")
    .select("*")
    .eq("company_id", companyId)
    .single();
  return data || null;
}
