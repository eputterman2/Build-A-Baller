import {
  ATTRIBUTES,
  ATTRIBUTE_GROUPS,
  PLAYERS,
  attributeScore,
  computeBuild,
  scoreBuild,
  type AttributeKey,
  type Player,
  type RawValues,
} from '../shared/src/index';

const KEEP_RATE = 0.80;
const TRIALS = Number(process.argv[2] ?? 100_000);
const BENCH_ROUND = 2; // Scoring: the highest-weight group in the final overall.
const ratedAttributes = ATTRIBUTES.filter(attribute => attribute.type === 'rating');

const playerQuality = (player: Player) =>
  ratedAttributes.reduce(
    (sum, attr) => sum + attributeScore(attr, player[attr.key] as number),
    0,
  ) / ratedAttributes.length;

const specialtyPlayers = PLAYERS.filter(player => player.team === 'STAR');
const regularPlayers = PLAYERS.filter(player => player.team !== 'STAR')
  .sort((a, b) => playerQuality(a) - playerQuality(b))
  .slice(Math.floor(PLAYERS.filter(player => player.team !== 'STAR').length * (1 - KEEP_RATE)));
const spinPool = [...regularPlayers, ...specialtyPlayers];
const bodyKeys = new Set<AttributeKey>(['height', 'weight', 'wingspan']);
const typicalRatedValues = Object.fromEntries(ratedAttributes.map(attribute => [
  attribute.key,
  spinPool.reduce((sum, player) => sum + (player[attribute.key] as number), 0) / spinPool.length,
])) as Partial<RawValues>;

let seed = 0xBA11E7;
function random() {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function samplePlayer() {
  return spinPool[Math.floor(random() * spinPool.length)];
}

function sampleDistinct(count: number) {
  const players: Player[] = [];
  const ids = new Set<string>();
  while (players.length < count) {
    const player = samplePlayer();
    if (!ids.has(player.id)) {
      ids.add(player.id);
      players.push(player);
    }
  }
  return players;
}

function bestAssignment(
  existing: Partial<RawValues>,
  keys: AttributeKey[],
  players: Player[],
): Partial<RawValues> {
  let best = existing;
  let bestOverall = -Infinity;

  function assign(index: number, values: Partial<RawValues>, used: Set<number>) {
    if (index === keys.length) {
      const evaluationValues = keys.every(key => bodyKeys.has(key))
        ? { ...typicalRatedValues, ...values }
        : values;
      const overall = computeBuild(evaluationValues).overall ?? 0;
      if (overall > bestOverall) {
        bestOverall = overall;
        best = values;
      }
      return;
    }

    const key = keys[index];
    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      if (used.has(playerIndex)) continue;
      used.add(playerIndex);
      assign(
        index + 1,
        { ...values, [key]: players[playerIndex][key] as number },
        used,
      );
      used.delete(playerIndex);
    }
  }

  assign(0, existing, new Set());
  return best;
}

function rationalGamble(values: RawValues) {
  const originalOverall = scoreBuild(values).overall;
  const candidateKeys = ATTRIBUTES.map(attribute => attribute.key);

  let bestKey: AttributeKey | null = null;
  let bestExpectedGain = 0;
  for (const candidateKey of candidateKeys) {
    let total = 0;
    for (let sample = 0; sample < 8; sample += 1) {
      const player = samplePlayer();
      total += scoreBuild({
        ...values,
        [candidateKey]: player[candidateKey] as number,
      }).overall;
    }
    const expectedGain = total / 8 - originalOverall;
    if (expectedGain > bestExpectedGain) {
      bestExpectedGain = expectedGain;
      bestKey = candidateKey;
    }
  }

  if (!bestKey || bestExpectedGain < 0.35) {
    return { values, used: false };
  }

  const replacement = samplePlayer();
  return {
    values: { ...values, [bestKey]: replacement[bestKey] as number },
    used: true,
  };
}

const ranges = [
  { label: '75 and below', min: -Infinity, max: 75 },
  { label: '76-81', min: 76, max: 81 },
  { label: '82-87', min: 82, max: 87 },
  { label: '88-91', min: 88, max: 91 },
  { label: '92-95', min: 92, max: 95 },
  { label: '96-98', min: 96, max: 98 },
  { label: '99', min: 99, max: 99 },
] as const;

function summarize(overalls: number[]) {
  const sorted = [...overalls].sort((a, b) => a - b);
  return {
    mean: overalls.reduce((sum, overall) => sum + overall, 0) / overalls.length,
    median: sorted[Math.floor(sorted.length / 2)],
    ranges: ranges.map(range => ({
      label: range.label,
      count: overalls.filter(overall => overall >= range.min && overall <= range.max).length,
    })),
  };
}

const noGamble: number[] = [];
const withGamble: number[] = [];
let gambleUses = 0;

for (let trial = 0; trial < TRIALS; trial += 1) {
  let values: Partial<RawValues> = {};

  for (let groupIndex = 0; groupIndex < ATTRIBUTE_GROUPS.length; groupIndex += 1) {
    const group = ATTRIBUTE_GROUPS[groupIndex];
    const playerCount = group.keys.length + (groupIndex === BENCH_ROUND ? 1 : 0);
    values = bestAssignment(values, group.keys, sampleDistinct(playerCount));
  }

  const fullValues = values as RawValues;
  noGamble.push(scoreBuild(fullValues).overall);
  const gambled = rationalGamble(fullValues);
  if (gambled.used) gambleUses += 1;
  withGamble.push(scoreBuild(gambled.values).overall);
}

function printSummary(label: string, overalls: number[]) {
  const summary = summarize(overalls);
  console.log(`\n${label}`);
  console.log(`Mean: ${summary.mean.toFixed(2)} | Median: ${summary.median}`);
  for (const range of summary.ranges) {
    console.log(
      `${range.label.padEnd(12)} ${((range.count / overalls.length) * 100).toFixed(2).padStart(6)}%`,
    );
  }
  console.log(`90+: ${(overalls.filter(overall => overall >= 90).length / overalls.length * 100).toFixed(2)}%`);
  console.log(`95+: ${(overalls.filter(overall => overall >= 95).length / overalls.length * 100).toFixed(2)}%`);
}

console.log(`Trials: ${TRIALS.toLocaleString()}`);
console.log(
  `Spin pool: ${spinPool.length} players (${regularPlayers.length} regular, ${specialtyPlayers.length} specialty)`,
);
printSummary('Strong drafting, bench used in Scoring, gamble skipped', noGamble);
printSummary('Strong drafting with rational optional gamble', withGamble);
console.log(`Gamble used: ${(gambleUses / TRIALS * 100).toFixed(2)}%`);
