# Bullwave Games API

Node.js + **Fastify** + **PostgreSQL** + **Redis**. Membership is a flat INR subscription (Wave / Surge / Tide). There is no wallet, coin pack, bet, or cash prize.

Schema: [`SCHEMA.md`](SCHEMA.md). Role promotion is **not** an HTTP API — use `npm run promote-admin -- you@email.com`.

## Local run

1. Copy `.env.example` to `.env` and set `JWT_ACCESS_SECRET` / `PLAY_SESSION_SECRET` (32+ characters).
2. Start Postgres and Redis:

```powershell
docker compose up -d
```

3. Install and start (from this folder, or via `npm run backend` at the repo root):

```powershell
npm install
npm run migrate
npm run seed
npm run dev
```

Run the background worker in a second terminal:

```powershell
npm run dev:worker
```

API: **http://127.0.0.1:8787**  
Health: `GET /health` and `GET /api/health`

Deployment health checks are `GET /health/live` and `GET /health/ready`. The readiness endpoint verifies PostgreSQL and Redis.

## Production build

```powershell
npm run typecheck
npm test
npm run build
npm run migrate:prod
npm start
```

Run `npm run start:worker` as a separate process with `SERVICE_KIND=worker`. Migrations are a release step and use a PostgreSQL advisory lock; neither migrations nor catalog seeds run during API startup. `npm run seed:prod` is available for an explicit initial catalog seed. Build the shared API/worker image from the repository root with `docker build -f backend/Dockerfile .`.

Without Razorpay keys, `ALLOW_DEV_BILLING=true` lets you `POST /api/billing/subscribe` then `POST /api/billing/dev/fulfill` with `{ "orderId" }`. Disable that in production.

Create the first admin after registering:

```powershell
npm run promote-admin -- operations@bullwavegames.com
```

## Auth

Production uses Supabase access tokens. When `DATABASE_URL` includes `public.profiles` (the Supabase Postgres), the API reads that table through its PostgreSQL connection, so the runtime database role must have `SELECT` on it. Local Docker Postgres does not have that table; in that case the API falls back to the verified JWT (and Supabase REST when the anon key is set). Keep `SUPABASE_SERVICE_ROLE_KEY` available only to the worker; it is used to complete queued identity deletions.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Argon2id; ignores/rejects `role` |
| POST | `/api/auth/login` | Access JWT + rotating refresh |
| POST | `/api/auth/refresh` | Reuse of a rotated refresh token kills the family |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/verify-email` | `{ token }` from email link (`/verify-email?token=`) |
| POST | `/api/auth/resend-verify` | |
| POST | `/api/auth/forgot-password` | Always `{ ok: true }` |
| POST | `/api/auth/reset-password` | `{ token, password }` for `/reset-password` |
| POST | `/api/auth/migrations/legacy-ticket` | Verify legacy credentials and issue a 10-minute one-use migration ticket |
| POST | `/api/auth/migrations/supabase-link` | Link that ticket to the current Supabase bearer identity |
| GET | `/api/me` | User + entitlement (`past_due`, `graceEnd`) |
| PATCH | `/api/me` | Profile / `autoRenew` — never `role` |
| DELETE | `/api/me` | Supabase requires a token issued within five minutes; deletion completes asynchronously |

Send `Authorization: Bearer <access>` or the `bw_access` cookie. Refresh is returned in the JSON body and `bw_refresh` cookie.

Legacy registration, login, refresh, verification, and password routes are registered only with `AUTH_MODE=legacy`. Supabase production deployments use Supabase Auth for those operations.

In development, verification and reset links are printed in the server log if `SMTP_URL` is empty.

## Billing (Razorpay)

Six dashboard Plan IDs: Wave/Surge/Tide × monthly/annual. Store them in env. Checkout never multiplies monthly × 12 on the client.

Provider checkout is recurring subscription checkout. `POST /api/billing/subscribe` requires an `Idempotency-Key` header of 16–128 URL-safe characters and accepts `{ "planId", "billingInterval" }`. Reusing the key for the same request returns the original checkout; reusing it for different checkout details returns `IDEMPOTENCY_CONFLICT`.

The subscription Checkout handler sends `{ "razorpaySubscriptionId", "razorpayPaymentId", "razorpaySignature" }` to `POST /api/billing/verify`. The API verifies ownership and the signature, then fetches the subscription and payment from Razorpay and validates their plan, status, notes, amount, and currency before granting access.

In local billing mode, the API generates a missing idempotency key for compatibility with the local payment console. Production requires the header. Development fulfillment and cancellation routes are registered only when `NODE_ENV` is not production, `BILLING_MODE=local`, and `ALLOW_DEV_BILLING=true`.

Failed recurring charges set `memberships.status = past_due` and `grace_end`. Access continues until grace ends.

Webhook: `POST /api/webhooks/razorpay` (raw body + `x-razorpay-signature`). The API verifies the signature, durably records the provider event, and returns `202`; it does not grant membership in the request. The separate worker claims pending events with `SKIP LOCKED`, processes order/membership/invoice changes atomically, retries failures with exponential backoff, and marks the eighth failed attempt `dead_letter`. Event occurrence timestamps prevent older payment failures or cancellations from regressing newer membership state.

## Play / boards

1. `POST /api/play/:slug/start` → `{ token }`
2. `POST /api/play/:slug/score` with that token, `score`, `durationMs`
3. Out-of-bounds or missing session → not ranked
4. `GET /api/leaderboards/:slug?scope=global|friends&page=1`

Score submission atomically claims the play session, so concurrent repeats produce one score event and one `REPLAY` response. The session must match the current account or guest exactly, and reported duration cannot run ahead of server-observed session time.

Leaderboard ordering follows each game's `higher_better` or `lower_better` rule. Redis publication uses the authoritative PostgreSQL personal best and a monotonic update, while reads fall back to a bounded PostgreSQL query if Redis is unavailable. Friend-board cache keys include user, game, page, page size, and a version invalidated by score or friendship changes. The worker claims leaderboard outbox rows with `SKIP LOCKED` and retries failed Redis delivery with backoff.

## Rooms

WebSocket **`/rooms`** on this server. Live state is Redis; on close the final JSON is written to `room_snapshots`. The Vite plugin in `frontend/server/rooms.mjs` remains for same-origin local play during `npm run dev` of the frontend. Point production clients at this API host.

## Frontend contract breaks

- User JSON never includes `password`
- Admin APIs need a Bearer token and `role=admin`
- `MembershipStatus` includes `past_due`
- Score submit needs a play-session token
- localStorage high scores are not imported onto public boards (`POST /api/migrations/local-v1`)
