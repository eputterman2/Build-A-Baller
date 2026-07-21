import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  ACCESSORIES_BY_ID, ARCHETYPE_CHARACTER_RULES, ATTRIBUTES, EMPTY_BUILD_ACCESSORIES,
  EMPTY_PLAYER_IDENTITY, MARKET_BUNDLES_BY_ID, PLAYERS_BY_ID,
  buildArchetype, buildRankMetrics, customCharacterId, customCharacterImageSrc, customCharacterRequestId,
  customDrawingMatchesArchetype,
  getArchetypeCharacterById, gradeFor, inCharacterOverallRange, isCustomCharacterId,
  normalizePlayerIdentity, scoreBuild, selectArchetypeCharacter, selectLegacyEmptyBuildCharacter,
  type AccessoryType, type AttributeKey, type BuildAccessories, type BuildDetail, type BuildSummary, type CollectionBuild, type PlayerOfDay,
  type DrawingCollectionLeader, type DrawingCollectionStats, type DrawingOption, type PlayerOfDayLeader, type PlayerOfDayWin, type PickMap, type RawValues, type ScoreResult,
} from '@shared/index';
import { query } from '../db';
import { requireAuth } from '../auth';
import { RANK_METRICS_VERSION } from '../rankings';
import {
  identityModerationError,
  safePublicIdentity,
  safePublicUsername,
} from '../moderation';

export const buildsRouter = Router();

const GLOBAL_LEADERBOARD_LIMIT = 100;
const GLOBAL_TIER_LEADERBOARD_LIMIT = 9;
const GLOBAL_CARDS_PER_USER = 3;
const COLLECTION_LIMIT = 50;
const PLAYER_OF_DAY_WIN_CARD_LIMIT = 30;

const attrKeys = ATTRIBUTES.map(a => a.key) as [AttributeKey, ...AttributeKey[]];

