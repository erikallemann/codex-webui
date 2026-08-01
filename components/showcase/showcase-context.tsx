"use client";

import { createContext, useContext, type ReactNode } from "react";

const ShowcaseModeContext = createContext(false);

export function ShowcaseModeProvider({ children }: { children: ReactNode }) {
  return (
    <ShowcaseModeContext.Provider value>
      {children}
    </ShowcaseModeContext.Provider>
  );
}

export function useShowcaseMode(): boolean {
  return useContext(ShowcaseModeContext);
}
