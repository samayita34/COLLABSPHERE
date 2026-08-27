import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import { forgotPasswordApi } from "../services/authApi";
import "../App.css";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<{ type: "error" | "success" | null; message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        if (!email.trim() || !email.includes("@")) {
            setStatus({ type: "error", message: "Valid email is required" });
            return;
        }

        setLoading(true);
        try {
            const res = await forgotPasswordApi(email);
            setStatus({ type: "success", message: res.message });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to send reset link" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <PageBackground />

            <div className="login-box-wrapper">
                <div className="login-header">
                    <div className="logo-placeholder" />
                    <h2>Reset your password</h2>
                    <p className="subtitle">Enter your email and we'll send you a link to reset your password.</p>
                </div>

                <div className="login-box">
                    {status.message && (
                        <div className={`error-message ${status.type === 'success' ? 'success-message' : ''}`} style={status.type === 'success' ? { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' } : {}}>
                            {status.message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <button type="submit" className="sign-in-btn" disabled={loading}>
                            {loading ? "Sending..." : "Send reset link"}
                        </button>
                    </form>

                    <div className="signup">
                        <span>Remember your password?</span>
                        <Link to="/">Back to login</Link>
                    </div>
                </div>

                <p className="footer">© 2026 COLLABSPHERE</p>
            </div>
        </div>
    );
}

export default ForgotPassword;