// picks: every attribute key mapped to a valid player id.
const submitSchema = z.object({
  picks: z.object(
    Object.fromEntries(attrKeys.map(k => [k, z.string()])) as
      Record<AttributeKey, z.ZodString>,
  ),
  identity: z.object({
    playerName: z.string().optional(),
    motto: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  accessories: z.object({
    userIconId: z.string().optional(),
    cardFrameId: z.string().optional(),
    cardBannerId: z.string().optional(),
  }).optional(),
  characterId: z.string().optional(),
});

const identitySchema = z.object({
  identity: z.object({
    playerName: z.string().optional(),
    motto: z.string().optional(),
    country: z.string().optional(),
  }),
});

const accessoriesSchema = z.object({
  accessories: z.object({
    userIconId: z.string().optional(),
    cardFrameId: z.string().optional(),
    cardBannerId: z.string().optional(),
  }),
});

const usernameIconSchema = z.object({
  userIconId: z.string().optional(),
});

const characterSchema = z.object({
  characterId: z.string(),
});

async function getOwnedBundleIds(userId: string): Promise<Set<string>> {
  const result = await query<{ bundle_id: string }>(
    'SELECT bundle_id FROM user_bundles WHERE user_id = $1',
    [userId],
  );
  return new Set(result.rows.map(row => row.bundle_id));
}

async function getOwnedMarketDrawingIds(userId: string): Promise<Set<string>> {
  const bundleIds = await getOwnedBundleIds(userId);
  const drawingIds = new Set<string>();
  for (const bundleId of bundleIds) {
    const drawingId = MARKET_BUNDLES_BY_ID[bundleId]?.drawingId;
    if (drawingId) drawingIds.add(drawingId);
  }
  return drawingIds;
}

interface CustomDrawingRow {
  id: string;
  user_id: string;
  final_name: string;
  visibility: 'public' | 'private';
  min_overall: number;
  max_overall: number;
  build_hint: string;
}

function isCustomDrawingEligible(row: CustomDrawingRow, overall: number): boolean {
  return overall >= row.min_overall && overall <= row.max_overall;
}

function isCustomDrawingBuildMatch(row: CustomDrawingRow, result: ScoreResult): boolean {
  return customDrawingMatchesArchetype(row.build_hint, buildArchetype(result));
}

async function getCompletedCustomDrawing(
  requestId: string,
  userId: string,
): Promise<CustomDrawingRow | null> {
  const result = await query<CustomDrawingRow>(
    `SELECT id, user_id, final_name, visibility, min_overall, max_overall, build_hint
     FROM market_drawing_requests
     WHERE id = $1
       AND status = 'fulfilled'
       AND final_drawing_data_url <> ''
       AND (visibility = 'public' OR user_id = $2)`,
    [requestId, userId],
  );
  return result.rows[0] ?? null;
}

async function getAvailableCustomDrawings(userId: string): Promise<CustomDrawingRow[]> {
  const result = await query<CustomDrawingRow>(
    `SELECT id, user_id, final_name, visibility, min_overall, max_overall, build_hint
     FROM market_drawing_requests
     WHERE status = 'fulfilled'
       AND final_drawing_data_url <> ''
       AND (visibility = 'public' OR user_id = $1)
     ORDER BY fulfilled_at DESC, created_at DESC`,
    [userId],
  );
  return result.rows;
}

function cleanAccessoryId(id?: string): string {
  return typeof id === 'string' ? id.trim() : '';
}

function validateAccessoryId(
  id: string,
  type: AccessoryType,
  ownedBundleIds: Set<string>,
): string | null {
  if (!id) return '';
  const accessory = ACCESSORIES_BY_ID[id];
  if (!accessory || accessory.type !== type) return null;
  return ownedBundleIds.has(accessory.bundleId) ? id : null;
}

async function normalizeBuildAccessories(
  userId: string,
  raw?: Partial<BuildAccessories>,
): Promise<{ accessories: BuildAccessories; error: string | null }> {
  const ownedBundleIds = await getOwnedBundleIds(userId);
  const userIconId = validateAccessoryId(cleanAccessoryId(raw?.userIconId), 'userIcon', ownedBundleIds);
  const cardFrameId = validateAccessoryId(cleanAccessoryId(raw?.cardFrameId), 'cardFrame', ownedBundleIds);
  const cardBannerId = validateAccessoryId(cleanAccessoryId(raw?.cardBannerId), 'cardBanner', ownedBundleIds);
  if (userIconId == null || cardFrameId == null || cardBannerId == null) {
    return { accessories: EMPTY_BUILD_ACCESSORIES, error: 'That accessory is not available on your account.' };
  }
  return { accessories: { userIconId, cardFrameId, cardBannerId }, error: null };
}

async function normalizeUsernameIcon(
  userId: string,
  userIconId?: string,
): Promise<{ userIconId: string; error: string | null }> {
  const ownedBundleIds = await getOwnedBundleIds(userId);
  const normalized = validateAccessoryId(cleanAccessoryId(userIconId), 'userIcon', ownedBundleIds);
  if (normalized == null) return { userIconId: '', error: 'That username icon is not available on your account.' };
  return { userIconId: normalized, error: null };
}

async function getEquippedUsernameIcon(userId: string): Promise<string> {
  const result = await query<{ equipped_user_icon_id: string }>(
    'SELECT equipped_user_icon_id FROM users WHERE id = $1',
    [userId],
  );
  return result.rows[0]?.equipped_user_icon_id ?? '';
}

function characterIdForBuild(
  result?: ScoreResult | unknown,
  picks?: PickMap | unknown,
  characterId?: string | null,
): string {
  const requested = typeof characterId === 'string' ? characterId.trim() : '';
  if (isCustomCharacterId(requested)) return requested;
  const scoreResult = result as ScoreResult | undefined;
  const pickMap = picks as PickMap | undefined;
  if (requested && scoreResult) {
    const rule = getArchetypeCharacterById(requested);
    if (rule && inCharacterOverallRange(rule, scoreResult.overall)) return requested;
  }
  return scoreResult && pickMap ? selectLegacyEmptyBuildCharacter(scoreResult, pickMap).id : requested;
}

async function getUnlockedCharacterIds(userId: string): Promise<Set<string>> {
  const [buildResult, bundleResult] = await Promise.all([
    query<DrawingBuildRow>(
      `SELECT character_id, picks, result
       FROM builds
       WHERE user_id = $1`,
      [userId],
    ),
    query<{ bundle_id: string }>(
      'SELECT bundle_id FROM user_bundles WHERE user_id = $1',
      [userId],
    ),
  ]);

  const ids = new Set<string>();
  for (const build of buildResult.rows) {
    const id = characterIdForBuild(build.result, build.picks, build.character_id);
    if (id) ids.add(id);
  }
  for (const bundle of bundleResult.rows) {
    const drawingId = MARKET_BUNDLES_BY_ID[bundle.bundle_id]?.drawingId;
    if (drawingId) ids.add(drawingId);
  }
  return ids;
}

async function normalizeCharacterIdForBuild(
  userId: string,
  result: ScoreResult,
  picks: PickMap,
  rawCharacterId?: string | null,
  currentCharacterId?: string | null,
): Promise<{ characterId: string; error: string | null }> {
  const ownedMarketDrawingIds = await getOwnedMarketDrawingIds(userId);
  const defaultCharacterId = selectArchetypeCharacter(result, picks, ownedMarketDrawingIds).id;
  const requested = typeof rawCharacterId === 'string' ? rawCharacterId.trim() : '';
  const current = typeof currentCharacterId === 'string' ? currentCharacterId.trim() : '';
  if (!requested) return { characterId: defaultCharacterId, error: null };

  if (isCustomCharacterId(requested)) {
    const custom = await getCompletedCustomDrawing(customCharacterRequestId(requested), userId);
    if (!custom) {
      return { characterId: defaultCharacterId, error: 'That custom drawing is not available on your account.' };
    }
    if (!isCustomDrawingEligible(custom, result.overall)) {
      return { characterId: defaultCharacterId, error: 'That custom drawing is not eligible for this overall.' };
    }
    if (!isCustomDrawingBuildMatch(custom, result)) {
      return { characterId: defaultCharacterId, error: 'That custom drawing is not eligible for this build type.' };
    }
    return { characterId: requested, error: null };
  }

  const rule = getArchetypeCharacterById(requested);
  if (!rule) return { characterId: defaultCharacterId, error: 'That player drawing does not exist.' };
  if (!inCharacterOverallRange(rule, result.overall)) {
    return { characterId: defaultCharacterId, error: 'That drawing is not eligible for this overall.' };
  }
  if (requested === defaultCharacterId || requested === current) {
    return { characterId: requested, error: null };
  }

  const unlockedIds = await getUnlockedCharacterIds(userId);
  if (!unlockedIds.has(requested)) {
    return { characterId: defaultCharacterId, error: 'Unlock that drawing before using it on this card.' };
  }
  return { characterId: requested, error: null };
}

function rowToSummary(row: BuildRow): BuildSummary {
  const identity = safePublicIdentity({
    playerName: row.player_name ?? EMPTY_PLAYER_IDENTITY.playerName,
    motto: row.motto ?? EMPTY_PLAYER_IDENTITY.motto,
    country: row.country ?? EMPTY_PLAYER_IDENTITY.country,
  });
	  return {
    id: row.id,
    username: safePublicUsername(row.username),
    overall: row.overall,
    grade: row.grade,
    gradeLabel: row.grade_label,
    createdAt: row.created_at,
    identity,
	    accessories: {
	      userIconId: row.equipped_user_icon_id || row.user_icon_id || '',
	      cardFrameId: row.card_frame_id ?? '',
	      cardBannerId: row.card_banner_id ?? '',
	    },
    characterId: characterIdForBuild(row.result, row.picks, row.character_id),
    originalOwnerDrawing: Boolean(row.original_owner_drawing),
  };
}

function rowToDetail(row: BuildRow): BuildDetail {
  return {
    ...rowToSummary(row),
    result: row.result as BuildDetail['result'],
    picks: row.picks as BuildDetail['picks'],
  };
}

function rowToCollection(row: BuildRow): CollectionBuild {
  return {
    ...rowToDetail(row),
    place: row.place == null ? null : Number(row.place),
  };
}

interface BuildRow {
  id: string;
  user_id?: string;
	  username: string;
	  equipped_user_icon_id?: string;
	  overall: number;
  grade: string;
  grade_label: string;
  player_name?: string;
  motto?: string;
  country?: string;
  user_icon_id?: string;
  card_frame_id?: string;
  card_banner_id?: string;
  character_id?: string;
  created_at: string;
  picks?: Record<AttributeKey, string>;
  result?: unknown;
  place?: number | string;
  win_date?: string;
  total_wins?: number | string;
  original_owner_drawing?: boolean;
}

interface DrawingBuildRow {
  overall: number;
  username?: string;
  character_id?: string;
  picks?: BuildDetail['picks'];
  result?: BuildDetail['result'];
}

async function awardPlayerOfDayWinIfCurrentTop(buildId: string): Promise<void> {
  await query(
    `WITH current_top AS (
       SELECT b.id, b.user_id, b.created_at::date AS win_date
       FROM builds b
       WHERE b.created_at >= CURRENT_DATE
         AND b.created_at < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY b.overall DESC, b.total_stats DESC, b.all_star_count DESC, b.created_at ASC
       LIMIT 1
     )
     INSERT INTO player_of_day_wins (id, build_id, user_id, win_date)
     SELECT $1, id, user_id, win_date
     FROM current_top
     WHERE id = $2
     ON CONFLICT (build_id) DO NOTHING`,
    [randomUUID(), buildId],
  );
}

async function isOriginalOwnerDrawing(characterId: string, userId: string): Promise<boolean> {
  if (!isCustomCharacterId(characterId)) return false;
  const result = await query<{ is_owner: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM market_drawing_requests
       WHERE id = $1 AND user_id = $2
     ) AS is_owner`,
    [customCharacterRequestId(characterId), userId],
  );
  return Boolean(result.rows[0]?.is_owner);
}

function originalOwnerDrawingSql(alias = 'b'): string {
  return `
  CASE
    WHEN ${alias}.character_id LIKE 'custom:%'
     AND EXISTS (
       SELECT 1
       FROM market_drawing_requests mdr
       WHERE mdr.id = substring(${alias}.character_id from 8)
         AND mdr.user_id = ${alias}.user_id
     )
    THEN TRUE
    ELSE FALSE
  END AS original_owner_drawing
`;
}

// Submit a finished build. Scoring is recomputed server-side from the chosen
// players' authoritative values, so clients can't forge inflated scores.
buildsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { picks, identity: rawIdentity, accessories: rawAccessories, characterId: rawCharacterId } = submitSchema.parse(req.body);
    const { identity, errors } = normalizePlayerIdentity(rawIdentity);
    if (errors.length) {
      res.status(400).json({ error: errors[0] });
      return;
    }
    const { accessories, error: accessoriesError } = await normalizeBuildAccessories(req.user!.id, rawAccessories);
    if (accessoriesError) {
      res.status(400).json({ error: accessoriesError });
      return;
    }
    const equippedUserIconId = await getEquippedUsernameIcon(req.user!.id);
    const savedAccessories = {
      ...accessories,
      userIconId: cleanAccessoryId(rawAccessories?.userIconId) ? accessories.userIconId : equippedUserIconId,
    };
    const moderationError = identityModerationError(identity);
    if (moderationError) {
      res.status(400).json({ error: moderationError });
      return;
    }

    const collectionSize = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM builds WHERE user_id = $1',
      [req.user!.id],
    );
    if (Number(collectionSize.rows[0]?.count ?? 0) >= COLLECTION_LIMIT) {
      res.status(409).json({
        error: `Your collection is full. Delete a card before saving another (${COLLECTION_LIMIT} card limit).`,
      });
      return;
    }

    const values = {} as RawValues;
    for (const attr of ATTRIBUTES) {
      const playerId = picks[attr.key];
      const player = PLAYERS_BY_ID[playerId];
      if (!player) {
        res.status(400).json({ error: `Unknown player id for ${attr.key}: ${playerId}` });
        return;
      }
      values[attr.key] = player[attr.key] as number;
    }

    const result = scoreBuild(values);
    const { characterId, error: characterError } = await normalizeCharacterIdForBuild(
      req.user!.id,
      result,
      picks,
      rawCharacterId,
    );
    if (characterError) {
      res.status(400).json({ error: characterError });
      return;
    }
    const rankMetrics = buildRankMetrics(result, picks);
    const grade = gradeFor(result.overall);
    const id = randomUUID();

    await query(
      `INSERT INTO builds
         (id, user_id, overall, grade, grade_label, player_name, motto, country,
          user_icon_id, card_frame_id, card_banner_id, character_id,
          picks, result, total_stats, all_star_count, rank_metrics_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, req.user!.id, result.overall, grade.g, grade.label,
       identity.playerName, identity.motto, identity.country,
       savedAccessories.userIconId, savedAccessories.cardFrameId, savedAccessories.cardBannerId, characterId,
       JSON.stringify(picks), JSON.stringify(result),
       rankMetrics.totalStats, rankMetrics.allStarCount, RANK_METRICS_VERSION],
    );
    await awardPlayerOfDayWinIfCurrentTop(id);
    const originalOwnerDrawing = await isOriginalOwnerDrawing(characterId, req.user!.id);

    res.status(201).json({
      build: {
        id, username: req.user!.username,
        overall: result.overall, grade: grade.g, gradeLabel: grade.label,
        createdAt: new Date().toISOString(),
        identity,
        accessories: savedAccessories,
        characterId,
        originalOwnerDrawing,
        result, picks,
      } satisfies BuildDetail,
    });
  } catch (err) { next(err); }
});

