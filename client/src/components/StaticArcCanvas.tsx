import { useEffect, useRef } from "react";

export default function StaticArcCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let mounted = true;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function generateBolt(
      x1: number, y1: number, x2: number, y2: number,
      displace: number, segments: number, branchChance: number
    ): { main: number[][], branches: number[][][] } {
      const branches: number[][][] = [];
      function subdivide(
        x1: number, y1: number, x2: number, y2: number,
        disp: number, depth: number
      ): number[][] {
        if (depth <= 0 || disp < 2) return [[x1, y1], [x2, y2]];
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * disp;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * disp;
        if (Math.random() < branchChance && depth < segments) {
          const bx = mx + (Math.random() - 0.5) * disp * 3;
          const by = my + (Math.random() - 0.5) * disp * 3 + disp;
          branches.push(subdivide(mx, my, bx, by, disp * 0.5, depth - 1));
        }
        const left = subdivide(x1, y1, mx, my, disp * 0.55, depth - 1);
        const right = subdivide(mx, my, x2, y2, disp * 0.55, depth - 1);
        return left.concat(right.slice(1));
      }
      const main = subdivide(x1, y1, x2, y2, displace, segments);
      return { main, branches };
    }

    function drawPath(pts: number[][], width: number, alpha: number) {
      if (!ctx || !canvas) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = `rgba(160,220,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.shadowColor = "#7fd4ff";
      ctx.shadowBlur = 14;
      ctx.stroke();
    }

    function strikeBolt(
      x1: number, y1: number, x2: number, y2: number,
      opts: { segments?: number; displace?: number; branchChance?: number; duration?: number } = {}
    ) {
      if (!canvas) return;
      const {
        segments = 6,
        displace = Math.abs(x2 - x1) * 0.5 + 40,
        branchChance = 0.35,
        duration = 200,
      } = opts;
      const bolt = generateBolt(x1, y1, x2, y2, displace, segments, branchChance);
      let start: number | null = null;

      function frame(t: number) {
        if (!mounted || !canvas) return;
        if (!start) start = t;
        const elapsed = t - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const alpha = 1 - elapsed / duration;
        if (alpha > 0) {
          drawPath(bolt.main, 4, alpha * 0.22);
          drawPath(bolt.main, 1.6, alpha);
          bolt.branches.forEach((b) => drawPath(b, 1, alpha * 0.75));
          requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      requestAnimationFrame(frame);
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    function ambientStrike() {
      if (!mounted || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      const x1 = Math.random() * w;
      const x2 = x1 + (Math.random() - 0.5) * 160;
      strikeBolt(x1, 0, x2, h * 0.35 + Math.random() * h * 0.45);
      timeoutId = setTimeout(ambientStrike, 1800 + Math.random() * 3000);
    }

    timeoutId = setTimeout(ambientStrike, 1000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
    />
  );
}
