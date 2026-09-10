import { randomUUID } from 'node:crypto';
import {
  ARCHETYPE_CHARACTER_RULES,
  ALL_BUNDLES_BY_ID,
  CHRISTMAS_BUNDLE_ID,
  FLAME_BUNDLE_ID,
  GOLDEN_STATE_BUNDLE_ID,
  HIGH_OVERALL_DRAWING_PRIZE_ID,
  LOGIN_STREAK_BUNDLE_ID,
  ONYX_FRAME_BUNDLE_ID,
  PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  SHOE_BUNDLE_ID,
  SPRITE_BUNDLE_ID,
} from '@shared/index';
import { query } from './db';

const TIER_RANGES = [
  { min: 99, max: 99 },
  { min: 96, max: 98 },
  { min: 92, max: 95 },
  { min: 88, max: 91 },
  { min: 82, max: 87 },
  { min: 76, max: 81 },
  { min: 0, max: 75 },
];

const BAY_BUNDLE_DAILY_LOGIN_DAYS = 7;
const SHOE_BUNDLE_DRAWING_COUNT = 40;
const SPRITE_BUNDLE_LOW_OVERALL_THRESHOLD = 45;
const CHRISTMAS_BUNDLE_DRAWING_COUNT = 20;
const LOGIN_STREAK_BANNER_DAYS = 3;
const ONYX_FRAME_MIN_OVERALL = 97;
const HIGH_OVERALL_DRAWING_MIN_OVERALL = 93;
const REPEATABLE_RANDOM_DRAWING_TEST_USERNAME = 'jiww';

let schemaReady = false;

export interface DailyLoginRewardStatus {
  currentStreak: number;
  requiredDays: number;
  checkedDays: boolean[];
  complete: boolean;
}

export interface BuildPrizeProgress {
  bestOverall: number | null;
  worstOverall: number | null;
}

export async function ensureRewardBundleSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_reward_bundles (
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bundle_id TEXT NOT NULL,
      reason    TEXT NOT NULL DEFAULT '',
      earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, bundle_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS user_reward_bundles_user_idx ON user_reward_bundles (user_id)');
  await query(`
    CREATE TABLE IF NOT EXISTS user_daily_logins (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      login_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, login_date)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS user_daily_logins_user_idx ON user_daily_logins (user_id, login_date DESC)');
  await query(`
    CREATE TABLE IF NOT EXISTS user_reward_drawings (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prize_id   TEXT NOT NULL,
      drawing_id TEXT NOT NULL,
      earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, prize_id),
      UNIQUE (user_id, drawing_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS user_reward_drawings_user_idx ON user_reward_drawings (user_id)');
  schemaReady = true;
}

export async function getRewardDrawingIds(userId: string): Promise<string[]> {
  await ensureRewardBundleSchema();
  const result = await query<{ drawing_id: string }>(
    `SELECT drawing_id
     FROM user_reward_drawings
     WHERE user_id = $1
     ORDER BY earned_at ASC`,
    [userId],
  );
  return result.rows.map(row => row.drawing_id);
}

export async function recordDailyLogin(userId: string): Promise<void> {
  await ensureRewardBundleSchema();
  await query(
    `INSERT INTO user_daily_logins (user_id, login_date)
     VALUES ($1, CURRENT_DATE)
     ON CONFLICT (user_id, login_date) DO NOTHING`,
    [userId],
  );
}

async function dailyLoginStreak(userId: string): Promise<number> {
  await ensureRewardBundleSchema();
  const result = await query<{ day_offset: number; logged_in: boolean }>(
    `SELECT
       day_offset::int AS day_offset,
       EXISTS (
         SELECT 1
         FROM user_daily_logins
         WHERE user_id = $1
           AND login_date = CURRENT_DATE - day_offset::int
       ) AS logged_in
     FROM generate_series(0, $2::int - 1) AS day_offset
     ORDER BY day_offset ASC`,
    [userId, BAY_BUNDLE_DAILY_LOGIN_DAYS],
  );

  let streak = 0;
  for (const row of result.rows) {
    if (!row.logged_in) break;
    streak += 1;
  }
  return streak;
}

async function ownsBundle(userId: string, bundleId: string): Promise<boolean> {
  const result = await query<{ owned: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM user_bundles WHERE user_id = $1 AND bundle_id = $2
       UNION
       SELECT 1 FROM user_reward_bundles WHERE user_id = $1 AND bundle_id = $2
     ) AS owned`,
    [userId, bundleId],
  );
  return Boolean(result.rows[0]?.owned);
}

async function awardBayBundleForDailyLoginStreak(userId: string): Promise<void> {
  const streak = await dailyLoginStreak(userId);
  if (streak < BAY_BUNDLE_DAILY_LOGIN_DAYS) return;
  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, GOLDEN_STATE_BUNDLE_ID, 'Logged in 7 days in a row'],
  );
}

async function awardLoginStreakBannerForThreeDays(userId: string): Promise<void> {
  const streak = await dailyLoginStreak(userId);
  if (streak < LOGIN_STREAK_BANNER_DAYS) return;
  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, LOGIN_STREAK_BUNDLE_ID, 'Logged in 3 days in a row'],
  );
}

async function awardShoeBundleForDrawingCollection(userId: string): Promise<void> {
  const [buildResult, bundleResult, winResult] = await Promise.all([
    query<{ character_id: string }>(
      `SELECT DISTINCT character_id
       FROM builds
       WHERE user_id = $1`,
      [userId],
    ),
    query<{ bundle_id: string }>(
      `SELECT bundle_id FROM user_bundles WHERE user_id = $1
       UNION
       SELECT bundle_id FROM user_reward_bundles WHERE user_id = $1`,
      [userId],
    ),
    query<{ has_win: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM player_of_day_wins WHERE user_id = $1
       ) AS has_win`,
      [userId],
    ),
  ]);

  const requiredDrawingIds = new Set(ARCHETYPE_CHARACTER_RULES.map(rule => rule.id));
  const collectedDrawingIds = new Set(
    buildResult.rows
      .map(row => row.character_id)
      .filter(characterId => requiredDrawingIds.has(characterId)),
  );
  for (const row of bundleResult.rows) {
    const drawingId = ALL_BUNDLES_BY_ID[row.bundle_id]?.drawingId;
    if (drawingId && requiredDrawingIds.has(drawingId)) collectedDrawingIds.add(drawingId);
  }
  if (winResult.rows[0]?.has_win) collectedDrawingIds.add(PLAYER_OF_DAY_PRIZE_CHARACTER_ID);
  if (collectedDrawingIds.size < SHOE_BUNDLE_DRAWING_COUNT) return;

  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, SHOE_BUNDLE_ID, 'Collected 40 player drawings'],
  );
}

