import { useState, useEffect, useRef } from "react";
import "./App.css";

function BackgroundParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const particleCount = 60;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.2 + 0.4,
      alpha: Math.random() * 0.35 + 0.1,
      speedX: (Math.random() - 0.5) * 0.12,
      speedY: (Math.random() - 0.5) * 0.12,
      pulseSpeed: Math.random() * 0.006 + 0.002,
      pulseDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.alpha += p.pulseSpeed * p.pulseDir;
        if (p.alpha > 0.45) p.pulseDir = -1;
        if (p.alpha < 0.1) p.pulseDir = 1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(199, 210, 254, ${p.alpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="particles-canvas" />;
}

function App() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-page">
      {/* Dynamic ambient particles */}
      <BackgroundParticles />



      <svg
        className="bg-ribbons"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle low-opacity gradients */}
          <linearGradient id="ribbonGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#0f172a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#060810" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="ribbonGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#312e81" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#1e293b" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#080b13" stopOpacity="0.02" />
          </linearGradient>

          <linearGradient id="ribbonGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2e1065" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#1e1b4b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#090d16" stopOpacity="0.0" />
          </linearGradient>

          <linearGradient id="ribbonGrad4" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0b0f19" stopOpacity="0.1" />
          </linearGradient>

          {/* Faint metallic edge stroke highlights */}
          <linearGradient id="edgeStroke1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="edgeStroke2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Layer 1: Outer sweeping curved ribbon from top-right to bottom-left */}
        <path
          d="M 680 -150 C 980 50, 1550 150, 1500 680 C 1450 950, 1100 1050, 750 980 C 400 910, 100 750, -200 600 C -200 350, 200 -50, 680 -150 Z"
          fill="url(#ribbonGrad1)"
        />
        <path
          d="M 680 -150 C 980 50, 1550 150, 1500 680"
          stroke="url(#edgeStroke1)"
          strokeWidth="1.2"
        />

        {/* Layer 2: Deep left-side curved wave fold */}
        <path
          d="M -250 150 C 150 50, 520 400, 380 880 C 250 1100, -150 1080, -350 820 Z"
          fill="url(#ribbonGrad2)"
        />
        <path
          d="M -250 150 C 150 50, 520 400, 380 880"
          stroke="url(#edgeStroke2)"
          strokeWidth="1"
        />

        {/* Layer 3: Soft top-left geometric curtain */}
        <path
          d="M -150 -120 C 350 -100, 580 120, 320 450 C 120 650, -220 450, -220 -20 Z"
          fill="url(#ribbonGrad3)"
        />

        {/* Layer 4: Deep right-hand backdrop shape */}
        <path
          d="M 920 50 C 1280 -50, 1620 250, 1420 720 C 1220 950, 880 750, 920 50 Z"
          fill="url(#ribbonGrad4)"
        />
        <path
          d="M 920 50 C 1280 -50, 1620 250, 1420 720"
          stroke="url(#edgeStroke1)"
          strokeWidth="1"
        />
      </svg>

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

          <button type="button" className="google-btn">
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
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <form>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
              />
            </div>

            <div className="form-group">
              <div className="password-row">
                <label htmlFor="password">Password</label>

                <button type="button" className="forgot-password">
                  Forgot password?
                </button>
              </div>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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

            <button type="submit" className="sign-in-btn">
              Sign in
            </button>
          </form>

          <div className="signup">
            <span>Don't have an account?</span>
            <button type="button">Create an account</button>
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