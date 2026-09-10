import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../db.js";
import { logger } from "../logger.js";
import { COLLECTION, ORIGINALS } from "../seed/catalog.js";
import { config } from "../config.js";

function scoreRules(sessionMinutes: number, maxScore: number) {
  return {
    min_score: 0,
    max_score: maxScore,
    min_duration_ms: 2500,
    max_duration_ms: sessionMinutes * 60 * 1000 * 3,
    max_score_per_second: maxScore > 10000 ? maxScore / 10 : null,
  };
}

export async function seed(): Promise<void> {
  await sql`
    INSERT INTO plans ${sql([
      {
        id: "wave",
        name: "Wave",
        monthly_paise: 39900,
        annual_paise: 383000,
        razorpay_plan_monthly: config.razorpay.plans.wave.monthly || null,
        razorpay_plan_annual: config.razorpay.plans.wave.annual || null,
        continue_cap: 1,
        benefits: sql.json(["Full catalog", "No ads", "Standard frames"]),
      },
      {
        id: "surge",
        name: "Surge",
        monthly_paise: 79900,
        annual_paise: 767000,
        razorpay_plan_monthly: config.razorpay.plans.surge.monthly || null,
        razorpay_plan_annual: config.razorpay.plans.surge.annual || null,
        continue_cap: 3,
        benefits: sql.json([
          "Everything in Wave",
          "Extra continues",
          "Weekly challenge cosmetics",
          "Early access to new games",
        ]),
      },
      {
        id: "tide",
        name: "Tide",
        monthly_paise: 149900,
        annual_paise: 1439000,
        razorpay_plan_monthly: config.razorpay.plans.tide.monthly || null,
        razorpay_plan_annual: config.razorpay.plans.tide.annual || null,
        continue_cap: 5,
        benefits: sql.json(["Everything in Surge", "Exclusive themes", "Tide badge", "Highest continue cap"]),
      },
    ])}
    ON CONFLICT (id) DO NOTHING
  `;

  const games = [
    ...ORIGINALS.map((game) => ({
      slug: game.slug,
      title: game.title,
      genre: game.genre,
      session_minutes: game.sessionMinutes,
      fantasy: game.fantasy,
      description: game.description,
      how_to_play: [...game.howToPlay],
      cover: game.cover,
      cover_alt: game.title,
      preview_alt: game.title,
      controls: { desktop: ["Keyboard or click"], touch: ["Tap the playfield"] },
      member_access: true,
      rotation_eligible: true,
      published: true,
      maintenance: false,
      is_new: false,
      maxScore: game.maxScore,
    })),
    ...COLLECTION.map((game) => ({
      slug: game.slug,
      title: game.title,
      genre: game.genre,
      session_minutes: game.sessionMinutes,
      fantasy: game.title,
      description: game.title,
      how_to_play: [],
      cover: `/covers/${game.slug}-cover.png`,
      cover_alt: game.title,
      preview_alt: game.title,
      controls: { desktop: [], touch: [] },
      member_access: true,
      rotation_eligible: true,
      published: true,
      maintenance: false,
      is_new: true,
      maxScore: game.maxScore,
    })),
  ];

  for (const game of games) {
    const { maxScore, how_to_play, controls, ...rest } = game;
    await sql`
      INSERT INTO games ${sql({ ...rest, how_to_play: sql.json(how_to_play), controls: sql.json(controls) })}
      ON CONFLICT (slug) DO NOTHING
    `;
    const rows = await sql<{ id: string }[]>`SELECT id FROM games WHERE slug = ${game.slug}`;
    const gameId = rows[0].id;
    const rules = scoreRules(game.session_minutes, maxScore);
    await sql`
      INSERT INTO game_score_rules ${sql({ game_id: gameId, ...rules })}
      ON CONFLICT (game_id) DO NOTHING
    `;
  }

  await sql`
    INSERT INTO cosmetics ${sql([
      { id: "frame-standard", kind: "frame", name: "Studio frame", requirement: "Included with Wave", artwork: "standard" },
      { id: "frame-lantern", kind: "frame", name: "Lantern edge", requirement: "Personal best in Lantern Path", artwork: "lantern" },
      { id: "theme-tide", kind: "theme", name: "Tide night", requirement: "Included with Tide", artwork: "tide" },
      { id: "theme-paper", kind: "theme", name: "Folded dusk", requirement: "Included with Tide", artwork: "paper" },
      { id: "badge-tide", kind: "badge", name: "Tide badge", requirement: "Included with Tide", artwork: "tide-badge" },
      { id: "badge-challenge", kind: "badge", name: "Weekly fold", requirement: "Weekly challenge cosmetic (Surge+)", artwork: "challenge" },
      { id: "trophy-first-flight", kind: "trophy", name: "First flight", requirement: "Finish a Kite Line session", artwork: "kite" },
      { id: "trophy-garden", kind: "trophy", name: "Garden wake", requirement: "Complete a Lantern Path puzzle", artwork: "lantern" },
      { id: "trophy-horizon", kind: "trophy", name: "Horizon tap", requirement: "Score 8 or more in Tide Tap", artwork: "tide" },
    ])}
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO achievement_defs ${sql([
      {
        id: "trophy-first-flight",
        title: "First flight",
        game_slug: "kite-line",
        rule: sql.json({ type: "accepted_play", game: "kite-line" }),
        cosmetic_id: "trophy-first-flight",
      },
      {
        id: "trophy-garden",
        title: "Garden wake",
        game_slug: "lantern-path",
        rule: sql.json({ type: "accepted_play", game: "lantern-path" }),
        cosmetic_id: "trophy-garden",
      },
      {
        id: "trophy-horizon",
        title: "Horizon tap",
        game_slug: "tide-tap",
        rule: sql.json({ type: "min_score", game: "tide-tap", n: 8 }),
        cosmetic_id: "trophy-horizon",
      },
    ])}
    ON CONFLICT (id) DO NOTHING
  `;

  const notes = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM content_notes`;
  if (Number(notes[0]?.n ?? 0) === 0) {
    await sql`
      INSERT INTO content_notes ${sql([
        {
          title: "Paper, light, and the five-minute world",
          type: "journal",
          status: "published",
          body: "Draft journal copy.",
        },
        {
          title: "Playing today’s free games",
          type: "help",
          status: "published",
          body: "Approved help draft.",
        },
      ])}
    `;
  }

  logger.info("seed complete");
}

const entrypoint = path.basename(process.argv[1] ?? "");
const isCli = entrypoint === "seed.ts" || entrypoint === "seed.js";
if (isCli) {
  seed()
    .then(() => sql.end())
    .catch((error) => {
      logger.error(error, "seed failed");
      process.exit(1);
    });
}
