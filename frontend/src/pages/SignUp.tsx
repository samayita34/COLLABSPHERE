import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import { signupApi } from "../services/authApi";
import { useAuth } from "../context/AuthContext";
import "../App.css";

function SignUp() {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("Full name is required");
            return;
        }
        if (!email.trim() || !email.includes("@")) {
            setError("Valid work email is required");
            return;
        }
        if (!password || password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            await signupApi(name, email, password);
            await refreshUser();
            navigate("/projects");
        } catch (err: any) {
            setError(err.message || "Failed to create account");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <PageBackground />

            <div className="login-container">

                <div className="brand">
                    <span className="brand-wordmark">
                        <span className="brand-collab">COLLAB</span><span className="brand-sphere">SPHERE</span>
                    </span>
                </div>


                <div className="login-card">

                    <div className="login-header">
                        <h1>Create your account</h1>
                        <p>Set up your account to get started with COLLABSPHERE.</p>
                    </div>

                    {error && (
                        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
                            {error}
                        </div>
                    )}

                    <button type="button" className="google-btn" onClick={() => window.location.href = "http://localhost:3000/api/auth/google"}>
                        <span className="google-letter">G</span>
                        Continue with Google
                    </button>

                    <div className="divider">
                        <span>OR</span>
                    </div>

                    <form onSubmit={handleSubmit}>

                        <div className="form-group">
                            <label htmlFor="name">Full name</label>
                            <input
                                id="name"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Work email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>

                            <div className="password-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                            <label htmlFor="confirmPassword">
                                Confirm password
                            </label>

                            <div className="password-wrapper">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />

                                <button
                                    type="button"
                                    className="show-password"
                                    onClick={() =>
                                        setShowConfirmPassword(!showConfirmPassword)
                                    }
                                >
                                    {showConfirmPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="sign-in-btn" disabled={loading}>
                            {loading ? "Creating account..." : "Create account"}
                        </button>

                    </form>

                    <div className="signup">
                        <span>Already have an account?</span>
                        <Link to="/">Sign in</Link>
                    </div>

                </div>

                <p className="footer">
                    © 2026 COLLABSPHERE
                </p>

            </div>
        </div>
    );
}

export default SignUp;