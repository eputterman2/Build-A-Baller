import { buildRankMetrics, type PickMap, type ScoreResult } from '@shared/index';
import { query } from './db';

const RANK_METRICS_VERSION = 2;

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
       SET total_stats = $1, all_star_count = $2, rank_metrics_version = $3
       WHERE id = $4`,
      [metrics.totalStats, metrics.allStarCount, RANK_METRICS_VERSION, build.id],
    );
  }
}

export { RANK_METRICS_VERSION };
