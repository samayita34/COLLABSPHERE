import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMeApi, logoutApi, type UserProfile } from "../services/authApi";

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    userInitials: string;
    userFullName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchSession = async () => {
        setLoading(true);
        try {
            const profile = await getMeApi();
            setUser(profile);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSession();
    }, []);

    const logout = async () => {
        try {
            await logoutApi();
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            setUser(null);
            navigate("/", { replace: true });
        }
    };

    const userInitials = user
        ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email.slice(0, 2).toUpperCase()
        : "US";

    const userFullName = user
        ? `${user.firstName} ${user.lastName}`.trim() || user.email
        : "User";

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                logout,
                refreshUser: fetchSession,
                userInitials,
                userFullName,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
