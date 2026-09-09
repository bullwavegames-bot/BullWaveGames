import { Link } from "react-router-dom";
import { useState } from "react";
import { formatInr, PLANS } from "../config/product";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { COLLECTION } from "../data/collection";
import { ButtonLink } from "../components/ui";

const categories = [
  { name: "Card & Board", subtitle: "Classic games, reimagined", symbol: "♠", color: "#d5aa50", games: ["Solitaire (Klondike)", "Spider Solitaire", "Rummy", "Ludo", "Chess", "Carrom"] },
  { name: "Puzzle", subtitle: "Sharpen your mind", symbol: "▦", color: "#61d6b0", games: ["Sudoku", "2048", "Crossword", "Wordle-style Word Guess", "Match-3", "Jigsaw Puzzle", "Memory / Matching Cards"] },
  { name: "Arcade & Skill", subtitle: "Fast fingers, faster fun", symbol: "↗", color: "#43c7e8", games: ["Snake Arena", "Blob Arena", "Endless Runner", "Aim Trainer / Reflex Clicker", "Tower Defense", "Racing Mini-Game", "Bubble Shooter"] },
  { name: "Trivia & Quiz", subtitle: "Test what you know", symbol: "?", color: "#a66acb", games: ["General Knowledge Quiz", "Sports Trivia", "Live Trivia Contest", "Bollywood / Movie Trivia"] },
  { name: "Strategy & Simulation", subtitle: "Build, grow, conquer", symbol: "♜", color: "#f1ad78", games: ["Idle City Builder", "Tycoon / Business Simulator", "Turn-Based Strategy"] },
  { name: "Multiplayer Party", subtitle: "Better with friends", symbol: "✦", color: "#f16f78", games: ["Draw & Guess", "Multiplayer Ludo Rooms", "Trivia Battle (1v1 or Teams)"] },
];
const features = [
  ["All published games", "Yes", "Yes", "Yes", "Yes"],
  ["Ads", "Yes", "Reduced", "Ad-free", "Ad-free"],
  ["Extra continues", "—", "Standard", "Extra", "Highest"],
  ["Early access to new releases", "—", "—", "Yes", "Yes"],
  ["Weekly cosmetics", "—", "Basic", "Yes", "Yes"],
  ["Exclusive visual themes", "—", "—", "—", "Yes"],
  ["Custom profile/avatar perks", "—", "Basic", "Enhanced", "Full"],
];