// Top builds across all players.
buildsRouter.get('/leaderboard', async (req, res, next) => {
  try {
    const limit = Math.min(
      GLOBAL_LEADERBOARD_LIMIT,
      Math.max(1, Number(req.query.limit) || GLOBAL_LEADERBOARD_LIMIT),
    );
    const rawMinOverall = typeof req.query.minOverall === 'string' ? Number(req.query.minOverall) : NaN;
    const rawMaxOverall = typeof req.query.maxOverall === 'string' ? Number(req.query.maxOverall) : NaN;
    const minOverall = Number.isFinite(rawMinOverall) ? rawMinOverall : 0;
    const maxOverall = Number.isFinite(rawMaxOverall) ? rawMaxOverall : 99;
    const result = await query<BuildRow>(
      `WITH user_ranked AS (
	         SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label, b.created_at,
                b.player_name, b.motto, b.country, b.picks, b.result,
                b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
                b.total_stats, b.all_star_count,
                ROW_NUMBER() OVER (
                  PARTITION BY b.user_id
                  ORDER BY b.overall DESC, b.total_stats DESC, b.all_star_count DESC, b.created_at DESC
                ) AS user_place
         FROM builds b JOIN users u ON u.id = b.user_id
         WHERE b.overall >= $3
           AND b.overall <= $4
       )
       SELECT ur.id, ur.user_id, ur.username, ur.equipped_user_icon_id, ur.overall, ur.grade, ur.grade_label, ur.created_at,
              ur.player_name, ur.motto, ur.country, ur.picks, ur.result,
              ur.user_icon_id, ur.card_frame_id, ur.card_banner_id, ur.character_id,
              ${originalOwnerDrawingSql('ur')}
       FROM user_ranked ur
       WHERE ur.user_place <= $2
       ORDER BY ur.overall DESC, ur.total_stats DESC, ur.all_star_count DESC, ur.created_at DESC
       LIMIT $1`,
      [limit, GLOBAL_CARDS_PER_USER, minOverall, maxOverall],
    );
    res.json({ builds: result.rows.map(rowToDetail) });
  } catch (err) { next(err); }
});

