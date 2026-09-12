import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createSupabaseVerifier } from "./supabaseJwt.js";

test("Supabase verifier accepts key rotation and rejects invalid token boundaries", async () => {
  const first = await generateKeyPair("RS256");
  const second = await generateKeyPair("RS256");
  const firstJwk = { ...(await exportJWK(first.publicKey)), kid: "first", alg: "RS256", use: "sig" };
  const secondJwk = { ...(await exportJWK(second.publicKey)), kid: "second", alg: "RS256", use: "sig" };
  const server = createServer((request, response) => {
    if (request.url === "/auth/v1/.well-known/jwks.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [firstJwk, secondJwk] }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  const issuer = `${url}/auth/v1`;
  const subject = "8cbf942d-6b8a-4dd8-a69d-19d2fc0c1504";
  const sign = (privateKey: CryptoKey, kid: string, overrides: { issuer?: string; audience?: string; expiry?: string } = {}) =>
    new SignJWT({ email: "player@example.test" })
      .setProtectedHeader({ alg: "RS256", kid })
      .setSubject(subject)
      .setIssuer(overrides.issuer ?? issuer)
      .setAudience(overrides.audience ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(overrides.expiry ?? "5m")
      .sign(privateKey);
  const verify = createSupabaseVerifier(url, "authenticated");

  try {
    assert.equal((await verify(await sign(first.privateKey, "first"))).sub, subject);
    assert.equal((await verify(await sign(second.privateKey, "second"))).sub, subject);
    await assert.rejects(verify(await sign(first.privateKey, "first", { expiry: "-2h" })));
    await assert.rejects(verify(await sign(first.privateKey, "first", { issuer: `${url}/wrong` })));
    assert.equal((await verify(await sign(first.privateKey, "first", { audience: "wrong" }))).sub, subject);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Supabase verifier falls back to the legacy HMAC secret when JWKS does not match", async () => {
  const secret = "legacy-supabase-jwt-secret-for-tests-32";
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  const subject = "8cbf942d-6b8a-4dd8-a69d-19d2fc0c1504";
  const token = await new SignJWT({ email: "player@example.test" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(`${url}/auth/v1`)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
  try {
    const claims = await createSupabaseVerifier(url, "authenticated", secret)(token);
    assert.equal(claims.sub, subject);
    await assert.rejects(
      createSupabaseVerifier(url, "authenticated")(token),
      /HS256_SECRET_MISSING/,
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
