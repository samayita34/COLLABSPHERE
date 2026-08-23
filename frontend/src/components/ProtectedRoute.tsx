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
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0f172a",
                    color: "#94a3b8",
                    fontFamily: "sans-serif",
                }}
            >
                Loading session...
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
