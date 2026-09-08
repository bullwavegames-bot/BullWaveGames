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
function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
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
      <div className="snake-grid">
        {Array.from({ length: 400 }, (_, i) => (
          <div
            key={i}
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
      <div
        className="aim-arena"
        onPointerDown={() => {
          if (!paused) setMisses(misses + 1);
        }}
      >
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
          ◎
        </button>
      </div>
    </GameFrame>
  );
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
          x: racing ? 120 + random(400) : 160 + random(3) * 160,
          y: -30,
          coin: Math.random() < 0.3,
        });
        g.spawn = Math.max(15, 40 - Math.floor(g.time / 5));
      }
      bg(c);
      c.fillStyle = "#132232";
      c.fillRect(90, 0, 460, H);
      c.strokeStyle = "#43c7e8";
      c.setLineDash([24, 24]);
      c.lineDashOffset = -g.time * 100;
      for (const x of [240, 400]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }
      c.setLineDash([]);
      for (const o of g.objects) {
        o.y += 4 + g.time * 0.06;
        if (o.coin) circle(c, o.x, o.y, 11, "#d5aa50");
        else {
          c.fillStyle = racing ? "#f16f78" : "#a66acb";
          c.fillRect(o.x - 24, o.y - 22, 48, 44);
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
      c.fillStyle = "#61d6b0";
      c.fillRect(g.x - 18, 346, 36, 48);
      if (!racing) circle(c, g.x, 340, 13, "#d5aa50");
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
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="arcade-canvas"
        aria-label="Highway arena"
        onPointerDown={(e) => steer(point(e).x < game.current.x ? -1 : 1)}
      />
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
      bg(c);
      s.food.forEach((f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < radius) {
          p.mass += 1;
          f.x = 12 + random(616);
          f.y = 12 + random(416);
        }
        circle(c, f.x, f.y, 3, "#d5aa50");
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
        circle(c, b.x, b.y, r, b.mass > p.mass ? "#f16f78" : "#a66acb");
      });
      circle(c, p.x, p.y, radius, "#61d6b0");
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
      <canvas
        ref={canvas}
        className="arcade-canvas"
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
      />
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
              if (Math.hypot(d.x - x, d.y - y) < 20) {
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
      c.fillStyle = "#a5793f";
      c.fillRect(0, 0, 480, 480);
      c.fillStyle = "#e1bd79";
      c.fillRect(20, 20, 440, 440);
      c.strokeStyle = "#724728";
      c.lineWidth = 3;
      c.strokeRect(70, 70, 340, 340);
      for (const x of [28, 452])
        for (const y of [28, 452]) circle(c, x, y, 22, "#0b121c");
      c.beginPath();
      c.arc(240, 240, 55, 0, Math.PI * 2);
      c.stroke();
      s.discs.forEach((d, i) => {
        if (!d.gone) {
          circle(
            c,
            d.x,
            d.y,
            d.r,
            i === 0
              ? "#43c7e8"
              : d.queen
                ? "#ba3449"
                : i % 2
                  ? "#263244"
                  : "#fff1c5",
          );
        }
      });
      if (s.aim) {
        c.beginPath();
        c.moveTo(s.discs[0].x, s.discs[0].y);
        c.lineTo(s.aim.x, s.aim.y);
        c.stroke();
      }
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame title="Carrom" paused={paused} status={status}>
      <p className="meta">
        Solo pocket-all variant · Queen counts as a coin; no cover rule.
      </p>
      <canvas
        ref={canvas}
        width="480"
        height="480"
        className="arcade-canvas square-canvas"
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
            s.discs[0].vx = (dx / d) * Math.min(22, d * 0.14);
            s.discs[0].vy = (dy / d) * Math.min(22, d * 0.14);
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
      c.strokeStyle = "#2b4555";
      c.lineWidth = 34;
      c.beginPath();
      path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      pads.forEach((p, i) => {
        circle(
          c,
          p.x,
          p.y,
          23,
          s.towers.some((t) => t.pad === i) ? "#61d6b0" : "#24384a",
        );
        c.fillStyle = "#f1f5f9";
        c.font = "14px sans-serif";
        c.textAlign = "center";
        c.fillText(s.towers.some((t) => t.pad === i) ? "ϟ" : "+", p.x, p.y + 5);
      });
      s.enemies.forEach((e) => {
        const p = along(e.distance);
        circle(c, p.x, p.y, 12, "#f16f78");
      });
      s.beams = s.beams.filter((b) => --b.ttl > 0);
      c.strokeStyle = "#43c7e8";
      c.lineWidth = 2;
      s.beams.forEach((b) => {
        c.beginPath();
        c.moveTo(b.from.x, b.from.y);
        c.lineTo(b.to.x, b.to.y);
        c.stroke();
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
      <canvas
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
      />
      <div className="number-pad">
        {pads.map((_, i) => (
          <button
            key={i}
            className="btn btn-secondary"
            disabled={
              g.current.gold < 50 || g.current.towers.some((t) => t.pad === i)
            }
            onClick={() => buy(i)}
          >
            Pad {i + 1} · 50
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary"
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
    </GameFrame>
  );
}

type Bubble = { r: number; c: number; color: number };
const BUBBLE_COLORS = ["#61d6b0", "#43c7e8", "#a66acb", "#d5aa50", "#f16f78"];
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
      c.strokeStyle = "#f16f78";
      c.beginPath();
      c.moveTo(60, 360);
      c.lineTo(580, 360);
      c.stroke();
      s.bubbles.forEach((b) => {
        const p = bubblePos(b.r, b.c);
        circle(c, p.x, p.y, 20, BUBBLE_COLORS[b.color]);
        c.fillStyle = "#07121b";
        c.font = "bold 14px sans-serif";
        c.textAlign = "center";
        c.fillText(String(b.color + 1), p.x, p.y + 5);
      });
      if (s.bullet)
        circle(c, s.bullet.x, s.bullet.y, 20, BUBBLE_COLORS[s.bullet.color]);
      circle(c, 320, 410, 20, BUBBLE_COLORS[s.color]);
      circle(c, 370, 413, 12, BUBBLE_COLORS[s.next]);
      setStatus(
        `Score ${s.score} · ${s.bubbles.length} bubbles · ${5 - s.misses} misses until new row`,
      );
    },
    1000 / 30,
    paused,
  );
  return (
    <GameFrame title="Bubble Shooter" paused={paused} status={status}>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="arcade-canvas"
        aria-label="Bubble board: tap a destination above the launcher"
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
    </GameFrame>
  );
}
