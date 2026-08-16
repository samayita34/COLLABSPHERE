import { useEffect, useRef } from "react";

function StarParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number | null = null;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Very sparse, tiny, barely-visible stars — like the Microsoft bg
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 0.8 + 0.2,
      a: Math.random() * 0.25 + 0.05,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 240, ${s.a})`;
        ctx.fill();
      });
      // static — no animation needed, stars don't move in MS bg
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="stars-canvas" />;
}

export default function PageBackground() {
  return (
    <>
      <StarParticles />

      <svg
        className="bg-ribbons"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="fold1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c2232" />
            <stop offset="100%" stopColor="#141824" />
          </linearGradient>
          <linearGradient id="fold2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a2030" />
            <stop offset="100%" stopColor="#131720" />
          </linearGradient>
          <linearGradient id="fold3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1b2232" />
            <stop offset="100%" stopColor="#111520" />
          </linearGradient>
          <linearGradient id="fold4" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#16192a" />
            <stop offset="100%" stopColor="#0f1219" />
          </linearGradient>
          <linearGradient id="fold5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#232b3e" />
            <stop offset="100%" stopColor="#191f2d" />
          </linearGradient>
        </defs>

        {/* Solid base */}
        <rect width="1440" height="900" fill="#0f1117" />

        {/* Large sweeping left ribbon — the dominant left-side fold */}
        <path
          d="M -300 -200
             C 100 -50, 400 200, 360 520
             C 320 800, 60 900, -200 1100
             L -400 1100 L -400 -200 Z"
          fill="url(#fold1)"
        />

        {/* Inner left fold — creates the crease/depth effect */}
        <path
          d="M -200 -200
             C 80 -100, 300 180, 260 480
             C 220 760, 0 880, -180 1100
             L -320 1100 L -320 -200 Z"
          fill="url(#fold3)"
        />

        {/* Upper-right wide ribbon sweeping down */}
        <path
          d="M 700 -200
             C 980 -120, 1280 80, 1380 340
             C 1480 600, 1380 800, 1540 1000
             L 1700 1000 L 1700 -200 Z"
          fill="url(#fold2)"
        />

        {/* Right-edge secondary fold */}
        <path
          d="M 900 -200
             C 1100 -80, 1340 120, 1420 400
             C 1500 680, 1380 860, 1500 1000
             L 1700 1000 L 1700 -200 Z"
          fill="url(#fold4)"
        />

        {/* Lower-left sweeping shape for bottom depth */}
        <path
          d="M -300 600
             C 0 520, 260 620, 340 820
             C 400 960, 200 1060, -200 1060
             L -400 1060 Z"
          fill="url(#fold5)"
        />

        {/* Fold crease lines — thin lighter edges where ribbons meet */}
        <path
          d="M -80 -200 C 200 0, 340 300, 300 600 C 260 860, 40 960, -100 1100"
          stroke="#232d42"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M 700 -200 C 900 0, 1100 200, 1200 480 C 1300 720, 1250 860, 1400 1000"
          stroke="#1e2840"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M 1000 -100 C 1150 100, 1300 300, 1350 560"
          stroke="#1e2a3e"
          strokeWidth="0.8"
          opacity="0.5"
        />
      </svg>
    </>
  );
}
