"use client";

import { useEffect, useRef } from "react";

type Node_ = { x: number; y: number; vx: number; vy: number; r: number; hue: number };
type Edge = { a: number; b: number };
type Packet = { e: number; t: number; speed: number; hue: number };

/** Живая топология сети: узлы дрейфуют, между ними бегают «пакеты» */
export default function HeroCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const N = 46;
    const nodes: Node_[] = [];
    const edges: Edge[] = [];
    const packets: Packet[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const build = () => {
      nodes.length = 0;
      edges.length = 0;
      packets.length = 0;
      for (let i = 0; i < N; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          r: 1.6 + Math.random() * 2.4,
          hue: Math.random() < 0.72 ? 198 : 262,
        });
      }
      const R = Math.min(w, h) * 0.24 + 70;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.hypot(dx, dy) < R) edges.push({ a: i, b: j });
        }
      }
      const pn = Math.min(26, edges.length);
      for (let i = 0; i < pn; i++) {
        packets.push({
          e: Math.floor(Math.random() * edges.length),
          t: Math.random(),
          speed: 0.004 + Math.random() * 0.008,
          hue: Math.random() < 0.8 ? 198 : 262,
        });
      }
    };

    resize();
    build();

    const onResize = () => {
      resize();
      build();
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / 60) return;
      last = t;
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // мягкое притяжение/отталкивание от курсора
        const dxm = n.x - mouse.x;
        const dym = n.y - mouse.y;
        const dm = Math.hypot(dxm, dym);
        if (dm < 140 && dm > 0.01) {
          n.x += (dxm / dm) * 0.6;
          n.y += (dym / dm) * 0.6;
        }
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }

      // рёбра
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const R = Math.min(w, h) * 0.24 + 70;
        if (dist > R) continue;
        const alpha = (1 - dist / R) * 0.32;
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, `rgba(76,194,255,${alpha})`);
        g.addColorStop(1, `rgba(124,92,255,${alpha})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // пакеты
      for (const p of packets) {
        p.t += p.speed;
        if (p.t >= 1) {
          p.t = 0;
          p.e = Math.floor(Math.random() * edges.length);
        }
        const e = edges[p.e] ?? edges[0];
        if (!e) continue;
        const a = nodes[e.a];
        const b = nodes[e.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 7);
        grad.addColorStop(0, `hsla(${p.hue} 90% 70% / .9)`);
        grad.addColorStop(1, `hsla(${p.hue} 90% 60% / 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${p.hue} 95% 80% / 1)`;
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // узлы
      for (const n of nodes) {
        const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const boost = dm < 140 ? (1 - dm / 140) * 3 : 0;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6 + boost * 4);
        grad.addColorStop(0, `hsla(${n.hue} 90% 68% / .55)`);
        grad.addColorStop(1, `hsla(${n.hue} 90% 60% / 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 6 + boost * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${n.hue} 85% 76% / .95)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + boost * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