// Best saved build for the current server day. Equal overalls are separated by
// total adjusted stats, then All-Star picks, then the earliest submission.
buildsRouter.get('/player-of-day', async (req, res, next) => {
  try {
    const dateResult = await query<{ day: string }>('SELECT CURRENT_DATE::text AS day');
    const result = await query<BuildRow>(
	      `SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label, b.created_at,
              b.player_name, b.motto, b.country, b.picks, b.result,
              b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
              ${originalOwnerDrawingSql('b')}
       FROM builds b JOIN users u ON u.id = b.user_id
       WHERE b.created_at >= CURRENT_DATE
         AND b.created_at < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY b.overall DESC, b.total_stats DESC, b.all_star_count DESC, b.created_at ASC
       LIMIT 1`,
    );
    res.json({
      date: dateResult.rows[0]?.day ?? new Date().toISOString().slice(0, 10),
      build: result.rows[0] ? rowToDetail(result.rows[0]) : null,
    } satisfies PlayerOfDay);
  } catch (err) { next(err); }
});

// Users ranked by how many daily-winning builds they have earned.
buildsRouter.get('/player-of-day-leaderboard', async (_req, res, next) => {
  try {
    const result = await query<{ username: string; wins: string }>(
      `SELECT u.username, COUNT(*)::text AS wins
       FROM player_of_day_wins w
       JOIN users u ON u.id = w.user_id
       GROUP BY u.username
       ORDER BY COUNT(*) DESC, username ASC
       LIMIT 100`,
    );
    const leaders: PlayerOfDayLeader[] = result.rows.map(row => ({
      username: safePublicUsername(row.username),
      wins: Number(row.wins),
    }));
    res.json({ leaders });
  } catch (err) { next(err); }
});

