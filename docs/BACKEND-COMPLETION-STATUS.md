# Backend completion evidence

The backend is not yet release-complete. This checklist supplements BACKEND-DESIGN.md; it does not replace its acceptance requirements.

## Current local changes

- Serialized periodic jobs, draining shutdown, worker database pool of three connections, and Redis retry scheduling.
- Support assignment/resolution/reopening with transactional audit records (migration 008).
- One-time transactional local import, preserved server saves, and no imported cosmetic grants (migration 009).
- Partial admin game edits preserve omitted values and update all accepted fields.
- Identity deletion and leaderboard backlog alerts; 60-second queue-age threshold.
- Event-loop delay and room queued-action latency metrics. These are not proof of network action-to-broadcast latency.
- Atomic shared rate limits; Redis failure returns 503.
- GitHub Actions with isolated PostgreSQL/Redis and integration suites, matching Docker's Node 22 runtime.

Local build passed. The unit suite has 46 passing tests. The workflow has not run; added database verifiers have not yet passed against real PostgreSQL/Redis. No deployment or load-test success is claimed.

## Outstanding acceptance work

- Run all migrations and integration suites on isolated services; fix failures before release.
- Verify private application schema, restricted database role, and Supabase profile RLS against the design.
- Implement and verify durable transactional email delivery. Play reminders are browser-only in the current product; do not infer email consent from those settings.
- Complete separate-worker deployment configuration and validate startup/shutdown on staging.
- Measure database pool waits and five-minute API error/latency alerts; connect operational alert delivery.
- Verify room reconnect, timeout races, restart recovery, hidden-state isolation and final snapshot uniqueness under real dependencies.
- Prove the documented 30-minute combined HTTP/room load gate and backup restore rehearsal.
- Verify real Supabase and Razorpay test-mode flows and service configuration in staging.

Horizontal replica ownership remains a prerequisite before adding replicas, as specified by the single-instance launch design.
