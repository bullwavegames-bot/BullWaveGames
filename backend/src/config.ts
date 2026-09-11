import "dotenv/config";

function normalizedUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

function required(source: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const value = source[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function list(source: NodeJS.ProcessEnv, name: string, fallback: string): string[] {
  return (source[name] ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTrustProxy(source: NodeJS.ProcessEnv): boolean | string[] {
  const raw = (source.TRUSTED_PROXIES ?? "").trim();
  if (!raw || raw === "false") return false;
  if (raw === "true" || raw === "1") return true;
  return list(source, "TRUSTED_PROXIES", "");
}

function validateUrl(name: string, value: string, protocols: string[], productionHttps = false): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${name} uses an unsupported protocol.`);
  if (productionHttps && parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS in production.`);
}

function validateCorsOrigin(origin: string, isProd: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("CORS_ORIGINS must contain valid URLs.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CORS_ORIGINS uses an unsupported protocol.");
  }
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (isProd && parsed.protocol !== "https:" && !loopback) {
    throw new Error("CORS_ORIGINS must use HTTPS in production except for loopback development origins.");
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const env = source.NODE_ENV ?? "development";
  const isProd = env === "production";
  const authMode = (source.AUTH_MODE ?? (normalizedUrl(source.SUPABASE_URL) ? "supabase" : isProd ? "supabase" : "legacy")) as "legacy" | "supabase";
  const billingMode = (source.BILLING_MODE ?? "razorpay") as "razorpay" | "local";
  const serviceKind = (source.SERVICE_KIND ?? "api") as "api" | "worker";
  const corsOrigins = list(
    source,
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://bullwavegames.com,https://www.bullwavegames.com",
  );
  const trustedProxies = parseTrustProxy(source);
  const configValue = {
    env,
    isProd,
    authMode,
    supabaseUrl: normalizedUrl(source.SUPABASE_URL),
    supabaseAnonKey: source.SUPABASE_ANON_KEY ?? "",
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY ?? "",
    supabaseJwtAudience: source.SUPABASE_JWT_AUDIENCE ?? "authenticated",
    port: Number(source.PORT ?? 8787),
    host: source.HOST ?? (isProd ? "0.0.0.0" : "127.0.0.1"),
    appUrl: normalizedUrl(source.APP_URL ?? "http://localhost:5173"),
    apiUrl: normalizedUrl(source.API_URL ?? "http://localhost:8787"),
    corsOrigins,
    trustProxy: trustedProxies,
    databaseUrl: required(source, "DATABASE_URL", isProd ? undefined : "postgres://bullwave:bullwave@127.0.0.1:5433/bullwave"),
    redisUrl: required(source, "REDIS_URL", isProd ? undefined : "redis://127.0.0.1:6380"),
    jwtAccessSecret: required(source, "JWT_ACCESS_SECRET", isProd ? undefined : "dev-only-access-secret-change-me-32ch"),
    playSessionSecret: required(source, "PLAY_SESSION_SECRET", isProd ? undefined : "dev-only-play-session-secret-32ch"),
    sentryDsn: source.SENTRY_DSN ?? "",
    mailFrom: source.MAIL_FROM ?? "Bullwave Games <noreply@bullwavegames.com>",
    smtpUrl: source.SMTP_URL ?? "",
    razorpay: {
      keyId: source.RAZORPAY_KEY_ID ?? "",
      keySecret: source.RAZORPAY_KEY_SECRET ?? "",
      webhookSecret: source.RAZORPAY_WEBHOOK_SECRET ?? "",
      plans: {
        wave: { monthly: source.RAZORPAY_PLAN_WAVE_MONTHLY ?? "", annual: source.RAZORPAY_PLAN_WAVE_ANNUAL ?? "" },
        surge: { monthly: source.RAZORPAY_PLAN_SURGE_MONTHLY ?? "", annual: source.RAZORPAY_PLAN_SURGE_ANNUAL ?? "" },
        tide: { monthly: source.RAZORPAY_PLAN_TIDE_MONTHLY ?? "", annual: source.RAZORPAY_PLAN_TIDE_ANNUAL ?? "" },
      },
    },
    graceDays: Number(source.GRACE_DAYS ?? 3),
    allowDevBilling: (source.ALLOW_DEV_BILLING ?? (isProd ? "false" : "true")) === "true",
    billingMode,
    serviceKind,
    shutdownTimeoutMs: Number(source.SHUTDOWN_TIMEOUT_MS ?? 15_000),
    accessTokenTtlSec: 15 * 60,
    refreshTokenTtlSec: 30 * 24 * 60 * 60,
    emailTokenTtlSec: 60 * 60,
    resetTokenTtlSec: 30 * 60,
    freeSessionAllowance: 3,
  };

  if (!Number.isInteger(configValue.port) || configValue.port < 1 || configValue.port > 65535) throw new Error("PORT must be a valid TCP port.");
  if (!Number.isFinite(configValue.shutdownTimeoutMs) || configValue.shutdownTimeoutMs < 1000) throw new Error("SHUTDOWN_TIMEOUT_MS must be at least 1000.");
  if (authMode !== "legacy" && authMode !== "supabase") throw new Error("AUTH_MODE must be legacy or supabase.");
  if (authMode === "supabase" && !configValue.supabaseUrl) throw new Error("SUPABASE_URL is required when AUTH_MODE=supabase.");
  if (billingMode !== "razorpay" && billingMode !== "local") throw new Error("BILLING_MODE must be razorpay or local.");
  if (serviceKind !== "api" && serviceKind !== "worker") throw new Error("SERVICE_KIND must be api or worker.");
  if (billingMode === "local" && (isProd || !configValue.allowDevBilling)) {
    throw new Error("BILLING_MODE=local requires development mode and ALLOW_DEV_BILLING=true.");
  }
  validateUrl("DATABASE_URL", configValue.databaseUrl, ["postgres:", "postgresql:"]);
  validateUrl("REDIS_URL", configValue.redisUrl, ["redis:", "rediss:"]);
  validateUrl("APP_URL", configValue.appUrl, ["http:", "https:"], isProd);
  validateUrl("API_URL", configValue.apiUrl, ["http:", "https:"], isProd);
  for (const origin of corsOrigins) {
    if (origin === "*") throw new Error("CORS_ORIGINS cannot contain a wildcard.");
    validateCorsOrigin(origin, isProd);
  }

  if (isProd) {
    if (authMode !== "supabase") throw new Error("Production requires AUTH_MODE=supabase.");
    if (!configValue.supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY is required in production.");
    if (serviceKind === "worker" && !configValue.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required by the production worker.");
    validateUrl("SUPABASE_URL", configValue.supabaseUrl, ["https:"], true);
    if (trustedProxies === false) throw new Error("TRUSTED_PROXIES is required in production.");
    if (configValue.allowDevBilling) throw new Error("ALLOW_DEV_BILLING must be false in production.");
    if (configValue.jwtAccessSecret.length < 32 || configValue.jwtAccessSecret.includes("dev-only")) throw new Error("JWT_ACCESS_SECRET must be a production secret of at least 32 characters.");
    if (configValue.playSessionSecret.length < 32 || configValue.playSessionSecret.includes("dev-only")) throw new Error("PLAY_SESSION_SECRET must be a production secret of at least 32 characters.");
    if (!configValue.smtpUrl) throw new Error("SMTP_URL is required in production.");
    if (billingMode !== "razorpay" || !configValue.razorpay.keyId || !configValue.razorpay.keySecret || !configValue.razorpay.webhookSecret) {
      throw new Error("Production requires BILLING_MODE=razorpay plus RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET.");
    }
  }
  return configValue;
}

export const config = loadConfig();

export type PlanId = "wave" | "surge" | "tide";
export type BillingInterval = "monthly" | "annual";

export function razorpayPlanId(planId: PlanId, interval: BillingInterval): string {
  return config.razorpay.plans[planId][interval];
}
