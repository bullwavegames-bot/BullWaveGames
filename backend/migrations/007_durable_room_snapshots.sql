CREATE TABLE room_snapshot_outbox (
  room_id uuid PRIMARY KEY REFERENCES rooms (id) ON DELETE CASCADE,
  close_reason text NOT NULL CHECK (close_reason IN ('all_left', 'host_ended', 'timeout', 'crash_recover')),
  final_state jsonb NOT NULL,
  player_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX room_snapshot_outbox_pending_idx
  ON room_snapshot_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');
