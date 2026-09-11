import { Link, useNavigate } from "react-router-dom";
import { COMPARISON_ROWS, formatInr, PLANS, PRODUCT } from "../config/product";
import { checkoutPath, continueCap, isMember } from "../lib/access";
import { useApp } from "../state/AppState";
import { Button, ButtonLink, Notice } from "../components/ui";
import { PageIntro } from "../components/PageIntro";
import { formatKolkata } from "../lib/time";

const STEPS = ["Choose a plan", "Review checkout", "Pay in INR", "Play the catalog"];

const FAQS = [
  {
    q: "What can I play without paying?",
    a: "Five selected games stay free with no play cap. Wave, Surge, or Tide unlocks the rest of the catalog.",
  },
  {
    q: "Does this need an app?",
    a: "No. Games launch in a current browser. No download is required.",
  },
  {
    q: "When do member perks start?",
    a: "Only after verified payment status. This prototype can use a local test console or Razorpay test keys. It does not take live charges unless live keys are configured.",
  },
  {
    q: "Does membership renew automatically?",
    a: PRODUCT.prototype.autoRenewalEnabled
      ? "Renewal follows the configured payment provider."
      : "Automatic renewal is off. Access lasts 30 days from verified activation, then ends. You can join again from Membership.",
  },
  {
    q: "Can I buy a better rank?",
    a: "No. Membership continues do not add ranked attempts. The weekly board is score only — no buy-in and no paid ranking advantage.",
  },
  {
    q: "Is there a wallet?",
    a: "No. There are no deposits-to-win, coin packs, or cash payouts. You pay a flat INR amount for a 30-day access period.",
  },
  {
    q: "How do I cancel?",
    a: PRODUCT.prototype.autoRenewalEnabled
      ? "Cancel renewal from Billing. Access remains until the stated date. There is no extra cancellation fee."
      : "This period does not auto-renew, so there is no renewal to switch off. Manage receipts and billing email from Billing.",
  },
  {
    q: "Payment stayed pending. Should I pay again?",
    a: "No. Check status on the confirmation screen, then contact support with your order reference if your statement looks different.",
  },
];

function emblem(id: (typeof PLANS)[number]["id"]) {
  if (id === "wave") return "≈";
  if (id === "surge") return "ϟ";
  return "◇";
}

