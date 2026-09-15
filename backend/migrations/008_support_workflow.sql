ALTER TABLE support_tickets
  ADD COLUMN status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  ADD COLUMN assigned_to uuid REFERENCES users(id),
  ADD COLUMN resolution text,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX support_tickets_status_created_idx ON support_tickets(status, created_at DESC);
