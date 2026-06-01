import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  displayName: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser };

type AuthContextValue = {
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = "/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const user = await res.json() as AuthUser;
        setAuthState({ status: "authenticated", user });
      } else {
        setAuthState({ status: "unauthenticated" });
      }
    } catch {
      setAuthState({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? "Login failed");
    }
    const user = await res.json() as AuthUser;
    setAuthState({ status: "authenticated", user });
  };

  const register = async (displayName: string, username: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ displayName, username, email, password }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? "Registration failed");
    }
    const user = await res.json() as AuthUser;
    setAuthState({ status: "authenticated", user });
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    setAuthState({ status: "unauthenticated" });
  };

  return (
    <AuthContext.Provider value={{ authState, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
