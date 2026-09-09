import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { PRODUCT } from "../config/product";
import { useApp } from "../state/AppState";
import { ButtonLink } from "./ui";

function Item({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink to={to} end={to === "/" || to === "/play"}>
      {children}
    </NavLink>
  );
}

export function AppShell() {
  const { user, introDone, setIntroDone, settings, toasts, dismissToast } = useApp();
  const location = useLocation();
  const playing = location.pathname.startsWith("/play/") && location.pathname !== "/play";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reduced) setIntroDone();
    else {
      const timer = window.setTimeout(setIntroDone, 1100);
      return () => window.clearTimeout(timer);
    }
  }, [reduced, setIntroDone]);

  useEffect(() => {
    if (reduced || playing || !("IntersectionObserver" in window)) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".main .card, .main .panel, .main .steps article, .main .planned-card, .main .page-intro"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("reveal-pending");
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06 });
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

  return (
    <div className={`shell ${playing ? "playing" : ""} ${reduced ? "reduce-motion" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {!introDone ? (
        <div className="intro" role="img" aria-label="Bullwave Games">
          <img src="/brand/bullwave-mark.png" alt="" />
        </div>
      ) : null}
      {!playing ? (
        <header className={`header ${scrolled || location.pathname !== "/" ? "scrolled" : ""}`}>
          <div className="header-inner">
            <Link className="brand" to="/">
              <img src="/brand/bullwave-mark.png" alt="" />
              Bullwave Games
            </Link>
            <nav className="nav-desktop" aria-label="Primary">
              {user ? (
                <>
                  <Item to="/">Home</Item>
                  <Item to="/games">Games</Item>
                  <Item to="/challenges">Challenges</Item>
                  <Item to="/collection">Collection</Item>
                  <Item to="/membership">Membership</Item>
                  <div style={{ position: "relative" }}>
                    <button className="avatar" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                      {user.displayName.slice(0, 1).toUpperCase()}
                    </button>
                    {menuOpen ? (
                      <div className="menu" role="menu">
                        <Link to="/profile" onClick={() => setMenuOpen(false)}>
                          Profile
                        </Link>
                        <Link to="/billing" onClick={() => setMenuOpen(false)}>
                          Billing
                        </Link>
                        <Link to="/settings" onClick={() => setMenuOpen(false)}>
                          Settings
                        </Link>
                        <Link to="/help" onClick={() => setMenuOpen(false)}>
                          Help
                        </Link>
                        {user.role === "admin" ? (
                          <Link to="/admin" onClick={() => setMenuOpen(false)}>
                            Operations
                          </Link>
                        ) : null}
                        <Logout close={() => setMenuOpen(false)} />
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <Item to="/">Home</Item>
                  <Item to="/games">Games</Item>
                  <Item to="/membership">Membership</Item>
                  <Item to="/stories">Stories</Item>
                  <Item to="/login">Log in</Item>
                  <ButtonLink to="/games" variant="primary">
                    Play free
                  </ButtonLink>
                </>
              )}
            </nav>
          </div>
        </header>
      ) : null}

      <main id="main" className={`main ${playing ? "" : "has-tabbar"}`}>
        <Outlet />
      </main>

      {!playing ? (
        <footer className="footer">
          <div className="wrap footer-grid">
            <div>
              <h2>Studio</h2>
              <p>{PRODUCT.brand}</p>
              <p>{PRODUCT.legalEntity}</p>
              <p>{PRODUCT.domain}</p>
              <p>English · India</p>
            </div>
            <div>
              <h2>Play</h2>
              <Link to="/games">Games</Link>
              <Link to="/membership">Membership</Link>
              <Link to="/stories">Stories</Link>
              <Link to="/challenges">Challenges</Link>
            </div>
            <div>
              <h2>Help</h2>
              <Link to="/help">Help</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/billing">Billing</Link>
            </div>
            <div>
              <h2>Policies</h2>
              <Link to="/terms-and-conditions">Terms of Service</Link>
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/refund-and-cancellation-policy">Membership & Cancellation Policy</Link>
              <Link to="/shipping-and-delivery-policy">Shipping and Delivery</Link>
            </div>
          </div>
          <div className="wrap legal">Bullwave Games contains no wagering, betting, or cash-prize content. All games are for entertainment and skill-based enjoyment only. Draft policy pages are labeled as such.</div>
        </footer>
      ) : null}

      {!playing ? (
        <nav className="tabbar" aria-label="Mobile">
          <Item to="/">Home</Item>
          <Item to="/games">Games</Item>
          <Item to="/membership">Membership</Item>
          <Item to={user ? "/profile" : "/login"}>Profile</Item>
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

function Logout({ close }: { close: () => void }) {
  const { logout } = useApp();
  return (
    <button
      onClick={() => {
        logout();
        close();
      }}
    >
      Log out
    </button>
  );
}

