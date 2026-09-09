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

API: **http://127.0.0.1:8787**  
Health: `GET /health` and `GET /api/health`

Without Razorpay keys, `ALLOW_DEV_BILLING=true` lets you `POST /api/billing/subscribe` then `POST /api/billing/dev/fulfill` with `{ "orderId" }`. Disable that in production.

Create the first admin after registering:

```powershell
npm run promote-admin -- operations@bullwavegames.com
```

## Auth

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
| GET | `/api/me` | User + entitlement (`past_due`, `graceEnd`) |
| PATCH | `/api/me` | Profile / `autoRenew` — never `role` |

Send `Authorization: Bearer <access>` or the `bw_access` cookie. Refresh is returned in the JSON body and `bw_refresh` cookie.

In development, verification and reset links are printed in the server log if `SMTP_URL` is empty.

## Billing (Razorpay)

Six dashboard Plan IDs: Wave/Surge/Tide × monthly/annual. Store them in env. Checkout never multiplies monthly × 12 on the client.

Failed recurring charges set `memberships.status = past_due` and `grace_end`. Access continues until grace ends.

Webhook: `POST /api/webhooks/razorpay` (raw body + `x-razorpay-signature`).

## Play / boards

1. `POST /api/play/:slug/start` → `{ token }`
2. `POST /api/play/:slug/score` with that token, `score`, `durationMs`
3. Out-of-bounds or missing session → not ranked
4. `GET /api/leaderboards/:slug?scope=global|friends&page=1`

## Rooms

WebSocket **`/rooms`** on this server. Live state is Redis; on close the final JSON is written to `room_snapshots`. The Vite plugin in `server/rooms.mjs` remains for same-origin local play during `npm run dev` of the frontend. Point production clients at this API host.

## Frontend contract breaks

- User JSON never includes `password`
- Admin APIs need a Bearer token and `role=admin`
- `MembershipStatus` includes `past_due`
- Score submit needs a play-session token
- localStorage high scores are not imported onto public boards (`POST /api/migrations/local-v1`)
