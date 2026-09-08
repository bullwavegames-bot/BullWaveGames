import { useEffect, useState } from "react";
import { finish, GameFrame, random, useTick, type Props } from "./common";
function readSave<T>(
  key: string,
  fallback: T,
  validate: (v: unknown) => v is T,
): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    return validate(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}
type City = { cash: number; plots: number[] };
const cityValid = (v: unknown): v is City =>
  !!v &&
  typeof v === "object" &&
  "cash" in v &&
  typeof v.cash === "number" &&
  Number.isFinite(v.cash) &&
  v.cash >= 0 &&
  "plots" in v &&
  Array.isArray(v.plots) &&
  v.plots.length === 25 &&
  v.plots.every((x) => [0, 1, 2, 3].includes(x));
const buildings = [
  { name: "Empty", cost: 0, symbol: "+" },
  { name: "House", cost: 50, symbol: "⌂" },
  { name: "Shop", cost: 100, symbol: "▣" },
  { name: "Power", cost: 80, symbol: "ϟ" },
];
export function IdleCity({ api, paused }: Props) {
  const [city, setCity] = useState(() =>
    readSave(
      "bullwave-city-v1",
      { cash: 200, plots: Array(25).fill(0) },
      cityValid,
    ),
  );
  const [selected, setSelected] = useState(1);
  const [message, setMessage] = useState(
    "Build a city of 100 residents. Progress saves on this device.",
  );
  const houses = city.plots.filter((x) => x === 1).length,
    shops = city.plots.filter((x) => x === 2).length,
    power = 2 + city.plots.filter((x) => x === 3).length * 12,
    used = houses + shops * 2,
    income = 1 + houses + shops * 8;
  useEffect(() => {
    try {
      localStorage.setItem("bullwave-city-v1", JSON.stringify(city));
    } catch {
      setMessage("Storage unavailable: progress lasts only for this session.");
    }
  }, [city]);
  useTick(
    () => setCity((c) => ({ ...c, cash: c.cash + income })),
    1000,
    paused,
  );
  const build = (i: number) => {
    if (city.plots[i]) {
      setMessage("That plot is occupied.");
      return;
    }
    const cost = buildings[selected].cost,
      need = selected === 1 ? 1 : selected === 2 ? 2 : 0;
    if (city.cash < cost) {
      setMessage("Wait for income to cover this building.");
      return;
    }
    if (used + need > power) {
      setMessage("Build a power plant first.");
      return;
    }
    const next = {
      cash: city.cash - cost,
      plots: city.plots.map((x, j) => (j === i ? selected : x)),
    };
    setCity(next);
    setMessage(`${buildings[selected].name} built.`);
    if (next.plots.filter((x) => x === 1).length * 5 >= 100)
      finish(api, 1000 + next.cash, true, "100 residents reached");
  };
  return (
    <GameFrame
      title="Idle City Builder"
      paused={paused}
      status={`Coins ${city.cash} · Residents ${houses * 5}/100 · Power ${used}/${power} · Income ${income}/s`}
    >
      <p>{message}</p>
      <div className="number-pad">
        {buildings.slice(1).map((b, i) => (
          <button
            className="btn btn-secondary"
            key={b.name}
            aria-pressed={selected === i + 1}
            onClick={() => setSelected(i + 1)}
          >
            {b.symbol} {b.name} · {b.cost}
          </button>
        ))}
      </div>
      <div className="city-grid">
        {city.plots.map((v, i) => (
          <button
            key={i}
            className={`building-${v}`}
            aria-label={`Plot ${i + 1}: ${buildings[v].name}`}
            onClick={() => build(i)}
          >
            <span>{buildings[v].symbol}</span>
            <small>{buildings[v].name}</small>
          </button>
        ))}
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => {
          setCity({ cash: 200, plots: Array(25).fill(0) });
          setMessage("New city started.");
        }}
      >
        Start new city
      </button>
    </GameFrame>
  );
}
type Business = { cash: number; stock: number; level: number; day: number };
const businessValid = (v: unknown): v is Business =>
  !!v &&
  typeof v === "object" &&
  ["cash", "stock", "level", "day"].every(
    (k) =>
      k in v &&
      typeof (v as Record<string, unknown>)[k] === "number" &&
      Number.isSafeInteger((v as Record<string, number>)[k]) &&
      (v as Record<string, number>)[k] >= 0,
  );
