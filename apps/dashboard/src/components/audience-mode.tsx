"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AudienceMode = "ceo" | "operator" | "buyer";

type AudienceModeContextValue = {
  mode: AudienceMode;
  setMode: (mode: AudienceMode) => void;
};

const AudienceModeContext = createContext<AudienceModeContextValue | null>(null);

export function AudienceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AudienceMode>("ceo");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard-audience-mode");
    if (saved === "ceo" || saved === "operator" || saved === "buyer") setMode(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard-audience-mode", mode);
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <AudienceModeContext.Provider value={value}>{children}</AudienceModeContext.Provider>;
}

export function useAudienceMode() {
  const context = useContext(AudienceModeContext);
  if (!context) throw new Error("useAudienceMode must be used within AudienceModeProvider");
  return context;
}
