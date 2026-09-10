import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { formatInr, planById, PLANS, PRODUCT } from "../config/product";
import { isMember, planFromQuery } from "../lib/access";
import { api, loadRazorpayScript } from "../lib/api";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/AuthContext";
import { Button, ButtonLink, Notice } from "../components/ui";
import { LocalPaymentConsole, type LocalCheckoutOrder } from "../components/LocalPaymentConsole";
import { PageIntro } from "../components/PageIntro";
import type { PlanId } from "../types";

type SubscribeResponse = {
  ok: true;
  orderId: string;
  mode: "razorpay" | "dev";
  amountPaise: number;
  currency: string;
  keyId: string | null;
  razorpayOrderId: string | null;
  razorpaySubscriptionId: string | null;
};

type OrderResponse = {
  ok: true;
  order: {
    id: string;
    plan_id: PlanId;
    amount_paise: number;
    status: string;
    activated: boolean;
    reference: string;
    safe_reason?: string | null;
  } | null;
};

const STEPS = ["Choose a plan", "Review checkout", "Pay in INR", "Play the catalog"];

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { user, entitlement: localEntitlement, syncEntitlement } = useApp();
  const { session } = useAuth();
  const navigate = useNavigate();
  const planId = planFromQuery(params.get("plan")) ?? "wave";
  const plan = planById(planId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [entitlement, setEntitlement] = useState(localEntitlement);
  const [localOrder, setLocalOrder] = useState<LocalCheckoutOrder | null>(null);

  useEffect(() => {
    if (!session) return;
    void api<{ entitlement: typeof localEntitlement }>("/api/me")
      .then((result) => setEntitlement(result.entitlement))
      .catch(() => undefined);
  }, [session]);

  if (!user || !session) {
    return <Navigate to={`/register?plan=${planId}&return=${encodeURIComponent(`/membership/checkout?plan=${planId}`)}`} replace />;
  }
  if (isMember(entitlement) && entitlement.planId === planId) {
    return (
      <div className="section wrap membership-page">
        <PageIntro
          eyebrow="Checkout"
          title={`${plan.name} is already active.`}
          description="This period is already on your account. Manage receipts from Billing, or pick a different plan from Membership."
        />
        <div className="challenge-hero-actions">
          <ButtonLink to="/billing" variant="primary">
            View billing
          </ButtonLink>
          <ButtonLink to="/membership">See other plans</ButtonLink>
          <ButtonLink to="/play">Play</ButtonLink>
        </div>
      </div>
    );
  }

  const pay = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const created = await api<SubscribeResponse>("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId, billingInterval: "monthly", autoRenew: false }),
      });
      if (created.mode === "dev") {
        setBusy(false);
        setLocalOrder({ orderId: created.orderId, amountPaise: created.amountPaise, currency: created.currency });
        return;
      }
      if (created.mode !== "razorpay" || !created.razorpayOrderId || !created.keyId) {
        throw new Error("Razorpay is not configured on the API. Start the backend with RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
      }
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load.");
      const checkout = new window.Razorpay({
        key: created.keyId,
        amount: created.amountPaise,
        currency: created.currency,
        name: PRODUCT.brand,
        description: `${plan.name} membership · ${PRODUCT.prototype.accessPeriodDays} days`,
        order_id: created.razorpayOrderId,
        prefill: { email: user.email, name: user.displayName },
        theme: { color: "#61D6B0" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError("Checkout was closed before payment finished.");
          },
        },
        handler: (response) => {
          void api("/api/billing/verify", {
            method: "POST",
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
            .then(() => navigate(`/payment-return?order=${created.orderId}`))
            .catch((cause: Error) => {
              setBusy(false);
              setError(cause.message);
            });
        },
      });
      checkout.open();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
    }
  };

  const approveLocalPayment = async () => {
    if (!localOrder || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ entitlement: typeof localEntitlement }>("/api/billing/dev/fulfill", {
        method: "POST",
        body: JSON.stringify({ orderId: localOrder.orderId }),
      });
      syncEntitlement(result.entitlement);
      navigate(`/payment-return?order=${localOrder.orderId}`);
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Could not complete the test payment.");
    }
  };

  const switching = isMember(entitlement) && entitlement.planId && entitlement.planId !== planId;

  return (
    <div className="section wrap membership-page">
      {localOrder ? (
        <LocalPaymentConsole
          order={localOrder}
          planName={plan.name}
          busy={busy}
          onApprove={() => void approveLocalPayment()}
          onClose={() => setLocalOrder(null)}
        />
      ) : null}

      <PageIntro
        eyebrow="Checkout"
        title={`Review ${plan.name}.`}
        description="Confirm the amount, period, and account before payment. Member perks start only after verified status — not when you open this page."
      >
        <ol className="membership-steps" aria-label="Checkout progress">
          {STEPS.map((step, index) => (
            <li key={step} className={index === 1 || index === 2 ? "is-current" : undefined}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </PageIntro>

      <div className="filters">
        {PLANS.map((item) => (
          <Link
            key={item.id}
            className="chip-btn"
            to={`/membership/checkout?plan=${item.id}`}
            aria-current={item.id === planId ? "page" : undefined}
          >
            {item.name} · {formatInr(item.monthlyPriceInr)}
          </Link>
        ))}
      </div>

      {switching ? (
        <Notice>
          You currently have {planById(entitlement.planId!).name}. Paying for {plan.name} starts a new {PRODUCT.prototype.accessPeriodDays}-day period after verified payment.
        </Notice>
      ) : null}

      <div className="billing-grid checkout-grid">
        <section className="panel billing-card">
          <p className="kicker">{plan.bestFor}</p>
          <h2>Included with {plan.name}</h2>
          <p className="challenge-hero-lede">{plan.tagline}</p>
          <ul className="challenge-rules">
            {plan.benefits.map((item) => (
              <li key={item}>
                <strong>{item}</strong>
                <span>Included for {PRODUCT.prototype.accessPeriodDays} days after verified activation.</span>
              </li>
            ))}
            <li>
              <strong>{PRODUCT.prototype.continueCaps[plan.id]} continues per session</strong>
              <span>Membership continues do not add ranked attempts on the weekly board.</span>
            </li>
            <li>
              <strong>Unlimited catalog</strong>
              <span>Eight always-free games stay free even after this period ends.</span>
            </li>
          </ul>
        </section>

        <aside className={`panel billing-card checkout-summary membership-plan-${plan.id}`}>
          <p className="kicker">Order summary</p>
          <h2>{plan.name}</h2>
          <dl className="billing-meta">
            <div>
              <dt>Amount due now</dt>
              <dd>{formatInr(plan.monthlyPriceInr)}</dd>
            </div>
            <div>
              <dt>Access period</dt>
              <dd>{PRODUCT.prototype.accessPeriodDays} days</dd>
            </div>
            <div>
              <dt>Renewal</dt>
              <dd>{PRODUCT.prototype.autoRenewalEnabled ? "Follows provider" : "Does not auto-renew"}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{PRODUCT.prototype.taxIncludedInDisplayedPrice ? "Included in the displayed INR price" : "Shown at checkout"}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Merchant</dt>
              <dd>{PRODUCT.legalEntity}</dd>
            </div>
            <div>
              <dt>Checkout</dt>
              <dd>{PRODUCT.prototype.paymentProviderName}</dd>
            </div>
          </dl>
          <Notice>
            {PRODUCT.prototype.isLivePayment
              ? "Live payment. Razorpay collects the charge."
              : "Payment test mode. The local Bullwave console does not collect card details or make a live charge."}
          </Notice>
          {error ? <p className="error">{error}</p> : null}
          <Button variant="primary" className="btn-full" disabled={busy} onClick={() => void pay()}>
            {busy ? "Opening checkout…" : `Pay ${formatInr(plan.monthlyPriceInr)}`}
          </Button>
          <p className="plan-legal">
            <Link to="/membership">Back to plans</Link> · <Link to="/terms-and-conditions">Terms</Link> ·{" "}
            <Link to="/refund-and-cancellation-policy">Refund</Link> · <Link to="/shipping-and-delivery-policy">Shipping</Link> ·{" "}
            <Link to="/contact">Contact</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function ReturnShell({
  kicker,
  title,
  description,
  children,
  currentStep,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
  currentStep: number;
}) {
  return (
    <div className="section wrap membership-page">
      <PageIntro eyebrow={kicker} title={title} description={description}>
        <ol className="membership-steps" aria-label="Checkout progress">
          {STEPS.map((step, index) => (
            <li key={step} className={index === currentStep ? "is-current" : undefined}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </PageIntro>
      {children}
    </div>
  );
}

export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const [checking, setChecking] = useState(false);
  const [order, setOrder] = useState<OrderResponse["order"]>(null);
  const [loadError, setLoadError] = useState("");

  const refresh = async () => {
    if (!orderId) return;
    const result = await api<OrderResponse>(`/api/billing/orders/${orderId}`);
    setOrder(result.order);
  };

  useEffect(() => {
    if (!orderId) return;
    void refresh().catch((cause: Error) => setLoadError(cause.message));
  }, [orderId]);

  if (!orderId) {
    return (
      <ReturnShell
        kicker="Payment"
        title="We’re confirming your payment."
        description="No order was found on this link. Do not pay again. If a statement charge appears, contact support with the time of the attempt."
        currentStep={2}
      >
        <div className="challenge-hero-actions">
          <ButtonLink to="/contact" variant="primary">
            Contact support
          </ButtonLink>
          <ButtonLink to="/billing">Open billing</ButtonLink>
          <ButtonLink to="/membership">Back to plans</ButtonLink>
        </div>
      </ReturnShell>
    );
  }

  if (loadError) {
    return (
      <ReturnShell
        kicker="Payment"
        title="We’re confirming your payment."
        description="The confirmation screen could not load this order yet. Do not start a second payment."
        currentStep={2}
      >
        <p className="error">{loadError}</p>
        <div className="challenge-hero-actions">
          <ButtonLink to="/contact" variant="primary">
            Contact support
          </ButtonLink>
          <ButtonLink to="/billing">Open billing</ButtonLink>
        </div>
      </ReturnShell>
    );
  }

  if (!order) {
    return (
      <ReturnShell
        kicker="Payment"
        title="Checking verified status…"
        description="This screen waits on the server order, not the URL alone."
        currentStep={2}
      >
        <p className="meta">Loading payment status…</p>
      </ReturnShell>
    );
  }

  const plan = planById(order.plan_id);
  const amount = formatInr(Number(order.amount_paise) / 100);

  if (order.status === "succeeded" && order.activated) {
    return (
      <ReturnShell
        kicker="Payment confirmed"
        title={`${plan.name} is active.`}
        description="Member perks are ready for this 30-day period. Eight always-free games stay free even after access ends."
        currentStep={3}
      >
        <section className={`billing-hero billing-hero-${plan.id}`}>
          <div>
            <p className="kicker">Verified order</p>
            <h2>{plan.name}</h2>
            <p className="billing-hero-lede">
              {plan.tagline} This screen is based on verified order status, not the URL alone.
            </p>
            <div className="billing-hero-actions">
              <ButtonLink to="/play" variant="primary">
                Play the catalog
              </ButtonLink>
              <ButtonLink to="/billing">View billing</ButtonLink>
              <ButtonLink to="/challenges">Open challenges</ButtonLink>
            </div>
          </div>
          <dl className="billing-facts">
            <div>
              <dt>Paid</dt>
              <dd>{amount}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{order.reference}</dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{PRODUCT.prototype.accessPeriodDays} days</dd>
            </div>
            <div>
              <dt>Renewal</dt>
              <dd>{PRODUCT.prototype.autoRenewalEnabled ? "Follows provider" : "No auto-renew"}</dd>
            </div>
          </dl>
        </section>
        <div className="billing-grid">
          <section className="panel billing-card">
            <h2>Included now</h2>
            <ul className="challenge-rules">
              {plan.benefits.map((item) => (
                <li key={item}>
                  <strong>{item}</strong>
                  <span>Active for this verified period.</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel billing-card">
            <h2>Receipts</h2>
            <p className="challenge-hero-lede">
              Download text receipts and update billing email from Billing. Merchant {PRODUCT.legalEntity}. Checkout via{" "}
              {PRODUCT.prototype.paymentProviderName}.
            </p>
            <Notice>Razorpay or local test payment verified on the server.</Notice>
          </section>
        </div>
      </ReturnShell>
    );
  }

  if (order.status === "pending") {
    return (
      <ReturnShell
        kicker="Payment pending"
        title="We’re confirming your payment."
        description={`${plan.name} · reference ${order.reference}. Activation waits on verified status. Do not pay again while this is pending.`}
        currentStep={2}
      >
        <div className="billing-stats">
          <article className="panel">
            <h3>Plan</h3>
            <p>{plan.name}</p>
            <small>Amount {amount}</small>
          </article>
          <article className="panel">
            <h3>Reference</h3>
            <p>{order.reference}</p>
            <small>Keep this if you contact support</small>
          </article>
          <article className="panel">
            <h3>Status</h3>
            <p>Pending</p>
            <small>Not activated yet</small>
          </article>
          <article className="panel">
            <h3>Next step</h3>
            <p>Wait</p>
            <small>Check status instead of paying twice</small>
          </article>
        </div>
        <div className="challenge-hero-actions">
          <Button
            variant="primary"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              void refresh().finally(() => setChecking(false));
            }}
          >
            {checking ? "Checking…" : "Check status"}
          </Button>
          <ButtonLink to="/contact">Contact support</ButtonLink>
          <ButtonLink to="/billing">Open billing</ButtonLink>
        </div>
      </ReturnShell>
    );
  }

  return (
    <ReturnShell
      kicker="Payment not completed"
      title="Your membership payment wasn’t completed."
      description={order.safe_reason || "The payment did not complete. This does not claim that no money was deducted."}
      currentStep={2}
    >
      <div className="billing-stats">
        <article className="panel">
          <h3>Plan</h3>
          <p>{plan.name}</p>
          <small>Retry uses the same review screen</small>
        </article>
        <article className="panel">
          <h3>Reference</h3>
          <p>{order.reference}</p>
          <small>Share this with support if a statement charge appears</small>
        </article>
        <article className="panel">
          <h3>Amount</h3>
          <p>{amount}</p>
          <small>Listed INR for this attempt</small>
        </article>
        <article className="panel">
          <h3>Status</h3>
          <p>{order.status}</p>
          <small>Not activated</small>
        </article>
      </div>
      <div className="challenge-hero-actions">
        <ButtonLink to={`/membership/checkout?plan=${order.plan_id}`} variant="primary">
          Retry {plan.name}
        </ButtonLink>
        <ButtonLink to="/contact">Contact support</ButtonLink>
        <ButtonLink to="/membership">Choose another plan</ButtonLink>
      </div>
    </ReturnShell>
  );
}
