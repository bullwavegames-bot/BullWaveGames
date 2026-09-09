import { useNavigate } from "react-router-dom";
import { COMPARISON_ROWS, formatInr, PLANS, PRODUCT } from "../config/product";
import { checkoutPath, isMember } from "../lib/access";
import { useApp } from "../state/AppState";
import { Button, ButtonLink, Notice } from "../components/ui";
import { PageIntro } from "../components/PageIntro";

const FAQS = [
  {
    q: "Does this need an app?",
    a: "No. Games launch in a current browser. No download is required.",
  },
  {
    q: "What can I play without paying?",
    a: "Every published game is free to play with no membership unlock or daily session limit. Account creation is only needed to save progress and use account features.",
  },
  {
    q: "When does membership start?",
    a: "Member perks activate only after verified payment status. This prototype does not take live payment.",
  },
  {
    q: "Does membership renew automatically?",
    a: PRODUCT.prototype.autoRenewalEnabled
      ? "Renewal follows the configured payment provider."
      : "Automatic renewal is not enabled in the current configuration. Access lasts for the stated period and then ends.",
  },
  {
    q: "How do I cancel?",
    a: PRODUCT.prototype.autoRenewalEnabled
      ? "Cancel renewal from Billing. Access remains until the stated date. There is no extra cancellation fee."
      : "Because this period does not auto-renew, there is no cancellation control to switch off a renewal that is not happening.",
  },
  {
    q: "Payment support",
    a: "If a payment stays pending, do not pay again. Check status, then contact support with your reference.",
  },
];

export function MembershipPage() {
  const { user, entitlement, setSelectedPlan } = useApp();
  const navigate = useNavigate();
  const member = isMember(entitlement);

  const join = (planId: (typeof PLANS)[number]["id"]) => {
    setSelectedPlan(planId);
    if (member && entitlement.planId === planId) return;
    if (!user) {
      navigate(`/register?plan=${planId}&return=${encodeURIComponent(checkoutPath(planId))}`);
      return;
    }
    navigate(checkoutPath(planId));
  };

  return (
    <div className="section">
      <div className="wrap">
        <PageIntro eyebrow="Choose your wave" title="Make the arcade yours." description="Every game stays free. Membership adds personal touches, cosmetics, and convenience perks.">
          <div className="intro-perks"><span>✦ Original games</span><span>◇ Personal touches</span><span>↗ Play in your browser</span></div>
        </PageIntro>
        {member && entitlement.planId ? (
          <Notice>
            Current plan: {PLANS.find((plan) => plan.id === entitlement.planId)?.name}.{" "}
            <ButtonLink to="/billing">Manage membership</ButtonLink>
          </Notice>
        ) : null}
        <div className="grid-3" style={{ marginTop: 28 }}>
          {PLANS.map((plan) => {
            const current = member && entitlement.planId === plan.id;
            return (
              <article key={plan.id} className={`card plan ${plan.id === "surge" ? "featured" : ""}`}>
                <span className={`plan-emblem ${plan.id}`} aria-hidden="true">{plan.id === "wave" ? "≈" : plan.id === "surge" ? "ϟ" : "◇"}</span>
                <h3>{plan.name}</h3>
                <div className="price">
                  {formatInr(plan.monthlyPriceInr)}
                  <span> / month</span>
                </div>
                <ul>
                  {plan.benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {current ? (
                  <Button disabled className="btn-full">
                    Current plan
                  </Button>
                ) : user ? (
                  <Button variant="primary" className="btn-full" onClick={() => join(plan.id)}>
                    Pay {formatInr(plan.monthlyPriceInr)}
                  </Button>
                ) : (
                  <Button variant="primary" className="btn-full" onClick={() => join(plan.id)}>
                    Join {plan.name}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
        <h2 style={{ marginTop: 48 }}>Compare</h2>
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="table compare">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Wave</th>
                <th>Surge</th>
                <th>Tide</th>
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
        <h2 style={{ marginTop: 48 }}>Questions</h2>
        <div className="grid-2">
          {FAQS.map((item) => (
            <article key={item.q} className="panel">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
