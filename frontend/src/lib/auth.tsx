/**
 * Client auth state — user sessions (farmer / SACCO) and the admin session.
 *
 * Tokens are JWTs from the FastAPI backend (`/api/auth/*`), kept in
 * localStorage. The admin session is separate: it comes from the 7-digit
 * ADMIN_PIN (footer → /admin-login) and unlocks only /admin.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id?: number | null;
  name: string;
  phone: string;
  role: "farmer" | "sacco" | "admin" | string;
  created_at?: string | null;
}

const USER_TOKEN_KEY = "sokosense_token";
const USER_KEY = "sokosense_user";
const ADMIN_TOKEN_KEY = "sokosense_admin_token";

export function getUserToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(USER_TOKEN_KEY);
}

export function getAdminToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ADMIN_TOKEN_KEY);
}

/** Token for an API path: admin endpoints use the admin session. */
export function getTokenForPath(path: string): string | null {
  if (path.startsWith("/api/admin") || path.startsWith("/api/logs")) {
    return getAdminToken() ?? getUserToken();
  }
  return getUserToken();
}

interface TokenResponse {
  access_token: string;
  user: AuthUser;
}

async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const base = import.meta.env?.VITE_API_URL ?? "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // keep statusText
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  isAdmin: boolean;
  login: (phone: string, password: string) => Promise<AuthUser>;
  register: (name: string, phone: string, password: string, role: string) => Promise<AuthUser>;
  adminLogin: (pin: string) => Promise<void>;
  logout: () => void;
  adminLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
      setIsAdmin(Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)));
    } catch {
      // corrupted storage — start signed out
    }
    setReady(true);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const r = await authFetch<TokenResponse>("/api/auth/login", { phone, password });
    localStorage.setItem(USER_TOKEN_KEY, r.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(r.user));
    setUser(r.user);
    return r.user;
  }, []);

  const register = useCallback(
    async (name: string, phone: string, password: string, role: string) => {
      const r = await authFetch<TokenResponse>("/api/auth/register", {
        name,
        phone,
        password,
        role,
      });
      localStorage.setItem(USER_TOKEN_KEY, r.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(r.user));
      setUser(r.user);
      return r.user;
    },
    [],
  );

  const adminLogin = useCallback(async (pin: string) => {
    const r = await authFetch<TokenResponse>("/api/auth/admin-login", { pin });
    localStorage.setItem(ADMIN_TOKEN_KEY, r.access_token);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, ready, isAdmin, login, register, adminLogin, logout, adminLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