// The signed-in user's own builds.
buildsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await query<BuildRow>(
	      `SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label, b.created_at,
              b.player_name, b.motto, b.country,
              b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
              ${originalOwnerDrawingSql('b')}
       FROM builds b JOIN users u ON u.id = b.user_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC LIMIT 50`,
      [req.user!.id],
    );
    res.json({ builds: result.rows.map(rowToSummary) });
  } catch (err) { next(err); }
});

// The signed-in user's saved cards, including their current leaderboard place.
buildsRouter.get('/collection', requireAuth, async (req, res, next) => {
  try {
    const result = await query<BuildRow>(
      `WITH user_ranked AS (
	         SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label,
                b.created_at, b.player_name, b.motto, b.country, b.picks, b.result,
                b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
                b.total_stats, b.all_star_count,
                ROW_NUMBER() OVER (
                  PARTITION BY b.user_id
                  ORDER BY b.overall DESC, b.total_stats DESC, b.all_star_count DESC, b.created_at DESC
                ) AS user_place
         FROM builds b JOIN users u ON u.id = b.user_id
       ),
	       global_ranked AS (
	         SELECT id,
	                ROW_NUMBER() OVER (
	                  PARTITION BY CASE
	                    WHEN overall = 99 THEN 'kryptonite'
	                    WHEN overall BETWEEN 96 AND 98 THEN 'pink-diamond'
	                    WHEN overall BETWEEN 92 AND 95 THEN 'diamond'
	                    WHEN overall BETWEEN 88 AND 91 THEN 'amethyst'
	                    WHEN overall BETWEEN 82 AND 87 THEN 'gold'
	                    WHEN overall BETWEEN 76 AND 81 THEN 'silver'
	                    ELSE 'bronze'
	                  END
	                  ORDER BY overall DESC, total_stats DESC, all_star_count DESC, created_at DESC
	                ) AS place
	         FROM user_ranked
	         WHERE user_place <= $2
	       )
       SELECT ur.id, ur.user_id, ur.username, ur.equipped_user_icon_id, ur.overall, ur.grade, ur.grade_label, ur.created_at,
              ur.player_name, ur.motto, ur.country, ur.picks, ur.result,
              ur.user_icon_id, ur.card_frame_id, ur.card_banner_id, ur.character_id,
              ${originalOwnerDrawingSql('ur')},
              CASE WHEN gr.place <= $3 THEN gr.place ELSE NULL END AS place
       FROM user_ranked ur
       LEFT JOIN global_ranked gr ON gr.id = ur.id
       WHERE ur.user_id = $1
       ORDER BY
         CASE WHEN gr.place <= $3 THEN 0 ELSE 1 END,
         CASE WHEN gr.place <= $3 THEN gr.place END ASC,
         ur.overall DESC,
         ur.total_stats DESC,
         ur.all_star_count DESC,
	         ur.created_at DESC
	       LIMIT $4`,
	      [req.user!.id, GLOBAL_CARDS_PER_USER, GLOBAL_TIER_LEADERBOARD_LIMIT, COLLECTION_LIMIT],
	    );
    res.json({ builds: result.rows.map(rowToCollection) });
  } catch (err) { next(err); }
});