export function Tycoon({ api, paused }: Props) {
  const [b, setB] = useState(() =>
    readSave(
      "bullwave-business-v1",
      { cash: 300, stock: 20, level: 0, day: 1 },
      businessValid,
    ),
  );
  const [price, setPrice] = useState(15);
  const [log, setLog] = useState(
    "Stock costs 5/unit. Higher prices lower demand. Target: 5,000 cash.",
  );
  useEffect(() => {
    try {
      localStorage.setItem("bullwave-business-v1", JSON.stringify(b));
    } catch {
      setLog("Storage unavailable. Progress is not saved.");
    }
  }, [b]);
  const day = () => {
    const demand = Math.max(
        0,
        Math.round((40 + b.level * 12) * (1 - price / 40)),
      ),
      sales = Math.min(b.stock, demand),
      rent = 10 + b.level * 5,
      cash = b.cash + sales * price - rent;
    const n = {
      ...b,
      cash: Math.max(0, cash),
      stock: b.stock - sales,
      day: b.day + 1,
    };
    setB(n);
    setLog(`Sold ${sales} units for ${sales * price}. Daily costs: ${rent}.`);
    if (cash >= 5000)
      finish(api, cash, true, `Business goal reached in ${b.day} days`);
    else if (cash < 5 && n.stock === 0)
      finish(api, 0, false, "Business ran out of cash and stock");
  };
  return (
    <GameFrame
      title="Business Tycoon"
      paused={paused}
      status={`Day ${b.day} · Cash ${b.cash} · Stock ${b.stock} · Level ${b.level}`}
    >
      <div className="business-card">
        <span className="business-symbol" aria-hidden="true">
          ▣
        </span>
        <h2>Your neighborhood business</h2>
        <progress value={b.cash} max="5000" />
        <p>{log}</p>
      </div>
      <label className="game-answer">
        Selling price: {price}
        <input
          type="range"
          min="6"
          max="35"
          value={price}
          onChange={(e) => setPrice(+e.target.value)}
        />
      </label>
      <div className="actions">
        <button
          className="btn btn-secondary"
          disabled={b.cash < 100}
          onClick={() =>
            setB({ ...b, cash: b.cash - 100, stock: b.stock + 20 })
          }
        >
          Buy 20 stock · 100
        </button>
        <button
          className="btn btn-secondary"
          disabled={b.cash < (b.level + 1) * 200}
          onClick={() =>
            setB({
              ...b,
              cash: b.cash - (b.level + 1) * 200,
              level: b.level + 1,
            })
          }
        >
          Upgrade · {(b.level + 1) * 200}
        </button>
        <button className="btn btn-primary" onClick={day}>
          Open for the day →
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setB({ cash: 300, stock: 20, level: 0, day: 1 });
            setLog("New business started.");
          }}
        >
          New business
        </button>
      </div>
    </GameFrame>
  );
}
type Territory = { owner: number; troops: number };
const adjacent = (a: number, b: number) =>
  Math.abs((a % 4) - (b % 4)) +
    Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) ===
  1;
