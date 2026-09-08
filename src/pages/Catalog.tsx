import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GAMES } from "../data/games";
import { isFreeToday } from "../lib/time";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { PageIntro } from "../components/PageIntro";
import { Button, EmptyState, ErrorPanel, SkeletonCard } from "../components/ui";
import type { Genre } from "../types";

const GENRES: Array<"All" | Genre> = ["All", "Card & Board", "Puzzle", "Arcade & Skill", "Trivia & Quiz", "Strategy & Simulation", "Multiplayer Party", "Reflex", "Rhythm", "Party", "Calm"];

export function CatalogPage() {
  const { games } = useApp();
  const [params, setParams] = useSearchParams();
  const [loading] = useState(false);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState(false);
  const q = params.get("q") ?? "";
  const genre = (params.get("genre") as Genre | "All") || "All";
  const availability = params.get("availability") ?? "all";
  const sort = params.get("sort") ?? "new";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "All" || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const results = useMemo(() => {
    let list = [...(games.length ? games : GAMES)].filter((game) => game.published);
    if (q) list = list.filter((game) => game.title.toLowerCase().includes(q.toLowerCase()));
    if (genre !== "All") list = list.filter((game) => game.genre === genre);
    if (availability === "free-today") list = list.filter((game) => isFreeToday(game.slug));
    if (availability === "members") list = list.filter((game) => !isFreeToday(game.slug));
    if (sort === "short") list.sort((a, b) => a.sessionMinutes - b.sessionMinutes);
    if (sort === "popular") list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "new") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [games, q, genre, availability, sort]);

  const filters = (
    <>
      <label className="field" style={{ minWidth: 220 }}>
        <span className="meta">Search by title</span>
        <input value={q} onChange={(event) => set("q", event.target.value)} placeholder="Search games" />
      </label>
      <div className="filters" aria-label="Genre">
        {GENRES.map((item) => (
          <button key={item} type="button" aria-pressed={(genre || "All") === item} onClick={() => set("genre", item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="filters" aria-label="Availability">
        {[
          ["all", "All games"],
          ["free-today", "Free today"],
          ["members", "Members"],
        ].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={availability === value || (value === "all" && !params.get("availability"))} onClick={() => set("availability", value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="filters" aria-label="Sort">
        {[
          ["new", "New"],
          ["popular", "Popular"],
          ["short", "Short session"],
        ].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={sort === value} onClick={() => set("sort", value)}>
            {label}
          </button>
        ))}
      </div>
      {sort === "popular" ? <p className="meta">Popular ordering is sample prototype data — not live aggregate play.</p> : null}
    </>
  );

  return (
    <div className="section">
      <div className="wrap">
        <PageIntro eyebrow="The Bullwave arcade" title="Find your next five-minute escape." description="A little focus, a quick challenge, or a moment of calm. Find a game that fits your mood.">
          <div className="intro-perks"><span>↗ Instant browser play</span><span>✦ Original worlds</span><span>✓ No cash stakes</span></div>
        </PageIntro>
        <div className="desktop-only catalog-filter-panel" style={{ marginTop: 20 }}>
          {filters}
        </div>
        <div style={{ marginTop: 16 }} className="tabbar-filters">
          <Button className="hide-desktop" onClick={() => setSheet(true)}>
            Filters
          </Button>
        </div>
        <p className="meta">
          {results.length} game{results.length === 1 ? "" : "s"}
          {availability === "free-today" ? " · Free today" : ""}
          {genre !== "All" ? ` · ${genre}` : ""}
        </p>
        {error ? <ErrorPanel message="We couldn’t load your games. Try again." onRetry={() => setError(false)} /> : null}
        {loading ? (
          <div className="grid-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No games match these filters."
            action={
              <Button variant="primary" onClick={() => setParams({})}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid-3" style={{ marginTop: 20 }}>
            {results.map((game) => (
              <GameCard
                key={game.slug}
                game={game}
                availability={isFreeToday(game.slug) ? "Free today" : "Members"}
                locked={!isFreeToday(game.slug)}
              />
            ))}
          </div>
        )}
      </div>
      {sheet ? (
        <div className="dialog-root" onClick={() => setSheet(false)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filters">
            {filters}
            <Button variant="primary" className="btn-full" onClick={() => setSheet(false)}>
              Show {results.length} games
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
