import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./OAuthCallback.css";

type CallbackState = "loading" | "success" | "error";

const ERROR_MESSAGES: Record<string, string> = {
    oauth_not_configured: "Google sign-in is not configured on this server. Please contact support.",
    access_denied: "You cancelled the Google sign-in. No account changes were made.",
    state_mismatch: "Security check failed (CSRF). Please try signing in again.",
    pkce_expired: "Your sign-in session expired. Please try again.",
    token_exchange_failed: "Could not complete sign-in with Google. Please try again.",
    no_email: "Your Google account did not share an email address. Please check your Google account settings.",
    no_code: "Google did not return an authorization code. Please try again.",
    server_error: "An unexpected server error occurred. Please try again in a moment.",
};

function getErrorMessage(reason: string | null): string {
    if (!reason) return "An unknown error occurred. Please try again.";
    return ERROR_MESSAGES[reason] ?? `Sign-in failed: ${reason.replace(/_/g, " ")}.`;
}

export default function OAuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const status = searchParams.get("status") as "success" | "error" | null;
    const reason = searchParams.get("reason");

    const [state, setState] = useState<CallbackState>("loading");
    const [errorMsg, setErrorMsg] = useState<string>("");

    useEffect(() => {
        if (status === "error") {
            setState("error");
            setErrorMsg(getErrorMessage(reason));
            return;
        }

        if (status === "success") {
            // Confirm the session is valid before navigating
            refreshUser()
                .then(() => {
                    setState("success");
                    setTimeout(() => navigate("/projects", { replace: true }), 800);
                })
                .catch(() => {
                    setState("error");
                    setErrorMsg("Sign-in completed on Google, but your session could not be established. Please try again.");
                });
        } else {
            // Unexpected state — redirect to login
            navigate("/", { replace: true });
        }
    }, [status, reason]);

    const handleRetry = () => navigate("/", { replace: true });

    return (
        <div className="oauth-callback-page">
            <div className="oauth-callback-bg">
                <div className="oauth-blob oauth-blob--1" />
                <div className="oauth-blob oauth-blob--2" />
                <div className="oauth-blob oauth-blob--3" />
            </div>

            <div className="oauth-callback-card">
                {/* Brand */}
                <div className="oauth-brand">
                    <span className="oauth-brand-collab">COLLAB</span>
                    <span className="oauth-brand-sphere">SPHERE</span>
                </div>

                {state === "loading" && (
                    <div className="oauth-loading">
                        <div className="oauth-spinner">
                            <div className="oauth-spinner__ring oauth-spinner__ring--outer" />
                            <div className="oauth-spinner__ring oauth-spinner__ring--inner" />
                            <div className="oauth-spinner__google">
                                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                            </div>
                        </div>
                        <h2 className="oauth-loading__title">Signing you in…</h2>
                        <p className="oauth-loading__sub">Verifying your Google account and establishing a secure session.</p>
                        <div className="oauth-step-dots">
                            <span className="oauth-step-dot oauth-step-dot--active" />
                            <span className="oauth-step-dot oauth-step-dot--active" />
                            <span className="oauth-step-dot" />
                        </div>
                    </div>
                )}

                {state === "success" && (
                    <div className="oauth-success">
                        <div className="oauth-success__icon">
                            <svg viewBox="0 0 52 52" className="oauth-checkmark" aria-hidden="true">
                                <circle className="oauth-checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="oauth-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>
                        <h2 className="oauth-success__title">You're in!</h2>
                        <p className="oauth-success__sub">Redirecting to your workspace…</p>
                    </div>
                )}

                {state === "error" && (
                    <div className="oauth-error">
                        <div className="oauth-error__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 className="oauth-error__title">Sign-in failed</h2>
                        <p className="oauth-error__message">{errorMsg}</p>
                        <button
                            id="oauth-retry-btn"
                            className="oauth-retry-btn"
                            onClick={handleRetry}
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="1 4 1 10 7 10" />
                                <path d="M3.51 15a9 9 0 1 0 .49-3.47" />
                            </svg>
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
