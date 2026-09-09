import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { continueCap } from "../lib/access";
import { gameBySlug } from "../data/games";
import { useApp } from "../state/AppState";
import { Button, ButtonLink, Dialog } from "../components/ui";
import { KiteLine } from "../games/KiteLine";
import { LanternPath } from "../games/LanternPath";
import { TideTap } from "../games/TideTap";
import { PaperGharial } from "../games/PaperGharial";
import { RangoliRecall } from "../games/RangoliRecall";
import { TwoPlayerFold } from "../games/TwoPlayerFold";
import type { Game } from "../types";
import type { GameAPI } from "../games/types";
import { CollectionGame } from "../games/collection";

export function GameSessionPage() {
  const { slug } = useParams();
  return <GameSession key={slug} />;
}

function GameSession() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { games, entitlement, recordResult, settings } = useApp();
  const game = games.find((item) => item.slug === slug) ?? gameBySlug(slug);
  const liveRoom = ["draw-guess", "multiplayer-ludo", "live-trivia", "trivia-battle"].includes(slug);
  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "results">("idle");
  const [muted, setMuted] = useState(!settings.gameSound);
  const [fullscreen, setFullscreen] = useState(false);
  const [continues, setContinues] = useState(continueCap(entitlement));
  const [result, setResult] = useState<{ score: number; stars: number; metric?: string; unsaved?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<"restart" | "quit" | null>(null);
  const [loadError, setLoadError] = useState(false);
  const started = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (!game) {
    return (
      <div className="hud-shell">
        <p>Missing game.</p>
        <ButtonLink to="/play">Back to arcade</ButtonLink>
      </div>
    );
  }

  const start = () => {
    if (!started.current) started.current = true;
    setLoadError(false);
    setPhase("playing");
  };

  const finish = (next: { score: number; stars: number; metric?: string }) => {
    try {
      recordResult({ slug: game.slug, score: next.score, stars: next.stars, metric: next.metric });
      setResult(next);
    } catch {
      setResult({ ...next, unsaved: true });
    }
    setPhase("results");
  };

  const api: GameAPI = {
    slug: game.slug,
    muted,
    reduced: settings.reducedMotion,
    continues,
    onContinue: () => {
      if (continues <= 0) return false;
      setContinues((value) => value - 1);
      return true;
    },
    onFinish: finish,
  };

  return (
    <div className="hud-shell" ref={rootRef}>
      <div className="hud-top">
        <Button onClick={() => (phase === "playing" ? liveRoom ? setConfirm("quit") : setPhase("paused") : navigate("/play"))}>Back</Button>
        <strong>{game.title}</strong>
        <div>
          <Button aria-pressed={!muted} onClick={() => setMuted((value) => !value)}>
            {muted ? "Sound off" : "Sound on"}
          </Button>
          {phase === "playing" && !liveRoom ? <Button onClick={() => setPhase("paused")}>Pause</Button> : null}
          <Button
            onClick={() => {
              const node = rootRef.current;
              if (!node) return;
              if (!document.fullscreenElement) {
                void node.requestFullscreen?.();
                setFullscreen(true);
              } else {
                void document.exitFullscreen?.();
                setFullscreen(false);
              }
            }}
          >
            {fullscreen ? "Exit full" : "Fullscreen"}
          </Button>
        </div>
      </div>
      <div className="playfield">
        {phase === "idle" ? (
          <div className="overlay">
            <div className="panel" style={{ maxWidth: 480 }}>
              <h1 className="display" style={{ fontSize: 36 }}>
                {game.title}
              </h1>
              <p>{game.fantasy}</p>
              <ul>
                {game.howToPlay.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Button variant="primary" onClick={start}>
                Start
              </Button>
            </div>
          </div>
        ) : null}
        {phase === "playing" || phase === "paused" ? <Playfield game={game} api={api} paused={phase === "paused"} /> : null}
        {loadError ? (
          <div className="overlay">
            <div className="panel">
              <p>The game didn’t load.</p>
              <Button variant="primary" onClick={start}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
        {phase === "paused" ? (
          <div className="overlay">
            <div className="panel">
              <h2>Paused</h2>
              <div className="actions" style={{ flexDirection: "column" }}>
                <Button variant="primary" onClick={() => setPhase("playing")}>
                  Resume
                </Button>
                <Button onClick={() => setConfirm("restart")}>Restart</Button>
                <Button onClick={() => setMuted((v) => !v)}>{muted ? "Sound off" : "Sound on"}</Button>
                <p className="meta">{game.howToPlay.join(" ")}</p>
                <Button onClick={() => setConfirm("quit")}>Quit to arcade</Button>
              </div>
            </div>
          </div>
        ) : null}
        {phase === "results" && result ? (
          <div className="overlay">
            <div className="panel" style={{ minWidth: 280 }}>
              <h2>{game.title}</h2>
              {result.unsaved ? <p>Your score hasn’t synced yet. Try again.</p> : null}
              <p>Score {result.score}</p>
              <p>{result.stars} stars</p>
              {result.metric ? <p>{result.metric}</p> : null}
              <div className="actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    started.current = false;
                    setPhase("idle");
                  }}
                >
                  Play again
                </Button>
                <ButtonLink to="/games">Next game</ButtonLink>
                <ButtonLink to="/play">Back to arcade</ButtonLink>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {confirm ? (
        <Dialog
          title={confirm === "restart" ? "Restart this attempt?" : "Leave this attempt?"}
          onClose={() => setConfirm(null)}
        >
          <p>The current attempt will not be kept as a resume save.</p>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                if (confirm === "quit") navigate("/play");
                else {
                  started.current = false;
                  setPhase("idle");
                }
                setConfirm(null);
              }}
            >
              Confirm
            </Button>
            <Button onClick={() => setConfirm(null)}>Keep playing</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function Playfield({ game, api, paused }: { game: Game; api: GameAPI; paused: boolean }) {
  const shared = { api, paused };
  switch (game.slug) {
    case "kite-line":
      return <KiteLine {...shared} />;
    case "lantern-path":
      return <LanternPath {...shared} />;
    case "tide-tap":
      return <TideTap {...shared} />;
    case "paper-gharial":
      return <PaperGharial {...shared} />;
    case "rangoli-recall":
      return <RangoliRecall {...shared} />;
    case "two-player-fold":
      return <TwoPlayerFold {...shared} />;
    default:
      return <CollectionGame {...shared} />;
  }
}
