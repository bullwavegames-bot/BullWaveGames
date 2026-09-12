import { useEffect, useRef, useState } from "react";
import {
  DirectionPad,
  finish,
  GameFrame,
  random,
  useTick,
  type Props,
} from "./common";
const W = 640,
  H = 440;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
type Point = { x: number; y: number };
function point(e: React.PointerEvent<HTMLCanvasElement>): Point {
  const r = e.currentTarget.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
    y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
  };
}
function bg(ctx: CanvasRenderingContext2D, w = W, h = H) {
  ctx.fillStyle = "#0c1926";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1b3042";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}
function blobBg(ctx: CanvasRenderingContext2D) {
  const gradient = typeof ctx.createRadialGradient === "function"
    ? ctx.createRadialGradient(W * .5, H * .4, 30, W * .5, H * .5, W * .75)
    : null;
  if (gradient) {
    gradient.addColorStop(0, "#15364a");
    gradient.addColorStop(1, "#06131f");
    ctx.fillStyle = gradient;
  } else ctx.fillStyle = "#0c1926";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(67, 199, 232, .1)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const glow = typeof ctx.createRadialGradient === "function"
    ? ctx.createRadialGradient(W * .5, H * .5, 10, W * .5, H * .5, 300)
    : null;
  if (glow) {
    glow.addColorStop(0, "rgba(97, 214, 176, .08)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
}
function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string | CanvasGradient | CanvasPattern,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function useKeys(move: (x: number, y: number) => void) {
  const ref = useRef(move);
  ref.current = move;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d: Record<string, number[]> = {
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
        ArrowUp: [0, -1],
        w: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
      };
      if (d[e.key]) {
        e.preventDefault();
        ref.current(d[e.key][0], d[e.key][1]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
}

export function Snake({ api, paused }: Props) {
  const [body, setBody] = useState([210, 209, 208]);
  const [food, setFood] = useState(216);
  const direction = useRef(1),
    pending = useRef(1);
  const [score, setScore] = useState(0);
  const move = (x: number, y: number) => {
    const n = x || y * 20;
    if (n !== -direction.current) pending.current = n;
  };
  useKeys(move);
  useTick(
    () => {
      direction.current = pending.current;
      const head = body[0],
        next = head + direction.current;
      const eat = next === food;
      const collision =
        next < 0 ||
        next >= 400 ||
        (direction.current === 1 && head % 20 === 19) ||
        (direction.current === -1 && head % 20 === 0) ||
        (eat ? body : body.slice(0, -1)).includes(next);
      if (collision) {
        finish(api, score, false, "Snake collided");
        return;
      }
      const b = [next, ...body];
      if (!eat) b.pop();
      else {
        const s = score + 10;
        setScore(s);
        const empty = Array.from({ length: 400 }, (_, i) => i).filter(
          (i) => !b.includes(i),
        );
        if (!empty.length) {
          finish(api, s, true, "Arena filled");
          return;
        }
        setFood(empty[random(empty.length)]);
      }
      setBody(b);
    },
    Math.max(65, 170 - score / 4),
    paused,
  );
  return (
    <GameFrame
      title="Snake Arena"
      paused={paused}
      status={`Score ${score} · Length ${body.length}`}
    >
      <div className="snake-game">
        <div className="snake-heading">
          <div><span className="snake-eyebrow">Neon survival arena</span><h2>Grow. Turn. Survive.</h2></div>
          <div className="snake-score"><strong>{score}</strong><span>score</span></div>
        </div>
        <div className="snake-stats"><span><i className="snake-stat-dot mint" />Length <b>{body.length}</b></span><span><i className="snake-stat-dot coral" />Food <b>+10</b></span><span><i className="snake-stat-dot cyan" />Best run <b>400</b></span></div>
        <div className="snake-arena-wrap">
          <div className="snake-arena-label"><span>LIVE ARENA</span><small>WASD / arrows</small></div>
          <div className="snake-grid" role="grid" aria-label="Snake arena">
            {Array.from({ length: 400 }, (_, i) => (
              <div
                key={i}
                role="gridcell"
                className={
                  body[0] === i
                    ? "snake-head"
                    : body.includes(i)
                      ? "snake-body"
                      : food === i
                        ? "snake-food"
                        : ""
                }
              />
            ))}
          </div>
          <div className="snake-arena-footer"><span>Collect the glowing fruit</span><span>Don’t hit the walls or yourself</span></div>
        </div>
      </div>
      <DirectionPad move={move} />
    </GameFrame>
  );
}

export function AimTrainer({ api, paused }: Props) {
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [time, setTime] = useState(30);
  useTick(
    () => {
      if (time <= 1)
        finish(
          api,
          hits * 100,
          true,
          `${hits} hits · ${Math.round((hits / Math.max(1, hits + misses)) * 100)}% accuracy`,
        );
      else setTime(time - 1);
    },
    1000,
    paused,
  );
  return (
    <GameFrame
      title="Aim Trainer"
      paused={paused}
      status={`${time}s · Hits ${hits} · Misses ${misses}`}
    >
      <div className="aim-game">
        <div className="aim-heading"><div><span className="aim-eyebrow">Precision range</span><h2>Lock on. Tap fast.</h2></div><div className="aim-score"><strong>{hits}</strong><span>hits</span></div></div>
        <div className="aim-stats"><span><i className="aim-dot cyan" />Time <b>{time}s</b></span><span><i className="aim-dot mint" />Accuracy <b>{Math.round((hits / Math.max(1, hits + misses)) * 100)}%</b></span><span><i className="aim-dot coral" />Misses <b>{misses}</b></span></div>
        <div
        className="aim-arena"
        onPointerDown={() => {
          if (!paused) setMisses(misses + 1);
        }}
        >
          <div className="aim-reticle-lines" aria-hidden="true" />
          <button
          disabled={paused}
          aria-label="Hit target"
          className="aim-target"
          style={{ left: `${target.x}%`, top: `${target.y}%` }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setHits(hits + 1);
            setTarget({ x: 10 + random(80), y: 12 + random(76) });
          }}
          >
            <span className="sr-only">◎</span>
            <span className="aim-target-ring ring-one" /><span className="aim-target-ring ring-two" /><span className="aim-target-core" />
          </button>
        </div>
        <p className="aim-tip">Hit the target before it relocates · misses reduce your accuracy</p>
      </div>
    </GameFrame>
  );
}

function raceCar(c: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1) {
  const w = 34 * scale, h = 58 * scale;
  c.fillStyle = "rgba(20,28,24,.35)"; c.beginPath(); c.ellipse(x + 5 * scale, y + h * .48, w * .7, h * .18, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#172129"; c.fillRect(x - w * .66, y - h * .22, 7 * scale, 17 * scale); c.fillRect(x + w * .46, y - h * .22, 7 * scale, 17 * scale);
  c.fillStyle = color; c.beginPath(); c.moveTo(x - w * .56, y + h * .5); c.lineTo(x - w * .7, y - h * .14); c.lineTo(x - w * .36, y - h * .5); c.lineTo(x + w * .36, y - h * .5); c.lineTo(x + w * .7, y - h * .14); c.lineTo(x + w * .56, y + h * .5); c.closePath(); c.fill();
  c.fillStyle = "#193345"; c.beginPath(); c.moveTo(x - w * .3, y - h * .31); c.lineTo(x - w * .22, y - h * .46); c.lineTo(x + w * .22, y - h * .46); c.lineTo(x + w * .3, y - h * .31); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.36)"; c.fillRect(x - w * .43, y - h * .08, w * .12, h * .43);
  c.fillStyle = "#fff2a6"; c.fillRect(x - w * .48, y + h * .32, 7 * scale, 4 * scale); c.fillRect(x + w * .28, y + h * .32, 7 * scale, 4 * scale);
}

export function Highway({
  api,
  paused,
  racing = false,
}: Props & { racing?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef({
    x: 320,
    lane: 1,
    time: 0,
    score: 0,
    objects: [] as { x: number; y: number; coin: boolean }[],
    spawn: 0,
    over: false,
  });
  const [status, setStatus] = useState("");
  const steer = (x: number) => {
    if (paused) return;
    if (racing) game.current.x = clamp(game.current.x + x * 26, 110, 530);
    else {
      game.current.lane = clamp(game.current.lane + x, 0, 2);
      game.current.x = 160 + game.current.lane * 160;
    }
  };
  useKeys((x) => steer(x));
  useTick(
    () => {
      const g = game.current,
        c = canvas.current?.getContext("2d");
      if (!c || g.over) return;
      g.time += 1 / 30;
      g.spawn--;
      if (g.spawn <= 0) {
        g.objects.push({
          x: racing ? [185, 275, 365, 455][random(4)] : 160 + random(3) * 160,
          y: -30,
          coin: Math.random() < 0.3,
        });
        g.spawn = Math.max(15, 40 - Math.floor(g.time / 5));
      }
      bg(c);
      if (racing) {
        c.fillStyle = "#b9b568"; c.fillRect(0, 0, W, H);
        c.fillStyle = "#6d9c46"; c.fillRect(0, 0, 85, H); c.fillRect(555, 0, 85, H);
        for (let i = 0; i < 18; i++) {
          const y = (i * 67 + (g.time * 75) % 500) % 500 - 30;
          const x = i % 2 ? 38 : 600;
          c.fillStyle = "rgba(44,66,32,.28)"; c.beginPath(); c.ellipse(x + 7, y + 18, 28, 10, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = "#5b3b22"; c.fillRect(x - 3, y - 2, 6, 25);
          c.strokeStyle = i % 3 ? "#3c7d35" : "#438b39"; c.lineWidth = 8;
          for (let a = -2; a <= 2; a++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + a * 11, y - 14 + Math.abs(a) * 4); c.stroke(); }
        }
        c.fillStyle = "#393e3d"; c.beginPath(); c.moveTo(170, 0); c.lineTo(470, 0); c.lineTo(565, H); c.lineTo(75, H); c.closePath(); c.fill();
        c.fillStyle = "rgba(255,255,255,.045)"; c.beginPath(); c.moveTo(320, 0); c.lineTo(470, 0); c.lineTo(565, H); c.lineTo(320, H); c.closePath(); c.fill();
        c.strokeStyle = "#c8c3aa"; c.lineWidth = 8; c.beginPath(); c.moveTo(170, 0); c.lineTo(75, H); c.stroke(); c.beginPath(); c.moveTo(470, 0); c.lineTo(565, H); c.stroke();
        c.strokeStyle = "#4b4f4c"; c.lineWidth = 3; c.beginPath(); c.moveTo(156, 0); c.lineTo(59, H); c.stroke(); c.beginPath(); c.moveTo(484, 0); c.lineTo(581, H); c.stroke();
        c.strokeStyle = "rgba(255,255,235,.75)"; c.lineWidth = 3; c.setLineDash([20, 24]); c.lineDashOffset = -g.time * 100;
        for (const x of [230, 320, 410]) { c.beginPath(); c.moveTo(320 + (x - 320) * .32, 0); c.lineTo(x, H); c.stroke(); }
        c.setLineDash([]);
      } else {
        const roadGradient = c.createLinearGradient?.(0, 0, 0, H);
        if (roadGradient) { roadGradient.addColorStop(0, "#112b3d"); roadGradient.addColorStop(1, "#06121d"); c.fillStyle = roadGradient; }
        else c.fillStyle = "#081522";
        c.fillRect(90, 0, 460, H); c.fillStyle = "rgba(67, 199, 232, .05)"; c.fillRect(90, 0, 460, H);
        c.strokeStyle = "rgba(67, 199, 232, .7)"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(90, 0); c.lineTo(90, H); c.stroke(); c.beginPath(); c.moveTo(550, 0); c.lineTo(550, H); c.stroke();
        for (const x of [110, 530]) for (let y = (g.time * 42) % 52 - 52; y < H; y += 52) { c.fillStyle = "rgba(97, 214, 176, .55)"; c.fillRect(x - 3, y, 6, 18); }
        c.setLineDash([24, 24]); c.lineDashOffset = -g.time * 100;
        for (const x of [240, 400]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        c.setLineDash([]);
      }
      for (const o of g.objects) {
        o.y += 4 + g.time * 0.06;
        if (o.coin) {
          c.shadowBlur = 18;
          c.shadowColor = "#f4c44f";
          circle(c, o.x, o.y, 11, "#f4c44f");
          c.shadowBlur = 0;
          circle(c, o.x - 3, o.y - 3, 3, "rgba(255,255,255,.7)");
        }
        else if (racing) {
          const scale = .58 + clamp(o.y / H, 0, 1) * .52;
          raceCar(c, o.x, o.y, ["#e94c51", "#f0a43a", "#68727a"][Math.abs(Math.floor(o.x / 10)) % 3], scale);
        } else {
          const obstacle = racing ? "#f16f78" : "#a66acb";
          c.shadowBlur = 12;
          c.shadowColor = obstacle;
          c.fillStyle = obstacle;
          c.fillRect(o.x - 24, o.y - 22, 48, 44);
          c.shadowBlur = 0;
          c.fillStyle = "rgba(255,255,255,.28)";
          c.fillRect(o.x - 19, o.y - 17, 38, 5);
          c.strokeStyle = "rgba(7, 18, 27, .5)";
          c.lineWidth = 4;
          c.beginPath(); c.moveTo(o.x - 18, o.y + 16); c.lineTo(o.x - 5, o.y - 14); c.stroke();
          c.beginPath(); c.moveTo(o.x + 5, o.y + 16); c.lineTo(o.x + 18, o.y - 14); c.stroke();
        }
        if (
          Math.abs(o.x - g.x) < (o.coin ? 29 : 44) &&
          Math.abs(o.y - 370) < 35
        ) {
          if (o.coin) {
            g.score += 100;
            o.y = 600;
          } else {
            g.over = true;
            finish(
              api,
              Math.floor(g.time * 10) + g.score,
              false,
              `${Math.floor(g.time)} seconds survived`,
            );
          }
        }
      }
      g.objects = g.objects.filter((o) => o.y < H + 40);
      if (racing) raceCar(c, g.x, 370, "#18aeda", 1.12);
      else {
        c.shadowBlur = 16; c.shadowColor = "#61d6b0"; c.fillStyle = "#61d6b0"; c.fillRect(g.x - 13, 350, 26, 38); c.shadowBlur = 0;
        circle(c, g.x, 340, 11, "#f4c44f"); circle(c, g.x - 3, 337, 3, "rgba(255,255,255,.7)");
        c.strokeStyle = "#61d6b0"; c.lineWidth = 6; const stride = Math.sin(g.time * 12) * 7;
        c.beginPath(); c.moveTo(g.x - 7, 388); c.lineTo(g.x - 12 + stride, 402); c.stroke(); c.beginPath(); c.moveTo(g.x + 7, 388); c.lineTo(g.x + 12 - stride, 402); c.stroke();
      }
      setStatus(
        `${Math.floor(g.time)}s · Score ${Math.floor(g.time * 10) + g.score}`,
      );
      if (racing && g.time >= 60 && !g.over) {
        g.over = true;
        finish(api, Math.floor(g.time * 10) + g.score, true, "Race finished");
      }
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame
      title={racing ? "Racing Rush" : "Endless Runner"}
      paused={paused}
      status={status || "Dodge traffic. Collect gold."}
    >
      <div className={`runner-game${racing ? " racing-game" : ""}`}>
        <div className="runner-heading"><div><span className="runner-eyebrow">{racing ? "Coastal highway" : "Neon lane challenge"}</span><h2>{racing ? "Traffic Rush" : "Stay in the flow"}</h2></div><div className="runner-score"><strong>{Math.floor(game.current.time * 10) + game.current.score}</strong><span>score</span></div></div>
        <div className="runner-stats"><span><i className="runner-dot cyan" />Time <b>{Math.floor(game.current.time)}s</b></span><span><i className="runner-dot gold" />Pickups <b>+100</b></span><span><i className="runner-dot coral" />Goal <b>{racing ? "60s" : "Survive"}</b></span></div>
        <div className="runner-arena-wrap"><span className="runner-live">{racing ? "HIGHWAY 01 · LIVE" : "LIVE TRACK"}</span><canvas
          ref={canvas}
          width={W}
          height={H}
          className="arcade-canvas runner-canvas"
          aria-label="Highway arena"
          onPointerDown={(e) => steer(point(e).x < game.current.x ? -1 : 1)}
        /></div>
        <p className="runner-tip">{racing ? "Steer through traffic · avoid collisions · finish the 60 second run" : "Tap a side or use the arrows to change lanes · collect gold pickups"}</p>
      </div>
      <DirectionPad move={(x) => steer(x)} />
    </GameFrame>
  );
}

type Blob = Point & { mass: number; vx: number; vy: number };
export function BlobArena({ api, paused }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef({
    player: { x: 320, y: 220, mass: 20 },
    target: { x: 320, y: 220 },
    food: Array.from({ length: 60 }, () => ({
      x: 12 + random(616),
      y: 12 + random(416),
    })),
    bots: Array.from({ length: 7 }, (_, i) => ({
      x: i % 2 ? 40 : 600,
      y: 30 + i * 60,
      mass: 10 + i * 8,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 2 - 1,
    })),
    over: false,
  });
  const [mass, setMass] = useState(20);
  useKeys((x, y) => {
    g.current.target = {
      x: clamp(g.current.player.x + x * 80, 0, W),
      y: clamp(g.current.player.y + y * 80, 0, H),
    };
  });
  useTick(
    () => {
      const s = g.current,
        c = canvas.current?.getContext("2d");
      if (!c || s.over) return;
      const p = s.player;
      const dx = s.target.x - p.x,
        dy = s.target.y - p.y,
        d = Math.hypot(dx, dy);
      if (d > 2) {
        p.x += (dx / d) * 2.5;
        p.y += (dy / d) * 2.5;
      }
      const radius = Math.sqrt(p.mass) * 3;
      p.x = clamp(p.x, radius, W - radius);
      p.y = clamp(p.y, radius, H - radius);
      blobBg(c);
      s.food.forEach((f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < radius) {
          p.mass += 1;
          f.x = 12 + random(616);
          f.y = 12 + random(416);
        }
        c.shadowBlur = 10;
        c.shadowColor = "#d5aa50";
        circle(c, f.x, f.y, 3.5, "#f4c44f");
        c.shadowBlur = 0;
      });
      s.bots.forEach((b: Blob) => {
        b.x += b.vx * 1.4;
        b.y += b.vy * 1.4;
        if (b.x < 20 || b.x > W - 20) b.vx *= -1;
        if (b.y < 20 || b.y > H - 20) b.vy *= -1;
        const r = Math.sqrt(b.mass) * 3;
        if (Math.hypot(p.x - b.x, p.y - b.y) < Math.max(radius, r) * 0.85) {
          if (p.mass > b.mass * 1.1) {
            p.mass += Math.round(b.mass * 0.65);
            b.mass = 10 + random(30);
            b.x = 25;
            b.y = 25 + random(390);
          } else if (b.mass > p.mass * 1.1) {
            s.over = true;
            finish(api, p.mass * 10, false, "Absorbed by a larger rival");
          }
        }
        const rivalColor = b.mass > p.mass ? "#f16f78" : "#a66acb";
        c.shadowBlur = 16;
        c.shadowColor = rivalColor;
        circle(c, b.x, b.y, r, rivalColor);
        c.shadowBlur = 0;
        circle(c, b.x - r * .28, b.y - r * .25, Math.max(2, r * .14), "rgba(255,255,255,.65)");
      });
      c.strokeStyle = "rgba(97, 214, 176, .2)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(s.target.x, s.target.y, 12, 0, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 20;
      c.shadowColor = "#61d6b0";
      circle(c, p.x, p.y, radius, "#61d6b0");
      c.shadowBlur = 0;
      circle(c, p.x - radius * .28, p.y - radius * .3, Math.max(2, radius * .16), "rgba(255,255,255,.7)");
      c.fillStyle = "#07121b";
      c.font = "bold 14px sans-serif";
      c.textAlign = "center";
      c.fillText(String(p.mass), p.x, p.y + 5);
      setMass(p.mass);
      if (p.mass >= 150 && !s.over) {
        s.over = true;
        finish(api, p.mass * 10, true, "150 mass reached");
      }
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame
      title="Blob Arena"
      paused={paused}
      status={`Mass ${mass}/150 · Avoid bigger rivals`}
    >
      <div className="blob-game">
        <div className="blob-heading"><div><span className="blob-eyebrow">Neon growth arena</span><h2>Absorb. Adapt. Expand.</h2></div><div className="blob-score"><strong>{mass}</strong><span>mass</span></div></div>
        <div className="blob-stats"><span><i className="blob-dot mint" />Target <b>150 mass</b></span><span><i className="blob-dot coral" />Threats <b>7 rivals</b></span><span><i className="blob-dot gold" />Food <b>+1 each</b></span></div>
        <div className="blob-arena-wrap"><span className="blob-live">LIVE ARENA</span><canvas
        ref={canvas}
        className="arcade-canvas blob-canvas"
        width={W}
        height={H}
        style={{ touchAction: "none" }}
        aria-label="Blob arena: steer with pointer or arrows"
        onPointerMove={(e) => {
          if (!paused) g.current.target = point(e);
        }}
        onPointerDown={(e) => {
          g.current.target = point(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
      /></div>
        <p className="blob-tip">Move your pointer to steer · absorb smaller blobs · avoid anything larger</p>
      </div>
      <DirectionPad
        move={(x, y) =>
          (g.current.target = {
            x: clamp(g.current.player.x + x * 80, 0, W),
            y: clamp(g.current.player.y + y * 80, 0, H),
          })
        }
      />
    </GameFrame>
  );
}

type Disc = Point & {
  vx: number;
  vy: number;
  r: number;
  queen?: boolean;
  gone?: boolean;
};
export function Carrom({ api, paused }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [difficulty, setDifficulty] = useState<"practice" | "standard" | "expert">("standard");
  const g = useRef({
    discs: [
      { x: 240, y: 390, vx: 0, vy: 0, r: 13 },
      ...Array.from({ length: 9 }, (_, i) => ({
        x: 240 + Math.cos((i / 9) * Math.PI * 2) * 35,
        y: 240 + Math.sin((i / 9) * Math.PI * 2) * 35,
        vx: 0,
        vy: 0,
        r: 10,
      })),
      { x: 240, y: 240, vx: 0, vy: 0, r: 10, queen: true },
    ] as Disc[],
    aim: null as Point | null,
    shots: 0,
    fouls: 0,
    over: false,
  });
  const [status, setStatus] = useState(
    "Drag backward from the striker to aim; release to shoot.",
  );
  const moving = () =>
    g.current.discs.some((d) => !d.gone && Math.hypot(d.vx, d.vy) > 0.08);
  useTick(
    () => {
      const s = g.current,
        c = canvas.current?.getContext("2d");
      if (!c || s.over) return;
      for (let sub = 0; sub < 2; sub++) {
        for (const d of s.discs) {
          if (d.gone) continue;
          d.x += d.vx * 0.5;
          d.y += d.vy * 0.5;
          d.vx *= 0.988;
          d.vy *= 0.988;
          if (Math.hypot(d.vx, d.vy) < 0.08) {
            d.vx = 0;
            d.vy = 0;
          }
          for (const x of [28, 452])
            for (const y of [28, 452])
              if (Math.hypot(d.x - x, d.y - y) < (difficulty === "practice" ? 27 : difficulty === "expert" ? 17 : 20)) {
                d.gone = true;
                d.vx = d.vy = 0;
              }
          if (d.gone) continue;
          if (d.x < 28 + d.r) {
            d.x = 28 + d.r;
            d.vx = Math.abs(d.vx) * 0.85;
          }
          if (d.x > 452 - d.r) {
            d.x = 452 - d.r;
            d.vx = -Math.abs(d.vx) * 0.85;
          }
          if (d.y < 28 + d.r) {
            d.y = 28 + d.r;
            d.vy = Math.abs(d.vy) * 0.85;
          }
          if (d.y > 452 - d.r) {
            d.y = 452 - d.r;
            d.vy = -Math.abs(d.vy) * 0.85;
          }
        }
        for (let i = 0; i < s.discs.length; i++)
          for (let j = i + 1; j < s.discs.length; j++) {
            const a = s.discs[i],
              b = s.discs[j];
            if (a.gone || b.gone) continue;
            const dx = b.x - a.x,
              dy = b.y - a.y,
              dist = Math.hypot(dx, dy) || 0.001;
            if (dist < a.r + b.r) {
              const nx = dx / dist,
                ny = dy / dist,
                over = (a.r + b.r - dist) / 2;
              a.x -= nx * over;
              a.y -= ny * over;
              b.x += nx * over;
              b.y += ny * over;
              const impulse = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (impulse > 0) {
                a.vx -= impulse * nx;
                a.vy -= impulse * ny;
                b.vx += impulse * nx;
                b.vy += impulse * ny;
              }
            }
          }
      }
      if (!moving()) {
        const striker = s.discs[0];
        if (striker.gone) {
          s.fouls++;
          striker.gone = false;
        }
        striker.x = 240;
        striker.y = 390;
        const count = s.discs.slice(1).filter((d) => d.gone).length;
        setStatus(`${count}/10 pocketed · ${s.shots} shots · ${s.fouls} fouls`);
        if (count === 10) {
          s.over = true;
          finish(
            api,
            Math.max(100, 1500 - s.shots * 10 - s.fouls * 50),
            true,
            "Board cleared",
          );
        }
      }
      // Layered wood board inspired by a classic tournament carrom set.
      const wood = c.createLinearGradient?.(0, 0, 480, 480);
      if (wood) { wood.addColorStop(0, "#4a2b22"); wood.addColorStop(0.5, "#8b5540"); wood.addColorStop(1, "#35201c"); }
      c.fillStyle = wood ?? "#6b4036";
      c.fillRect(0, 0, 480, 480);
      c.save();
      c.globalAlpha = 0.12;
      c.strokeStyle = "#f6c9a7";
      c.lineWidth = 1;
      for (let i = -480; i < 900; i += 9) {
        c.beginPath();
        c.moveTo(i, 0);
        c.bezierCurveTo(i + 80, 110, i - 60, 260, i + 20, 480);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "#c8876f";
      c.fillRect(18, 18, 444, 444);
      const court = c.createRadialGradient?.(240, 180, 40, 240, 240, 330);
      if (court) { court.addColorStop(0, "#f5c5ad"); court.addColorStop(1, "#c98771"); }
      c.fillStyle = court ?? "#dfaa91";
      c.fillRect(28, 28, 424, 424);
      c.strokeStyle = "#6d4038";
      c.lineWidth = 4;
      c.strokeRect(78, 78, 324, 324);
      c.lineWidth = 3;
      c.strokeRect(100, 100, 280, 280);
      c.strokeStyle = "#8e5948";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(115, 95); c.lineTo(365, 95);
      c.moveTo(115, 385); c.lineTo(365, 385);
      c.moveTo(95, 115); c.lineTo(95, 365);
      c.moveTo(385, 115); c.lineTo(385, 365);
      c.stroke();
      for (const x of [28, 452]) for (const y of [28, 452]) {
        const pocket = c.createRadialGradient?.(x - 5, y - 6, 2, x, y, 25);
        if (pocket) { pocket.addColorStop(0, "#2f2528"); pocket.addColorStop(0.72, "#0d1016"); pocket.addColorStop(1, "#6b4036"); }
        circle(c, x, y, 24, pocket ?? "#171318");
        c.strokeStyle = "#392326"; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.stroke();
      }
      c.strokeStyle = "#674038";
      c.lineWidth = 3;
      c.beginPath(); c.arc(240, 240, 55, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(240, 240, 43, 0, Math.PI * 2); c.stroke();
      for (const [x, y] of [[120, 95], [360, 95], [120, 385], [360, 385], [95, 120], [385, 120], [95, 360], [385, 360]]) {
        circle(c, x, y, 13, "#db7466");
        c.strokeStyle = "#70463c"; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, 13, 0, Math.PI * 2); c.stroke();
      }
      s.discs.forEach((d, i) => {
        if (!d.gone) {
          const fill = i === 0 ? "#e7e2d9" : d.queen ? "#e3222c" : i % 2 ? "#26282b" : "#f8f4ec";
          const glow = c.createRadialGradient?.(d.x - d.r * .35, d.y - d.r * .4, 1, d.x, d.y, d.r * 1.25);
          if (glow) { glow.addColorStop(0, i === 0 ? "#ffffff" : d.queen ? "#ff6a63" : i % 2 ? "#777" : "#fff" ); glow.addColorStop(0.38, fill); glow.addColorStop(1, i === 0 ? "#98928a" : d.queen ? "#9d1019" : i % 2 ? "#08090a" : "#b8b0a6"); }
          c.save(); c.shadowColor = "rgba(50,20,15,.55)"; c.shadowBlur = 5; c.shadowOffsetY = 3;
          circle(c, d.x, d.y, d.r, glow ?? fill); c.restore();
          c.strokeStyle = i === 0 ? "#6b6661" : d.queen ? "#7f1118" : "#4b4642";
          c.lineWidth = 1.5; c.beginPath(); c.arc(d.x, d.y, d.r - 1, 0, Math.PI * 2); c.stroke();
        }
      });
      if (s.aim) {
        c.beginPath();
        c.moveTo(s.discs[0].x, s.discs[0].y);
        c.lineTo(s.aim.x, s.aim.y);
        c.strokeStyle = "rgba(102,43,35,.85)"; c.lineWidth = 2; c.setLineDash([7, 7]); c.stroke(); c.setLineDash([]);
      }
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame title="Carrom" paused={paused} status={status}>
      <div className="carrom-intro"><span className="carrom-eyebrow">Classic board · precision play</span><h2>Carrom Royale</h2><p className="meta">
        Solo pocket-all variant · Queen counts as a coin; no cover rule.
      </p></div>
      <label className="game-select">Difficulty <select value={difficulty} disabled={g.current.shots > 0} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="practice">Practice · larger pockets</option><option value="standard">Standard</option><option value="expert">Expert · smaller pockets</option></select></label>
      <canvas
        ref={canvas}
        width="480"
        height="480"
        className="arcade-canvas square-canvas carrom-canvas"
        style={{ touchAction: "none" }}
        aria-label="Carrom board: drag the blue striker to shoot"
        onPointerDown={(e) => {
          const p = point(e);
          if (!paused && !moving() && Math.hypot(p.x - 240, p.y - 390) < 40) {
            g.current.aim = p;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (g.current.aim) g.current.aim = point(e);
        }}
        onPointerCancel={() => (g.current.aim = null)}
        onPointerUp={(e) => {
          const s = g.current;
          if (!s.aim || paused) {
            s.aim = null;
            return;
          }
          const p = point(e),
            dx = 240 - p.x,
            dy = 390 - p.y,
            d = Math.hypot(dx, dy);
          if (d > 5) {
            const maxPower = difficulty === "practice" ? 18 : difficulty === "expert" ? 24 : 22;
            s.discs[0].vx = (dx / d) * Math.min(maxPower, d * 0.14);
            s.discs[0].vy = (dy / d) * Math.min(maxPower, d * 0.14);
            s.shots++;
          }
          s.aim = null;
        }}
      />
      <button
        className="btn btn-secondary"
        onClick={() =>
          finish(
            api,
            g.current.discs.slice(1).filter((d) => d.gone).length * 100,
            false,
            "Practice ended",
          )
        }
      >
        End practice
      </button>
    </GameFrame>
  );
}

const path: Point[] = [
  { x: 0, y: 110 },
  { x: 200, y: 110 },
  { x: 200, y: 320 },
  { x: 430, y: 320 },
  { x: 430, y: 100 },
  { x: 640, y: 100 },
];
const pads = [
  { x: 110, y: 175 },
  { x: 265, y: 180 },
  { x: 125, y: 285 },
  { x: 300, y: 250 },
  { x: 365, y: 160 },
  { x: 500, y: 240 },
  { x: 550, y: 165 },
  { x: 350, y: 380 },
];
function along(distance: number) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      len = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= len)
      return {
        x: a.x + ((b.x - a.x) * distance) / len,
        y: a.y + ((b.y - a.y) * distance) / len,
      };
    distance -= len;
  }
  return path.at(-1)!;
}
export function TowerDefense({ api, paused }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef({
    gold: 150,
    health: 10,
    wave: 0,
    remaining: 0,
    tick: 0,
    active: false,
    towers: [] as { pad: number; cool: number }[],
    enemies: [] as { distance: number; hp: number }[],
    beams: [] as { from: Point; to: Point; ttl: number }[],
    over: false,
  });
  const [status, setStatus] = useState("Place towers, then start Wave 1.");
  const [active, setActive] = useState(false);
  useTick(
    () => {
      const s = g.current,
        c = canvas.current?.getContext("2d");
      if (!c || s.over) return;
      s.tick++;
      if (s.active) {
        if (s.remaining && s.tick % 25 === 0) {
          s.enemies.push({ distance: 0, hp: 30 + s.wave * 15 });
          s.remaining--;
        }
        s.enemies.forEach((e) => (e.distance += 1.8 + s.wave * 0.3));
        s.towers.forEach((t) => {
          t.cool--;
          if (t.cool <= 0) {
            const enemy = s.enemies
              .filter(
                (e) =>
                  e.hp > 0 &&
                  Math.hypot(
                    along(e.distance).x - pads[t.pad].x,
                    along(e.distance).y - pads[t.pad].y,
                  ) < 150,
              )
              .sort((a, b) => b.distance - a.distance)[0];
            if (enemy) {
              enemy.hp -= 22;
              t.cool = 18;
              s.beams.push({
                from: pads[t.pad],
                to: along(enemy.distance),
                ttl: 5,
              });
            }
          }
        });
        s.enemies = s.enemies.filter((e) => {
          if (e.hp <= 0) {
            s.gold += 15;
            return false;
          }
          if (e.distance >= 1070) {
            s.health--;
            return false;
          }
          return true;
        });
        if (!s.remaining && !s.enemies.length) {
          s.active = false;
          setActive(false);
          s.gold += 40;
          if (s.wave === 5) {
            s.over = true;
            finish(api, s.health * 100 + s.gold, true, "Five waves defended");
          }
        }
        if (s.health <= 0) {
          s.over = true;
          finish(api, s.wave * 100, false, "Base lost");
        }
      }
      bg(c);
      c.fillStyle = "#72c94b";
      c.fillRect(0, 0, W, H);
      // Layered grass, flowers and edge foliage create a bright toy-diorama field.
      for (let i = 0; i < 72; i++) {
        const x = (i * 83 + 29) % W, y = (i * 47 + 17) % H;
        c.fillStyle = i % 5 === 0 ? "#f8ef9c" : i % 3 === 0 ? "#a8e86f" : "#58b83f";
        c.beginPath(); c.arc(x, y, i % 5 === 0 ? 2 : 1.5, 0, Math.PI * 2); c.fill();
      }
      for (let i = 0; i < 18; i++) {
        const x = i < 9 ? 12 + (i % 3) * 22 : W - 56 + (i % 3) * 22;
        const y = 25 + (i % 9) * 51;
        c.fillStyle = "rgba(41,92,40,.35)"; c.beginPath(); c.ellipse(x + 5, y + 12, 20, 9, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = i % 2 ? "#237a3f" : "#2e9147"; c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#51ad55"; c.beginPath(); c.arc(x - 6, y - 7, 11, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = "rgba(57,78,58,.30)";
      c.lineWidth = 52;
      c.lineCap = "round";
      c.beginPath();
      path.forEach((p, i) => (i ? c.lineTo(p.x + 5, p.y + 8) : c.moveTo(p.x + 5, p.y + 8)));
      c.stroke();
      c.strokeStyle = "#a7a89c";
      c.lineWidth = 44;
      c.beginPath();
      path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      c.strokeStyle = "#d2d1bd";
      c.lineWidth = 34;
      c.stroke();
      for (let d = 12, stone = 0; d < 1070; d += 29, stone++) {
        const p = along(d);
        c.fillStyle = stone % 3 === 0 ? "rgba(255,255,255,.18)" : "rgba(80,87,75,.13)";
        c.beginPath(); c.ellipse(p.x, p.y, 12, 3, -.15, 0, Math.PI * 2); c.fill();
      }
      pads.forEach((p, i) => {
        const built = s.towers.some((t) => t.pad === i);
        c.fillStyle = "rgba(41,83,37,.32)"; c.beginPath(); c.ellipse(p.x + 6, p.y + 12, 30, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = built ? "#65727a" : "rgba(82,145,67,.7)";
        c.beginPath(); c.ellipse(p.x, p.y, 27, 17, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = built ? "#d6e0e5" : "rgba(232,255,210,.75)"; c.lineWidth = 2; c.stroke();
        if (built) {
          c.fillStyle = "#3f4c59"; c.fillRect(p.x - 11, p.y - 27, 22, 25);
          c.fillStyle = "#596a78"; c.beginPath(); c.ellipse(p.x, p.y - 27, 15, 9, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = "#263442"; c.lineWidth = 7; c.beginPath(); c.moveTo(p.x + 7, p.y - 29); c.lineTo(p.x + 25, p.y - 38); c.stroke();
          c.strokeStyle = "#8fa6b5"; c.lineWidth = 3; c.stroke();
          c.fillStyle = "#f4c44f"; c.beginPath(); c.arc(p.x - 5, p.y - 31, 3, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = "#f1f5f9";
        c.font = "14px sans-serif";
        c.textAlign = "center";
        if (!built) c.fillText("+", p.x, p.y + 5);
      });
      s.enemies.forEach((e) => {
        const p = along(e.distance);
        c.fillStyle = "rgba(48,82,36,.35)"; c.beginPath(); c.ellipse(p.x + 4, p.y + 12, 14, 6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = e.hp > 45 ? "#9b62d0" : "#ef5060"; c.beginPath(); c.arc(p.x, p.y - 2, 13, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(p.x - 5, p.y - 7, 4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#513b3b"; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y + 10); c.lineTo(p.x, p.y + 17); c.stroke();
      });
      s.beams = s.beams.filter((b) => --b.ttl > 0);
      s.beams.forEach((b) => {
        c.strokeStyle = "rgba(67,199,232,.25)"; c.lineWidth = 8;
        c.beginPath();
        c.moveTo(b.from.x, b.from.y);
        c.lineTo(b.to.x, b.to.y);
        c.stroke();
        c.strokeStyle = "#d4fbff"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(b.from.x, b.from.y); c.lineTo(b.to.x, b.to.y); c.stroke();
      });
      setStatus(`Gold ${s.gold} · Base ${s.health}/10 · Wave ${s.wave}/5`);
    },
    1000 / 30,
    paused,
  );
  const buy = (i: number) => {
    const s = g.current;
    if (paused || s.gold < 50 || s.towers.some((t) => t.pad === i)) return;
    s.gold -= 50;
    s.towers.push({ pad: i, cool: 0 });
  };
  return (
    <GameFrame title="Tower Defense" paused={paused} status={status}>
      <div className="tower-game">
      <div className="tower-heading"><div><span className="tower-eyebrow">Command deck</span><h2>Build your defense</h2></div><div className="tower-score"><strong>{g.current.gold}</strong><span>credits</span></div></div>
      <div className="tower-stats"><span>Base <b>{g.current.health}/10</b></span><span>Wave <b>{g.current.wave}/5</b></span><span>Threat <b>{g.current.enemies.length}</b></span></div>
      <div className="tower-battle-layout">
      <div className="tower-map-frame"><span className="tower-map-label">Meadow pass</span><canvas
        ref={canvas}
        width={W}
        height={H}
        className="arcade-canvas"
        aria-label="Tower defense map"
        onPointerDown={(e) => {
          const p = point(e),
            i = pads.findIndex((t) => Math.hypot(p.x - t.x, p.y - t.y) < 30);
          if (i >= 0) buy(i);
        }}
      /></div>
      <aside className="tower-shop"><div className="tower-shop-title"><span>Arsenal</span><b>50 each</b></div><div className="tower-shop-grid">
        {pads.map((_, i) => (
          <button
            key={i}
            className="tower-shop-item"
            disabled={
              g.current.gold < 50 || g.current.towers.some((t) => t.pad === i)
            }
            onClick={() => buy(i)}
          >
            <span className="tower-mini-cannon">●</span><b>Pad {i + 1}</b><small>{g.current.towers.some((t) => t.pad === i) ? "Built" : "50"}</small>
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary tower-wave-button"
        disabled={active}
        onClick={() => {
          const s = g.current;
          s.wave++;
          s.remaining = 6 + s.wave * 2;
          s.active = true;
          s.tick = 0;
          setActive(true);
        }}
      >
        Start wave {g.current.wave + 1}
      </button>
      </aside>
      </div>
      </div>
    </GameFrame>
  );
}

type Bubble = { r: number; c: number; color: number };
const BUBBLE_COLORS = ["#22d85a", "#27aef3", "#d51be8", "#ffc62f", "#f03245"];
function glossyBubble(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  c.shadowBlur = radius * .55; c.shadowColor = "rgba(5,20,80,.42)";
  circle(c, x + 1, y + 3, radius, "#101b68"); c.shadowBlur = 0;
  circle(c, x, y, radius, color);
  c.strokeStyle = "rgba(255,255,255,.3)"; c.lineWidth = Math.max(1, radius * .08); c.beginPath(); c.arc(x, y, radius - 2, 0, Math.PI * 2); c.stroke();
  c.fillStyle = "rgba(255,255,255,.82)"; c.beginPath(); c.ellipse(x - radius * .34, y - radius * .38, radius * .25, radius * .12, -.65, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,.2)"; c.beginPath(); c.arc(x - radius * .18, y - radius * .18, radius * .52, 0, Math.PI * 2); c.fill();
}
const bubblePos = (r: number, c: number) => ({
  x: 85 + c * 44 + (r % 2) * 22,
  y: 30 + r * 38,
});
function neighbors(a: Bubble, b: Bubble) {
  if (a.r === b.r) return Math.abs(a.c - b.c) === 1;
  if (Math.abs(a.r - b.r) !== 1) return false;
  return a.r % 2
    ? b.c === a.c || b.c === a.c + 1
    : b.c === a.c || b.c === a.c - 1;
}
export function BubbleShooter({ api, paused }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef({
    bubbles: Array.from({ length: 40 }, (_, i) => ({
      r: Math.floor(i / 10),
      c: i % 10,
      color: random(5),
    })),
    bullet: null as (Point & { vx: number; vy: number; color: number }) | null,
    color: random(5),
    next: random(5),
    misses: 0,
    score: 0,
    aim: { x: 320, y: 120 },
    over: false,
  });
  const [status, setStatus] = useState(
    "Aim above the launcher. Match 3 or more.",
  );
  const attach = () => {
    const s = g.current,
      b = s.bullet!;
    s.bullet = null;
    const empty: Bubble[] = [];
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++) {
        const q = { r, c, color: b.color };
        if (
          !s.bubbles.some((x) => x.r === r && x.c === c) &&
          (r === 0 || s.bubbles.some((x) => neighbors(q, x)))
        )
          empty.push(q);
      }
    empty.sort((a, z) => {
      const p = bubblePos(a.r, a.c),
        q = bubblePos(z.r, z.c);
      return (
        Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y)
      );
    });
    if (!empty.length) {
      s.over = true;
      finish(api, s.score, false, "Board full");
      return;
    }
    const q = empty[0];
    s.bubbles.push(q);
    const cluster = new Set<Bubble>([q]);
    let frontier = [q];
    while (frontier.length) {
      const p = frontier.pop()!;
      s.bubbles.forEach((x) => {
        if (x.color === q.color && !cluster.has(x) && neighbors(p, x)) {
          cluster.add(x);
          frontier.push(x);
        }
      });
    }
    if (cluster.size >= 3) {
      s.score += cluster.size * 20;
      s.bubbles = s.bubbles.filter((x) => !cluster.has(x));
      const connected = new Set(s.bubbles.filter((x) => x.r === 0));
      frontier = [...connected];
      while (frontier.length) {
        const p = frontier.pop()!;
        s.bubbles.forEach((x) => {
          if (!connected.has(x) && neighbors(p, x)) {
            connected.add(x);
            frontier.push(x);
          }
        });
      }
      s.score += (s.bubbles.length - connected.size) * 30;
      s.bubbles = [...connected];
      s.misses = 0;
    } else if (++s.misses >= 5) {
      s.misses = 0;
      s.bubbles = s.bubbles.map((x) => ({ ...x, r: x.r + 1 }));
      for (let c = 0; c < 10; c++)
        s.bubbles.push({ r: 0, c, color: random(5) });
    }
    s.color = s.next;
    const colors = [...new Set(s.bubbles.map((x) => x.color))];
    s.next = colors.length ? colors[random(colors.length)] : 0;
    if (!s.bubbles.length) {
      s.over = true;
      finish(api, s.score, true, "Bubbles cleared");
    } else if (s.bubbles.some((x) => x.r >= 9)) {
      s.over = true;
      finish(api, s.score, false, "Danger line reached");
    }
  };
  useTick(
    () => {
      const s = g.current,
        c = canvas.current?.getContext("2d");
      if (!c || s.over) return;
      if (s.bullet) {
        const b = s.bullet;
        for (let i = 0; i < 3 && s.bullet; i++) {
          b.x += b.vx / 3;
          b.y += b.vy / 3;
          if (b.x < 65 || b.x > 575) {
            b.vx *= -1;
            b.x = clamp(b.x, 65, 575);
          }
          if (
            b.y <= 30 ||
            s.bubbles.some((x) => {
              const p = bubblePos(x.r, x.c);
              return Math.hypot(p.x - b.x, p.y - b.y) < 42;
            })
          )
            attach();
        }
      }
      bg(c);
      const bubbleSky = c.createLinearGradient?.(0, 0, 0, H);
      if (bubbleSky) { bubbleSky.addColorStop(0, "#171b78"); bubbleSky.addColorStop(.6, "#123fe8"); bubbleSky.addColorStop(1, "#1dc8f3"); c.fillStyle = bubbleSky; }
      else c.fillStyle = "#174edb";
      c.fillRect(42, 0, 556, H);
      c.fillStyle = "rgba(255,255,255,.08)"; c.beginPath(); c.arc(320, 430, 210, Math.PI, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(255,102,125,.65)"; c.lineWidth = 2; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(55, 356); c.lineTo(585, 356); c.stroke(); c.setLineDash([]);
      if (!s.bullet) {
        const dx = s.aim.x - 320, dy = s.aim.y - 410, d = Math.max(1, Math.hypot(dx, dy));
        for (let n = 1; n <= 7; n++) {
          const dist = 32 + n * 22;
          circle(c, 320 + dx / d * dist, 410 + dy / d * dist, Math.max(2, 5 - n * .35), "rgba(255,255,255,.78)");
        }
      }
      s.bubbles.forEach((b) => {
        const p = bubblePos(b.r, b.c);
        glossyBubble(c, p.x, p.y, 20, BUBBLE_COLORS[b.color]);
      });
      if (s.bullet)
        glossyBubble(c, s.bullet.x, s.bullet.y, 20, BUBBLE_COLORS[s.bullet.color]);
      c.fillStyle = "rgba(4,20,75,.55)"; c.beginPath(); c.ellipse(320, 424, 48, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#deecff"; c.beginPath(); c.moveTo(304, 423); c.lineTo(320, 389); c.lineTo(336, 423); c.closePath(); c.fill();
      glossyBubble(c, 320, 397, 21, BUBBLE_COLORS[s.color]);
      c.fillStyle = "rgba(8,25,91,.65)"; c.beginPath(); c.arc(378, 408, 20, 0, Math.PI * 2); c.fill();
      glossyBubble(c, 378, 405, 12, BUBBLE_COLORS[s.next]);
      c.fillStyle = "#eef7ff"; c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.fillText("NEXT", 378, 433);
      setStatus(
        `Score ${s.score} · ${s.bubbles.length} bubbles · ${5 - s.misses} misses until new row`,
      );
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame title="Bubble Shooter" paused={paused} status={status}>
      <div className="bubble-game">
      <div className="bubble-heading"><div><span className="bubble-eyebrow">Color pop arcade</span><h2>Bubble Burst</h2></div><div className="bubble-score"><strong>{g.current.score}</strong><span>score</span></div></div>
      <div className="bubble-stats"><span>Remaining <b>{g.current.bubbles.length}</b></span><span>Safety shots <b>{5 - g.current.misses}</b></span><span>Match <b>3+</b></span></div>
      <div className="bubble-board-wrap"><span className="bubble-board-label">Aim · Bank · Match</span>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="arcade-canvas"
        aria-label="Bubble board: tap a destination above the launcher"
        onPointerMove={(e) => { g.current.aim = point(e); }}
        onPointerDown={(e) => {
          const s = g.current,
            p = point(e);
          if (paused || s.bullet || p.y >= 380) return;
          const dx = p.x - 320,
            dy = p.y - 410,
            d = Math.hypot(dx, dy);
          s.bullet = {
            x: 320,
            y: 410,
            vx: (dx / d) * 15,
            vy: (dy / d) * 15,
            color: s.color,
          };
        }}
      />
      </div>
      <p className="bubble-tip">Tap anywhere above the launcher to shoot · bounce shots off the walls</p>
      </div>
    </GameFrame>
  );
}
