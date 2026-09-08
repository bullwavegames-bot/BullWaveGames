import { useEffect, useRef, useState } from "react";
import {
  DirectionPad,
  finish,
  GameFrame,
  random,
  shuffle,
  useTick,
  type Props,
} from "./common";
import { findMatches, slide2048, wordFeedback } from "./rules";

export function Tiles2048({ api, paused }: Props) {
  const spawn = (b: number[]) => {
    const next = [...b],
      empty = next.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    if (empty.length)
      next[empty[random(empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    return next;
  };
  const [board, setBoard] = useState(() => spawn(spawn(Array(16).fill(0))));
  const [score, setScore] = useState(0);
  const touch = useRef<[number, number] | null>(null);
  const move = (x: number, y: number) => {
    if (paused) return;
    const r = slide2048(board, x < 0 ? 0 : x > 0 ? 1 : y < 0 ? 2 : 3);
    if (!r.changed) return;
    const next = spawn(r.board),
      points = score + r.score;
    setBoard(next);
    setScore(points);
    if (next.includes(2048)) finish(api, points, true, "2048 reached");
    else if ([0, 1, 2, 3].every((d) => !slide2048(next, d).changed))
      finish(api, points, false, "No moves left");
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (d[e.key]) {
        e.preventDefault();
        move(...d[e.key]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <GameFrame title="2048" paused={paused} status={`Score ${score}`}>
      <div
        className="tile-grid"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          touch.current = [e.clientX, e.clientY];
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (!touch.current) return;
          const x = e.clientX - touch.current[0],
            y = e.clientY - touch.current[1];
          touch.current = null;
          if (Math.max(Math.abs(x), Math.abs(y)) > 25)
            move(
              Math.abs(x) > Math.abs(y) ? Math.sign(x) : 0,
              Math.abs(y) >= Math.abs(x) ? Math.sign(y) : 0,
            );
        }}
      >
        {board.map((v, i) => (
          <div
            key={i}
            className={`number-tile power-${Math.min(11, Math.log2(v || 1))}`}
          >
            {v || ""}
          </div>
        ))}
      </div>
      <DirectionPad move={move} />
    </GameFrame>
  );
}

const WORDS =
  "ABOUT ABOVE ABUSE ACTOR ACUTE ADMIT ADOPT ADULT AFTER AGAIN AGENT AGREE AHEAD ALARM ALBUM ALERT ALIEN ALIVE ALLOW ALONE ALONG ALTER AMONG ANGEL ANGER ANGLE ANGRY APART APPLE APPLY ARGUE ARISE ARMOR AVOID AWAKE AWARD AWARE AWFUL BADGE BAKER BASIC BEACH BEGAN BEGIN BEING BELOW BENCH BIRTH BLACK BLADE BLAME BLANK BLAST BLEND BLIND BLOCK BLOOD BOARD BOAST BONUS BOOST BOUND BRAIN BRAND BRAVE BREAD BREAK BRICK BRIDE BRIEF BRING BROAD BROKE BROWN BRUSH BUILD BUILT BUNCH CABLE CARRY CATCH CAUSE CHAIN CHAIR CHARM CHART CHASE CHEAP CHECK CHEEK CHEER CHEST CHIEF CHILD CHINA CHOSE CIVIL CLAIM CLASS CLEAN CLEAR CLERK CLICK CLIMB CLOCK CLOSE CLOUD COACH COAST COLOR COMET COMIC COULD COUNT COURT COVER CRACK CRAFT CRANE CRASH CRAZY CREAM CRIME CROSS CROWD CROWN CURVE CYCLE DAILY DANCE DEALT DEATH DELAY DEPTH DIRTY DOING DOUBT DOZEN DRAFT DRAIN DRAMA DRAWN DREAM DRESS DRINK DRIVE DROVE EARLY EARTH EIGHT ELBOW ELDER ELECT ELITE EMPTY ENEMY ENJOY ENTER ENTRY EQUAL ERROR EVENT EVERY EXACT EXIST EXTRA FAITH FALSE FAULT FEAST FIELD FIFTH FIFTY FIGHT FINAL FIRST FIXED FLAME FLASH FLEET FLOOR FLOUR FOCUS FORCE FORTH FORTY FORUM FOUND FRAME FRESH FRONT FRUIT FULLY FUNNY GIANT GIVEN GLASS GLOBE GOING GRACE GRADE GRAIN GRAND GRANT GRAPE GRASS GREAT GREEN GROUP GROWN GUARD GUESS GUEST GUIDE HABIT HAPPY HEART HEAVY HELLO HONEY HONOR HORSE HOTEL HOUSE HUMAN IDEAL IMAGE INDEX INNER INPUT ISSUE JOINT JUDGE JUICE KNIFE KNOCK KNOWN LABEL LARGE LASER LATER LAUGH LAYER LEARN LEAST LEAVE LEGAL LEMON LEVEL LIGHT LIMIT LOCAL LOOSE LUCKY LUNCH MAGIC MAJOR MAKER MANGO MATCH MAYBE MAYOR MEDIA METAL MIGHT MINOR MODEL MONEY MONTH MORAL MOTOR MOUNT MOUSE MOUTH MOVIE MUSIC NEEDS NEVER NIGHT NOISE NORTH NOVEL NURSE OCCUR OCEAN OFFER OFTEN OLIVE OPERA ORDER OTHER OUGHT OUTER OWNER PAINT PANEL PAPER PARTY PEACE PEACH PEARL PETER PHASE PHONE PHOTO PIANO PIECE PILOT PITCH PLACE PLAIN PLANE PLANT PLATE POINT POUND POWER PRESS PRICE PRIDE PRIME PRINT PRIOR PRIZE PROOF PROUD PROVE PUPPY QUEEN QUERY QUEST QUICK QUIET QUITE RADIO RAISE RANGE RAPID RATIO REACH READY REFER RELAX REPLY RIGHT RIVER ROBIN ROBOT ROUGH ROUND ROUTE ROYAL RUGBY RURAL SCALE SCENE SCOPE SCORE SENSE SERVE SEVEN SHADE SHAKE SHALL SHAME SHAPE SHARE SHARK SHARP SHEEP SHEET SHELF SHELL SHIFT SHINE SHIRT SHOCK SHOOT SHORT SHOWN SIGHT SINCE SIXTH SIXTY SKILL SLEEP SLICE SLIDE SMALL SMART SMILE SMOKE SOLAR SOLID SOLVE SORRY SOUND SOUTH SPACE SPARE SPEAK SPEED SPEND SPENT SPICE SPLIT SPOKE SPORT STAFF STAGE STAIR STAKE STAND START STATE STEAM STEEL STEEP STICK STILL STOCK STONE STOOD STORE STORM STORY STRIP STUDY STUFF STYLE SUGAR SUITE SUNNY SUPER SWEET SWORD TABLE TAKEN TASTE TEACH TEETH THANK THEIR THEME THERE THESE THICK THING THINK THIRD THOSE THREE THROW TIGER TIGHT TIRED TITLE TODAY TOOTH TOPIC TOTAL TOUCH TOUGH TOWER TRACK TRADE TRAIL TRAIN TREAT TREND TRIAL TRIED TRULY TRUST TRUTH TWICE UNDER UNION UNITY UNTIL UPPER UPSET URBAN USAGE USUAL VALID VALUE VIDEO VIRUS VISIT VITAL VOICE WASTE WATCH WATER WHEEL WHERE WHICH WHILE WHITE WHOLE WHOSE WOMAN WOMEN WORLD WORRY WORTH WOULD WRITE WRONG WROTE YIELD YOUNG YOUTH ZEBRA".split(
    " ",
  );
export function WordGuess({ api, paused }: Props) {
  const [answer] = useState(
    () =>
      shuffle([
        "OCEAN",
        "CRANE",
        "GRAPE",
        "LIGHT",
        "MANGO",
        "PAPER",
        "QUIET",
        "TIGER",
        "WATER",
        "DREAM",
      ])[0],
  );
  const [guess, setGuess] = useState("");
  const [rows, setRows] = useState<string[]>([]);
  const [message, setMessage] = useState("Guess a five-letter word.");
  const submit = () => {
    if (paused) return;
    const g = guess.toUpperCase();
    if (!WORDS.includes(g)) {
      setMessage("Choose a word from the game's English dictionary.");
      return;
    }
    const next = [...rows, g];
    setRows(next);
    setGuess("");
    setMessage("");
    if (g === answer) finish(api, (7 - next.length) * 100, true, answer);
    else if (next.length === 6) finish(api, 0, false, `The word was ${answer}`);
  };
  return (
    <GameFrame title="Word Guess" paused={paused} status={message}>
      <div className="word-grid">
        {Array.from({ length: 6 }, (_, r) => {
          const word = rows[r] || (r === rows.length ? guess : "");
          const feedback = rows[r] ? wordFeedback(word, answer) : [];
          return Array.from({ length: 5 }, (_, c) => (
            <span key={`${r}-${c}`} className={feedback[c] || ""}>
              {word[c]}
            </span>
          ));
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="game-input-row"
      >
        <label>
          Five-letter word
          <input
            autoComplete="off"
            maxLength={5}
            value={guess}
            onChange={(e) =>
              setGuess(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())
            }
          />
        </label>
        <button className="btn btn-primary">Guess</button>
      </form>
      <p className="meta">
        Mint: right place · Gold: wrong place · Slate: absent
      </p>
    </GameFrame>
  );
}

const BASE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
export function Sudoku({ api, paused }: Props) {
  const [mapping] = useState(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [initial] = useState(() =>
    BASE.split("").map((x) => (+x ? mapping[+x - 1] : 0)),
  );
  const [solution] = useState(() =>
    SOLUTION.split("").map((x) => mapping[+x - 1]),
  );
  const [board, setBoard] = useState(initial);
  const [cell, setCell] = useState(2);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [pencil, setPencil] = useState(false);
  const [check, setCheck] = useState(false);
  const [moves, setMoves] = useState(0);
  const enter = (n: number) => {
    if (paused || initial[cell]) return;
    if (pencil && n) {
      setNotes({
        ...notes,
        [cell]: (notes[cell] || []).includes(n)
          ? notes[cell].filter((x) => x !== n)
          : [...(notes[cell] || []), n].sort(),
      });
      return;
    }
    const b = [...board];
    b[cell] = n;
    setBoard(b);
    setMoves(moves + 1);
    if (b.every((x, i) => x === solution[i]))
      finish(api, Math.max(100, 1000 - moves), true, "Sudoku solved");
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) enter(+e.key);
      if (e.key === "Backspace" || e.key === "Delete") enter(0);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  return (
    <GameFrame
      title="Sudoku"
      paused={paused}
      status="Every row, column, and box needs 1–9."
    >
      <div className="sudoku-grid">
        {board.map((v, i) => (
          <button
            key={i}
            aria-label={`Row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}: ${v || "empty"}`}
            aria-pressed={cell === i}
            className={`${initial[i] ? "given" : ""} ${check && v && v !== solution[i] ? "incorrect" : ""}`}
            style={{
              borderRightWidth: i % 3 === 2 ? 3 : 1,
              borderBottomWidth: Math.floor(i / 9) % 3 === 2 ? 3 : 1,
            }}
            onClick={() => setCell(i)}
          >
            {v || <small>{(notes[i] || []).join(" ")}</small>}
          </button>
        ))}
      </div>
      <div className="number-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button
            className="btn btn-secondary"
            key={n}
            onClick={() => enter(n)}
          >
            {n || "Erase"}
          </button>
        ))}
      </div>
      <button
        className="btn btn-secondary"
        aria-pressed={pencil}
        onClick={() => setPencil(!pencil)}
      >
        Notes {pencil ? "on" : "off"}
      </button>
      <button
        className="btn btn-secondary"
        aria-pressed={check}
        onClick={() => setCheck(!check)}
      >
        Check
      </button>
    </GameFrame>
  );
}

const CLUES = [
  {
    id: 1,
    row: 0,
    col: 2,
    down: true,
    answer: "PLANET",
    clue: "A world orbiting a star",
  },
  {
    id: 2,
    row: 0,
    col: 2,
    down: false,
    answer: "PLAY",
    clue: "What you do in an arcade",
  },
  {
    id: 3,
    row: 2,
    col: 1,
    down: false,
    answer: "GAME",
    clue: "An activity with rules and a goal",
  },
  {
    id: 4,
    row: 4,
    col: 1,
    down: false,
    answer: "NEON",
    clue: "A gas known for bright signs",
  },
  {
    id: 5,
    row: 5,
    col: 2,
    down: false,
    answer: "TIDE",
    clue: "The sea's periodic rise and fall",
  },
];
export function Crossword({ api, paused }: Props) {
  const [letters, setLetters] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("Select a clue and fill its answer.");
  const cells: Record<string, string> = {};
  CLUES.forEach((c) =>
    c.answer
      .split("")
      .forEach(
        (v, i) =>
          (cells[`${c.row + (c.down ? i : 0)},${c.col + (c.down ? 0 : i)}`] =
            v),
      ),
  );
  const clue = CLUES[active];
  const keys = clue.answer
    .split("")
    .map(
      (_, i) =>
        `${clue.row + (clue.down ? i : 0)},${clue.col + (clue.down ? 0 : i)}`,
    );
  return (
    <GameFrame title="Crossword" paused={paused} status={message}>
      <div className="crossword-layout">
        <div className="crossword-grid">
          {Array.from({ length: 42 }, (_, i) => {
            const key = `${Math.floor(i / 7)},${i % 7}`;
            const start = CLUES.find((c) => `${c.row},${c.col}` === key);
            return cells[key] ? (
              <div className={keys.includes(key) ? "active" : ""} key={key}>
                <small>{start?.id}</small>
                {letters[key] || ""}
              </div>
            ) : (
              <div className="blocked" key={key} />
            );
          })}
        </div>
        <div>
          {CLUES.map((c, i) => (
            <button
              key={c.id}
              className="clue-button"
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              {c.id} {c.down ? "Down" : "Across"}: {c.clue} ({c.answer.length})
            </button>
          ))}
        </div>
      </div>
      <label className="game-answer">
        {clue.id} {clue.down ? "Down" : "Across"}
        <input
          value={keys
            .map((k) => letters[k] || " ")
            .join("")
            .trimEnd()}
          maxLength={clue.answer.length}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z ]/g, "");
            const next = { ...letters };
            keys.forEach((k, i) => (next[k] = v[i]?.trim() || ""));
            setLetters(next);
          }}
        />
      </label>
      <button
        className="btn btn-primary"
        onClick={() => {
          if (Object.entries(cells).every(([k, v]) => letters[k] === v))
            finish(api, 500, true, "Crossword solved");
          else
            setMessage("Some letters are missing or incorrect. Keep trying.");
        }}
      >
        Check puzzle
      </button>
    </GameFrame>
  );
}

