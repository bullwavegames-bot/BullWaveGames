ALTER TABLE webhook_events
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN last_error text,
  ADD COLUMN occurred_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX webhook_events_pending_idx
  ON webhook_events (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE memberships ADD COLUMN last_billing_event_at timestamptz;

CREATE UNIQUE INDEX invoices_order_payment_idx
  ON invoices (order_id, razorpay_payment_id)
  WHERE order_id IS NOT NULL AND razorpay_payment_id IS NOT NULL;
