import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { DEV_TOKEN_PREFIX } from "./nag-utils";

const TOKEN_KEY = "nagz_token";

/** Read the auth token from session storage. */
export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

interface AuthCtx {
  token: string | null;
  userId: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  token: null,
  userId: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => getStoredToken()
  );

  const userId = token?.startsWith(DEV_TOKEN_PREFIX) ? token.slice(DEV_TOKEN_PREFIX.length) : null;

  const login = useCallback((t: string) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    try {
      localStorage.removeItem("nagz_family_id");
    } catch {
      // Storage may be unavailable in private browsing
    }
    setToken(null);
  }, []);

  // Listen for 401 unauthorized events from the axios interceptor
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("nagz:unauthorized", handler);
    return () => window.removeEventListener("nagz:unauthorized", handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
