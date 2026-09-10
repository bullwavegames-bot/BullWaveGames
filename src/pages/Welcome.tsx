import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatInr, PLANS } from "../config/product";
import { AVATAR_SKINS } from "../lib/avatar";
import { allowlistReturn, alwaysFreeGames, planFromQuery } from "../lib/access";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/AuthContext";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { HeroParticles } from "../components/HeroParticles";
import { Button, Field, TextInput } from "../components/ui";
import type { PlanId } from "../types";

const PERKS = [
  { id: "short", mark: "⏱", title: "Five-minute runs", copy: "Slip in a puzzle or a reflex burst between other things." },
  { id: "instant", mark: "↗", title: "Instant play", copy: "No install, no queue. Open a game and you are already in." },
  { id: "browser", mark: "✦", title: "In the browser", copy: "Phone or laptop — the arcade lives where you already are." },
  { id: "fair", mark: "✓", title: "No coins, no stakes", copy: "Stars and cosmetics stay cosmetic. Membership is a flat subscription." },
];

const SKIN_BLURB: Record<string, string> = {
  kite: "Coastal wind, paper line.",
  lantern: "Warm light on folded dusk.",
  tide: "Moonlit water, quiet taps.",
  gharial: "River grit, slow grin.",
  rangoli: "Powder geometry, festival night.",
  fold: "Two players, one sheet.",
};

const STEP_ART = [
  "/covers/kite-line-cover.png",
  "/covers/lantern-path-cover.png",
  "/covers/rangoli-recall-cover.png",
];

const stepEase = [0.22, 1, 0.36, 1] as const;