export function LandingPage() {
  const { games, settings } = useApp();
  const [motionPaused, setMotionPaused] = useState(false);
  const [category, setCategory] = useState(0);
  const [annual, setAnnual] = useState(false);
  const selected = categories[category];
  return (
    <div className={`landing offer-landing ${motionPaused || settings.reducedMotion ? "motion-paused" : ""}`}>
      <section className="hero arcade-hero">
        <div className="hero-art" aria-hidden="true"><img src="/covers/bullwave-neon-hero.png" alt="" fetchPriority="high" /><div className="hero-light" /></div>
        <div className="wrap hero-copy"><p className="kicker">Play. Relax. Repeat.</p><h1 className="display">Your Daily Dose of<br /><span>Chill, Skillful Fun</span></h1>
          <p className="lede">Original puzzle, reflex, rhythm, calm, and party games — play instantly in your browser, no downloads, no waiting.</p>
          <div className="actions"><ButtonLink to="/games" variant="primary">Start Playing Free ↗</ButtonLink><a className="btn btn-secondary" href="#plans">See Membership Plans</a></div>
        </div>
        <button className="motion-control" aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>{motionPaused ? "Resume effects" : "Pause effects"}</button>
      </section>
      <section className="wrap positioning" aria-label="Our promise"><div className="promise-bar">{["⊘ No Betting", "⊘ No Cash Prizes", "✓ 100% Skill & Fun", "✓ All Ages Welcome"].map((label) => <span key={label}>{label}</span>)}</div><p>Bullwave Games is a pure arcade experience — every game here is about skill, relaxation, and fun. No wagering, no deposits-to-win, no cash payouts.</p></section>

      <section className="section" id="discover"><div className="wrap">
        <div className="section-head"><div><p className="kicker">Find your kind of fun</p><h2 className="display">30+ Games. 6 Vibes. Endless Fun.</h2></div><span className="chip">36 playable games</span></div>
        <p className="meta">Explore solo challenges and shared room games. Every published game is free to play; membership adds optional profile, cosmetic, and convenience perks. Room games need at least two connected players.</p>
        <div className="category-tabs" role="tablist" aria-label="Game categories">{categories.map((item, index) => <button key={item.name} id={`category-${index}`} role="tab" aria-selected={category === index} aria-controls="category-panel" tabIndex={category === index ? 0 : -1} onClick={() => setCategory(index)} onKeyDown={(event) => {
          if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + categories.length) % categories.length;
          setCategory(next); document.getElementById(`category-${next}`)?.focus();
        }}><span aria-hidden="true">{item.symbol}</span>{item.name}</button>)}</div>
        <div id="category-panel" role="tabpanel" aria-labelledby={`category-${category}`}><div className="category-heading"><h3>{selected.subtitle}</h3><span className="meta">{selected.games.length} games</span></div>
          <div className="arcade-catalog">{games.filter(game=>game.published&&game.genre===selected.name&&COLLECTION.some(item=>item.slug===game.slug)).map(game=><GameCard key={game.slug} game={game}/>)}</div>
        </div>
        <div className="section-head playable-head"><div><p className="kicker">Ready when you are</p><h2 className="display">Play our originals today</h2></div><Link className="catalog-link" to="/games">View playable games →</Link></div>
        <div className="arcade-catalog">{games.filter((game) => game.published&&!COLLECTION.some(item=>item.slug===game.slug)).map((game) => <GameCard key={game.slug} game={game} />)}</div>
      </div></section>

      <section className="section" id="plans"><div className="wrap"><div className="section-head"><div><p className="kicker">A little more play, your way</p><h2 className="display">Find your wave.</h2></div><div className="billing-toggle" aria-label="Billing period"><button aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button><button aria-pressed={annual} onClick={() => setAnnual(true)}>Annual <span>Save 20%*</span></button></div></div>
        <p className="meta">Plan preview: the benefits below are proposed. *Annual prices show an illustrative 20% discount; annual billing is not available yet. Review current benefits before joining.</p>
        <div className="plan-comparison" role="region" aria-label="Compare membership plans" tabIndex={0}><table><caption className="sr-only">Proposed Free, Wave, Surge, and Tide membership benefits</caption><thead><tr><th scope="col">Your membership</th><th scope="col"><h3>Free</h3><div className="price">₹0</div><p className="meta">All published games</p><ButtonLink to="/games">Play Free</ButtonLink></th>
          {PLANS.map((plan) => <th scope="col" key={plan.id} className={plan.id === "surge" ? "highlight-plan" : ""}><h3>{plan.name}</h3><div className="price">{formatInr(Math.round(plan.monthlyPriceInr * (annual ? 0.8 : 1)))}</div><p className="meta">/ month{annual ? ` · ${formatInr(Math.round(plan.monthlyPriceInr * 12 * 0.8))}/year*` : ""}</p><ButtonLink to={`/membership?plan=${plan.id}`} variant={plan.id === "surge" ? "primary" : "secondary"}>Get {plan.name}</ButtonLink></th>)}
        </tr></thead><tbody>{features.map(([feature, ...values]) => <tr key={feature}><th scope="row">{feature}</th>{values.map((value, index) => <td key={index} className={index === 2 ? "highlight-plan" : ""}>{value === "Yes" ? <span className="feature-check" aria-label="Included">✓</span> : value}</td>)}</tr>)}</tbody></table></div>
      </div></section>

      <section className="section"><div className="wrap"><div className="section-head"><div><p className="kicker">Made for your everyday escape</p><h2 className="display">Good games. Great little breaks.</h2></div><span className="chip">Sample social proof</span></div>
        <div className="social-grid"><article className="panel community-stat"><span className="price">50,000+</span><h3>games played this week</h3><p className="meta">Placeholder statistic — live activity data is not connected.</p></article>{["Perfect for a quick break between work.", "A little puzzle, a little calm. Just what my day needed."].map((quote) => <figure className="panel testimonial" key={quote}><div className="stars" aria-label="Sample five-star rating">★★★★★</div><blockquote>“{quote}”</blockquote><figcaption className="meta">Illustrative testimonial · not a verified review</figcaption></figure>)}</div>
        <div className="leaderboard-teaser"><div><p className="kicker">Trivia Battle · Play with friends</p><h3>Who will top your room’s leaderboard?</h3><p className="meta">Create a shared quiz room and compete individually or in teams. Scores are live within your room.</p></div><ButtonLink to="/games/trivia-battle">Explore Trivia Battle →</ButtonLink></div>
      </div></section>

      <section className="section"><div className="wrap arcade-how"><p className="kicker">Three steps. You’re in.</p><h2 className="display">How it works</h2><div className="steps" style={{ marginTop: 24 }}>
        <article><span className="step-number">01</span><h3>Sign up in seconds</h3><p>Create your profile to save progress. Just browsing? Play any published game as a guest.</p><Link to="/register">Create an account →</Link></article>
        <article><span className="step-number">02</span><h3>Pick your kind of fun</h3><p>Choose cards, puzzles, arcade challenges, trivia, strategy, or a room game with friends.</p><a href="#discover">Explore the collection →</a></article>
        <article><span className="step-number">03</span><h3>Play instantly</h3><p>Right in your browser. No downloads or waiting — just a little time for yourself.</p><Link to="/games">Start playing free →</Link></article>
      </div></div></section>
      <section className="wrap final-play"><p className="kicker">Your next favorite break is here</p><h2 className="display">A little chill. A little challenge.</h2><ButtonLink to="/games" variant="primary">Start Playing Free ↗</ButtonLink></section>
    </div>
  );
}
