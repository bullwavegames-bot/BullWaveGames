import { useEffect, useLayoutEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconBook2,
  IconChartBar,
  IconDeviceGamepad2,
  IconFlame,
  IconHelp,
  IconHome,
  IconSettings,
  IconSparkles,
  IconStack2,
  IconTool,
  IconTrophy,
  IconUsers,
  IconWaveSine,
} from "@tabler/icons-react";
import { PRODUCT } from "../config/product";
import { useApp } from "../state/AppState";
import { AccountMenu } from "./AccountMenu";
import { PlanChip } from "./PlanChip";
import { ButtonLink } from "./ui";

function ScrollToTop() {
  const location = useLocation();
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);
  return null;
}

function Item({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end ?? (to === "/" || to === "/play")}>
      {children}
    </NavLink>
  );
}

function GamesSubLink({ to, sort, children }: { to: string; sort: string | null; children: ReactNode }) {
  const location = useLocation();
  const current = new URLSearchParams(location.search).get("sort");
  const active = location.pathname === "/games" && current === sort;
  return (
    <NavLink to={to} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
      {children}
    </NavLink>
  );
}

export function AppShell() {
  const { user, introDone, setIntroDone, settings, toasts, dismissToast, entitlement } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const playing = location.pathname.startsWith("/play/") && location.pathname !== "/play";
  const authPath = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/welcome"].includes(
    location.pathname,
  );
  const studio = Boolean(user) && !playing && !authPath;
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const reduced = settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reduced || playing) setIntroDone();
    else {
      const timer = window.setTimeout(setIntroDone, 5000);
      return () => window.clearTimeout(timer);
    }
  }, [playing, reduced, setIntroDone]);

  useEffect(() => {
    if (reduced || playing || !("IntersectionObserver" in window)) return;
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".main .card, .main .panel, .main .steps article, .main .planned-card, .main .page-intro"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-pending");
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06 },
    );
    elements.forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 4) * 55}ms`);
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add("reveal-pending");
      observer.observe(element);
    });
    return () => {
      observer.disconnect();
      elements.forEach((element) => element.classList.remove("reveal-pending", "reveal-in"));
    };
  }, [location.pathname, reduced, playing]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    navigate(next ? `/games?q=${encodeURIComponent(next)}` : "/games");
  };

  return (
    <div className={`shell ${playing ? "playing" : ""} ${studio ? "studio" : ""} ${reduced ? "reduce-motion" : ""}`}>
      <ScrollToTop />
      <a className="skip" href="#main">
        Skip to content
      </a>
      {!introDone ? (
        <div className="intro" role="dialog" aria-label="Welcome to Bullwave Games">
          <div className="intro-grid" aria-hidden="true" />
          <div className="intro-orbit intro-orbit-one" aria-hidden="true" />
          <div className="intro-orbit intro-orbit-two" aria-hidden="true" />
          <div className="intro-content">
            <div className="intro-mark-wrap" aria-hidden="true">
              <span className="intro-pulse" />
              <img src="/brand/bullwave-mark.png" alt="" />
            </div>
            <p className="intro-kicker">Original games · everyday escapes</p>
            <h1><span>Bullwave</span> Games</h1>
            <p className="intro-tagline">Play the wave.</p>
            <div className="intro-loader" aria-hidden="true"><span /></div>
          </div>
          <button className="intro-skip" onClick={setIntroDone}>Skip intro</button>
        </div>
      ) : null}

      {studio ? (
        <aside className="studio-sidebar" aria-label="Studio">
          <Link className="brand" to="/play">
            <img src="/brand/bullwave-mark.png" alt="" />
            Bullwave
          </Link>
          <nav>
            <NavLink to="/play" end>
              <IconHome size={18} stroke={1.7} />
              Home
            </NavLink>
            <NavLink to="/games">
              <IconDeviceGamepad2 size={18} stroke={1.7} />
              Games
            </NavLink>
            <div className="studio-sidebar-sub">
              <GamesSubLink to="/games?sort=new" sort="new">
                <IconSparkles size={16} stroke={1.7} />
                New
              </GamesSubLink>
              <GamesSubLink to="/games?sort=popular" sort="popular">
                <IconChartBar size={16} stroke={1.7} />
                Popular
              </GamesSubLink>
            </div>
            <NavLink
              to="/challenges"
              className={() =>
                location.pathname === "/challenges" ||
                location.pathname.startsWith("/challenges/") ||
                location.pathname === "/leaderboards"
                  ? "is-active"
                  : undefined
              }
            >
              <IconTrophy size={18} stroke={1.7} />
              Challenges
            </NavLink>
            <div className="studio-sidebar-sub">
              <NavLink to="/challenges/daily">
                <IconFlame size={16} stroke={1.7} />
                Daily Challenge
              </NavLink>
              <NavLink to="/leaderboards">
                <IconChartBar size={16} stroke={1.7} />
                Leaderboards
              </NavLink>
            </div>
            <NavLink to="/collection">
              <IconStack2 size={18} stroke={1.7} />
              Collection
            </NavLink>
            <NavLink to="/friends">
              <IconUsers size={18} stroke={1.7} />
              Friends
              <span className="nav-soon">Play soon</span>
            </NavLink>
            <NavLink to="/stories">
              <IconBook2 size={18} stroke={1.7} />
              Stories
            </NavLink>
            <NavLink to="/membership">
              <IconWaveSine size={18} stroke={1.7} />
              Membership
            </NavLink>
            {user?.role === "admin" ? (
              <NavLink to="/admin">
                <IconTool size={18} stroke={1.7} />
                Admin
              </NavLink>
            ) : null}
            <div className="studio-sidebar-rule" />
            <NavLink to="/help">
              <IconHelp size={18} stroke={1.7} />
              Help
            </NavLink>
            <NavLink to="/settings">
              <IconSettings size={18} stroke={1.7} />
              Settings
            </NavLink>
          </nav>
        </aside>
      ) : null}

      {!playing && !authPath ? (
        <header className={`header ${scrolled || location.pathname !== "/" || studio ? "scrolled" : ""} ${studio ? "studio-top" : ""}`}>
          <div className="header-inner">
            {studio ? (
              <>
                <form className="studio-search" onSubmit={search} role="search">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search games"
                    aria-label="Search games"
                  />
                </form>
                <div className="studio-top-actions">
                  <PlanChip entitlement={entitlement} />
                  {user ? <AccountMenu user={user} /> : null}
                </div>
              </>
            ) : (
              <>
                <Link className="brand" to="/">
                  <img src="/brand/bullwave-mark.png" alt="" />
                  Bullwave Games
                </Link>
                <nav className="nav-desktop" aria-label="Primary">
                  <Item to="/">Home</Item>
                  <Item to="/games">Games</Item>
                  <Item to="/membership">Membership</Item>
                  <Item to="/login">Log in</Item>
                  <ButtonLink to="/games" variant="primary">
                    Play free games
                  </ButtonLink>
                </nav>
              </>
            )}
          </div>
        </header>
      ) : null}

      <main id="main" className={`main ${playing || authPath ? "" : "has-tabbar"} ${studio ? "studio-main" : ""}`}>
        <Outlet />
      </main>

      {!playing && !authPath ? (
        <footer className="footer">
          <div className="wrap footer-grid">
            <div>
              <h2>Studio</h2>
              <p>{PRODUCT.brand}</p>
              <p>{PRODUCT.legalEntity}</p>
              <p>{PRODUCT.domain}</p>
              <p>English · India · 18+</p>
            </div>
            <div>
              <h2>Play</h2>
              <Link to="/games">Games</Link>
              <Link to="/membership">Membership</Link>
              <Link to="/play">Arcade home</Link>
              <Link to="/challenges/daily">Daily challenge</Link>
              <Link to="/leaderboards">Leaderboards</Link>
            </div>
            <div>
              <h2>Account</h2>
              <Link to="/help">Help</Link>
              <Link to="/billing">Billing</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/friends">Friends</Link>
              <Link to="/settings">Settings</Link>
            </div>
            <div>
              <h2>Legal</h2>
              <Link to="/contact">Contact</Link>
              <Link to="/terms-and-conditions">Terms</Link>
              <Link to="/privacy-policy">Privacy</Link>
              <Link to="/refund-and-cancellation-policy">Refund</Link>
              <Link to="/shipping-and-delivery-policy">Shipping</Link>
            </div>
          </div>
          <div className="wrap legal">
            Bullwave Games contains no wagering, betting, or cash-prize content. Membership is a flat INR subscription. Digital
            delivery only — access is added to the signed-in account.
          </div>
        </footer>
      ) : null}

      {!playing && !authPath ? (
        <nav className="tabbar" aria-label="Mobile">
          {user ? (
            <>
              <Item to="/play">Home</Item>
              <Item to="/games">Games</Item>
              <Item to="/membership">Membership</Item>
              <Item to="/profile">Profile</Item>
            </>
          ) : (
            <>
              <Item to="/">Home</Item>
              <Item to="/games">Games</Item>
              <Item to="/membership">Membership</Item>
              <Item to="/login">Profile</Item>
            </>
          )}
        </nav>
      ) : null}

      <div className="toast-wrap" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            {item.text}
            <button className="btn btn-ghost" style={{ minHeight: 32, marginLeft: 8 }} onClick={() => dismissToast(item.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
