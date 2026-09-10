ALTER TABLE orders
  ADD COLUMN idempotency_key text,
  ADD COLUMN provider_error_code text,
  ADD COLUMN provider_error_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX orders_user_idempotency_idx
  ON orders (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX orders_razorpay_subscription_idx
  ON orders (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

ALTER TABLE orders ADD CONSTRAINT orders_idempotency_key_length
  CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 16 AND 128);

CREATE INDEX orders_creating_idx
  ON orders (created_at)
  WHERE status IN ('creating', 'uncertain');
