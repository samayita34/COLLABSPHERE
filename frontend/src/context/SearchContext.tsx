import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { SearchCategory } from "../services/searchApi";

interface SearchContextType {
    isOpen: boolean;
    initialQuery: string;
    initialCategory: SearchCategory;
    initialProjectId?: string;
    openSearch: (options?: { query?: string; category?: SearchCategory; projectId?: string }) => void;
    closeSearch: () => void;
    toggleSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [initialQuery, setInitialQuery] = useState("");
    const [initialCategory, setInitialCategory] = useState<SearchCategory>("all");
    const [initialProjectId, setInitialProjectId] = useState<string | undefined>(undefined);

    const openSearch = useCallback((options?: { query?: string; category?: SearchCategory; projectId?: string }) => {
        if (options?.query !== undefined) setInitialQuery(options.query);
        if (options?.category) setInitialCategory(options.category);
        if (options?.projectId !== undefined) setInitialProjectId(options.projectId);
        setIsOpen(true);
    }, []);

    const closeSearch = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggleSearch = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    // Global keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    return (
        <SearchContext.Provider
            value={{
                isOpen,
                initialQuery,
                initialCategory,
                initialProjectId,
                openSearch,
                closeSearch,
                toggleSearch,
            }}
        >
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = (): SearchContextType => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error("useSearch must be used within a SearchProvider");
    }
    return context;
};
