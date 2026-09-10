ALTER TABLE leaderboard_outbox
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN publishing_at timestamptz,
  ADD COLUMN last_error text;

DROP INDEX leaderboard_outbox_pending_idx;
CREATE INDEX leaderboard_outbox_pending_idx
  ON leaderboard_outbox (next_attempt_at, created_at)
  WHERE published_at IS NULL;

CREATE INDEX friendships_user_low_status_idx ON friendships (user_low, status);
CREATE INDEX friendships_user_high_status_idx ON friendships (user_high, status);
