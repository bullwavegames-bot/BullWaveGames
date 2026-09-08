import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { formatInr, planById, PRODUCT } from "../config/product";
import { isMember, planFromQuery } from "../lib/access";
import { useApp } from "../state/AppState";
import { Button, ButtonLink, Dialog, Notice } from "../components/ui";
import type { PaymentStatus, PlanId } from "../types";
import { PLANS } from "../config/product";

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { user, entitlement, createOrder, resolveOrder, lastOrderId } = useApp();
  const navigate = useNavigate();
  const planId = planFromQuery(params.get("plan")) ?? "wave";
  const plan = planById(planId);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(lastOrderId);

  if (!user) {
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

  const pay = () => {
    if (busy) return;
    setBusy(true);
    const result = createOrder(planId);
    setBusy(false);
    if (!result.ok) return;
    setOrderId(result.order.id);
    setProvider(true);
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
          {PRODUCT.prototype.taxBreakdownAvailable ? <p>Tax breakdown from provider.</p> : <p className="meta">Displayed prices include any tax already baked into the listed INR amount (prototype assumption).</p>}
          <p>Access period: {PRODUCT.prototype.accessPeriodDays} days from verified activation (configurable).</p>
          <p>
            Renewal: {PRODUCT.prototype.autoRenewalEnabled ? "Configured to renew." : "Does not renew automatically in this configuration."}
          </p>
          <p>Account {user.email}</p>
          <Notice>Prototype hosted checkout — not a real purchase. No money is collected.</Notice>
          <Button variant="primary" className="btn-full" disabled={busy} onClick={pay}>
            {busy ? "Opening…" : `Pay ${formatInr(plan.monthlyPriceInr)}`}
          </Button>
          <p className="meta">
            <Link to="/terms-and-conditions">Terms</Link> · <Link to="/refund-and-cancellation-policy">Refund</Link> ·{" "}
            <Link to="/shipping-and-delivery-policy">Shipping</Link> · <Link to="/contact">Contact</Link>
          </p>
        </div>
      </div>
      {provider && orderId ? (
        <Dialog title="Hosted checkout (prototype)" onClose={() => setProvider(false)}>
          <p>This is not a bank, UPI, OTP, or card screen. Choose an outcome the provider might return.</p>
          <div className="actions" style={{ flexDirection: "column" }}>
            {(["succeeded", "declined", "canceled", "expired", "pending", "uncertain"] as PaymentStatus[]).map((status) => (
              <Button
                key={status}
                variant={status === "succeeded" ? "primary" : "secondary"}
                onClick={() => {
                  resolveOrder(orderId, status, status === "declined" ? "The provider declined this attempt." : undefined);
                  setProvider(false);
                  navigate(`/membership/payment-return?order=${orderId}`);
                }}
              >
                {status}
              </Button>
            ))}
            <Button onClick={() => setProvider(false)}>Dismiss provider</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const { checkOrder, resolveOrder, store } = useApp();
  const orderId = params.get("order");
  const order = orderId ? checkOrder(orderId) : store.orders.at(-1);
  const [checking, setChecking] = useState(false);

  if (!order) {
    return (
      <div className="section wrap">
        <h1>We’re confirming your payment.</h1>
        <p>No order was found. Do not pay again. Contact support if you were charged.</p>
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
    );
  }

  if (order.status === "succeeded" && order.activated) {
    return (
      <div className="section wrap article">
        <h1 className="display">{planById(order.planId).name} is active. The studio is unlocked.</h1>
        <p>Active plan: {planById(order.planId).name}</p>
        <p>Confirmed amount: {formatInr(order.amountInr)}</p>
        <p>Access follows the verified entitlement period. This screen is based on verified order status, not the URL alone.</p>
        <ul>
          {planById(order.planId).benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="actions">
          <ButtonLink to="/play" variant="primary">
            Play
          </ButtonLink>
          <ButtonLink to="/billing">View billing</ButtonLink>
        </div>
        <Notice>Not a live purchase. Prototype activation after an explicit simulated provider result.</Notice>
      </div>
    );
  }

  if (order.status === "pending" || order.status === "uncertain" || order.status === "creating") {
    return (
      <div className="section wrap article" style={{ textAlign: "center" }}>
        <h1 className="display">We’re confirming your payment.</h1>
        <p>
          Plan {planById(order.planId).name}. Reference {order.reference}.
        </p>
        <p>Activation is being checked. Do not pay again while confirmation is pending.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Button
            variant="primary"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              resolveOrder(order.id, order.status);
              setChecking(false);
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
      <p>
        {order.status === "declined"
          ? order.safeReason ?? "The provider declined this attempt."
          : order.status === "canceled"
            ? "The checkout was canceled before completion."
            : order.status === "expired"
              ? "The checkout expired before completion."
              : "The payment did not complete."}
      </p>
      <p>This does not claim that no money was deducted. If your statement looks different, contact support with {order.reference}.</p>
      <div className="actions">
        {order.status === "declined" || order.status === "canceled" || order.status === "expired" ? (
          <ButtonLink to={`/membership/checkout?plan=${order.planId}`} variant="primary">
            Retry
          </ButtonLink>
        ) : null}
        <ButtonLink to="/contact">Contact support</ButtonLink>
      </div>
    </div>
  );
}
