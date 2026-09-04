import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import PageBackground from "./components/PageBackground";
import { loginApi } from "./services/authApi";
import { useAuth } from "./context/AuthContext";
import "./App.css";

function App() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setGoogleRedirecting(true);
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    // Strip trailing /api if present so we hit the base server path
    const serverBase = apiBase.replace(/\/api$/, "");
    window.location.href = `${serverBase}/api/auth/google`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await loginApi(email, password);
      await refreshUser();
      navigate("/projects");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <PageBackground />

      {/* Main card container */}
      <div className="login-container">
        <div className="brand">
          <span className="brand-wordmark">
            <span className="brand-collab">COLLAB</span><span className="brand-sphere">SPHERE</span>
          </span>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h1>Welcome back</h1>
            <p>Sign in to continue to your workspace.</p>
          </div>

          {error && (
            <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={googleRedirecting}
            id="google-login-btn"
          >
            {googleRedirecting ? (
              <>
                <svg className="google-icon google-icon--spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Redirecting to Google…
              </>
            ) : (
              <>
                <svg
                  className="google-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div className="password-row">
                <label htmlFor="password">Password</label>

                <Link to="/forgot-password" className="forgot-password">
                  Forgot password?
                </Link>
              </div>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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

            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <button type="submit" className="sign-in-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="signup">
            <span>Don't have an account?</span>
            <Link to="/signup">Create an account</Link>
          </div>

        </div>

        <p className="footer">
          © 2026 COLLABSPHERE
        </p>

      </div>
    </div>
  );
}

export default App;