// Per-drawing ownership and win totals for the signed-in user's collection.
buildsRouter.get('/drawing-stats', requireAuth, async (req, res, next) => {
  try {
    const [buildResult, winResult] = await Promise.all([
      query<DrawingBuildRow>(
        `SELECT overall, character_id, picks, result
         FROM builds
         WHERE user_id = $1`,
        [req.user!.id],
      ),
      query<DrawingBuildRow>(
        `SELECT b.overall, b.character_id, b.picks, b.result
         FROM player_of_day_wins w
         JOIN builds b ON b.id = w.build_id
         WHERE w.user_id = $1`,
        [req.user!.id],
      ),
    ]);

    const stats: DrawingCollectionStats = Object.fromEntries(
      ARCHETYPE_CHARACTER_RULES.map(rule => [
        rule.id,
        { cards: 0, highestOverall: 0, playerOfDayWins: 0 },
      ]),
    );

    for (const build of buildResult.rows) {
      const drawingId = characterIdForBuild(build.result, build.picks, build.character_id);
      const drawingStats = stats[drawingId] ??= {
        cards: 0,
        highestOverall: 0,
        playerOfDayWins: 0,
      };
      drawingStats.cards += 1;
      drawingStats.highestOverall = Math.max(drawingStats.highestOverall, build.overall);
    }

    for (const win of winResult.rows) {
      const drawingId = characterIdForBuild(win.result, win.picks, win.character_id);
      const drawingStats = stats[drawingId] ??= {
        cards: 0,
        highestOverall: 0,
        playerOfDayWins: 0,
      };
      drawingStats.playerOfDayWins += 1;
    }

    res.json({ stats });
  } catch (err) { next(err); }
});

