"use client";

import * as React from "react";

export type Density = "compact" | "regular";

/**
 * Density is user switchable, as the design system requires: compact rows are
 * 32px and the data default, regular rows are 40px and the reading default.
 * The switch lives in the top nav, so the value is shared from the shell.
 */
const DensityContext = React.createContext<{
  density: Density;
  setDensity: (d: Density) => void;
}>({ density: "compact", setDensity: () => {} });

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensity] = React.useState<Density>("compact");
  const value = React.useMemo(() => ({ density, setDensity }), [density]);
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  return React.useContext(DensityContext);
}