async function awardSpriteBundleForLowOverallBuild(userId: string): Promise<void> {
  const result = await query<{ qualifies: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM builds
       WHERE user_id = $1
         AND overall <= $2
     ) AS qualifies`,
    [userId, SPRITE_BUNDLE_LOW_OVERALL_THRESHOLD],
  );
  if (!result.rows[0]?.qualifies) return;
  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, SPRITE_BUNDLE_ID, 'Built a 45 OVR or lower card'],
  );
}

async function awardOnyxFrameForHighOverallBuild(userId: string): Promise<void> {
  const result = await query<{ qualifies: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM builds
       WHERE user_id = $1
         AND overall >= $2
     ) AS qualifies`,
    [userId, ONYX_FRAME_MIN_OVERALL],
  );
  if (!result.rows[0]?.qualifies) return;
  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, ONYX_FRAME_BUNDLE_ID, 'Built a 97+ overall card'],
  );
}

const PRIZE_DRAWING_IDS = new Set([
  PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  ...Object.values(ALL_BUNDLES_BY_ID).map(bundle => bundle.drawingId).filter(Boolean),
]);

export interface RewardDrawing {
  id: string;
  name: string;
  src: string;
}

export async function isRepeatableRandomDrawingTestAccount(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  const result = await query<{ is_test_account: boolean }>(
    `SELECT username = $2 AS is_test_account FROM users WHERE id = $1`,
    [userId, REPEATABLE_RANDOM_DRAWING_TEST_USERNAME],
  );
  return Boolean(result.rows[0]?.is_test_account);
}

function rewardDrawingFromId(drawingId: string): RewardDrawing | null {
  const drawing = ARCHETYPE_CHARACTER_RULES.find(rule => rule.id === drawingId);
  return drawing ? { id: drawing.id, name: drawing.name, src: drawing.src } : null;
}

