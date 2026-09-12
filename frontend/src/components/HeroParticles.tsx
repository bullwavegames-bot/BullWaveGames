import { useEffect, useRef } from "react";

const COLORS = ["#61d6b0", "#43c7e8", "#a66acb"];

export function HeroParticles({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dots = Array.from({ length: 42 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.00035,
      vy: -0.00012 - Math.random() * 0.00028,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: 0.18 + Math.random() * 0.45,
    }));
    let raf = 0;
    const draw = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = Math.max(1, w * dpr);
        canvas.height = Math.max(1, h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);
      for (const dot of dots) {
        if (!paused) {
          dot.x += dot.vx;
          dot.y += dot.vy;
          if (dot.y < -0.02) dot.y = 1.02;
          if (dot.x < -0.02) dot.x = 1.02;
          if (dot.x > 1.02) dot.x = -0.02;
        }
        ctx.beginPath();
        ctx.fillStyle = dot.color;
        ctx.globalAlpha = dot.a;
        ctx.arc(dot.x * w, dot.y * h, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return <canvas ref={canvasRef} className="hero-particles" aria-hidden="true" />;
}
