import { PRODUCT } from "../config/product";
import { api, loadRazorpayScript } from "./api";
import type { PlanId } from "../types";

type SubscribeResponse = {
  ok: true;
  orderId: string;
  mode: "razorpay" | "dev";
  amountPaise: number;
  currency: string;
  keyId: string | null;
  razorpayOrderId: string | null;
};

export async function startRazorpayCheckout(input: {
  planId: PlanId;
  planName: string;
  email: string;
  displayName: string;
  onDismiss: () => void;
  onVerified: (orderId: string) => void;
  onError: (message: string) => void;
}): Promise<void> {
  const created = await api<SubscribeResponse>("/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ planId: input.planId, billingInterval: "monthly", autoRenew: false }),
  });
  if (created.mode !== "razorpay" || !created.razorpayOrderId || !created.keyId) {
    throw new Error("Razorpay is not configured on the API.");
  }
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout did not load.");
  const checkout = new window.Razorpay({
    key: created.keyId,
    amount: created.amountPaise,
    currency: created.currency,
    name: PRODUCT.brand,
    description: `${input.planName} membership`,
    order_id: created.razorpayOrderId,
    prefill: { email: input.email, name: input.displayName },
    theme: { color: "#61D6B0" },
    modal: { ondismiss: input.onDismiss },
    handler: (response) => {
      void api("/api/billing/verify", {
        method: "POST",
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      })
        .then(() => input.onVerified(created.orderId))
        .catch((cause: Error) => input.onError(cause.message));
    },
  });
  checkout.open();
}
