# Backend schema (implemented)

Implemented in `backend/src` (Fastify). This document is the source of truth for tables, Redis keys, and access rules.

**Stack:** Fastify (TypeScript) + PostgreSQL + Redis + Razorpay Subscriptions.

**Why Fastify over Express:** first-class JSON Schema / Zod typing, `@fastify/websocket` matches the existing `/rooms` upgrade pattern, and lower overhead when room fan-out is Redis pub/sub. Razorpay webhooks are ordinary HTTP either way.

**Non-negotiable:** no bets, wallets, coin packs, jackpots, or cash-value rewards. Membership is a flat INR subscription for catalog access.

**Postgres extensions (first migration):** `CREATE EXTENSION IF NOT EXISTS citext;` and `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (or `uuid-ossp`) for uuid generation. `citext` is required for case-insensitive unique emails.

---

## Entity relationship (logical)

```
users 1──1 memberships
users 1──* refresh_tokens, email_tokens, orders, invoices
users 1──* play_sessions ──1 score_events   (one accepted score per session)
users 1──* game_saves, personal_bests
users 1──* user_achievements, user_cosmetics
users 1──* friendships (as requester or addressee)
users 1──* challenge_links
games 1──1 game_score_rules
games 1──* play_sessions, personal_bests, game_saves, rooms
rooms 1──* room_members
rooms 1──1 room_snapshots          (final state written on close)
```

There is **no** `wallets`, `coins`, `deposits`, or `payouts` table.

**Role is not a user-writable field.** `users.role` is never accepted on register, PATCH `/me`, migration import, or any public/admin HTTP API. Promotion is a direct SQL update or a separate internal CLI, then `audit_log`. See [Role escalation](#role-escalation).

---

## PostgreSQL

All money columns are **integer paise** (`amount_paise`). Display INR = paise / 100.

Timestamps are `timestamptz`. Calendar “days” for rotation, streaks, and free allowance use **Asia/Kolkata** `date_key` (`YYYY-MM-DD`).

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | citext unique not null | login |
| billing_email | citext not null | |
| password_hash | text not null | argon2id |
| display_name | text not null | |
| avatar_id | text not null | |
| email_verified_at | timestamptz null | |
| role | text not null default `player` | `player` \| `admin` — **server/DB only** |
| onboarding_complete | boolean not null default false | |
| auto_renew | boolean not null default false | user-controlled; default off |
| created_at, updated_at | timestamptz | |
| deleted_at | timestamptz null | soft delete |

Replaces `UserProfile` **except** `password` is never stored or returned in plaintext. Request bodies that include `role` are rejected, not stored.

### refresh_tokens

Hashed refresh tokens **rotate on every use**. Theft is detected by **family reuse**.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | this refresh credential |
| user_id | uuid FK users | |
| family_id | uuid not null | stable across rotations of one login session |
| token_hash | text unique | only hash stored |
| expires_at | timestamptz | |
| revoked_at | timestamptz null | replaced, logout, or family kill |
| replaced_by | uuid null FK refresh_tokens | the next token in the chain |
| user_agent, ip | text / inet | |

**Rotation:** `POST /api/auth/refresh` with a still-valid token T: issue T2 in the same `family_id`, set T.`revoked_at` + T.`replaced_by` = T2, return T2.

**Reuse detection:** if a request presents a token that is already `revoked_at` **and** belongs to a family that still has a live descendant, treat as theft: revoke **all** rows with that `family_id`, deny the refresh, force re-login.

**Logout / password change:** revoke the family (or all families for that user).

Short-lived access JWT (~15m) + rotating refresh (~30d idle, sliding on use).

### email_tokens

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| kind | text | `verify` \| `reset` |
| token_hash | text unique | |
| expires_at | timestamptz | |
| used_at | timestamptz null | |

Matches `/verify-email`, `/forgot-password`, `/reset-password`.

### plans

Seeded, not user-editable except via admin **catalog** fields (names/benefits/caps). Razorpay IDs are env/ops, not client input.

| Column | Type | Notes |
|---|---|---|
| id | text PK | `wave` `surge` `tide` |
| name | text | Wave / Surge / Tide |
| monthly_paise | int not null | 39900 / 79900 / 149900 |
| annual_paise | int not null | **server catalog only** — not `monthly × 12` on the client |
| razorpay_plan_monthly | text not null (once live) | **own** Razorpay Plan ID |
| razorpay_plan_annual | text not null (once live) | **own** Razorpay Plan ID, not derived |
| continue_cap | int not null | 1 / 3 / 5 (configurable) |
| benefits | jsonb | string[] |

**Razorpay dashboard:** six Plans — Wave monthly, Wave annual, Surge monthly, Surge annual, Tide monthly, Tide annual. Checkout sends `plan_id` + `billing_interval`; the API looks up the matching `razorpay_plan_*` and creates a subscription against **that** ID. Annual INR is confirmed in ops (illustrative 20% off × 12 until the dashboard amounts are locked).

### memberships

**One row per user** (current entitlement). Historical periods live on `orders` / `invoices`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid unique FK | |
| plan_id | text FK plans null | |
| status | text | `none` `pending` `active` `active_until` **`past_due`** `expired` |
| billing_interval | text | `monthly` `annual` |
| source | text | `payment` `admin_grant` `none` |
| razorpay_customer_id | text null | |
| razorpay_subscription_id | text unique null | |
| access_start | timestamptz null | |
| access_end | timestamptz null | period end / paid-through |
| grace_end | timestamptz null | set when a recurring charge fails |
| last_payment_failed_at | timestamptz null | |
| dunning_retry_count | int not null default 0 | Razorpay retry attempts observed |
| next_payment_at | timestamptz null | |
| cancel_at_period_end | boolean | |
| auto_renew | boolean | copied from user setting at charge time |
| granted_by | uuid null FK users | admin grant |

**Access (server-only):**

- `active` / `active_until`: member if `access_end > now()`
- `past_due`: member if `grace_end > now()` (failed renewal, still in grace)
- otherwise not a member

**Dunning:** Razorpay `subscription.charged` failure / halt / pending retry → set `status = past_due`, `last_payment_failed_at`, increment `dunning_retry_count`, set `grace_end` (ops-configurable, e.g. 3–7 days, not longer than Razorpay’s retry window). Successful charge → `active`, clear dunning fields, refresh `access_end`. After `grace_end` with no success → `expired`, clear `plan_id` access. Do not jump `active` → `expired` on the first failed webhook.

Frontend `MembershipStatus` needs **`past_due` added** (small type break). Until then the API can also expose `graceEnd` on `GET /api/me`.

### orders

Maps `PaymentOrder`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| plan_id | text FK | |
| amount_paise | int | |
| currency | text default INR | |
| status | text | `creating` `pending` `succeeded` `declined` `canceled` `expired` `uncertain` |
| razorpay_order_id | text unique null | |
| razorpay_payment_id | text unique null | |
| razorpay_signature | text null | |
| activated | boolean not null default false | **idempotent grant** |
| reference | text | |
| safe_reason | text null | |

Repeating a succeeded webhook cannot grant twice (`activated`). Recurring failures update **memberships** dunning fields; they may also insert an invoice with `status = failed`.

### invoices

Maps `Invoice`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id, order_id, plan_id | FKs | `order_id` nullable for subscription invoices |
| amount_paise | int | |
| status | text | `paid` `failed` `pending` |
| paid_at | timestamptz null | |
| razorpay_invoice_id / payment_id | text unique null | |

### webhook_events

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| provider | text | `razorpay` |
| event_id | text unique | Razorpay event id |
| event_type | text | |
| payload | jsonb | |
| processed_at | timestamptz null | |

### games

Maps `Game`. JSON for `how_to_play`, `controls`.

### game_score_rules

**One row per game.** Client-side games cannot be fully trusted; this is the minimum server sanity layer.

| Column | Type | Notes |
|---|---|---|
| game_id | uuid PK FK games | |
| score_direction | text | `higher_better` \| `lower_better` |
| min_score | bigint not null default 0 | |
| max_score | bigint not null | hard reject above/below |
| min_duration_ms | int not null | reject instant “perfect” runs |
| max_duration_ms | int not null | aligned with `sessionMinutes` + slack |
| max_score_per_second | numeric null | optional extra bound |

Out-of-bounds submits are **rejected**, not written to `personal_bests` or Redis. Optionally store a rejected `score_events` row with `accepted = false` for abuse forensics (rate-limit those IPs/users).

### play_sessions

Issued when play **starts** (`POST /api/play/:slug/start`). Required on score submit. A score cannot be submitted without a live session for that user + game.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid null FK | null if guest |
| guest_id | uuid null FK guests | exactly one of user/guest |
| game_id | uuid FK | |
| token_hash | text unique | HMAC-SHA256 of the issued session token |
| started_at | timestamptz | |
| expires_at | timestamptz | start + session window + short grace |
| submitted_at | timestamptz null | |
| status | text | `open` `submitted` `expired` `rejected` |
| ip | inet null | |

**Flow:** start → server stores `token_hash`, returns opaque token (httpOnly cookie or response body for the play client). Submit (`POST /api/play/:slug/score`) must present that token. Server checks: hash matches, `status = open`, not expired, game matches, subject matches, duration and score pass `game_score_rules`. Then one-time consume: `status = submitted`. Replay of the same session is `409`.

This is **not** cryptographic proof of a fair client (the game still runs in the browser). It stops drive-by POSTs and unbound score spam. Achievements and leaderboards only read **accepted** scores.

### score_events

Append-only. Leaderboards and achievements **ignore** `accepted = false`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| play_session_id | uuid unique FK | one event per session |
| user_id | uuid null FK | |
| guest_id | uuid null | guests do **not** enter global boards |
| game_id | uuid FK | |
| score | bigint | |
| stars | int | |
| metric | text null | |
| duration_ms | int | |
| accepted | boolean not null | |
| reject_reason | text null | `bounds` `expired_session` `no_session` `replay` |
| created_at | timestamptz | |

### personal_bests

Unique `(user_id, game_id)`: `score`, `stars`, `metric`, `achieved_at`, `score_event_id`. Updated only from **accepted** events that beat the current best (`score_direction`).

### leaderboard_outbox

Keeps Redis ZSETs aligned with Postgres when Redis is down or a process dies mid-write.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| game_id | uuid | |
| user_id | uuid | |
| score | bigint | best to publish (after PB upsert) |
| score_event_id | uuid FK | |
| created_at | timestamptz | |
| published_at | timestamptz null | Redis ZADD succeeded |

**Write path (score submit, after bounds + session checks):**

1. In one Postgres transaction: insert `score_events`, upsert `personal_bests` if improved, insert `leaderboard_outbox` row (`published_at` null).
2. After commit: `ZADD lb:{slug}:global` (and invalidate `lb:{slug}:friends:*` for that user’s friends, or delete those keys).
3. If Redis succeeds: set `published_at`. If it fails: leave unpublished; **do not** roll back the accepted score.
4. Worker every few seconds: `SELECT … WHERE published_at IS NULL`, retry ZADD, then mark published.
5. Reconciliation job (e.g. every 15 min + on boot): for each game, rebuild the ZSET from `personal_bests` (authoritative). Outbox is the fast path; rebuild is the safety net.

Friends boards are **derived cache** (TTL ~2 min) from accepted PBs ∩ accepted friendships — never a second source of truth.

### session_allowance

| Column | Notes |
|---|---|
| subject_id | user id **or** guest id |
| subject_kind | `user` \| `guest` |
| date_key | Kolkata calendar day |
| used | int |

Unique `(subject_kind, subject_id, date_key)`. Cap from config (prototype 3). Incremented on **play start** (session issued), not on score submit, so abandoned starts still consume the free-today allowance.

### guests

`id uuid`, `created_at`. Issued as httpOnly cookie. Replaces forgeable `guestKey` in localStorage for allowance.

### achievement_defs + user_achievements

Defs: `id`, `title`, `game_id` null (global), `rule jsonb` (e.g. `{ "type": "plays", "game": "sudoku", "n": 10 }`), `cosmetic_id` null. Unlocks **only** after server validates **accepted** `score_events` / completions. Cosmetic only — no cash.

### cosmetics + user_cosmetics + user_loadout

`kind`: frame \| theme \| badge \| trophy. Loadout: one equipped of each kind per user.

### login_streaks

`user_id` PK, `current_streak`, `longest_streak`, `last_login_date_key` (Kolkata).

### daily_challenges + daily_challenge_completions

One featured `game_id` per `date_key`. Completion is an accepted play session for that game on that date. Reward is a cosmetic id, never currency.

### friendships

`requester_id`, `addressee_id`, `status` (`pending` `accepted` `declined` `blocked`), unique pair with `requester_id < addressee_id` **or** store canonical `user_low`, `user_high` plus `initiated_by`.

### challenge_links

`code` unique, `from_user_id`, `game_id`, `score`, `expires_at`. Shareable “beat my score” URL. Score on the link must match an **accepted** personal best (or the specific accepted event). Rate-limited.

### rooms + room_members + room_snapshots

Postgres during play: `code`, `mode`, `host_user_id`, `created_at`, `ended_at` null, member list.

**Live phase, draws, dice, scores** live in Redis (`room:{code}`) and are the source of truth **until close**.

On close (all players left, host ended, idle timeout, or crash recovery), **atomically**:

1. Read Redis JSON.
2. Insert `room_snapshots` (`room_id`, `closed_at`, `close_reason`, `final_state jsonb`, `player_count`, `winner_user_id` null).
3. Set `rooms.ended_at`, `rooms.close_reason` (`all_left` \| `host_ended` \| `timeout` \| `crash_recover`).
4. Publish a final WS event, then delete Redis key (or short TTL for late reconnects).

`room_snapshots.final_state` is required for history; `rooms` without a snapshot after `ended_at` is a bug — a sweeper finds `ended_at IS NOT NULL AND snapshot missing` and `ended_at IS NULL` rooms whose Redis key is gone / heartbeat stale, then snapshots whatever remains (or `{ "incomplete": true }`).

**Heartbeat:** Redis `room:{code}:hb` refreshed while anyone is connected. Startup: scan live room keys, snapshot+close stale ones.

### content_notes, support_tickets, user_settings, audit_log

Match existing journal/help notes, contact tickets, reduced-motion/sound settings.

`audit_log`: `actor_id` (nullable for SQL/CLI), `action`, `target`, `payload`, `created_at`. Sensitive actions include membership grant/revoke, game publish, **and role changes performed outside HTTP**.

---

## Role escalation

- Default `role = player` on insert.
- Register, login, `/me` update, and `POST /api/migrations/local-v1` **strip/ignore** `role`. A body that tries to set `role` is a validation error.
- **No** `PATCH /api/admin/users/:id/role`. Admin HTTP can manage membership, catalog, and notes — not privilege.
- Production admin: ops runbook SQL (`UPDATE users SET role = 'admin' WHERE email = …`) or an internal CLI that is not mounted on the public Fastify app. Write `audit_log` (`action = role_change`, `actor_id` null or ops identity).
- Prototype `operations@bullwavegames.com` is never auto-promoted from localStorage.

---

## Redis

| Key | Purpose |
|---|---|
| `sess:{jti}` | Optional access-token denylist |
| `rl:auth:{ip}` / `rl:invite:{user}` / `rl:score:{user}` | Rate limits |
| `lb:{slug}:global` | ZSET of **accepted PBs** — cache of `personal_bests` |
| `lb:{slug}:friends:{userId}` | Derived cache, short TTL |
| `room:{code}` | Live room JSON |
| `room:{code}:hb` | Last heartbeat |
| `room:chan:{code}` | Pub/sub fan-out |

Postgres `personal_bests` wins if Redis disagrees. Rebuild job is the reconciliation path.

---

## API contract (keep vs break)

**Keep:** plan ids, most entitlement `status` strings, payment `status` strings, game slugs, room `type: state` payloads where possible.

**Break:**

1. User JSON **must not** include `password`.
2. Admin HTTP APIs require `Authorization: Bearer` + `role=admin` (UI guard stays as UX only). **Admin cannot set `role` over HTTP.**
3. Checkout: `POST /api/billing/subscribe` with `planId` + `billingInterval`; server maps to a **pre-created** Razorpay plan ID.
4. After login, localStorage is at most a cache; entitlement is fetched from `GET /api/me`.
5. `MembershipStatus` adds `past_due`; `GET /api/me` includes `graceEnd`.
6. Score submit requires a `play_session` token from `/play/:slug` start; out-of-bounds scores are rejected.
7. Challenge-link scores must match an accepted server PB.

---

## localStorage migration (`bullwave.v1`)

Prototype passwords cannot be imported. Flow:

1. User proves email (magic link or new password).
2. Optional `POST /api/migrations/local-v1` with saves, cosmetics, displayName.
3. **Do not import personal bests as accepted leaderboard scores** (they were client-trusted). Import as `game_saves` / a `migrated_local_bests` flag for profile display only, or require a new accepted session to rank. Achievements from local flags are **not** granted until rules pass on accepted events.
4. Ignore `password`, `role`, and prototype admin `operations@bullwavegames.com`.
5. Force password reset if they still have only a client-stored password.

---

## Implement after approval, in this order

Shipped in this order in `backend/src`.

1. Auth (register, verify, login, **rotating refresh + family reuse**, reset). Role: DB/CLI only.
2. Membership + Razorpay webhooks + auto-renew + **`past_due` / grace_end** + access_end
3. `play_sessions` + `game_score_rules` + accepted scores + outbox write-through + rebuild job
4. Friends + challenge links
5. Admin APIs + audit log (**no role endpoint**)
6. Rooms: Redis live + **snapshot on close** + stale sweeper
