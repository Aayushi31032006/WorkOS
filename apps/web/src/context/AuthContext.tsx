import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { MeResponse } from "../types.js";
import { apiRequest } from "../api/client.js";

export interface DemoUser {
  tag: string;
  name: string;
  role: string;
  company: string;
}

export const DEMO_USERS: DemoUser[] = [
  { tag: "acme-owner", name: "Alice Chen", role: "Owner", company: "Acme Corp" },
  { tag: "acme-admin", name: "Bob Martinez", role: "Admin", company: "Acme Corp" },
  { tag: "acme-member", name: "Carol Thompson", role: "Member", company: "Acme Corp" },
  { tag: "acme-guest", name: "Dave Kim", role: "Guest", company: "Acme Corp" },
  { tag: "globex-owner", name: "Frank Burns", role: "Owner", company: "Globex Corp" },
  { tag: "globex-admin", name: "Grace Hopper", role: "Admin", company: "Globex Corp" },
];

interface AuthContextType {
  currentUser: MeResponse | null;
  currentTag: string;
  token: string | null;
  loading: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  switchUser: (tag: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentTag, setCurrentTag] = useState<string>("acme-owner");
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, [theme]);

  const switchUser = useCallback(async (tag: string) => {
    try {
      setLoading(true);
      // Fetch token from Mock IdP
      const res = await fetch(`http://localhost:4001/token?tag=${tag}`);
      if (!res.ok) throw new Error("Failed to authenticate with mock IdP");
      const data = await res.json();
      const jwt = (data.access_token || data.token) as string;
      setToken(jwt);
      setCurrentTag(tag);

      // Fetch user profile & company details
      const meRes = await apiRequest<{ data: MeResponse }>("/v1/me", jwt);
      setCurrentUser(meRes.data);
    } catch (err) {
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void switchUser(currentTag);
  }, [switchUser, currentTag]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTag,
        token,
        loading,
        theme,
        toggleTheme,
        switchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
