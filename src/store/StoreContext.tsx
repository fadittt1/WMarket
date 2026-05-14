import React, { createContext, useContext } from "react";
import { useStore } from "./useStore";

type StoreType = ReturnType<typeof useStore>;

const StoreContext = createContext<StoreType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
};

export function useAppStore(): StoreType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppStore must be used within StoreProvider");
  return ctx;
}
