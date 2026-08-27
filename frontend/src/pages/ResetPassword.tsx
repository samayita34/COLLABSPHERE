import { useState, type FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import { resetPasswordApi } from "../services/authApi";
import "../App.css";

function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [status, setStatus] = useState<{ type: "error" | "success" | null; message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus({ type: "error", message: "Invalid or missing reset token. Please request a new link." });
        }
    }, [token]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        if (!token) {
            setStatus({ type: "error", message: "Invalid or missing reset token." });
            return;
        }
        if (!password || password.length < 6) {
            setStatus({ type: "error", message: "Password must be at least 6 characters long" });
            return;
        }
        if (password !== confirmPassword) {
            setStatus({ type: "error", message: "Passwords do not match" });
            return;
        }

        setLoading(true);
        try {
            const res = await resetPasswordApi(token, password);
            setStatus({ type: "success", message: res.message });
            setTimeout(() => {
                navigate("/");
            }, 3000);
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to reset password" });
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
                    <h2>Create new password</h2>
                    <p className="subtitle">Enter your new password below.</p>
                </div>

                <div className="login-box">
                    {status.message && (
                        <div className={`error-message ${status.type === 'success' ? 'success-message' : ''}`} style={status.type === 'success' ? { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' } : {}}>
                            {status.message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="password">New Password</label>
                            <div className="password-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading || !token}
                                />
                                <button
                                    type="button"
                                    className="show-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div className="password-wrapper">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading || !token}
                                />
                                <button
                                    type="button"
                                    className="show-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="sign-in-btn" disabled={loading || !token}>
                            {loading ? "Resetting..." : "Reset Password"}
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

export default ResetPassword;
