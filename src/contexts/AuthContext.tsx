import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface User {
  email: string;
  nombre?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("inaltera_token");
    const savedUser = localStorage.getItem("inaltera_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    // Mock login - replace with real API call when available
    // try { const res = await api.post('/auth/login', { email, password }, { skipAuth: true }); }
    await new Promise((r) => setTimeout(r, 800));
    const mockToken = "mock_token_" + Date.now();
    const mockUser = { email };
    localStorage.setItem("inaltera_token", mockToken);
    localStorage.setItem("inaltera_user", JSON.stringify(mockUser));
    setToken(mockToken);
    setUser(mockUser);
  }, []);

  const register = useCallback(async (email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const mockToken = "mock_token_" + Date.now();
    const mockUser = { email };
    localStorage.setItem("inaltera_token", mockToken);
    localStorage.setItem("inaltera_user", JSON.stringify(mockUser));
    setToken(mockToken);
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("inaltera_token");
    localStorage.removeItem("inaltera_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