export async function claimHighOverallDrawing(userId: string): Promise<RewardDrawing> {
  await ensureRewardBundleSchema();
  const repeatableTestAccount = await isRepeatableRandomDrawingTestAccount(userId);

  if (!repeatableTestAccount) {
    const existing = await query<{ drawing_id: string }>(
      `SELECT drawing_id
       FROM user_reward_drawings
       WHERE user_id = $1 AND prize_id = $2`,
      [userId, HIGH_OVERALL_DRAWING_PRIZE_ID],
    );
    const existingDrawing = existing.rows[0] ? rewardDrawingFromId(existing.rows[0].drawing_id) : null;
    if (existingDrawing) return existingDrawing;
  }

  const qualifyingBuild = await query<{ qualifies: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM builds WHERE user_id = $1 AND overall >= $2
     ) AS qualifies`,
    [userId, HIGH_OVERALL_DRAWING_MIN_OVERALL],
  );
  if (!qualifyingBuild.rows[0]?.qualifies) throw new Error('Build a 93+ overall card before claiming this prize.');

  const [buildResult, bundleResult, playerOfDayResult, rewardDrawingIds] = await Promise.all([
    query<{ character_id: string }>('SELECT DISTINCT character_id FROM builds WHERE user_id = $1', [userId]),
    query<{ bundle_id: string }>(
      `SELECT bundle_id FROM user_bundles WHERE user_id = $1
       UNION SELECT bundle_id FROM user_reward_bundles WHERE user_id = $1`,
      [userId],
    ),
    query<{ has_win: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM player_of_day_wins WHERE user_id = $1) AS has_win`,
      [userId],
    ),
    getRewardDrawingIds(userId),
  ]);

  const ownedDrawingIds = new Set(buildResult.rows.map(row => row.character_id));
  for (const row of bundleResult.rows) {
    const drawingId = ALL_BUNDLES_BY_ID[row.bundle_id]?.drawingId;
    if (drawingId) ownedDrawingIds.add(drawingId);
  }
  if (playerOfDayResult.rows[0]?.has_win) ownedDrawingIds.add(PLAYER_OF_DAY_PRIZE_CHARACTER_ID);
  rewardDrawingIds.forEach(drawingId => ownedDrawingIds.add(drawingId));

  const candidates = ARCHETYPE_CHARACTER_RULES.filter(rule =>
    !PRIZE_DRAWING_IDS.has(rule.id) && !ownedDrawingIds.has(rule.id),
  );
  if (!candidates.length) throw new Error('There are no eligible player drawings left to award.');

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const prizeId = repeatableTestAccount
    ? `${HIGH_OVERALL_DRAWING_PRIZE_ID}:${randomUUID()}`
    : HIGH_OVERALL_DRAWING_PRIZE_ID;
  const inserted = await query<{ drawing_id: string }>(
    `INSERT INTO user_reward_drawings (user_id, prize_id, drawing_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, prize_id) DO NOTHING
     RETURNING drawing_id`,
    [userId, prizeId, selected.id],
  );
  const drawingId = inserted.rows[0]?.drawing_id;
  const drawing = drawingId ? rewardDrawingFromId(drawingId) : null;
  if (!drawing) throw new Error('The drawing prize could not be finalized.');
  return drawing;
}

async function awardChristmasBundleForDrawingCollection(userId: string): Promise<void> {
  const [buildResult, bundleResult, winResult] = await Promise.all([
    query<{ character_id: string }>(
      `SELECT DISTINCT character_id
       FROM builds
       WHERE user_id = $1`,
      [userId],
    ),
    query<{ bundle_id: string }>(
      `SELECT bundle_id FROM user_bundles WHERE user_id = $1
       UNION
       SELECT bundle_id FROM user_reward_bundles WHERE user_id = $1`,
      [userId],
    ),
    query<{ has_win: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM player_of_day_wins WHERE user_id = $1
       ) AS has_win`,
      [userId],
    ),
  ]);

  const requiredDrawingIds = new Set(ARCHETYPE_CHARACTER_RULES.map(rule => rule.id));
  const collectedDrawingIds = new Set(
    buildResult.rows
      .map(row => row.character_id)
      .filter(characterId => requiredDrawingIds.has(characterId)),
  );
  for (const row of bundleResult.rows) {
    const drawingId = ALL_BUNDLES_BY_ID[row.bundle_id]?.drawingId;
    if (drawingId && requiredDrawingIds.has(drawingId)) collectedDrawingIds.add(drawingId);
  }
  if (winResult.rows[0]?.has_win) collectedDrawingIds.add(PLAYER_OF_DAY_PRIZE_CHARACTER_ID);
  if (collectedDrawingIds.size < CHRISTMAS_BUNDLE_DRAWING_COUNT) return;

  await query(
    `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, CHRISTMAS_BUNDLE_ID, 'Collected 20 player drawings'],
  );
}

