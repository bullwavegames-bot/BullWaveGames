import { Link, useNavigate } from "react-router-dom";
import { formatInr, PLANS, PRODUCT } from "../config/product";
import { checkoutPath } from "../lib/access";
import { todaysRotation } from "../lib/time";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { Button, ButtonLink, Notice } from "../components/ui";

export function LandingPage() {
  const { games, setSelectedPlan, user } = useApp();
  const navigate = useNavigate();
  const rotation = todaysRotation().filter((game) => games.some((item) => item.slug === game.slug));
  return (
    <>
      <section className="hero">
        <div className="hero-art">
          <img src="/covers/lantern-path-hero.png" alt="Warm lanterns over a sleeping garden path." />
        </div>
        <div className="wrap hero-copy">
          <p className="kicker">Bullwave Games</p>
          <h1 className="display">Small sessions. Beautiful worlds.</h1>
          <p className="lede" style={{ marginTop: 18 }}>
            Play original browser games. Membership unlocks the studio.
          </p>
          <div className="actions">
            <ButtonLink to="/games?availability=free-today" variant="primary">
              Play today’s free games
            </ButtonLink>
            <ButtonLink to="/membership">See membership</ButtonLink>
          </div>
        </div>
      </section>
      <div className="wrap">
        <div className="trust" aria-label="Trust">
          <span>All ages</span>
          <span>Instant in browser</span>
          <span>No download</span>
          <span>No real-money prizes</span>
        </div>
      </div>
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="kicker">This week in the studio</p>
              <h2 className="display">Three rooms, ready now</h2>
            </div>
          </div>
          {rotation.length ? (
            <div className="grid-3">
              {rotation.map((game) => (
                <GameCard key={game.slug} game={game} availability="Free today" />
              ))}
            </div>
          ) : (
            <div className="error-panel panel">
              We couldn’t load your games. Try again.
              <div style={{ marginTop: 12 }}>
                <Link to="/games">Open catalog</Link>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2 className="display">How it works</h2>
          <div className="steps" style={{ marginTop: 24 }}>
            <article>
              <h3>1. Discover today’s free three</h3>
              <p>Each Kolkata day, three original games are open to play, subject to a session allowance.</p>
            </article>
            <article>
              <h3>2. Play instantly in your browser</h3>
              <p>No app. Typical sessions last 5–12 minutes. Sound stays muted until you ask for it.</p>
            </article>
            <article>
              <h3>3. Join a membership to unlock the studio</h3>
              <p>An account saves progress. It is not required for the guest trial.</p>
            </article>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="kicker">Membership</p>
              <h2 className="display">Unlock the studio.</h2>
            </div>
          </div>
          <div className="grid-3">
            {PLANS.map((plan) => (
              <article key={plan.id} className={`card plan ${plan.id === "surge" ? "featured" : ""}`}>
                <h3>{plan.name}</h3>
                <div className="price">
                  {formatInr(plan.monthlyPriceInr)}
                  <span>/ month</span>
                </div>
                <ul>
                  {plan.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {user ? (
                  <Button
                    variant="primary"
                    className="btn-full"
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      navigate(checkoutPath(plan.id));
                    }}
                  >
                    Pay {formatInr(plan.monthlyPriceInr)}
                  </Button>
                ) : (
                  <ButtonLink
                    to={`/register?plan=${plan.id}&return=${encodeURIComponent(checkoutPath(plan.id))}`}
                    variant="primary"
                    className="btn-full"
                  >
                    Join {plan.name}
                  </ButtonLink>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap panel">
          <h2 className="display" style={{ fontSize: 36 }}>
            A boutique arcade, not a casino
          </h2>
          <p>
            Original games, thoughtful art, and short sessions. Stars, frames, and personal bests stay inside play. They
            have no monetary value.
          </p>
          <Notice>
            Prototype note: catalog cards on this page use today’s computed rotation in {PRODUCT.timezone}. Sample editorial
            framing is labeled where used.
          </Notice>
        </div>
      </section>
    </>
  );
}
