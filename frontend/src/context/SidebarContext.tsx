import React, { createContext, useContext, useState } from "react";

interface SidebarContextType {
  isOpen: boolean;
  isFloating: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
  setIsFloating: (floating: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  isFloating: false,
  toggleSidebar: () => {},
  setIsOpen: () => {},
  setIsFloating: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("cs_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });

  const [isFloating, setIsFloating] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("cs_sidebar_open", String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isOpen, isFloating, toggleSidebar, setIsOpen, setIsFloating }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
