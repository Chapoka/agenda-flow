import { supabase } from "@/lib/supabaseClient";

/**
 * Retorna um access_token válido, fazendo refresh automático se necessário.
 * Evita o erro "Token inexistente ou expirado" ao chamar APIs /api/*.
 * - Tenta getSession()
 * - Se exp < 60s, chama refreshSession()
 * - Se sem sessão, tenta refreshSession() uma vez
 */
export async function getValidAccessToken() {
  try {
    let { data: { session } } = await supabase.auth.getSession();

    // Se não há sessão, tenta refresh (caso esteja em background e o autoRefresh falhou)
    if (!session?.access_token) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) return refreshed.session.access_token;
      } catch {}
      return null;
    }

    // Checa expiração do JWT (exp é em segundos)
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      const expMs = (payload.exp || 0) * 1000;
      const now = Date.now();
      // Se expira em menos de 60s, renova
      if (expMs && expMs - now < 60_000) {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (!error && refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
        // Se refresh falhou, retorna o token atual (server vai dar 401 e frontend tenta de novo)
      }
    } catch {
      // Se não deu para decodificar, tenta refresh preventivo quando exp desconhecido
    }

    return session.access_token;
  } catch {
    return null;
  }
}

/**
 * Wrapper fetch autenticado com retry automático em 401.
 * Se a primeira tentativa retornar 401 com "Token inválido ou expirado",
 * faz refreshSession e tenta novamente uma vez.
 */
export async function fetchWithAuth(url, options = {}) {
  let token = await getValidAccessToken();
  const headers = { ...(options.headers || {}), "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(url, { ...options, headers });

  // Se deu 401 por token expirado, tenta refresh + retry 1x
  if (res.status === 401) {
    try {
      const body = await res.clone().json().catch(() => ({}));
      const msg = body.error || "";
      if (msg.includes("Token") || msg.includes("expirado") || msg.includes("inválido")) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const newToken = refreshed?.session?.access_token;
        if (newToken && newToken !== token) {
          headers["Authorization"] = `Bearer ${newToken}`;
          res = await fetch(url, { ...options, headers });
        }
      }
    } catch {}
  }
  return res;
}
