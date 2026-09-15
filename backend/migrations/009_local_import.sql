CREATE TABLE local_save_imports (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now()
);
