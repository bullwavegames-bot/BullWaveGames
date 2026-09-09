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
import { findMatches, slide2048 } from "./rules";

export function Tiles2048({ api, paused }: Props) {
  const spawn = (b: number[]) => {
    const next = [...b],
      empty = next.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    if (empty.length)
      next[empty[random(empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    return next;
  };
  const saved = useRef<{ board: number[]; score: number } | null>(null);
  if (saved.current === null) {
    try { saved.current = JSON.parse(localStorage.getItem("bullwave-2048-v1") || "null"); } catch { saved.current = null; }
  }
  const [board, setBoard] = useState(() => saved.current?.board?.length === 16 ? saved.current.board : spawn(spawn(Array(16).fill(0))));
  const [score, setScore] = useState(() => saved.current?.score ?? 0);
  const [history, setHistory] = useState<Array<{ board: number[]; score: number }>>([]);
  const touch = useRef<[number, number] | null>(null);
  const move = (x: number, y: number) => {
    if (paused) return;
    const r = slide2048(board, x < 0 ? 0 : x > 0 ? 1 : y < 0 ? 2 : 3);
    if (!r.changed) return;
    const next = spawn(r.board),
      points = score + r.score;
    setHistory((items) => [...items.slice(-19), { board, score }]);
    setBoard(next);
    setScore(points);
    localStorage.setItem("bullwave-2048-v1", JSON.stringify({ board: next, score: points }));
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
      <div className="actions"><button className="btn btn-secondary" disabled={!history.length} onClick={() => { const previous = history.at(-1); if (!previous) return; setBoard(previous.board); setScore(previous.score); setHistory(history.slice(0, -1)); localStorage.setItem("bullwave-2048-v1", JSON.stringify(previous)); }}>Undo</button><button className="btn btn-secondary" onClick={() => { const next = spawn(spawn(Array(16).fill(0))); setBoard(next); setScore(0); setHistory([]); localStorage.setItem("bullwave-2048-v1", JSON.stringify({ board: next, score: 0 })); }}>New game</button></div>
    </GameFrame>
  );
}

const WORDS =
  "ABOUT ABOVE ABUSE ACTOR ACUTE ADMIT ADOPT ADULT AFTER AGAIN AGENT AGREE AHEAD ALARM ALBUM ALERT ALIEN ALIVE ALLOW ALONE ALONG ALTER AMONG ANGEL ANGER ANGLE ANGRY APART APPLE APPLY ARGUE ARISE ARMOR AVOID AWAKE AWARD AWARE AWFUL BADGE BAKER BASIC BEACH BEGAN BEGIN BEING BELOW BENCH BIRTH BLACK BLADE BLAME BLANK BLAST BLEND BLIND BLOCK BLOOD BOARD BOAST BONUS BOOST BOUND BRAIN BRAND BRAVE BREAD BREAK BRICK BRIDE BRIEF BRING BROAD BROKE BROWN BRUSH BUILD BUILT BUNCH CABLE CARRY CATCH CAUSE CHAIN CHAIR CHARM CHART CHASE CHEAP CHECK CHEEK CHEER CHEST CHIEF CHILD CHINA CHOSE CIVIL CLAIM CLASS CLEAN CLEAR CLERK CLICK CLIMB CLOCK CLOSE CLOUD COACH COAST COLOR COMET COMIC COULD COUNT COURT COVER CRACK CRAFT CRANE CRASH CRAZY CREAM CRIME CROSS CROWD CROWN CURVE CYCLE DAILY DANCE DEALT DEATH DELAY DEPTH DIRTY DOING DOUBT DOZEN DRAFT DRAIN DRAMA DRAWN DREAM DRESS DRINK DRIVE DROVE EARLY EARTH EIGHT ELBOW ELDER ELECT ELITE EMPTY ENEMY ENJOY ENTER ENTRY EQUAL ERROR EVENT EVERY EXACT EXIST EXTRA FAITH FALSE FAULT FEAST FIELD FIFTH FIFTY FIGHT FINAL FIRST FIXED FLAME FLASH FLEET FLOOR FLOUR FOCUS FORCE FORTH FORTY FORUM FOUND FRAME FRESH FRONT FRUIT FULLY FUNNY GIANT GIVEN GLASS GLOBE GOING GRACE GRADE GRAIN GRAND GRANT GRAPE GRASS GREAT GREEN GROUP GROWN GUARD GUESS GUEST GUIDE HABIT HAPPY HEART HEAVY HELLO HONEY HONOR HORSE HOTEL HOUSE HUMAN IDEAL IMAGE INDEX INNER INPUT ISSUE JOINT JUDGE JUICE KNIFE KNOCK KNOWN LABEL LARGE LASER LATER LAUGH LAYER LEARN LEAST LEAVE LEGAL LEMON LEVEL LIGHT LIMIT LOCAL LOOSE LUCKY LUNCH MAGIC MAJOR MAKER MANGO MATCH MAYBE MAYOR MEDIA METAL MIGHT MINOR MODEL MONEY MONTH MORAL MOTOR MOUNT MOUSE MOUTH MOVIE MUSIC NEEDS NEVER NIGHT NOISE NORTH NOVEL NURSE OCCUR OCEAN OFFER OFTEN OLIVE OPERA ORDER OTHER OUGHT OUTER OWNER PAINT PANEL PAPER PARTY PEACE PEACH PEARL PETER PHASE PHONE PHOTO PIANO PIECE PILOT PITCH PLACE PLAIN PLANE PLANT PLATE POINT POUND POWER PRESS PRICE PRIDE PRIME PRINT PRIOR PRIZE PROOF PROUD PROVE PUPPY QUEEN QUERY QUEST QUICK QUIET QUITE RADIO RAISE RANGE RAPID RATIO REACH READY REFER RELAX REPLY RIGHT RIVER ROBIN ROBOT ROUGH ROUND ROUTE ROYAL RUGBY RURAL SCALE SCENE SCOPE SCORE SENSE SERVE SEVEN SHADE SHAKE SHALL SHAME SHAPE SHARE SHARK SHARP SHEEP SHEET SHELF SHELL SHIFT SHINE SHIRT SHOCK SHOOT SHORT SHOWN SIGHT SINCE SIXTH SIXTY SKILL SLEEP SLICE SLIDE SMALL SMART SMILE SMOKE SOLAR SOLID SOLVE SORRY SOUND SOUTH SPACE SPARE SPEAK SPEED SPEND SPENT SPICE SPLIT SPOKE SPORT STAFF STAGE STAIR STAKE STAND START STATE STEAM STEEL STEEP STICK STILL STOCK STONE STOOD STORE STORM STORY STRIP STUDY STUFF STYLE SUGAR SUITE SUNNY SUPER SWEET SWORD TABLE TAKEN TASTE TEACH TEETH THANK THEIR THEME THERE THESE THICK THING THINK THIRD THOSE THREE THROW TIGER TIGHT TIRED TITLE TODAY TOOTH TOPIC TOTAL TOUCH TOUGH TOWER TRACK TRADE TRAIL TRAIN TREAT TREND TRIAL TRIED TRULY TRUST TRUTH TWICE UNDER UNION UNITY UNTIL UPPER UPSET URBAN USAGE USUAL VALID VALUE VIDEO VIRUS VISIT VITAL VOICE WASTE WATCH WATER WHEEL WHERE WHICH WHILE WHITE WHOLE WHOSE WOMAN WOMEN WORLD WORRY WORTH WOULD WRITE WRONG WROTE YIELD YOUNG YOUTH ZEBRA".split(
    " ",
  );
const SEARCH_SIZE = 10;
const SEARCH_DIRECTIONS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
  [0, -1], [-1, 0], [-1, -1], [-1, 1],
] as const;
type SearchPuzzle = { grid: string[]; words: string[] };

function makeWordSearch(): SearchPuzzle {
  const words = shuffle(WORDS).slice(0, 7);
  const grid = Array(SEARCH_SIZE * SEARCH_SIZE).fill("");
  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const [dr, dc] = SEARCH_DIRECTIONS[random(SEARCH_DIRECTIONS.length)];
      const row = random(SEARCH_SIZE);
      const col = random(SEARCH_SIZE);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= SEARCH_SIZE || endCol < 0 || endCol >= SEARCH_SIZE) continue;
      const cells = Array.from({ length: word.length }, (_, i) => (row + dr * i) * SEARCH_SIZE + col + dc * i);
      if (cells.some((cell, i) => grid[cell] && grid[cell] !== word[i])) continue;
      cells.forEach((cell, i) => { grid[cell] = word[i]; });
      placed = true;
    }
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return { grid: grid.map((letter) => letter || alphabet[random(alphabet.length)]), words };
}