// Drawings available to the signed-in user, with eligibility for a specific card overall.
buildsRouter.get('/drawing-options', requireAuth, async (req, res, next) => {
  try {
    const overall = Number(req.query.overall);
    const currentCharacterId = typeof req.query.current === 'string' ? req.query.current : '';
    const archetype = typeof req.query.archetype === 'string' ? req.query.archetype : '';
    if (!Number.isFinite(overall)) {
      res.status(400).json({ error: 'Missing overall.' });
      return;
    }
    const [unlockedIds, customDrawings] = await Promise.all([
      getUnlockedCharacterIds(req.user!.id),
      getAvailableCustomDrawings(req.user!.id),
    ]);
    const options: DrawingOption[] = ARCHETYPE_CHARACTER_RULES
      .filter(rule => unlockedIds.has(rule.id) || rule.id === currentCharacterId)
      .map(rule => ({
        id: rule.id,
        name: rule.name,
        src: rule.src,
        minOverall: rule.minOverall,
        maxOverall: rule.maxOverall,
        owned: unlockedIds.has(rule.id),
        eligible: inCharacterOverallRange(rule, overall),
        current: rule.id === currentCharacterId,
      }));
    for (const drawing of customDrawings) {
      const id = customCharacterId(drawing.id);
      options.push({
        id,
        name: drawing.final_name || 'Custom Drawing',
        src: customCharacterImageSrc(id),
        minOverall: drawing.min_overall,
        maxOverall: drawing.max_overall,
        owned: true,
        eligible: isCustomDrawingEligible(drawing, overall)
          && (!archetype || customDrawingMatchesArchetype(drawing.build_hint, archetype)),
        current: id === currentCharacterId,
      });
    }
    res.json({ options });
  } catch (err) { next(err); }
});

// Users ranked by how many unique player drawings they have collected.
buildsRouter.get('/drawing-collection-leaderboard', async (_req, res, next) => {
  try {
    const [buildResult, bundleResult, customResult] = await Promise.all([
      query<DrawingBuildRow>(
        `SELECT u.username, b.character_id, b.picks, b.result
         FROM builds b
         JOIN users u ON u.id = b.user_id`,
      ),
      query<{ username: string; bundle_id: string }>(
        `SELECT u.username, ub.bundle_id
         FROM user_bundles ub
         JOIN users u ON u.id = ub.user_id`,
      ),
      query<{ username: string; id: string }>(
        `SELECT u.username, r.id
         FROM market_drawing_requests r
         JOIN users u ON u.id = r.user_id
         WHERE r.status = 'fulfilled'
           AND r.final_drawing_data_url <> ''`,
      ),
    ]);
    const byUser = new Map<string, Set<string>>();
    const addDrawing = (rawUsername: string | undefined, drawingId: string | undefined) => {
      const username = safePublicUsername(rawUsername ?? '');
      if (!username || !drawingId) return;
      if (!byUser.has(username)) byUser.set(username, new Set());
      byUser.get(username)!.add(drawingId);
    };
    for (const row of buildResult.rows) {
      const username = safePublicUsername(row.username ?? '');
      const drawingId = characterIdForBuild(row.result, row.picks, row.character_id);
      addDrawing(username, drawingId);
    }
    for (const row of bundleResult.rows) {
      addDrawing(row.username, MARKET_BUNDLES_BY_ID[row.bundle_id]?.drawingId);
    }
    for (const row of customResult.rows) {
      addDrawing(row.username, customCharacterId(row.id));
    }
    const leaders: DrawingCollectionLeader[] = [...byUser.entries()]
      .map(([username, drawings]) => ({ username, drawings: drawings.size }))
      .sort((a, b) => b.drawings - a.drawings || a.username.localeCompare(b.username))
      .slice(0, 100);
    res.json({ leaders });
  } catch (err) { next(err); }
});

// Every day-winning build owned by the signed-in user.
buildsRouter.get('/player-of-day-wins', requireAuth, async (req, res, next) => {
  try {
    const result = await query<BuildRow>(
	      `SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label,
              b.created_at, b.player_name, b.motto, b.country, b.picks, b.result,
              b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
              ${originalOwnerDrawingSql('b')},
              w.win_date::text AS win_date,
              COUNT(*) OVER () AS total_wins
       FROM player_of_day_wins w
       JOIN builds b ON b.id = w.build_id
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC
       LIMIT $2`,
      [req.user!.id, PLAYER_OF_DAY_WIN_CARD_LIMIT],
    );
    const wins: PlayerOfDayWin[] = result.rows.map(row => ({
      ...rowToDetail(row),
      winDate: row.win_date!,
    }));
    res.json({
      wins,
      totalWins: Number(result.rows[0]?.total_wins ?? 0),
    });
  } catch (err) { next(err); }
});

