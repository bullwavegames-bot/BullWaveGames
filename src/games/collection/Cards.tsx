import { useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  finish,
  GameFrame,
  random,
  shuffle,
  useTick,
  type Props,
} from "./common";
import { red, validRummy, type Card } from "./rules";

const suits = ["♠", "♥", "♦", "♣"];
const rank = (n: number) =>
  ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][n];
function deck(): Card[] {
  return shuffle(
    Array.from({ length: 52 }, (_, id) => ({
      id,
      rank: (id % 13) + 1,
      suit: Math.floor(id / 13),
      up: true,
    })),
  );
}
function PlayingCard({
  card,
  selected,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`playing-card ${card.up ? (red(card) ? "red-card" : "black-card") : "card-back"}`}
      aria-label={
        card.up ? `${rank(card.rank)} ${suits[card.suit]}` : "Face down"
      }
      aria-pressed={selected}
      onClick={onClick}
    >
      {card.up ? (
        <>
          <span>{rank(card.rank)}</span>
          <span>{suits[card.suit]}</span>
        </>
      ) : (
        "✦"
      )}
    </button>
  );
}

type Deal = {
  columns: Card[][];
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  completed: number;
  moves: number;
};
function deal(spider: boolean): Deal {
  const d = spider
    ? shuffle(
        Array.from({ length: 104 }, (_, id) => ({
          id,
          rank: (id % 13) + 1,
          suit: 0,
          up: false,
        })),
      )
    : deck();
  const columns = Array.from({ length: spider ? 10 : 7 }, (_, i) => {
    const cards = d.splice(0, spider ? (i < 4 ? 6 : 5) : i + 1);
    return cards.map((c, j) => ({ ...c, up: j === cards.length - 1 }));
  });
  return {
    columns,
    stock: d,
    waste: [],
    foundations: [[], [], [], []],
    completed: 0,
    moves: 0,
  };
}
export function Solitaire({
  api,
  paused,
  spider = false,
}: Props & { spider?: boolean }) {
  const [state, setState] = useState(() => deal(spider));
  const [selected, setSelected] = useState<{
    column: number;
    index: number;
  } | null>(null);
  const [history, setHistory] = useState<Deal[]>([]);
  const [message, setMessage] = useState(
    spider
      ? "One-suit Spider · build descending king-to-ace runs."
      : "Draw one · alternating colors down, suited foundations up.",
  );
  const commit = (next: Deal) => {
    next.columns = next.columns.map((col) =>
      col.map((c, i) => ({ ...c, up: c.up || i === col.length - 1 })),
    );
    if (spider)
      next.columns = next.columns.map((col) => {
        if (
          col.length >= 13 &&
          col.slice(-13).every((c, i) => c.up && c.rank === 13 - i)
        ) {
          next.completed++;
          const result = col.slice(0, -13);
          if (result.length)
            result[result.length - 1] = { ...result.at(-1)!, up: true };
          return result;
        }
        return col;
      });
    next.moves = state.moves + 1;
    setHistory([...history.slice(-49), state]);
    setState(next);
    setSelected(null);
    if (
      spider
        ? next.completed === 8
        : next.foundations.reduce((n, c) => n + c.length, 0) === 52
    )
      finish(
        api,
        Math.max(100, 5000 - next.moves * 5),
        true,
        `${next.moves} moves`,
      );
  };
  const copy = (): Deal => ({
    ...state,
    columns: state.columns.map((c) => [...c]),
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: state.foundations.map((c) => [...c]),
  });
  const moving = () =>
    selected
      ? selected.column === -1
        ? state.waste.slice(-1)
        : state.columns[selected.column].slice(selected.index)
      : [];
  const moveTo = (column: number) => {
    if (paused || !selected) return;
    const run = moving();
    const dest = state.columns[column].at(-1);
    if (selected.column === column) return setSelected(null);
    if (
      !run.length ||
      !run.every(
        (c, i) =>
          c.up &&
          (!i ||
            (run[i - 1].rank === c.rank + 1 &&
              (spider || red(run[i - 1]) !== red(c)))),
      )
    ) {
      setMessage("Select a descending face-up sequence.");
      return;
    }
    if (
      dest
        ? dest.rank !== run[0].rank + 1 ||
          (!spider && red(dest) === red(run[0]))
        : !spider && run[0].rank !== 13
    ) {
      setMessage(
        spider
          ? "Move onto the next higher rank or an empty column."
          : "Use alternating colors; only kings enter empty columns.",
      );
      return;
    }
    const n = copy();
    if (selected.column === -1) n.waste.pop();
    else n.columns[selected.column].splice(selected.index);
    n.columns[column].push(...run);
    setMessage("Moved.");
    commit(n);
  };
  const foundation = (suit: number) => {
    if (paused || spider || !selected) return;
    const run = moving(),
      c = run[0];
    if (
      run.length !== 1 ||
      c.suit !== suit ||
      c.rank !== state.foundations[suit].length + 1
    ) {
      setMessage("Foundations build from ace to king in the same suit.");
      return;
    }
    const n = copy();
    if (selected.column === -1) n.waste.pop();
    else n.columns[selected.column].pop();
    n.foundations[suit].push(c);
    commit(n);
  };
  const draw = () => {
    if (paused) return;
    const n = copy();
    if (spider) {
      if (!n.stock.length) return;
      if (n.columns.some((c) => !c.length)) {
        setMessage("Fill every empty column before dealing a row.");
        return;
      }
      n.columns.forEach((c) => c.push({ ...n.stock.pop()!, up: true }));
    } else if (n.stock.length) n.waste.push({ ...n.stock.pop()!, up: true });
    else if (n.waste.length) {
      n.stock = n.waste.reverse();
      n.waste = [];
    } else return;
    commit(n);
  };
  return (
    <GameFrame
      title={spider ? "Spider Solitaire" : "Klondike"}
      paused={paused}
      status={`${message} · ${state.moves} moves`}
    >
      <div className="card-toolbar">
        <button className="playing-card card-back" onClick={draw}>
          {state.stock.length ? `✦ ${state.stock.length}` : "↻"}
        </button>
        {!spider &&
          (state.waste.length ? (
            <PlayingCard
              card={state.waste.at(-1)!}
              selected={selected?.column === -1}
              onClick={() => setSelected({ column: -1, index: 0 })}
            />
          ) : (
            <span className="card-slot">Waste</span>
          ))}
        {spider ? (
          <span>Completed {state.completed}/8</span>
        ) : (
          state.foundations.map((c, s) => (
            <button
              className={`card-slot ${s === 1 || s === 2 ? "red-card" : ""}`}
              key={s}
              onClick={() => foundation(s)}
            >
              {c.length ? rank(c.at(-1)!.rank) : "A"}
              {suits[s]}
              <small>{c.length}/13</small>
            </button>
          ))
        )}
        <button
          className="btn btn-secondary"
          disabled={!history.length}
          onClick={() => {
            setState(history.at(-1)!);
            setHistory(history.slice(0, -1));
            setSelected(null);
          }}
        >
          Undo
        </button>
        <button className="btn btn-secondary" onClick={() => { setState(deal(spider)); setHistory([]); setSelected(null); setMessage("New deal ready."); }}>
          New deal
        </button>
        <button
          className="btn btn-secondary"
          onClick={() =>
            finish(
              api,
              spider
                ? state.completed * 500
                : state.foundations.reduce((n, c) => n + c.length, 0) * 20,
              false,
              "Deal ended",
            )
          }
        >
          End deal
        </button>
      </div>
      <div className={`solitaire-table ${spider ? "spider-table" : ""}`}>
        {state.columns.map((col, i) => (
          <div className="card-column" key={i}>
            <button
              className="card-slot column-target"
              onClick={() => moveTo(i)}
              aria-label={`Move to column ${i + 1}`}
            >
              ↓ {i + 1}
            </button>
            {col.map((c, j) => (
              <div key={c.id} style={{ marginTop: j ? -60 : 8 }}>
                <PlayingCard
                  card={c}
                  selected={selected?.column === i && j >= selected.index}
                  onClick={() => {
                    if (!c.up) return;
                    if (selected && selected.column !== i) moveTo(i);
                    else
                      setSelected(
                        selected?.column === i && selected.index === j
                          ? null
                          : { column: i, index: j },
                      );
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </GameFrame>
  );
}

function rummyPotential(hand: Card[]) {
  return hand.reduce((score, card) => score + hand.filter((other) => other !== card && (other.rank === card.rank || (other.suit === card.suit && Math.abs(other.rank - card.rank) <= 2))).length, 0);
}

export function Rummy({ api, paused }: Props) {
  const [state, setState] = useState(() => {
    const d = deck();
    return {
      hand: d.splice(0, 10),
      bot: d.splice(0, 10),
      stock: d,
      discard: [d.pop()!],
      drawn: false,
      turns: 0,
    };
  });
  const [message, setMessage] = useState(
    "Draw a card, then click a card in your hand to discard it.",
  );
  const [difficulty, setDifficulty] = useState<"beginner" | "standard">("standard");
  const draw = (discard: boolean) => {
    if (paused || state.drawn) return;
    const n = {
      ...state,
      hand: [...state.hand],
      stock: [...state.stock],
      discard: [...state.discard],
    };
    if (!n.stock.length && n.discard.length > 1) {
      const top = n.discard.pop()!;
      n.stock = shuffle(n.discard);
      n.discard = [top];
    }
    const c = discard ? n.discard.pop() : n.stock.pop();
    if (!c) {
      setMessage("That pile is empty.");
      return;
    }
    n.hand.push(c);
    n.drawn = true;
    setState(n);
  };
  const discard = (index: number) => {
    if (paused || !state.drawn) {
      setMessage("Draw before discarding.");
      return;
    }
    const n = {
      ...state,
      hand: [...state.hand],
      bot: [...state.bot],
      stock: [...state.stock],
      discard: [...state.discard],
      drawn: false,
      turns: state.turns + 1,
    };
    n.discard.push(n.hand.splice(index, 1)[0]);
    if (validRummy(n.hand)) {
      setState(n);
      finish(api, 1000, true, "All ten cards melded");
      return;
    }
    if (!n.stock.length && n.discard.length > 1) {
      const top = n.discard.pop()!;
      n.stock = shuffle(n.discard);
      n.discard = [top];
    }
    const discardTop = n.discard.at(-1);
    const takeDiscard = difficulty === "standard" && discardTop && rummyPotential([...n.bot, discardTop]) > rummyPotential(n.bot);
    const top = takeDiscard ? n.discard.pop() : n.stock.pop();
    if (top) n.bot.push(top);
    let best = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < n.bot.length; i++) {
      const h = n.bot.filter((_, j) => j !== i);
      if (validRummy(h)) {
        setState(n);
        finish(api, 0, false, "Computer melded its hand");
        return;
      }
      const value = difficulty === "beginner" ? Math.random() : rummyPotential(h);
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    n.discard.push(n.bot.splice(best, 1)[0]);
    setState(n);
    setMessage("Computer discarded. Your turn to draw.");
  };
  return (
    <GameFrame
      title="Rummy"
      paused={paused}
      status={`Ten-card meld rummy · ${state.turns} turns · ${message}`}
    >
      <label className="game-select">Computer difficulty <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as "beginner" | "standard")} disabled={state.turns > 0}><option value="beginner">Beginner</option><option value="standard">Standard</option></select></label>
      <p>Computer: {state.bot.length} cards</p>
      <div className="card-toolbar">
        <button
          className="playing-card card-back"
          disabled={state.drawn}
          onClick={() => draw(false)}
        >
          Draw
          <br />
          {state.stock.length}
        </button>
        {state.discard.length ? (
          <PlayingCard
            card={state.discard.at(-1)!}
            onClick={() => draw(true)}
          />
        ) : (
          <span>Discard empty</span>
        )}
      </div>
      <div className="rummy-hand">
        {[...state.hand].map((c, i) => (
          <PlayingCard key={c.id} card={c} onClick={() => discard(i)} />
        ))}
      </div>
      <div className="actions">
        <button
          className="btn btn-secondary"
          onClick={() =>
            setState({
              ...state,
              hand: [...state.hand].sort(
                (a, b) => a.suit - b.suit || a.rank - b.rank,
              ),
            })
          }
        >
          Sort hand
        </button>
        <button
          className="btn btn-primary"
          disabled={state.drawn}
          onClick={() => {
            if (validRummy(state.hand))
              finish(api, 1000, true, "Valid declaration");
            else
              setMessage(
                "Hand must partition into sets or suited runs of three or more. Aces are low.",
              );
          }}
        >
          Declare
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => finish(api, 0, false, "Rummy ended")}
        >
          End game
        </button>
      </div>
    </GameFrame>
  );
}

const symbols: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
export function ChessGame({ api, paused }: Props) {
  const [game] = useState(() => new Chess());
  const [, refresh] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [bot, setBot] = useState(true);
  const [difficulty, setDifficulty] = useState<"beginner" | "standard" | "skilled">("standard");
  const [promotion, setPromotion] = useState("q");
  const [message, setMessage] = useState("");
  const end = () => {
    refresh((n) => n + 1);
    if (game.isGameOver())
      finish(
        api,
        game.isCheckmate() ? 1000 : 500,
        true,
        game.isCheckmate()
          ? `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`
          : `Draw: ${game.isStalemate() ? "stalemate" : game.isThreefoldRepetition() ? "repetition" : game.isInsufficientMaterial() ? "insufficient material" : "fifty-move rule"}`,
      );
  };
  useTick(
    () => {
      if (bot && game.turn() === "b" && !game.isGameOver()) {
        const moves = game.moves({ verbose: true });
        let choice = moves[random(moves.length)];
        if (difficulty === "standard") {
          const captures = moves.filter((move) => move.captured);
          choice = (captures.length ? captures : moves)[random((captures.length ? captures : moves).length)];
        }
        if (difficulty === "skilled") {
          const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
          choice = [...moves].sort((a, b) => {
            const score = (move: typeof a) => (move.captured ? values[move.captured] : 0) + (move.promotion ? values[move.promotion] : 0) + (move.san.includes("#") ? 1000 : move.san.includes("+") ? 2 : 0);
            return score(b) - score(a);
          })[0];
        }
        game.move(choice.san);
        setSelected(null);
        end();
      }
    },
    500,
    paused,
  );
  const choose = (square: Square) => {
    if (paused || (bot && game.turn() === "b")) return;
    const piece = game.get(square);
    if (selected) {
      const legal = game
        .moves({ square: selected, verbose: true })
        .find((m) => m.to === square);
      if (legal) {
        game.move({ from: selected, to: square, promotion });
        setSelected(null);
        setMessage("");
        end();
        return;
      }
    }
    if (piece?.color === game.turn()) setSelected(square);
    else {
      setSelected(null);
      setMessage("Select one of your pieces.");
    }
  };
  const legal = selected
    ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
    : [];
  return (
    <GameFrame
      title="Chess"
      paused={paused}
      status={`${game.turn() === "w" ? "White" : "Black"} to move${game.isCheck() ? " · Check!" : ""} ${message}`}
    >
      <div className="game-input-row">
        <label>
          Opponent{" "}
          <select
            value={bot ? "bot" : "local"}
            disabled={game.history().length > 0}
            onChange={(e) => setBot(e.target.value === "bot")}
          >
            <option value="bot">Beginner computer</option>
            <option value="local">Friend on this device</option>
          </select>
        </label>
        {bot ? <label>Difficulty{" "}<select value={difficulty} disabled={game.history().length > 0} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="beginner">Beginner</option><option value="standard">Standard</option><option value="skilled">Skilled</option></select></label> : null}
        <label>
          Promote pawn to{" "}
          <select
            value={promotion}
            onChange={(e) => setPromotion(e.target.value)}
          >
            {["q", "r", "b", "n"].map((p) => (
              <option key={p} value={p}>
                {{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chess-board">
        {game
          .board()
          .flat()
          .map((piece, i) => {
            const square =
              `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}` as Square;
            return (
              <button
                key={square}
                className={`${((i % 8) + Math.floor(i / 8)) % 2 ? "dark-square" : "light-square"} ${legal.includes(square) ? "legal-square" : ""} ${piece?.color === "w" ? "white-piece" : "black-piece"}`}
                aria-label={`${square} ${piece ? `${piece.color === "w" ? "White" : "Black"} ${piece.type}` : "empty"}`}
                aria-pressed={square === selected}
                onClick={() => choose(square)}
              >
                <small>{square}</small>
                {piece
                  ? symbols[piece.color + piece.type]
                  : legal.includes(square)
                    ? "·"
                    : ""}
              </button>
            );
          })}
      </div>
      <p className="meta">
        Moves: {game.history().slice(-12).join(" ") || "White starts"}
      </p>
      <button
        className="btn btn-secondary"
        onClick={() =>
          finish(
            api,
            0,
            false,
            `${game.turn() === "w" ? "White" : "Black"} resigned`,
          )
        }
      >
        Resign
      </button>
      <button className="btn btn-secondary" disabled={!game.history().length} onClick={() => { game.undo(); if (bot) game.undo(); setSelected(null); setMessage("Move undone."); refresh((value) => value + 1); }}>
        Undo
      </button>
    </GameFrame>
  );
}