export function TerritoryStrategy({ api, paused }: Props) {
  const [land, setLand] = useState<Territory[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ owner: i < 4 ? 0 : 1, troops: 3 })),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [reserve, setReserve] = useState(3);
  const [turn, setTurn] = useState(1);
  const [message, setMessage] = useState(
    "Select your territory to place reinforcements, then attack adjacent red territories.",
  );
  const [reinforce, setReinforce] = useState(true);
  const battle = (board: Territory[], from: number, to: number) => {
    const n = board.map((t) => ({ ...t }));
    const attack = random(6) + 1,
      defense = random(6) + 1;
    if (attack > defense) n[to].troops--;
    else n[from].troops--;
    if (n[to].troops <= 0) {
      n[to] = { owner: n[from].owner, troops: n[from].troops - 1 };
      n[from].troops = 1;
    }
    return {
      board: n,
      text: `Attack ${attack} vs defense ${defense}. ${attack > defense ? "Defender" : "Attacker"} lost a troop.`,
    };
  };
  const check = (n: Territory[]) => {
    if (n.every((t) => t.owner === 0))
      finish(api, 2000 - turn * 10, true, "All territories conquered");
    else if (n.every((t) => t.owner === 1))
      finish(api, 0, false, "Your territories were conquered");
  };
  const click = (i: number) => {
    if (paused) return;
    if (land[i].owner === 0) {
      if (reinforce && reserve) {
        const n = land.map((t, j) =>
          j === i ? { ...t, troops: t.troops + 1 } : t,
        );
        setLand(n);
        setReserve(reserve - 1);
        if (reserve === 1) setReinforce(false);
        return;
      }
      setSelected(i);
      return;
    }
    if (
      selected === null ||
      land[selected].troops < 2 ||
      !adjacent(selected, i)
    ) {
      setMessage(
        "Attack an adjacent enemy from a territory with at least two troops.",
      );
      return;
    }
    const result = battle(land, selected, i);
    setLand(result.board);
    setMessage(result.text);
    check(result.board);
  };
  const end = () => {
    let n = land.map((t) => ({ ...t }));
    const enemy = n
      .map((t, i) => (t.owner === 1 ? i : -1))
      .filter((i) => i >= 0);
    if (!enemy.length) return;
    const border = enemy.filter((i) =>
      n.some((t, j) => t.owner === 0 && adjacent(i, j)),
    );
    const home = (border.length ? border : enemy)[
      random((border.length ? border : enemy).length)
    ];
    n[home].troops += Math.max(3, Math.floor(enemy.length / 3));
    for (let k = 0; k < 8; k++) {
      const attacks = enemy.flatMap((i) =>
        n[i].owner === 1 && n[i].troops > 1
          ? n
              .map((t, j) => (t.owner === 0 && adjacent(i, j) ? [i, j] : null))
              .filter((x): x is number[] => !!x)
          : [],
      );
      if (!attacks.length) break;
      const [a, b] = attacks[random(attacks.length)];
      n = battle(n, a, b).board;
    }
    setLand(n);
    check(n);
    setTurn(turn + 1);
    setReserve(
      Math.max(3, Math.floor(n.filter((t) => t.owner === 0).length / 3)),
    );
    setReinforce(true);
    setSelected(null);
    setMessage("Your turn. Place reinforcements, then attack.");
  };
  return (
    <GameFrame
      title="Territory Strategy"
      paused={paused}
      status={`Turn ${turn} · Reinforcements ${reserve} · Your territories ${land.filter((t) => t.owner === 0).length}/12`}
    >
      <p>{message}</p>
      <div className="territory-grid">
        {land.map((t, i) => (
          <button
            key={i}
            className={t.owner === 0 ? "owned" : "enemy"}
            aria-pressed={selected === i}
            onClick={() => click(i)}
          >
            <small>Territory {i + 1}</small>
            <strong>{t.troops}</strong>
            <span>{t.owner === 0 ? "You" : "Computer"}</span>
          </button>
        ))}
      </div>
      <button
        className="btn btn-secondary"
        disabled={!reserve}
        aria-pressed={reinforce}
        onClick={() => setReinforce(!reinforce)}
      >
        {reinforce ? "Place reinforcements" : "Select / attack"}
      </button>
      <button className="btn btn-primary" onClick={end}>
        End turn
      </button>
    </GameFrame>
  );
}
