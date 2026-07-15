-- Application schema. Run idempotently on startup.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS builds (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall     INTEGER NOT NULL,
  grade       TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT '',
  motto       TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  picks       JSONB NOT NULL,
  result      JSONB NOT NULL,
  total_stats INTEGER NOT NULL DEFAULT 0,
  all_star_count INTEGER NOT NULL DEFAULT 0,
  rank_metrics_version INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE builds ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS motto TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS total_stats INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS all_star_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS rank_metrics_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS user_icon_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS card_frame_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS card_banner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS character_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS user_bundles (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id    TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS player_of_day_wins (
  id         TEXT PRIMARY KEY,
  build_id   TEXT UNIQUE NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  win_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id    TEXT NOT NULL,
  voter_key  TEXT NOT NULL,
  option_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, voter_key)
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  username     TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL,
  word_count   INTEGER NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_drawing_requests (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type   TEXT NOT NULL,
  subject        TEXT NOT NULL,
  photo_data_url TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL,
  stripe_session_id TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending_payment',
  paid_at        TIMESTAMPTZ,
  admin_note     TEXT NOT NULL DEFAULT '',
  final_name     TEXT NOT NULL DEFAULT '',
  final_drawing_data_url TEXT NOT NULL DEFAULT '',
  visibility     TEXT NOT NULL DEFAULT 'private',
  min_overall    INTEGER NOT NULL DEFAULT 0,
  max_overall    INTEGER NOT NULL DEFAULT 99,
  build_hint     TEXT NOT NULL DEFAULT '',
  admin_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
  fulfilled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS stripe_session_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS final_name TEXT NOT NULL DEFAULT '';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS final_drawing_data_url TEXT NOT NULL DEFAULT '';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS min_overall INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS max_overall INTEGER NOT NULL DEFAULT 99;
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS build_hint TEXT NOT NULL DEFAULT '';
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS admin_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE market_drawing_requests ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS builds_overall_idx ON builds (overall DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS builds_rank_idx
  ON builds (overall DESC, total_stats DESC, all_star_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS builds_user_idx ON builds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_bundles_user_idx ON user_bundles (user_id);
CREATE INDEX IF NOT EXISTS player_of_day_wins_user_idx ON player_of_day_wins (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_of_day_wins_leader_idx ON player_of_day_wins (user_id, win_date);
CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON poll_votes (poll_id, option_id);
CREATE INDEX IF NOT EXISTS feedback_messages_created_idx ON feedback_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS market_drawing_requests_user_idx
  ON market_drawing_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_drawing_requests_status_idx
  ON market_drawing_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS app_migrations (
  key        TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time cleanup requested before the July 2, 2026 Replit release.
DO $reset_users_2026_07_02$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migrations
    WHERE key = 'reset-users-and-builds-2026-07-02'
  ) THEN
    UPDATE feedback_messages SET username = '' WHERE user_id IS NOT NULL;
    DELETE FROM poll_votes WHERE voter_key LIKE 'user:%';
    DELETE FROM users;
    INSERT INTO app_migrations (key)
    VALUES ('reset-users-and-builds-2026-07-02');
  END IF;
END
$reset_users_2026_07_02$;

-- One-time cleanup requested before the July 7, 2026 Replit release.
DO $reset_users_2026_07_07$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migrations
    WHERE key = 'reset-users-builds-and-account-data-2026-07-07'
  ) THEN
    UPDATE feedback_messages SET username = '' WHERE user_id IS NOT NULL;
    DELETE FROM poll_votes WHERE voter_key LIKE 'user:%';
    DELETE FROM users;
    INSERT INTO app_migrations (key)
    VALUES ('reset-users-builds-and-account-data-2026-07-07');
  END IF;
END
$reset_users_2026_07_07$;

-- Backfill one award for historical daily winners; future awards are recorded
-- when a saved build takes the live Player of the Day spot.
DO $backfill_player_of_day_wins_2026_07_08$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migrations
    WHERE key = 'backfill-player-of-day-wins-2026-07-08'
  ) THEN
    INSERT INTO player_of_day_wins (id, build_id, user_id, win_date, created_at)
    SELECT 'backfill-' || id, id, user_id, win_date, created_at
    FROM (
      SELECT b.id, b.user_id, b.created_at::date AS win_date, b.created_at,
             ROW_NUMBER() OVER (
               PARTITION BY b.created_at::date
               ORDER BY b.overall DESC, b.total_stats DESC, b.all_star_count DESC, b.created_at ASC
             ) AS day_place
      FROM builds b
    ) daily_winners
    WHERE day_place = 1
    ON CONFLICT (build_id) DO NOTHING;

    INSERT INTO app_migrations (key)
    VALUES ('backfill-player-of-day-wins-2026-07-08');
  END IF;
END
$backfill_player_of_day_wins_2026_07_08$;
