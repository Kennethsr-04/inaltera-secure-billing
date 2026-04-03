import { createContext, useContext, useState, ReactNode } from "react";

type LayoutOrientation = "side" | "top";

interface LayoutContextType {
  orientation: LayoutOrientation;
  toggleOrientation: () => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [orientation, setOrientation] = useState<LayoutOrientation>(
    () => (localStorage.getItem("layout-orientation") as LayoutOrientation) || "side"
  );

  const toggleOrientation = () => {
    setOrientation((prev) => {
      const next = prev === "side" ? "top" : "side";
      localStorage.setItem("layout-orientation", next);
      return next;
    });
  };

  return (
    <LayoutContext.Provider value={{ orientation, toggleOrientation }}>
      {children}
    </LayoutContext.Provider>
  );
}
