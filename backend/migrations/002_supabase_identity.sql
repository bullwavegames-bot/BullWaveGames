ALTER TABLE users
  ADD COLUMN auth_provider text NOT NULL DEFAULT 'legacy'
    CHECK (auth_provider IN ('legacy', 'supabase')),
  ADD COLUMN supabase_user_id uuid;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX users_supabase_user_id_idx
  ON users (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

ALTER TABLE users ADD CONSTRAINT users_auth_identity_check CHECK (
  (auth_provider = 'legacy' AND password_hash IS NOT NULL AND supabase_user_id IS NULL)
  OR
  (auth_provider = 'supabase' AND password_hash IS NULL AND supabase_user_id IS NOT NULL)
);

