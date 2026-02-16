import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
    () => localStorage.getItem("nagz_token")
  );

  const userId = token?.startsWith("dev:") ? token.slice(4) : null;

  const login = useCallback((t: string) => {
    localStorage.setItem("nagz_token", t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("nagz_token");
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