function searchLine(start: number, end: number): number[] {
  const sr = Math.floor(start / SEARCH_SIZE), sc = start % SEARCH_SIZE;
  const er = Math.floor(end / SEARCH_SIZE), ec = end % SEARCH_SIZE;
  const rowDelta = er - sr, colDelta = ec - sc;
  if (rowDelta !== 0 && colDelta !== 0 && Math.abs(rowDelta) !== Math.abs(colDelta)) return [start];
  const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta)) + 1;
  const dr = Math.sign(rowDelta), dc = Math.sign(colDelta);
  return Array.from({ length }, (_, i) => (sr + dr * i) * SEARCH_SIZE + sc + dc * i);
}

export function WordGuess({ api, paused }: Props) {
  const [puzzle] = useState(makeWordSearch);
  const [found, setFound] = useState<Record<string, number[]>>({});
  const [start, setStart] = useState<number | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [message, setMessage] = useState("Find all seven hidden words.");
  const finishSelection = (cells = selection) => {
    if (paused || start === null) return;
    const chosen = cells.map((cell) => puzzle.grid[cell]).join("");
    const reverse = [...chosen].reverse().join("");
    const word = puzzle.words.find((item) => !found[item] && (item === chosen || item === reverse));
    if (word) {
      const next = { ...found, [word]: cells };
      setFound(next);
      setMessage(`${word} found! ${Object.keys(next).length} of ${puzzle.words.length}.`);
      if (Object.keys(next).length === puzzle.words.length)
        finish(api, 700, true, "All hidden words found");
    } else if (cells.length > 1) setMessage("That line is not one of the hidden words.");
    setStart(null);
    setSelection([]);
  };
  const foundCells = new Set(Object.values(found).flat());
  return (
    <GameFrame title="Word Guess" paused={paused} status={message}>
      <div className="word-search-game">
        <div className="word-guess-heading">
          <div>
            <span className="word-guess-eyebrow">Hidden word challenge</span>
            <h2>Find all the words</h2>
          </div>
          <span className="word-attempts">{Object.keys(found).length}<b>/{puzzle.words.length}</b> found</span>
        </div>
        <p className="word-search-help">Drag across letters horizontally, vertically, or diagonally.</p>
        <div
          className="word-search-grid"
          role="grid"
          aria-label="Word search letter grid"
          onPointerLeave={() => { if (start !== null) finishSelection(); }}
        >
          {puzzle.grid.map((letter, index) => (
            <button
              type="button"
              key={index}
              role="gridcell"
              aria-label={`Row ${Math.floor(index / SEARCH_SIZE) + 1}, column ${(index % SEARCH_SIZE) + 1}: ${letter}`}
              className={`${foundCells.has(index) ? "found" : ""} ${selection.includes(index) ? "selecting" : ""}`}
              onPointerDown={(event) => {
                if (paused) return;
                event.preventDefault();
                setStart(index);
                setSelection([index]);
              }}
              onPointerEnter={() => {
                if (start !== null) setSelection(searchLine(start, index));
              }}
              onPointerUp={() => finishSelection(selection.length > 1 ? selection : [index])}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="word-search-list" aria-label="Words to find">
          {puzzle.words.map((word) => (
            <span key={word} className={found[word] ? "found" : ""}>{word}</span>
          ))}
        </div>
      </div>
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
  const [mistakes, setMistakes] = useState(0);
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
    if (n && n !== solution[cell]) setMistakes((value) => value + 1);
    if (b.every((x, i) => x === solution[i]))
      finish(api, Math.max(100, 1000 - moves), true, "Sudoku solved");
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) enter(+e.key);
      if (e.key === "Backspace" || e.key === "Delete") enter(0);
      const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (delta[e.key]) {
        e.preventDefault();
        setCell((value) => Math.max(0, Math.min(80, value + delta[e.key])));
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  return (
    <GameFrame
      title="Sudoku"
      paused={paused}
      status={`Every row, column, and box needs 1–9 · ${mistakes} mistakes`}
    >
      <div className="sudoku-grid">
        {board.map((v, i) => (
          <button
            key={i}
            aria-label={`Row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}: ${v || "empty"}`}
            aria-pressed={cell === i}
            className={`${initial[i] ? "given" : ""} ${check && v && v !== solution[i] ? "incorrect" : ""} ${cell !== i && (Math.floor(cell / 9) === Math.floor(i / 9) || cell % 9 === i % 9 || (Math.floor(cell / 27) === Math.floor(i / 27) && Math.floor((cell % 9) / 3) === Math.floor((i % 9) / 3))) ? "related" : ""}`}
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
      <button className="btn btn-secondary" onClick={() => { setBoard(initial); setNotes({}); setMoves(0); setMistakes(0); setCheck(false); setCell(initial.findIndex((value) => !value)); }}>
        Restart puzzle
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
  const [letters, setLetters] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("bullwave-crossword-v1") || "{}"); } catch { return {}; }
  });
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
  useEffect(() => { localStorage.setItem("bullwave-crossword-v1", JSON.stringify(letters)); }, [letters]);
  const filled = Object.keys(cells).filter((key) => letters[key]).length;
  return (
    <GameFrame title="Crossword" paused={paused} status={`${message} · ${filled}/${Object.keys(cells).length} letters`}>
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
      <button className="btn btn-secondary" onClick={() => { setLetters({}); setMessage("Puzzle cleared."); localStorage.removeItem("bullwave-crossword-v1"); }}>Clear puzzle</button>
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
  const [best, setBest] = useState<number | null>(null);
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
          setBest((current) => (current === null ? moves + 1 : Math.min(current, moves + 1)));
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
      status={`${found.length / 2}/8 pairs · ${moves} guesses${best ? ` · Best ${best}` : ""}`}
    >
      <div className="memory-game">
        <div className="memory-heading">
          <div>
            <span className="memory-eyebrow">Focus &amp; recall</span>
            <h2>Match the constellation</h2>
            <p>Reveal two cards at a time and pair every symbol.</p>
          </div>
          <div className="memory-score"><strong>{found.length / 2}</strong><span>/ 8 pairs</span></div>
        </div>
        <div className="memory-progress" aria-label={`${found.length / 16 * 100}% complete`}><span style={{ width: `${found.length / 16 * 100}%` }} /></div>
        <div className="memory-grid" role="grid" aria-label="Memory cards">
        {cards.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={`${found.includes(i) ? "matched" : ""} ${open.includes(i) ? "revealed" : ""}`}
            aria-label={
              open.includes(i) || found.includes(i)
                ? `Symbol ${v + 1}`
                : `Face-down card ${i + 1}`
            }
            onClick={() => click(i)}
          >
            <span className="memory-card-inner">
              <span className="memory-card-front" aria-hidden="true" />
              <span className="memory-card-back">{open.includes(i) || found.includes(i) ? ["♠", "♥", "♦", "♣", "★", "☀", "☾", "♫"][v] : ""}</span>
            </span>
          </button>
        ))}
        </div>
        <div className="memory-tips"><span>✦ Find all 8 pairs</span><span>↗ Fewer guesses = higher score</span><span>◷ Take your time</span></div>
      </div>
    </GameFrame>
  );
}

const JIGSAW_PUZZLES = [
  { title: "Neon Bull", src: "/covers/bullwave-neon-hero.png", alt: "Golden bull charging through a neon tunnel" },
  { title: "Kite Festival", src: "/puzzles/kite-festival.jpg", alt: "Colorful kites above a sunlit coastal city" },
  { title: "Lantern Garden", src: "/puzzles/lantern-garden.jpg", alt: "Moonlit garden with glowing lanterns and lotus ponds" },
  { title: "Rangoli Courtyard", src: "/puzzles/rangoli-courtyard.jpg", alt: "Luminous rangoli surrounded by diyas in a courtyard" },
] as const;

function shuffledJigsaw() {
  const p = shuffle([...Array(16).keys()]);
  if (p.every((x, i) => x === i)) [p[0], p[1]] = [p[1], p[0]];
  return p;
}

export function Jigsaw({ api, paused }: Props) {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [pieces, setPieces] = useState(shuffledJigsaw);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const puzzle = JIGSAW_PUZZLES[puzzleIndex];
  const restart = (nextIndex = puzzleIndex) => {
    setPuzzleIndex(nextIndex);
    setPieces(shuffledJigsaw());
    setSelected(null);
    setMoves(0);
  };
  return (
    <GameFrame
      title="Jigsaw Puzzle"
      paused={paused}
      status={`${pieces.filter((p, i) => p === i).length}/16 in place · ${moves} swaps`}
    >
      <div className="jigsaw-game">
        <div className="jigsaw-heading">
          <div><span className="word-guess-eyebrow">Picture collection</span><h2>{puzzle.title}</h2></div>
          <button className="btn btn-secondary" onClick={() => restart()}>Shuffle again</button>
        </div>
        <div className="jigsaw-gallery" aria-label="Choose a puzzle image">
          {JIGSAW_PUZZLES.map((item, index) => (
            <button key={item.title} aria-pressed={puzzleIndex === index} onClick={() => restart(index)}>
              <img src={item.src} alt="" /><span>{item.title}</span>
            </button>
          ))}
        </div>
        <div className="jigsaw-layout">
          <div className="jigsaw-board-wrap">
            <div className="jigsaw-grid" aria-label={`${puzzle.title} puzzle board`}>
              {pieces.map((p, i) => (
                <button
                  className={`jigsaw-piece ${p === i ? "in-place" : ""}`}
                  aria-label={`Piece ${p + 1}, slot ${i + 1}${p === i ? ", correct" : ""}`}
                  aria-pressed={selected === i}
                  key={i}
                  style={{
                    backgroundImage: `url('${puzzle.src}')`,
                    backgroundSize: "400% 400%",
                    backgroundPosition: `${((p % 4) * 100) / 3}% ${(Math.floor(p / 4) * 100) / 3}%`,
                  }}
                  onClick={() => {
                    if (selected === null) { setSelected(i); return; }
                    if (selected === i) { setSelected(null); return; }
                    const n = [...pieces];
                    [n[i], n[selected]] = [n[selected], n[i]];
                    setPieces(n);
                    setSelected(null);
                    setMoves(moves + 1);
                    if (n.every((x, j) => x === j))
                      finish(api, Math.max(100, 1000 - moves * 10), true, `${moves + 1} swaps · ${puzzle.title}`);
                  }}
                />
              ))}
            </div>
            <p className="jigsaw-tip">Select any tile, then select another to swap them.</p>
          </div>
          <figure className="jigsaw-reference">
            <div className="jigsaw-reference-image"><img src={puzzle.src} alt={`Reference: ${puzzle.alt}`} /></div>
            <figcaption><span>Reference image</span><strong>{puzzle.title}</strong><small>Match all 16 tiles to finish</small></figcaption>
          </figure>
        </div>
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
