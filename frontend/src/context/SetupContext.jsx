"use client";
import { createContext, useState, useContext } from "react";

const SetupContext = createContext();

export function SetupProvider({ children }) {
  const [selectedSources, setSelectedSources] = useState([]);

  return (
    <SetupContext.Provider value={{ selectedSources, setSelectedSources }}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
}
