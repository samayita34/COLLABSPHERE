import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0d0d12",
                    color: "#f4f4f5",
                    fontFamily: "'Inter', sans-serif",
                    gap: "1rem"
                }}
            >
                <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: "3px solid rgba(255, 255, 255, 0.1)",
                    borderTopColor: "#6366f1",
                    animation: "spin 0.8s linear infinite"
                }} />
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
                <div style={{ fontSize: "14px", color: "#a1a1aa", fontWeight: 500, letterSpacing: "0.02em" }}>
                    Authenticating session...
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