export function WelcomePage() {
  const { completeOnboarding, avatars, user } = useAuth();
  const { games, setSelectedPlan, settings } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reducePref = useReducedMotion();
  const reduce = Boolean(reducePref) || settings.reducedMotion;
  const returnTo = allowlistReturn(params.get("return"), "/play");
  const rotation = alwaysFreeGames(games);
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(user?.displayName ?? "");
  const [avatar, setAvatar] = useState(user?.avatarId ?? "lantern");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [perk, setPerk] = useState(PERKS[0].id);
  const [featured, setFeatured] = useState(0);
  const [peekPlan, setPeekPlan] = useState<PlanId | null>(planFromQuery(params.get("plan")));
  const motionOff = reduce || paused;

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
    if (user?.avatarId) setAvatar(user.avatarId);
  }, [user?.displayName, user?.avatarId]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setError("");
    setStep(next);
  };

  const finish = async () => {
    if (name.trim() && name.trim().length < 2) return setError("Use at least two characters, or leave the default.");
    setBusy(true);
    const result = await completeOnboarding(name.trim() || user?.displayName || "Player", avatar);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const plan = peekPlan ?? planFromQuery(params.get("plan"));
    if (plan) setSelectedPlan(plan);
    navigate(returnTo);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (step < 3) {
        event.preventDefault();
        go(step + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const variants = {
    enter: (d: number) => (motionOff ? { opacity: 1 } : { opacity: 0, x: d * 56, filter: "blur(8px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    leave: (d: number) => (motionOff ? { opacity: 0 } : { opacity: 0, x: d * -48, filter: "blur(8px)" }),
  };

  const hello = (name || user?.displayName || "").trim();
  const skin = AVATAR_SKINS[avatar];
  const star = rotation[featured] ?? rotation[0];

  return (
    <div className={`welcome-stage welcome-step-${step}${motionOff ? " is-still" : ""}`}>
      <div className="welcome-bg" aria-hidden="true">
        <img src={STEP_ART[step - 1]} alt="" />
        <HeroParticles paused={motionOff} />
        <div className="welcome-wash" />
        <span className="welcome-orb welcome-orb-a" />
        <span className="welcome-orb welcome-orb-b" />
        <span className="welcome-orb welcome-orb-c" />
      </div>

      <header className="welcome-top">
        <div className="welcome-brand">
          <img src="/brand/bullwave-mark.png" alt="" />
          <span>Bullwave</span>
        </div>
        <ol className="welcome-rail" aria-label="Onboarding steps">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <button
                type="button"
                className={step === n ? "is-current" : step > n ? "is-done" : ""}
                aria-current={step === n ? "step" : undefined}
                onClick={() => go(n)}
              >
                <span>{n}</span>
                {n === 1 ? "Welcome" : n === 2 ? "Play" : "You"}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="welcome-pause" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </header>
      <div className="welcome-progress" aria-hidden="true">
        <i style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className="welcome-body">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={step}
            className="welcome-panel"
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="leave"
            transition={{ duration: motionOff ? 0.01 : 0.45, ease: stepEase }}
          >
            {step === 1 ? (
              <div className="welcome-split">
                <div className="welcome-copy">
                  <p className="kicker">Step 1 of 3</p>
                  <h1 className="display">
                    Welcome to your
                    <br />
                    <span>browser arcade.</span>
                  </h1>
                  <p className="welcome-lede">
                    {hello ? `Hey ${hello.split(" ")[0]}. ` : ""}
                    Short sessions. Instant play. No download. No stakes.
                  </p>
                  <ul className="welcome-promise">
                    <li>Always-free originals</li>
                    <li>No wallet, no betting</li>
                    <li>Ready in the tab</li>
                  </ul>
                </div>
                <div className="welcome-perks">
                  {PERKS.map((item, index) => (
                    <motion.button
                      key={item.id}
                      type="button"
                      className={`welcome-perk${perk === item.id ? " is-on" : ""}`}
                      aria-pressed={perk === item.id}
                      onClick={() => setPerk(item.id)}
                      initial={motionOff ? false : { opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: motionOff ? 0 : 0.08 + index * 0.06, duration: 0.42 }}
                      whileHover={motionOff ? undefined : { y: -6 }}
                      whileTap={motionOff ? undefined : { scale: 0.98 }}
                    >
                      <span className="welcome-perk-mark">{item.mark}</span>
                      <strong>{item.title}</strong>
                      <em>{item.copy}</em>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <>
                <div className="welcome-copy welcome-copy-wide">
                  <p className="kicker">Step 2 of 3</p>
                  <h1 className="display">
                    Free stays <span>free.</span>
                  </h1>
                  <p className="welcome-lede">
                    Eight games stay free with no play cap. Every other title includes 5 free plays, then Wave from {formatInr(399)} / month unlocks the studio.
                  </p>
                </div>
                {star ? (
                  <div className="welcome-showcase">
                    <motion.article
                      key={star.slug}
                      className="welcome-hero-card"
                      initial={motionOff ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <img src={star.cover} alt="" />
                      <div>
                        <p className="welcome-chip">Always free</p>
                        <h2>{star.title}</h2>
                        <p>{star.fantasy}</p>
                        <small>
                          {star.sessionMinutes} min · {star.genre}
                        </small>
                      </div>
                    </motion.article>
                    <div className="welcome-thumbs" aria-label="Always-free games">
                      {rotation.map((game, index) => (
                        <motion.button
                          key={game.slug}
                          type="button"
                          className={`welcome-thumb${featured === index ? " is-front" : ""}`}
                          onClick={() => setFeatured(index)}
                          aria-pressed={featured === index}
                          whileHover={motionOff ? undefined : { y: -4 }}
                        >
                          <img src={game.cover} alt="" />
                          <span>{game.title}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="welcome-plans">
                  {PLANS.map((plan) => (
                    <motion.button
                      key={plan.id}
                      type="button"
                      className={`welcome-plan welcome-plan-${plan.id}${peekPlan === plan.id ? " is-on" : ""}${plan.id === "surge" ? " is-featured" : ""}`}
                      aria-pressed={peekPlan === plan.id}
                      onClick={() => {
                        setPeekPlan(plan.id);
                        setSelectedPlan(plan.id);
                      }}
                      whileHover={motionOff ? undefined : { y: -6 }}
                    >
                      {plan.id === "surge" ? <p className="welcome-chip">Most chosen</p> : null}
                      <strong>{plan.name}</strong>
                      <b>{formatInr(plan.monthlyPriceInr)}</b>
                      <em>/ month</em>
                      <ul>
                        {plan.benefits.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </motion.button>
                  ))}
                </div>
                <p className="meta welcome-fan-note">Tap a plan to remember it — you can subscribe later. Free play does not need a card.</p>
              </>
            ) : null}

            {step === 3 ? (
              <div className="welcome-you">
                <div>
                  <p className="kicker">Step 3 of 3</p>
                  <h1 className="display">
                    Make it <span>yours.</span>
                  </h1>
                  <p className="welcome-lede">Pick a skin. Name yourself. You can change both later from Profile.</p>
                  <Field label="Display name" error={error}>
                    <TextInput
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void finish();
                        }
                      }}
                    />
                  </Field>
                  <p className="welcome-skin-label">Character skin</p>
                  <div className="welcome-skins">
                    {avatars.map((id) => {
                      const item = AVATAR_SKINS[id];
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          className={`welcome-skin${avatar === id ? " is-on" : ""}`}
                          aria-pressed={avatar === id}
                          onClick={() => setAvatar(id)}
                          style={{ "--skin": item?.tint ?? "#61d6b0" } as CSSProperties}
                          whileHover={motionOff ? undefined : { scale: 1.04, y: -4 }}
                          whileTap={motionOff ? undefined : { scale: 0.96 }}
                        >
                          <span>{item?.glyph ?? "•"}</span>
                          {item?.label ?? id}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <motion.aside
                  className="welcome-preview"
                  style={{ "--skin": skin?.tint ?? "#61d6b0" } as CSSProperties}
                  animate={motionOff ? undefined : { y: [0, -8, 0] }}
                  transition={motionOff ? undefined : { repeat: Infinity, duration: 5, ease: "easeInOut" }}
                >
                  <div className="welcome-preview-ring" aria-hidden="true" />
                  <PlayerAvatar name={name || "Player"} avatarId={avatar} size={148} framed />
                  <p className="welcome-chip">Player card</p>
                  <h2>{name.trim() || "Player"}</h2>
                  <p>{skin?.label ?? avatar}</p>
                  <p className="meta">{SKIN_BLURB[avatar] ?? "A studio original."}</p>
                </motion.aside>
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="welcome-foot">
        {error && step !== 3 ? <p className="error">{error}</p> : null}
        <div className="welcome-actions">
          {step > 1 ? (
            <Button onClick={() => go(step - 1)} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button variant="primary" className="welcome-go" onClick={() => go(step + 1)}>
              Continue
            </Button>
          ) : (
            <div className="welcome-actions-end">
              <Button disabled={busy} onClick={() => void finish()}>
                Skip cosmetics
              </Button>
              <Button variant="primary" className="welcome-go" disabled={busy} onClick={() => void finish()}>
                {busy ? "Saving…" : "Enter the arcade"}
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
