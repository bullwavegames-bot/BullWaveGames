CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  billing_email citext NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  avatar_id text NOT NULL DEFAULT 'lantern',
  email_verified_at timestamptz,
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  onboarding_complete boolean NOT NULL DEFAULT false,
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens (id),
  user_agent text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

CREATE TABLE email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_kind_idx ON email_tokens (user_id, kind);

CREATE TABLE plans (
  id text PRIMARY KEY CHECK (id IN ('wave', 'surge', 'tide')),
  name text NOT NULL,
  monthly_paise integer NOT NULL,
  annual_paise integer NOT NULL,
  razorpay_plan_monthly text,
  razorpay_plan_annual text,
  continue_cap integer NOT NULL,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  plan_id text REFERENCES plans (id),
  status text NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'pending', 'active', 'active_until', 'past_due', 'expired')),
  billing_interval text CHECK (billing_interval IN ('monthly', 'annual')),
  source text NOT NULL DEFAULT 'none' CHECK (source IN ('none', 'payment', 'admin_grant')),
  razorpay_customer_id text,
  razorpay_subscription_id text UNIQUE,
  access_start timestamptz,
  access_end timestamptz,
  grace_end timestamptz,
  last_payment_failed_at timestamptz,
  dunning_retry_count integer NOT NULL DEFAULT 0,
  next_payment_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  auto_renew boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans (id),
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'annual')),
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'pending', 'succeeded', 'declined', 'canceled', 'expired', 'uncertain')),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  razorpay_subscription_id text,
  razorpay_signature text,
  activated boolean NOT NULL DEFAULT false,
  reference text NOT NULL,
  safe_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders (id),
  plan_id text NOT NULL REFERENCES plans (id),
  amount_paise integer NOT NULL,
  status text NOT NULL CHECK (status IN ('paid', 'failed', 'pending')),
  paid_at timestamptz,
  razorpay_invoice_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_idx ON invoices (user_id, created_at DESC);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  genre text NOT NULL,
  session_minutes integer NOT NULL,
  fantasy text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  how_to_play jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover text NOT NULL DEFAULT '',
  cover_alt text NOT NULL DEFAULT '',
  preview_alt text NOT NULL DEFAULT '',
  controls jsonb NOT NULL DEFAULT '{"desktop":[],"touch":[]}'::jsonb,
  member_access boolean NOT NULL DEFAULT true,
  rotation_eligible boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT true,
  maintenance boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  unsupported_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_score_rules (
  game_id uuid PRIMARY KEY REFERENCES games (id) ON DELETE CASCADE,
  score_direction text NOT NULL DEFAULT 'higher_better' CHECK (score_direction IN ('higher_better', 'lower_better')),
  min_score bigint NOT NULL DEFAULT 0,
  max_score bigint NOT NULL,
  min_duration_ms integer NOT NULL,
  max_duration_ms integer NOT NULL,
  max_score_per_second numeric
);

CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests (id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games (id),
  token_hash text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'expired', 'rejected')),
  ip inet,
  CHECK ((user_id IS NULL) <> (guest_id IS NULL))
);
CREATE INDEX play_sessions_user_idx ON play_sessions (user_id, started_at DESC);

CREATE TABLE score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_session_id uuid NOT NULL UNIQUE REFERENCES play_sessions (id),
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests (id),
  game_id uuid NOT NULL REFERENCES games (id),
  score bigint NOT NULL,
  stars integer NOT NULL DEFAULT 0,
  metric text,
  duration_ms integer NOT NULL,
  accepted boolean NOT NULL,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX score_events_game_accepted_idx ON score_events (game_id, accepted, score DESC);

CREATE TABLE personal_bests (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  score bigint NOT NULL,
  stars integer NOT NULL DEFAULT 0,
  metric text,
  achieved_at timestamptz NOT NULL,
  score_event_id uuid NOT NULL REFERENCES score_events (id),
  PRIMARY KEY (user_id, game_id)
);
CREATE INDEX personal_bests_game_score_idx ON personal_bests (game_id, score DESC);

CREATE TABLE leaderboard_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  score bigint NOT NULL,
  score_event_id uuid NOT NULL REFERENCES score_events (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX leaderboard_outbox_pending_idx ON leaderboard_outbox (created_at) WHERE published_at IS NULL;

CREATE TABLE game_saves (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  label text NOT NULL DEFAULT 'Saved run',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE session_allowance (
  subject_kind text NOT NULL CHECK (subject_kind IN ('user', 'guest')),
  subject_id uuid NOT NULL,
  date_key date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_kind, subject_id, date_key)
);

CREATE TABLE achievement_defs (
  id text PRIMARY KEY,
  title text NOT NULL,
  game_slug text,
  rule jsonb NOT NULL,
  cosmetic_id text
);

CREATE TABLE user_achievements (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES achievement_defs (id),
  earned_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE cosmetics (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('frame', 'theme', 'badge', 'trophy')),
  name text NOT NULL,
  requirement text NOT NULL DEFAULT '',
  artwork text NOT NULL DEFAULT ''
);

CREATE TABLE user_cosmetics (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cosmetic_id text NOT NULL REFERENCES cosmetics (id),
  owned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE user_loadout (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  frame_id text REFERENCES cosmetics (id),
  theme_id text REFERENCES cosmetics (id),
  badge_id text REFERENCES cosmetics (id)
);

CREATE TABLE login_streaks (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_login_date_key date
);

CREATE TABLE daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key date NOT NULL UNIQUE,
  game_id uuid NOT NULL REFERENCES games (id),
  rules text NOT NULL DEFAULT '',
  cosmetic_id text REFERENCES cosmetics (id)
);

CREATE TABLE daily_challenge_completions (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES daily_challenges (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  score bigint,
  play_session_id uuid REFERENCES play_sessions (id),
  PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE friendships (
  user_low uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL REFERENCES users (id),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high)
);

CREATE TABLE challenge_links (
  code text PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games (id),
  score bigint NOT NULL,
  score_event_id uuid REFERENCES score_events (id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenge_links_user_idx ON challenge_links (from_user_id, created_at DESC);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  mode text NOT NULL,
  host_user_id uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  close_reason text CHECK (close_reason IN ('all_left', 'host_ended', 'timeout', 'crash_recover'))
);

CREATE TABLE room_members (
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  player_id text NOT NULL,
  user_id uuid REFERENCES users (id),
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, player_id)
);

CREATE TABLE room_snapshots (
  room_id uuid PRIMARY KEY REFERENCES rooms (id) ON DELETE CASCADE,
  closed_at timestamptz NOT NULL DEFAULT now(),
  close_reason text NOT NULL,
  final_state jsonb NOT NULL,
  player_count integer NOT NULL DEFAULT 0,
  winner_user_id uuid REFERENCES users (id)
);

CREATE TABLE content_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id),
  name text NOT NULL,
  email citext NOT NULL,
  topic text NOT NULL,
  message text NOT NULL,
  payment_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  reduced_motion boolean NOT NULL DEFAULT false,
  ui_sound boolean NOT NULL DEFAULT false,
  game_sound boolean NOT NULL DEFAULT false,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_interval text NOT NULL DEFAULT 'tomorrow',
  sound_consent boolean NOT NULL DEFAULT false
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users (id),
  action text NOT NULL,
  target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
