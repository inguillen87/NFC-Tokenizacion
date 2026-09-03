"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SimpleTrustIndustry } from "./simple-trust-step-visual";

type ConnectedProductIndustryContextValue = {
  activeIndustry: SimpleTrustIndustry;
  setActiveIndustry: (industry: SimpleTrustIndustry) => void;
};

const ConnectedProductIndustryContext = createContext<ConnectedProductIndustryContextValue | null>(null);

export function ConnectedProductIndustryProvider({ children }: { children: ReactNode }) {
  const [activeIndustry, setActiveIndustry] = useState<SimpleTrustIndustry>("bottles");
  const value = useMemo(() => ({ activeIndustry, setActiveIndustry }), [activeIndustry]);

  return (
    <ConnectedProductIndustryContext.Provider value={value}>
      {children}
    </ConnectedProductIndustryContext.Provider>
  );
}

export function useConnectedProductIndustry() {
  return useContext(ConnectedProductIndustryContext);
}
