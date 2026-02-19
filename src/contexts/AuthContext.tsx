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

function getRegisteredUsers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("inaltera_registered_users") || "{}");
  } catch { return {}; }
}

function saveRegisteredUsers(users: Record<string, string>) {
  localStorage.setItem("inaltera_registered_users", JSON.stringify(users));
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

  const login = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const users = getRegisteredUsers();
    if (!users[email]) {
      throw new Error("Este email no está registrado. Por favor, crea una cuenta primero.");
    }
    if (users[email] !== password) {
      throw new Error("Contraseña incorrecta.");
    }
    const mockToken = "mock_token_" + Date.now();
    const mockUser = { email };
    localStorage.setItem("inaltera_token", mockToken);
    localStorage.setItem("inaltera_user", JSON.stringify(mockUser));
    setToken(mockToken);
    setUser(mockUser);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const users = getRegisteredUsers();
    if (users[email]) {
      throw new Error("Este email ya está registrado. Inicia sesión.");
    }
    users[email] = password;
    saveRegisteredUsers(users);
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