// Update identity details for one of the signed-in user's saved cards.
buildsRouter.patch('/:id/identity', requireAuth, async (req, res, next) => {
  try {
    const { identity: rawIdentity } = identitySchema.parse(req.body);
    const { identity, errors } = normalizePlayerIdentity(rawIdentity);
    if (errors.length) {
      res.status(400).json({ error: errors[0] });
      return;
    }
    const moderationError = identityModerationError(identity);
    if (moderationError) {
      res.status(400).json({ error: moderationError });
      return;
    }

    const result = await query<BuildRow>(
      `UPDATE builds
       SET player_name = $1, motto = $2, country = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, player_name, motto, country`,
      [identity.playerName, identity.motto, identity.country, req.params.id, req.user!.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({ identity });
  } catch (err) { next(err); }
});

// Update card accessories for one of the signed-in user's saved cards.
buildsRouter.patch('/:id/accessories', requireAuth, async (req, res, next) => {
  try {
    const { accessories: rawAccessories } = accessoriesSchema.parse(req.body);
    const { accessories, error } = await normalizeBuildAccessories(req.user!.id, rawAccessories);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const result = await query<BuildRow>(
      `UPDATE builds
       SET user_icon_id = $1, card_frame_id = $2, card_banner_id = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_icon_id, card_frame_id, card_banner_id`,
      [accessories.userIconId, accessories.cardFrameId, accessories.cardBannerId, req.params.id, req.user!.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({ accessories });
  } catch (err) { next(err); }
});

// Update the account-level username icon shown beside this user's name on cards.
buildsRouter.patch('/username-icon', requireAuth, async (req, res, next) => {
  try {
    const { userIconId: rawUserIconId } = usernameIconSchema.parse(req.body);
    const { userIconId, error } = await normalizeUsernameIcon(req.user!.id, rawUserIconId);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    await query('UPDATE users SET equipped_user_icon_id = $1 WHERE id = $2', [userIconId, req.user!.id]);
    await query('UPDATE builds SET user_icon_id = $1 WHERE user_id = $2', [userIconId, req.user!.id]);
    res.json({ userIconId });
  } catch (err) { next(err); }
});

// Swap the saved player drawing for one the user has unlocked and this overall can use.
buildsRouter.patch('/:id/character', requireAuth, async (req, res, next) => {
  try {
    const { characterId: rawCharacterId } = characterSchema.parse(req.body);
    const buildResult = await query<BuildRow>(
      `SELECT id, user_id, overall, grade, grade_label, created_at,
              character_id, picks, result
       FROM builds
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id],
    );
    const build = buildResult.rows[0];
    if (!build?.result || !build.picks) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const { characterId, error } = await normalizeCharacterIdForBuild(
      req.user!.id,
      build.result as ScoreResult,
      build.picks as PickMap,
      rawCharacterId,
      characterIdForBuild(build.result, build.picks, build.character_id),
    );
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const result = await query<{ character_id: string }>(
      `UPDATE builds
       SET character_id = $1
       WHERE id = $2 AND user_id = $3
       RETURNING character_id`,
      [characterId, req.params.id, req.user!.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({
      characterId: result.rows[0].character_id,
      originalOwnerDrawing: await isOriginalOwnerDrawing(result.rows[0].character_id, req.user!.id),
    });
  } catch (err) { next(err); }
});

// Remove a saved build from the signed-in user's collection and leaderboard.
buildsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query<{ id: string }>(
      'DELETE FROM builds WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// A single build with its full breakdown (shareable).
buildsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await query<BuildRow>(
	      `SELECT b.id, b.user_id, u.username, u.equipped_user_icon_id, b.overall, b.grade, b.grade_label, b.created_at,
              b.player_name, b.motto, b.country, b.picks, b.result,
              b.user_icon_id, b.card_frame_id, b.card_banner_id, b.character_id,
              ${originalOwnerDrawingSql('b')}
       FROM builds b JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({
      build: {
        ...rowToSummary(row),
        result: row.result,
        picks: row.picks,
      },
    });
  } catch (err) { next(err); }
});
