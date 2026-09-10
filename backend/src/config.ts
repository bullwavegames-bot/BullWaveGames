import "dotenv/config";

const env = process.env.NODE_ENV ?? "development";
const isProd = env === "production";

function normalizedUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function list(name: string, fallback: string): string[] {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  env,
  isProd,
  authMode: (process.env.AUTH_MODE ?? (isProd ? "supabase" : "legacy")) as "legacy" | "supabase",
  supabaseUrl: normalizedUrl(process.env.SUPABASE_URL),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseJwtAudience: process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated",
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "127.0.0.1",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  apiUrl: process.env.API_URL ?? "http://localhost:8787",
  corsOrigins: list(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://bullwavegames.com,https://www.bullwavegames.com",
  ),
  databaseUrl: required("DATABASE_URL", "postgres://bullwave:bullwave@127.0.0.1:5433/bullwave"),
  redisUrl: required("REDIS_URL", "redis://127.0.0.1:6379"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-only-access-secret-change-me-32ch"),
  playSessionSecret: required("PLAY_SESSION_SECRET", "dev-only-play-session-secret-32ch"),
  sentryDsn: process.env.SENTRY_DSN ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Bullwave Games <noreply@bullwavegames.com>",
  smtpUrl: process.env.SMTP_URL ?? "",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    plans: {
      wave: {
        monthly: process.env.RAZORPAY_PLAN_WAVE_MONTHLY ?? "",
        annual: process.env.RAZORPAY_PLAN_WAVE_ANNUAL ?? "",
      },
      surge: {
        monthly: process.env.RAZORPAY_PLAN_SURGE_MONTHLY ?? "",
        annual: process.env.RAZORPAY_PLAN_SURGE_ANNUAL ?? "",
      },
      tide: {
        monthly: process.env.RAZORPAY_PLAN_TIDE_MONTHLY ?? "",
        annual: process.env.RAZORPAY_PLAN_TIDE_ANNUAL ?? "",
      },
    },
  },
  graceDays: Number(process.env.GRACE_DAYS ?? 3),
  allowDevBilling: (process.env.ALLOW_DEV_BILLING ?? "true") === "true",
  billingMode: (process.env.BILLING_MODE ?? "razorpay") as "razorpay" | "local",
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
  emailTokenTtlSec: 60 * 60,
  resetTokenTtlSec: 30 * 60,
  freeSessionAllowance: 3,
};

if (config.authMode !== "legacy" && config.authMode !== "supabase") {
  throw new Error("AUTH_MODE must be legacy or supabase.");
}
if (config.authMode === "supabase" && !config.supabaseUrl) {
  throw new Error("SUPABASE_URL is required when AUTH_MODE=supabase.");
}
if (config.billingMode !== "razorpay" && config.billingMode !== "local") {
  throw new Error("BILLING_MODE must be razorpay or local.");
}
if (config.billingMode === "local" && (config.isProd || !config.allowDevBilling)) {
  throw new Error("BILLING_MODE=local requires development mode and ALLOW_DEV_BILLING=true.");
}

export type PlanId = "wave" | "surge" | "tide";
export type BillingInterval = "monthly" | "annual";

export function razorpayPlanId(planId: PlanId, interval: BillingInterval): string {
  return config.razorpay.plans[planId][interval];
}
