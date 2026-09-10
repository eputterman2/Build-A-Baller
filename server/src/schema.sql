-- Application schema. Run idempotently on startup.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_user_icon_id TEXT NOT NULL DEFAULT '';
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
  hall_of_fame_count INTEGER NOT NULL DEFAULT 0,
  all_star_count INTEGER NOT NULL DEFAULT 0,
  rank_metrics_version INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE builds ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS motto TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS total_stats INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS hall_of_fame_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS all_star_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS rank_metrics_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS user_icon_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS card_frame_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS card_banner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS character_id TEXT NOT NULL DEFAULT '';

UPDATE users u
SET equipped_user_icon_id = picked.user_icon_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, user_icon_id
  FROM builds
  WHERE user_icon_id <> ''
  ORDER BY user_id, created_at DESC
) picked
WHERE u.id = picked.user_id
  AND u.equipped_user_icon_id = '';

CREATE TABLE IF NOT EXISTS user_bundles (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id    TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS user_reward_bundles (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL,
  reason    TEXT NOT NULL DEFAULT '',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS user_daily_logins (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, login_date)
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

CREATE TABLE IF NOT EXISTS player_drawing_poll_options (
  poll_id    TEXT NOT NULL,
  slot       INTEGER NOT NULL,
  option_id  TEXT NOT NULL,
  label      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, slot),
  UNIQUE (poll_id, option_id)
);

CREATE TABLE IF NOT EXISTS contest_entries (
  id               TEXT PRIMARY KEY,
  user_id          TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drawing_data_url TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest_entry_examples (
  id               TEXT PRIMARY KEY,
  user_id          TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drawing_data_url TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO contest_entry_examples (id, user_id, drawing_data_url, created_at, updated_at)
SELECT id, user_id, drawing_data_url, created_at, updated_at
FROM contest_entries
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS contest_votes (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, voter_user_id, week_start)
);

CREATE TABLE IF NOT EXISTS contest_entry_impressions (
  entry_id   TEXT NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 1,
  shown_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, viewer_key)
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

CREATE TABLE IF NOT EXISTS site_visit_days (
  visitor_id   TEXT NOT NULL,
  visit_date   DATE NOT NULL,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_path    TEXT NOT NULL DEFAULT '/',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, visit_date)
);

CREATE TABLE IF NOT EXISTS site_issue_events (
  id           BIGSERIAL PRIMARY KEY,
  visitor_id   TEXT,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  issue_type   TEXT NOT NULL,
  message      TEXT NOT NULL,
  path         TEXT NOT NULL DEFAULT '/',
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
  ON builds (overall DESC, total_stats DESC, hall_of_fame_count DESC, all_star_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS builds_user_idx ON builds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_bundles_user_idx ON user_bundles (user_id);
CREATE INDEX IF NOT EXISTS user_reward_bundles_user_idx ON user_reward_bundles (user_id);
CREATE INDEX IF NOT EXISTS user_daily_logins_user_idx ON user_daily_logins (user_id, login_date DESC);
CREATE INDEX IF NOT EXISTS player_of_day_wins_user_idx ON player_of_day_wins (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_of_day_wins_leader_idx ON player_of_day_wins (user_id, win_date);
CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON poll_votes (poll_id, option_id);
CREATE INDEX IF NOT EXISTS player_drawing_poll_options_poll_idx
  ON player_drawing_poll_options (poll_id, slot);
CREATE INDEX IF NOT EXISTS contest_entries_created_idx ON contest_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS contest_entry_examples_updated_idx ON contest_entry_examples (updated_at DESC);
CREATE INDEX IF NOT EXISTS contest_votes_week_idx ON contest_votes (week_start, entry_id);
CREATE INDEX IF NOT EXISTS contest_votes_voter_week_idx ON contest_votes (voter_user_id, week_start);
CREATE INDEX IF NOT EXISTS contest_entry_impressions_entry_idx ON contest_entry_impressions (entry_id);
CREATE INDEX IF NOT EXISTS feedback_messages_created_idx ON feedback_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS site_visit_days_date_idx ON site_visit_days (visit_date DESC, visitor_id);
CREATE INDEX IF NOT EXISTS site_issue_events_created_idx ON site_issue_events (created_at DESC);
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
               ORDER BY b.overall DESC, b.total_stats DESC, b.hall_of_fame_count DESC, b.all_star_count DESC, b.created_at ASC
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
