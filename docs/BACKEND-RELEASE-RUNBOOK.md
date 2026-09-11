# Backend release runbook

Use this for a staging release first, then repeat the same flow for production.

## Before deployment

1. Run `npm run typecheck` and `npm test` in `backend`.
2. Build the image from the repository root: `docker build -f backend/Dockerfile .`.
3. Configure separate API and worker services. Set `SERVICE_KIND=api` for the WebSocket/API service and `SERVICE_KIND=worker` for the worker.
4. Configure production values: `NODE_ENV=production`, `AUTH_MODE=supabase`, `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on the worker only, exact `CORS_ORIGINS`, `TRUSTED_PROXIES`, SMTP, and Razorpay keys, plans, and webhook secret.
5. Confirm `ALLOW_DEV_BILLING=false` and `BILLING_MODE=razorpay`.

## Release

1. Run `npm run migrate:prod` once as a release job. The migration runner uses a PostgreSQL advisory lock.
2. Run `npm run seed:prod` only for an initial catalog. Do not seed on normal releases.
3. Deploy the worker, then the API service. Keep one API instance while rooms use Redis live state.
4. Verify `/health/live` and `/health/ready`; readiness must report both database and Redis as `up`.
5. Sign in as an administrator and inspect `GET /api/admin/operations`. Pending jobs should drain, oldest age should stay low, and dead-letter counts must be zero.

## Staging acceptance

1. Create a Razorpay test subscription and verify success, decline, cancellation, pending, duplicate-webhook, and out-of-order webhook paths.
2. Test a room create, join, disconnect, resume within 30 seconds, expiry after 30 seconds, and server restart behavior.
3. Confirm a room closure creates a `room_snapshot_outbox` row and the worker completes it into `room_snapshots`.
4. Verify a non-admin receives `403` from `/api/admin/operations`.
5. Record API and room latency, worker queue age, error rate, and memory during a representative load run.

## Backup and recovery rehearsal

1. Create a point-in-time backup or provider snapshot of the staging database.
2. Restore it into a separate staging database; never restore over the active database.
3. Run migrations and verify row counts for `users`, `memberships`, `orders`, `invoices`, `score_events`, `room_snapshots`, and `schema_migrations`.
4. Record the backup timestamp, restore duration, observed recovery point, and operator in the deployment record.

## Rollback

1. Stop the new API and worker deployment.
2. Deploy the previously compatible image.
3. Do not reverse additive database migrations during an incident. Apply a forward corrective migration after the service is stable.
4. Inspect `/api/admin/operations`, worker logs, and Razorpay webhook delivery before reopening checkout.
