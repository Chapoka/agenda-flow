import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

function normalizeRole(role) {
  if (!role) return 'cliente';
  if (role === 'teacher') return 'profissional';
  if (role === 'user') return 'cliente';
  return role;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: appParams.appId, public_settings: {} });

  useEffect(() => {
    const authTimeout = setTimeout(() => {
      setIsLoadingAuth(false);
    }, 2500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(authTimeout);
      setSession(session);
      if (session) {
        loadUser(session.user.id);
      } else {
        setIsLoadingAuth(false);
      }
    }).catch(() => {
      clearTimeout(authTimeout);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(authTimeout);
      setSession(session);
      if (session) {
        loadUser(session.user.id);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    // Empresa fica logado o tempo todo - keep-alive a cada 10min + ao voltar para a aba
    const keepAlive = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) supabase.auth.refreshSession().catch(()=>{});
      });
    }, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) supabase.auth.refreshSession().catch(()=>{});
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearTimeout(authTimeout);
      subscription.unsubscribe();
      clearInterval(keepAlive);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const loadUser = async (userId) => {
    try {
      setIsLoadingAuth(true);
      const { data: userData } = await supabase
        .from("users")
        .select("*, user_companies(company_id)")
        .eq("id", userId)
        .maybeSingle();

      if (userData) {
        const normalizedUser = {
          ...userData,
          role: normalizeRole(userData.role),
          company_ids: userData.user_companies?.length > 0
            ? userData.user_companies.map(uc => uc.company_id)
            : (userData.company_id ? [userData.company_id] : []),
        };
        setUser(normalizedUser);
        setIsAuthenticated(true);
      } else {
        setUser({ id: userId, role: 'cliente', company_ids: [] });
        setIsAuthenticated(true);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error("Failed to load user:", error);
      setAuthError({ type: "load_failed", message: error.message || "Erro ao carregar usuário" });
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
