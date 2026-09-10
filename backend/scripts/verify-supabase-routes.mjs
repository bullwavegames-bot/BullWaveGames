process.env.AUTH_MODE = "supabase";
process.env.SUPABASE_URL = "https://phase2-test.supabase.co";

const { buildApp } = await import("../dist/backend/src/app.js");
const app = await buildApp({
  roomsEnabled: false,
  readinessChecks: { database: async () => undefined, redis: async () => undefined },
});

try {
  const legacy = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "player@example.test", password: "password" },
  });
  if (legacy.statusCode !== 404) throw new Error(`Legacy login remained registered (${legacy.statusCode}).`);
  const legacyEmailChange = await app.inject({
    method: "POST",
    url: "/api/me/email",
    payload: { email: "new@example.test" },
  });
  if (legacyEmailChange.statusCode !== 404) throw new Error("Legacy email-change route remained registered.");
  const logout = await app.inject({ method: "POST", url: "/api/auth/logout", payload: {} });
  if (logout.statusCode !== 200) throw new Error("Supabase logout endpoint is unavailable.");
  process.stdout.write("supabase-route-cutover: passed\n");
} finally {
  await app.close();
}
