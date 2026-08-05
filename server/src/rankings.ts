import { buildRankMetrics, type PickMap, type ScoreResult } from '@shared/index';
import { query } from './db';

const RANK_METRICS_VERSION = 3;

interface UnrankedBuild {
  id: string;
  picks: PickMap;
  result: ScoreResult;
}

export async function backfillBuildRankMetrics(): Promise<void> {
  const result = await query<UnrankedBuild>(
    `SELECT id, picks, result
     FROM builds
     WHERE rank_metrics_version < $1`,
    [RANK_METRICS_VERSION],
  );

  for (const build of result.rows) {
    const metrics = buildRankMetrics(build.result, build.picks);
    await query(
      `UPDATE builds
       SET total_stats = $1, hall_of_fame_count = $2, all_star_count = $3, rank_metrics_version = $4
       WHERE id = $5`,
      [
        metrics.totalStats,
        metrics.hallOfFameCount,
        metrics.allStarCount,
        RANK_METRICS_VERSION,
        build.id,
      ],
    );
  }
}

export { RANK_METRICS_VERSION };
