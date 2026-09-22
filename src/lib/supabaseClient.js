import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce",
  },
  global: {
    fetch: (...args) => {
      return fetch(...args);
    },
  },
});

/**
 * Helper centralizado para obter um access_token válido.
 * Usa refresh automático quando o JWT está prestes a expirar (<60s).
 * Exportado aqui para evitar import circular com getValidSession.js em alguns casos.
 */
export async function getValidAccessToken() {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) return refreshed.session.access_token;
      } catch {}
      return null;
    }
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      const expMs = (payload.exp || 0) * 1000;
      if (expMs && expMs - Date.now() < 60_000) {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (!error && refreshed?.session?.access_token) return refreshed.session.access_token;
      }
    } catch {}
    return session.access_token;
  } catch {
    return null;
  }
}