export async function getBuildPrizeProgress(userId: string): Promise<BuildPrizeProgress> {
  await ensureRewardBundleSchema();
  await awardShoeBundleForDrawingCollection(userId);
  await awardSpriteBundleForLowOverallBuild(userId);
  await awardOnyxFrameForHighOverallBuild(userId);
  const result = await query<{ best_overall: number | null; worst_overall: number | null }>(
    `SELECT
       MAX(overall)::int AS best_overall,
       MIN(overall)::int AS worst_overall
     FROM builds
     WHERE user_id = $1`,
    [userId],
  );
  return {
    bestOverall: result.rows[0]?.best_overall ?? null,
    worstOverall: result.rows[0]?.worst_overall ?? null,
  };
}

export async function getDailyLoginRewardStatus(userId: string): Promise<DailyLoginRewardStatus> {
  await recordDailyLogin(userId);
  await awardBayBundleForDailyLoginStreak(userId);

  const currentStreak = await dailyLoginStreak(userId);
  const complete = await ownsBundle(userId, GOLDEN_STATE_BUNDLE_ID);
  const checkedDays = Array.from(
    { length: BAY_BUNDLE_DAILY_LOGIN_DAYS },
    (_, index) => complete || index < currentStreak,
  );

  return {
    currentStreak,
    requiredDays: BAY_BUNDLE_DAILY_LOGIN_DAYS,
    checkedDays,
    complete,
  };
}

async function tierLeaderUserIds(): Promise<Set<string>> {
  const winners = new Set<string>();
  for (const tier of TIER_RANGES) {
    const result = await query<{ user_id: string }>(
      `WITH user_ranked AS (
         SELECT
           b.user_id,
           b.overall,
           b.total_stats,
           b.hall_of_fame_count,
           b.all_star_count,
           b.created_at,
           ROW_NUMBER() OVER (
             PARTITION BY b.user_id
             ORDER BY b.overall DESC, b.total_stats DESC, b.hall_of_fame_count DESC, b.all_star_count DESC, b.created_at DESC
           ) AS user_place
         FROM builds b
         WHERE b.overall >= $1
           AND b.overall <= $2
       )
       SELECT user_id
       FROM user_ranked
       WHERE user_place <= 3
       ORDER BY overall DESC, total_stats DESC, hall_of_fame_count DESC, all_star_count DESC, created_at DESC
       LIMIT 1`,
      [tier.min, tier.max],
    );
    const userId = result.rows[0]?.user_id;
    if (userId) winners.add(userId);
  }
  return winners;
}

export async function refreshLeaderboardRewardBundles(): Promise<void> {
  await ensureRewardBundleSchema();
  const winners = await tierLeaderUserIds();
  for (const userId of winners) {
    await query(
      `INSERT INTO user_reward_bundles (user_id, bundle_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, bundle_id) DO NOTHING`,
      [userId, FLAME_BUNDLE_ID, 'Reached #1 on a tier leaderboard'],
    );
  }
}

export async function getOwnedBundleIdsWithRewards(userId: string): Promise<string[]> {
  await refreshLeaderboardRewardBundles();
  await awardBayBundleForDailyLoginStreak(userId);
  await awardLoginStreakBannerForThreeDays(userId);
  await awardShoeBundleForDrawingCollection(userId);
  await awardSpriteBundleForLowOverallBuild(userId);
  await awardOnyxFrameForHighOverallBuild(userId);
  await awardChristmasBundleForDrawingCollection(userId);
  const result = await query<{ bundle_id: string }>(
    `SELECT DISTINCT bundle_id
     FROM (
       SELECT bundle_id FROM user_bundles WHERE user_id = $1
       UNION ALL
       SELECT bundle_id FROM user_reward_bundles WHERE user_id = $1
     ) owned
     ORDER BY bundle_id ASC`,
    [userId],
  );
  return result.rows.map(row => row.bundle_id);
}