export function MembershipPage() {
  const { user, entitlement, setSelectedPlan } = useApp();
  const navigate = useNavigate();
  const member = isMember(entitlement);
  const currentPlan = member && entitlement.planId ? PLANS.find((plan) => plan.id === entitlement.planId) : undefined;
  const accessEnd = entitlement.accessEndDate
    ? formatKolkata(new Date(entitlement.accessEndDate), { dateStyle: "medium" })
    : null;

  const choose = (planId: (typeof PLANS)[number]["id"]) => {
    setSelectedPlan(planId);
    if (member && entitlement.planId === planId) return;
    if (!user) {
      navigate(`/register?plan=${planId}&return=${encodeURIComponent(checkoutPath(planId))}`);
      return;
    }
    navigate(checkoutPath(planId));
  };

  return (
    <div className="section wrap membership-page">
      <PageIntro
        eyebrow="Membership"
        title="Unlock the studio."
        description="Five selected games stay free. A flat INR plan opens the rest of the catalog. No wallet, no buy-in, no paid ranking."
      >
        <div className="challenge-pills" style={{ marginTop: 22 }}>
          <span className="billing-pill billing-pill-paid">No wallet</span>
          <span className="billing-pill">No auto-renew</span>
          <span className="billing-pill">Tax included in INR price</span>
        </div>
      </PageIntro>

      <ol className="membership-steps" aria-label="How membership works">
        {STEPS.map((step, index) => (
          <li key={step} className={index === 0 ? "is-current" : undefined}>
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {currentPlan ? (
        <section className={`billing-hero billing-hero-${currentPlan.id}`}>
          <div>
            <p className="kicker">Current membership</p>
            <h2>{currentPlan.name}</h2>
            <p className="billing-hero-lede">
              {currentPlan.tagline} {PRODUCT.prototype.autoRenewalEnabled ? "Renewal follows the payment provider." : "This period does not auto-renew."}
            </p>
            <div className="billing-hero-actions">
              <ButtonLink to="/billing" variant="primary">
                Manage billing
              </ButtonLink>
              <ButtonLink to="/play">Play the catalog</ButtonLink>
            </div>
          </div>
          <dl className="billing-facts">
            <div>
              <dt>Status</dt>
              <dd>Active this period</dd>
            </div>
            <div>
              <dt>Access ends</dt>
              <dd>{accessEnd ?? "See billing"} IST</dd>
            </div>
            <div>
              <dt>Continues</dt>
              <dd>{continueCap(entitlement)} per session</dd>
            </div>
            <div>
              <dt>Next payment</dt>
              <dd>None — no auto-renew</dd>
            </div>
          </dl>
        </section>
      ) : (
        <Notice>
          You can inspect every plan as a guest. Join from {formatInr(399)} to unlock membership titles. Always-free games never lock.
        </Notice>
      )}

      <div className="billing-stats">
        <article className="panel">
          <h3>Always free</h3>
          <p>8 games</p>
          <small>No play cap on the always-free set</small>
        </article>
        <article className="panel">
          <h3>Catalog trial</h3>
          <p>5 plays</p>
          <small>Then Wave, Surge, or Tide unlocks the rest</small>
        </article>
        <article className="panel">
          <h3>Access period</h3>
          <p>{PRODUCT.prototype.accessPeriodDays} days</p>
          <small>From verified payment. No automatic renewal</small>
        </article>
        <article className="panel">
          <h3>Checkout</h3>
          <p>{PRODUCT.prototype.paymentProviderName}</p>
          <small>INR · displayed price includes applicable tax</small>
        </article>
      </div>

      <section>
        <div className="section-head">
          <h2>Choose a plan</h2>
          <p className="meta">Review the order on the next screen before any payment starts.</p>
        </div>
        <div className="grid-3">
          {PLANS.map((plan) => {
            const current = Boolean(currentPlan && currentPlan.id === plan.id);
            return (
              <article key={plan.id} className={`card plan membership-plan ${plan.featured ? "featured" : ""} membership-plan-${plan.id}`}>
                <div className="membership-plan-top">
                  <span className={`plan-emblem ${plan.id}`} aria-hidden="true">
                    {emblem(plan.id)}
                  </span>
                  {plan.featured ? <span className="billing-pill billing-pill-pending">Most chosen</span> : null}
                  {current ? <span className="billing-pill billing-pill-paid">Current</span> : null}
                </div>
                <h3>{plan.name}</h3>
                <div className="price">
                  {formatInr(plan.monthlyPriceInr)}
                  <span> / {PRODUCT.prototype.accessPeriodDays} days</span>
                </div>
                <p className="membership-plan-copy">{plan.tagline}</p>
                <p className="meta">{plan.bestFor}</p>
                <p className="meta">{PRODUCT.prototype.continueCaps[plan.id]} continues · unlimited catalog · no wallet</p>
                <ul>
                  {plan.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {current ? (
                  <Button disabled className="btn-full">
                    Current plan
                  </Button>
                ) : (
                  <Button variant="primary" className="btn-full" onClick={() => choose(plan.id)}>
                    {user ? `Review ${plan.name}` : `Join ${plan.name}`}
                  </Button>
                )}
                <p className="plan-legal">
                  Amount due {formatInr(plan.monthlyPriceInr)} · no auto-renew
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel billing-card">
        <div className="section-head">
          <h2>Compare plans</h2>
          <p className="meta">Same catalog access on every paid plan. Perks change continues and cosmetics only.</p>
        </div>
        <div className="table-scroll">
          <table className="table compare">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Wave {formatInr(399)}</th>
                <th>Surge {formatInr(799)}</th>
                <th>Tide {formatInr(1499)}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.wave}</td>
                  <td>{row.surge}</td>
                  <td>{row.tide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="billing-grid">
        <section className="panel billing-card">
          <h2>Still free without a plan</h2>
          <ul className="challenge-rules">
            <li>
              <strong>Five always-free titles</strong>
              <span>Sudoku, Solitaire, 2048, Chess, and Snake Arena stay uncapped.</span>
            </li>
            <li>
              <strong>Membership catalog</strong>
              <span>Every other published game requires Wave, Surge, or Tide membership.</span>
            </li>
            <li>
              <strong>Inspect boards as a guest</strong>
              <span>Challenges and leaderboards stay readable. Membership does not buy rank.</span>
            </li>
          </ul>
        </section>
        <section className="panel billing-card">
          <h2>What a plan does not include</h2>
          <ul className="challenge-rules">
            <li>
              <strong>No wagering</strong>
              <span>Stars, cosmetics, and scores have no cash value and cannot be withdrawn.</span>
            </li>
            <li>
              <strong>No extra ranked attempts</strong>
              <span>Weekly challenge rules stay the same for every participant.</span>
            </li>
            <li>
              <strong>No auto-renew in this configuration</strong>
              <span>Access ends after {PRODUCT.prototype.accessPeriodDays} days unless you join again.</span>
            </li>
          </ul>
        </section>
      </div>

      <section>
        <div className="section-head">
          <h2>Questions</h2>
          <p className="meta">
            Merchant {PRODUCT.legalEntity} · {PRODUCT.domain} · {PRODUCT.prototype.paymentProviderName}
          </p>
        </div>
        <div className="grid-2">
          {FAQS.map((item) => (
            <article key={item.q} className="panel">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="plan-legal">
        <Link to="/terms-and-conditions">Terms</Link> · <Link to="/refund-and-cancellation-policy">Refund</Link> ·{" "}
        <Link to="/shipping-and-delivery-policy">Shipping</Link> · <Link to="/privacy-policy">Privacy</Link> ·{" "}
        <Link to="/contact">Contact</Link> · <Link to="/billing">Billing</Link>
      </p>
    </div>
  );
}
