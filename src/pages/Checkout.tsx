import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { formatInr, planById, PRODUCT } from "../config/product";
import { isMember, planFromQuery } from "../lib/access";
import { api, loadRazorpayScript } from "../lib/api";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/AuthContext";
import { Button, ButtonLink, Notice } from "../components/ui";
import type { PlanId } from "../types";
import { PLANS } from "../config/product";

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

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { user, entitlement: localEntitlement } = useApp();
  const { session } = useAuth();
  const navigate = useNavigate();
  const planId = planFromQuery(params.get("plan")) ?? "wave";
  const plan = planById(planId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [entitlement, setEntitlement] = useState(localEntitlement);

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
      <div className="section wrap">
        <h1 className="display">This plan is already active.</h1>
        <ButtonLink to="/billing">View billing</ButtonLink>
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
        description: `${plan.name} membership`,
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

  return (
    <div className="section">
      <div className="wrap split">
        <div>
          <h1 className="display">Review membership</h1>
          <div className="filters">
            {PLANS.map((item) => (
              <Link key={item.id} className="chip-btn" to={`/membership/checkout?plan=${item.id}`} aria-current={item.id === planId}>
                {item.name}
              </Link>
            ))}
          </div>
          <ul>
            {plan.benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>{plan.name}</h2>
          <p>Monthly price {formatInr(plan.monthlyPriceInr)}</p>
          <p>Amount due now {formatInr(plan.monthlyPriceInr)}</p>
          {PRODUCT.prototype.taxBreakdownAvailable ? <p>Tax breakdown from provider.</p> : <p className="meta">Displayed prices include any tax already baked into the listed INR amount.</p>}
          <p>Access period: {PRODUCT.prototype.accessPeriodDays} days from verified activation.</p>
          <p>Renewal: Does not renew automatically in this configuration. Recurring Razorpay plans can be added later.</p>
          <p>Account {user.email}</p>
          <Notice>Razorpay test mode. Use a Razorpay test card (for example 4111 1111 1111 1111). This is not a live charge.</Notice>
          {error ? <p className="error">{error}</p> : null}
          <Button variant="primary" className="btn-full" disabled={busy} onClick={() => void pay()}>
            {busy ? "Opening Razorpay…" : `Pay ${formatInr(plan.monthlyPriceInr)}`}
          </Button>
          <p className="meta">
            <Link to="/terms-and-conditions">Terms</Link> · <Link to="/refund-and-cancellation-policy">Refund</Link> ·{" "}
            <Link to="/shipping-and-delivery-policy">Shipping</Link> · <Link to="/contact">Contact</Link>
          </p>
        </div>
      </div>
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
      <div className="section wrap">
        <h1>We’re confirming your payment.</h1>
        <p>No order was found. Do not pay again. Contact support if you were charged.</p>
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="section wrap">
        <h1>We’re confirming your payment.</h1>
        <p className="error">{loadError}</p>
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="section wrap">
        <p>Loading payment status…</p>
      </div>
    );
  }

  if (order.status === "succeeded" && order.activated) {
    return (
      <div className="section wrap article">
        <h1 className="display">{planById(order.plan_id).name} is active. Your member perks are ready.</h1>
        <p>Active plan: {planById(order.plan_id).name}</p>
        <p>Confirmed amount: {formatInr(Number(order.amount_paise) / 100)}</p>
        <p>Access follows the verified entitlement period. This screen is based on verified order status, not the URL alone.</p>
        <ul>
          {planById(order.plan_id).benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="actions">
          <ButtonLink to="/play" variant="primary">
            Play
          </ButtonLink>
          <ButtonLink to="/billing">View billing</ButtonLink>
        </div>
        <Notice>Razorpay test payment verified on the server.</Notice>
      </div>
    );
  }

  if (order.status === "pending") {
    return (
      <div className="section wrap article" style={{ textAlign: "center" }}>
        <h1 className="display">We’re confirming your payment.</h1>
        <p>
          Plan {planById(order.plan_id).name}. Reference {order.reference}.
        </p>
        <p>Activation is being checked. Do not pay again while confirmation is pending.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Button
            variant="primary"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              void refresh().finally(() => setChecking(false));
            }}
          >
            Check status
          </Button>
          <ButtonLink to="/contact">Contact support</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="section wrap article">
      <h1 className="display">Your membership payment wasn’t completed.</h1>
      <p>{order.safe_reason || "The payment did not complete."}</p>
      <p>This does not claim that no money was deducted. If your statement looks different, contact support with {order.reference}.</p>
      <div className="actions">
        <ButtonLink to={`/membership/checkout?plan=${order.plan_id}`} variant="primary">
          Retry
        </ButtonLink>
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
    </div>
  );
}
