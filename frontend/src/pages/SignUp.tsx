import { useState } from "react";
import { Link } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import "../App.css";

function SignUp() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

                    <button type="button" className="google-btn">
                        <span className="google-letter">G</span>
                        Continue with Google
                    </button>

                    <div className="divider">
                        <span>OR</span>
                    </div>

                    <form>

                        <div className="form-group">
                            <label htmlFor="name">Full name</label>
                            <input
                                id="name"
                                type="text"
                                placeholder="Your name"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Work email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>

                            <div className="password-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
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

                        <button type="submit" className="sign-in-btn">
                            Create account
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