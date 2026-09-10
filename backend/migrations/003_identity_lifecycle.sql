CREATE TABLE identity_migration_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  requested_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_migration_tickets_user_idx
  ON identity_migration_tickets (user_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN deletion_status text NOT NULL DEFAULT 'active'
    CHECK (deletion_status IN ('active', 'pending', 'completed', 'failed')),
  ADD COLUMN deletion_requested_at timestamptz;

CREATE TABLE identity_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users (id),
  supabase_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_deletion_jobs_due_idx
  ON identity_deletion_jobs (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');
