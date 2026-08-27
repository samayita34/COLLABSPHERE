import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import { verifyEmailApi } from "../services/authApi";
import "../App.css";

function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    
    const [status, setStatus] = useState<{ type: "loading" | "error" | "success"; message: string }>({ type: "loading", message: "Verifying your email address..." });

    useEffect(() => {
        let isMounted = true;

        const verify = async () => {
            if (!token) {
                if (isMounted) setStatus({ type: "error", message: "Invalid or missing verification token." });
                return;
            }

            try {
                const res = await verifyEmailApi(token);
                if (isMounted) setStatus({ type: "success", message: res.message });
            } catch (err: any) {
                if (isMounted) setStatus({ type: "error", message: err.message || "Failed to verify email address." });
            }
        };

        verify();

        return () => {
            isMounted = false;
        };
    }, [token]);

    return (
        <div className="login-container">
            <PageBackground />

            <div className="login-box-wrapper">
                <div className="login-header">
                    <div className="logo-placeholder" />
                    <h2>Email Verification</h2>
                </div>

                <div className="login-box" style={{ textAlign: "center", padding: "2rem" }}>
                    {status.type === "loading" && (
                        <div style={{ color: "#a1a1aa" }}>{status.message}</div>
                    )}

                    {status.type === "error" && (
                        <div className="error-message">
                            {status.message}
                        </div>
                    )}

                    {status.type === "success" && (
                        <div className="success-message" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            {status.message}
                        </div>
                    )}

                    <div style={{ marginTop: "2rem" }}>
                        <Link to="/projects" className="sign-in-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                            Continue to app
                        </Link>
                    </div>
                </div>

                <p className="footer">© 2026 COLLABSPHERE</p>
            </div>
        </div>
    );
}

export default VerifyEmail;
