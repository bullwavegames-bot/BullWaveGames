import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { requireUser } from "../plugins/auth.js";
import {
  cancelRenewal,
  changePlan,
  createSubscription,
  devCancelMembership,
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
import { listPublicPlans } from "../services/catalog.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/plans", async () => {
    return { ok: true, plans: await listPublicPlans() };
  });

  app.get("/api/billing/config", async () => ({
    ok: true,
    mode: config.billingMode,
    configured: Boolean(config.razorpay.keyId && config.razorpay.keySecret),
    testMode: (config.razorpay.keyId ?? "").startsWith("rzp_test_"),
    keyId: config.razorpay.keyId || null,
    autoRenewalEnabled: true,
  }));

  app.post("/api/billing/subscribe", async (request) => {
    const user = requireUser(request);
    // Keep production checkout creation deliberately tight. Local test mode
    // needs a shorter window so provider/configuration failures do not lock a
    // developer out for an hour while testing the Razorpay flow.
    const billingLimit = config.isProd
      ? { attempts: 8, windowSeconds: 3600 }
      : { attempts: 120, windowSeconds: 60 };
    await hitRateLimit(
      `rl:billing:v3:${user.id}`,
      billingLimit.attempts,
      billingLimit.windowSeconds,
    );
    const body = z
      .object({
        planId: z.enum(["wave", "surge", "tide"]),
        billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
        autoRenew: z.boolean().optional(),
      })
      .parse(request.body);
    const suppliedKey = request.headers["idempotency-key"];
    const rawKey = Array.isArray(suppliedKey) ? suppliedKey[0] : suppliedKey;
    const idempotencyKey = rawKey ?? (!config.isProd ? `dev:${crypto.randomUUID()}` : undefined);
    const validatedKey = z
      .string({ required_error: "Idempotency-Key header is required." })
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency-Key contains unsupported characters.")
      .parse(idempotencyKey);
    const row = await findUserById(user.id);
    const result = await createSubscription({
      userId: user.id,
      email: row?.email ?? "",
      planId: body.planId,
      billingInterval: body.billingInterval,
      idempotencyKey: validatedKey,
    });
    return { ok: true, ...result };
  });

  app.post("/api/billing/verify", async (request) => {
    const user = requireUser(request);
    const body = z
      .object({
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1),
        razorpayOrderId: z.string().min(1).optional(),
        razorpaySubscriptionId: z.string().min(1).optional(),
      })
      .refine((value) => Boolean(value.razorpayOrderId || value.razorpaySubscriptionId), {
        message: "Checkout reference is required.",
      })
      .parse(request.body);
    await verifyCheckoutSignature({ userId: user.id, ...body });
    return { ok: true };
  });

  if (!config.isProd && config.allowDevBilling) {
    app.post("/api/billing/dev/fulfill", async (request) => {
      const user = requireUser(request);
      const body = z.object({ orderId: z.string().uuid() }).parse(request.body);
      await devFulfill(user.id, body.orderId);
      const entitlement = publicEntitlement(await getMembership(user.id));
      return { ok: true, entitlement };
    });

    app.post("/api/billing/dev/cancel", async (request) => {
      const user = requireUser(request);
      const membership = await devCancelMembership(user.id);
      return { ok: true, entitlement: publicEntitlement(membership) };
    });
  }

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
    handler: async (request, reply) => {
      await hitRateLimit(`rl:webhook:${request.ip}`, 120, 60);
      const raw = typeof request.rawBody === "string" ? request.rawBody : request.rawBody?.toString() ?? JSON.stringify(request.body);
      const signature = request.headers["x-razorpay-signature"];
      verifyWebhookSignature(typeof raw === "string" ? raw : String(raw), typeof signature === "string" ? signature : undefined);
      const body = request.body as { event?: string; payload?: unknown };
      const providerEventId = request.headers["x-razorpay-event-id"];
      const eventId = typeof providerEventId === "string" && providerEventId
        ? providerEventId
        : sha256(typeof raw === "string" ? raw : JSON.stringify(body));
      const eventType = String(body.event ?? "unknown");
      const queued = await handleRazorpayEvent(eventId, eventType, body);
      return reply.code(202).send({ ok: true, queued: !queued.duplicate, duplicate: queued.duplicate });
    },
  });
}
