import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ButtonLink } from "../components/ui";
import { PRODUCT } from "../config/product";

function PolicyLayout({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="section">
      <div className="wrap split">
        <aside className="toc panel">
          <strong>On this page</strong>
          <a href={`#${id}-eligibility`}>Overview</a>
          <a href={`#${id}-contact`}>Contact</a>
        </aside>
        <article className="article">
          <h1 className="display">{title}</h1>
          <p className="meta">Last updated: date pending approved legal content.</p>
          <p className="notice">Draft placeholder. This page is not a claim of legal completeness.</p>
          {children}
          <h2 id={`${id}-contact`}>Contact</h2>
          <p>
            Questions: <Link to="/contact">Contact support</Link>. Legal entity: {PRODUCT.legalEntity}.
          </p>
        </article>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <PolicyLayout title="Terms and Conditions" id="terms">
      <h2 id="terms-eligibility">Eligibility, accounts, and play</h2>
      <p>Bullwave Games is an India-first browser arcade. Accounts store progress, collection items, and billing email. Guest play of the daily free rotation is allowed subject to a session allowance.</p>
      <p>Permitted use is personal, non-commercial play of original browser games. Membership unlocks catalog access as configured. Games may be unavailable for maintenance.</p>
      <p>Scores, stars, cosmetics, and personal bests have no monetary value and cannot be withdrawn.</p>
    </PolicyLayout>
  );
}

export function PrivacyPage() {
  return (
    <PolicyLayout title="Privacy Policy" id="privacy">
      <h2 id="privacy-eligibility">What this prototype stores</h2>
      <p>This frontend prototype stores account, play, and preference data in the browser. A live service must describe only actual collection and processing.</p>
      <p>Do not treat this draft as a complete privacy notice. Payment card data is never requested in Bullwave forms.</p>
    </PolicyLayout>
  );
}

export function RefundPage() {
  return (
    <PolicyLayout title="Refund and Cancellation Policy" id="refund">
      <h2 id="refund-eligibility">Membership payments</h2>
      <p>Refund eligibility follows approved policy and the payment provider. This prototype does not invent guarantees or processing times.</p>
      <p>
        {PRODUCT.prototype.autoRenewalEnabled
          ? "If renewal is enabled, cancellation keeps access until the stated date and has no extra fee."
          : "Automatic renewal is not enabled in the current configuration. Access expires at the end of the stated period."}
      </p>
      <p>Account deletion does not itself issue a refund.</p>
    </PolicyLayout>
  );
}

export function ShippingPage() {
  return (
    <PolicyLayout title="Shipping and Delivery Policy" id="ship">
      <h2 id="ship-eligibility">Digital delivery</h2>
      <p>Membership is digital access to browser games. There is no physical shipment and no courier.</p>
      <p>Access is delivered by unlocking the catalog after verified payment status, not by dispatching goods.</p>
    </PolicyLayout>
  );
}

export function NotFoundPage() {
  return (
    <div className="section wrap" style={{ textAlign: "center" }}>
      <img src="/brand/bullwave-mark.png" alt="" width={96} height={96} style={{ margin: "0 auto 16px" }} />
      <h1 className="display">This page wandered out of the arcade.</h1>
      <p>The path you asked for is not on the map.</p>
      <ButtonLink to="/" variant="primary">
        Home
      </ButtonLink>
    </div>
  );
}

export function ServerErrorPage() {
  return (
    <div className="section wrap" style={{ textAlign: "center" }}>
      <h1 className="display">Something interrupted the studio.</h1>
      <p>An unexpected failure stopped this page. Try Home, then continue.</p>
      <ButtonLink to="/" variant="primary">
        Home
      </ButtonLink>
    </div>
  );
}

export function MaintenancePage() {
  return (
    <div className="section wrap" style={{ textAlign: "center" }}>
      <h1 className="display">The studio is taking a short break.</h1>
      <p>A return time is shown only when it has been verified. None is published here.</p>
      <ButtonLink to="/" variant="primary">
        Home
      </ButtonLink>
    </div>
  );
}