export function MemoryMatch({ api, paused }: Props) {
  const [cards] = useState(() =>
    shuffle([...Array(8).keys(), ...Array(8).keys()]),
  );
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [delay, setDelay] = useState(0);
  useTick(
    () => {
      if (delay > 0) {
        if (delay <= 100) {
          setOpen([]);
          setDelay(0);
        } else setDelay(delay - 100);
      }
    },
    100,
    paused,
  );
  const click = (i: number) => {
    if (paused || delay || open.includes(i) || found.includes(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves(moves + 1);
      if (cards[next[0]] === cards[i]) {
        const f = [...found, ...next];
        setFound(f);
        setOpen([]);
        if (f.length === 16)
          finish(
            api,
            Math.max(100, 1000 - (moves + 1) * 20),
            true,
            `${moves + 1} guesses`,
          );
      } else setDelay(800);
    }
  };
  return (
    <GameFrame
      title="Memory Match"
      paused={paused}
      status={`${found.length / 2}/8 pairs · ${moves} guesses`}
    >
      <div className="tile-grid memory-grid">
        {cards.map((v, i) => (
          <button
            key={i}
            className={found.includes(i) ? "matched" : ""}
            aria-label={
              open.includes(i) || found.includes(i)
                ? `Symbol ${v + 1}`
                : `Face-down card ${i + 1}`
            }
            onClick={() => click(i)}
          >
            {open.includes(i) || found.includes(i)
              ? ["♠", "♥", "♦", "♣", "★", "☀", "☾", "♫"][v]
              : "?"}
          </button>
        ))}
      </div>
    </GameFrame>
  );
}

export function Jigsaw({ api, paused }: Props) {
  const [pieces, setPieces] = useState(() => {
    const p = shuffle([...Array(16).keys()]);
    if (p.every((x, i) => x === i)) [p[0], p[1]] = [p[1], p[0]];
    return p;
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  return (
    <GameFrame
      title="Jigsaw Puzzle"
      paused={paused}
      status={`${pieces.filter((p, i) => p === i).length}/16 in place · ${moves} swaps`}
    >
      <div className="jigsaw-layout">
        <div className="tile-grid jigsaw-grid">
          {pieces.map((p, i) => (
            <button
              aria-label={`Piece ${p + 1}, slot ${i + 1}`}
              aria-pressed={selected === i}
              key={i}
              style={{
                backgroundImage: "url('/covers/bullwave-neon-hero.png')",
                backgroundSize: "400% 400%",
                backgroundPosition: `${((p % 4) * 100) / 3}% ${(Math.floor(p / 4) * 100) / 3}%`,
              }}
              onClick={() => {
                if (selected === null) {
                  setSelected(i);
                  return;
                }
                if (selected === i) {
                  setSelected(null);
                  return;
                }
                const n = [...pieces];
                [n[i], n[selected]] = [n[selected], n[i]];
                setPieces(n);
                setSelected(null);
                setMoves(moves + 1);
                if (n.every((x, j) => x === j))
                  finish(
                    api,
                    Math.max(100, 1000 - moves * 10),
                    true,
                    `${moves + 1} swaps`,
                  );
              }}
            />
          ))}
        </div>
        <figure>
          <img
            src="/covers/bullwave-neon-hero.png"
            alt="Reference picture: golden bull in a neon tunnel"
          />
          <figcaption>Reference · swap any two tiles</figcaption>
        </figure>
      </div>
    </GameFrame>
  );
}

const GEMS = ["◆", "●", "▲", "■", "✦", "♥"],
  COLORS = ["#61d6b0", "#43c7e8", "#a66acb", "#d5aa50", "#f16f78", "#f1f5f9"];
function freshGems() {
  const b: number[] = [];
  for (let i = 0; i < 64; i++) {
    let c = random(6);
    while (
      (i % 8 >= 2 && b[i - 1] === c && b[i - 2] === c) ||
      (i >= 16 && b[i - 8] === c && b[i - 16] === c)
    )
      c = random(6);
    b.push(c);
  }
  return b;
}
function hasSwap(b: number[]) {
  for (let i = 0; i < 64; i++)
    for (const j of [i % 8 < 7 ? i + 1 : -1, i + 8 < 64 ? i + 8 : -1]) {
      if (j < 0) continue;
      const n = [...b];
      [n[i], n[j]] = [n[j], n[i]];
      if (findMatches(n).length) return true;
    }
  return false;
}
export function MatchThree({ api, paused }: Props) {
  const [board, setBoard] = useState(freshGems);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(25);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState(
    "Match three or more. Target: 1,500 points.",
  );
  const click = (i: number) => {
    if (paused) return;
    if (selected === null) {
      setSelected(i);
      return;
    }
    const a = selected;
    setSelected(null);
    if (
      Math.abs((a % 8) - (i % 8)) +
        Math.abs(Math.floor(a / 8) - Math.floor(i / 8)) !==
      1
    ) {
      setSelected(i);
      return;
    }
    let b = [...board];
    [b[a], b[i]] = [b[i], b[a]];
    let hits = findMatches(b);
    if (!hits.length) {
      setMessage("That swap does not make a match.");
      return;
    }
    let points = 0,
      chain = 0;
    while (hits.length && chain < 100) {
      points += hits.length * 10 * ++chain;
      hits.forEach((j) => (b[j] = -1));
      for (let col = 0; col < 8; col++) {
        const v = Array.from(
          { length: 8 },
          (_, row) => b[row * 8 + col],
        ).filter((x) => x >= 0);
        while (v.length < 8) v.unshift(random(6));
        v.forEach((x, row) => (b[row * 8 + col] = x));
      }
      hits = findMatches(b);
    }
    if (!hasSwap(b)) {
      b = freshGems();
      setMessage("No moves remained: board reshuffled.");
    } else setMessage(`+${points} · ${chain} cascade${chain === 1 ? "" : "s"}`);
    const total = score + points;
    setScore(total);
    setBoard(b);
    setMoves(moves - 1);
    if (total >= 1500) finish(api, total, true, "Target reached");
    else if (moves === 1) finish(api, total, false, "Out of moves");
  };
  return (
    <GameFrame
      title="Match-3"
      paused={paused}
      status={`${score}/1500 points · ${moves} moves · ${message}`}
    >
      <div className="gem-grid">
        {board.map((c, i) => (
          <button
            key={i}
            aria-label={`Row ${Math.floor(i / 8) + 1} column ${(i % 8) + 1}, gem ${c + 1}`}
            aria-pressed={selected === i}
            onClick={() => click(i)}
            style={{ color: COLORS[c] }}
          >
            {GEMS[c]}
          </button>
        ))}
      </div>
    </GameFrame>
  );
}
