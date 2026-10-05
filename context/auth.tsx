"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/client";

export type Role = "customer" | "worker" | "admin";

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  gender?: string;
  avatarFileId?: string | null;
  status?: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("not ready");
  },
  register: async () => {
    throw new Error("not ready");
  },
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api<AuthUser>("/api/auth/login", { body: { email, password } });
    setUser(data);
    return data;
  };

  const register = async (payload: Record<string, unknown>) => {
    const data = await api<AuthUser>("/api/auth/register", { body: payload });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function dashboardHome(role?: Role | null): string {
  if (role === "admin") return "/dashboard/admin";
  if (role === "worker") return "/dashboard/worker";
  return "/dashboard/customer";
}

export function useRequireAuth(roles?: Role[]) {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (roles && !roles.includes(user.role)) {
      router.replace(dashboardHome(user.role));
    }
  }, [user, loading, roles, router, pathname]);
  return { user, loading, allowed: !!user && (!roles || roles.includes(user.role)), logout, refresh };
}
