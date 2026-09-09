import "dotenv/config";

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
  env: process.env.NODE_ENV ?? "development",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
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
  supabaseUrl: process.env.SUPABASE_URL ?? "",
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
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
  emailTokenTtlSec: 60 * 60,
  resetTokenTtlSec: 30 * 60,
  freeSessionAllowance: 3,
};

export type PlanId = "wave" | "surge" | "tide";
export type BillingInterval = "monthly" | "annual";

export function razorpayPlanId(planId: PlanId, interval: BillingInterval): string {
  return config.razorpay.plans[planId][interval];
}
