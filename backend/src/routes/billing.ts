import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../plugins/auth.js";
import {
  cancelRenewal,
  changePlan,
  createSubscription,
  devFulfill,
  getOrder,
  handleRazorpayEvent,
  listInvoices,
  setAutoRenew,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../services/billing.js";
import { findUserById } from "../services/users.js";
import { publicEntitlement } from "../types.js";
import { getMembership } from "../services/membership.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { sha256 } from "../lib/crypto.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/plans", async () => {
    const { sql } = await import("../db.js");
    const rows = await sql`SELECT id, name, monthly_paise, annual_paise, continue_cap, benefits FROM plans ORDER BY monthly_paise`;
    return { ok: true, plans: rows };
  });

  app.post("/api/billing/subscribe", async (request) => {
    const user = requireUser(request);
    await hitRateLimit(`rl:billing:${user.id}`, 8, 3600);
    const body = z
      .object({
        planId: z.enum(["wave", "surge", "tide"]),
        billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
        autoRenew: z.boolean().default(false),
      })
      .parse(request.body);
    const row = await findUserById(user.id);
    const result = await createSubscription({
      userId: user.id,
      email: row?.email ?? "",
      planId: body.planId,
      billingInterval: body.billingInterval,
      autoRenew: body.autoRenew,
    });
    return { ok: true, ...result };
  });

  app.post("/api/billing/verify", async (request) => {
    requireUser(request);
    const body = z
      .object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      })
      .parse(request.body);
    await verifyCheckoutSignature(body);
    return { ok: true };
  });

  app.post("/api/billing/dev/fulfill", async (request) => {
    const user = requireUser(request);
    const body = z.object({ orderId: z.string().uuid() }).parse(request.body);
    await devFulfill(user.id, body.orderId);
    const entitlement = publicEntitlement(await getMembership(user.id));
    return { ok: true, entitlement };
  });

  app.get("/api/billing/orders/:id", async (request) => {
    const user = requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const order = await getOrder(user.id, params.id);
    return { ok: true, order };
  });

  app.get("/api/billing/invoices", async (request) => {
    const user = requireUser(request);
    const invoices = await listInvoices(user.id);
    return {
      ok: true,
      invoices: invoices.map((row) => ({
        id: row.id,
        date: row.created_at,
        planId: row.plan_id,
        amountInr: Number(row.amount_paise) / 100,
        status: row.status,
        orderId: row.order_id,
      })),
    };
  });

  app.post("/api/billing/cancel", async (request) => {
    const user = requireUser(request);
    const membership = await cancelRenewal(user.id);
    return { ok: true, entitlement: publicEntitlement(membership) };
  });

  app.post("/api/billing/auto-renew", async (request) => {
    const user = requireUser(request);
    const body = z.object({ enabled: z.boolean() }).parse(request.body);
    const membership = await setAutoRenew(user.id, body.enabled);
    return { ok: true, entitlement: publicEntitlement(membership) };
  });

  app.post("/api/billing/change-plan", async (request) => {
    const user = requireUser(request);
    const body = z
      .object({
        planId: z.enum(["wave", "surge", "tide"]),
        billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
      })
      .parse(request.body);
    const membership = await changePlan(user.id, body.planId, body.billingInterval);
    return { ok: true, entitlement: publicEntitlement(membership) };
  });

  app.post("/api/webhooks/razorpay", {
    config: { rawBody: true },
    handler: async (request) => {
      await hitRateLimit(`rl:webhook:${request.ip}`, 120, 60);
      const raw = typeof request.rawBody === "string" ? request.rawBody : request.rawBody?.toString() ?? JSON.stringify(request.body);
      const signature = request.headers["x-razorpay-signature"];
      verifyWebhookSignature(typeof raw === "string" ? raw : String(raw), typeof signature === "string" ? signature : undefined);
      const body = request.body as { event?: string; payload?: unknown };
      const eventId = sha256(typeof raw === "string" ? raw : JSON.stringify(body));
      const eventType = String(body.event ?? "unknown");
      await handleRazorpayEvent(eventId, eventType, body);
      return { ok: true };
    },
  });
}
