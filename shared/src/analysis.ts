import type { AttributeKey, ScoreResult } from './types';
import { ATTRIBUTES } from './attributes';

export interface BuildAnalysis {
  verdict: string;
  strengths: string[];
  weaknesses: string[];
}

const avg = (...values: number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

function articleFor(name: string): 'a' | 'an' {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

function buildHash(r: ScoreResult, salt: string): number {
  let hash = 2166136261;
  const values = `${salt}|${r.overall}|${r.injuryRisk}|${ATTRIBUTES.map(a => r.subScores[a.key]).join('|')}`;
  for (let i = 0; i < values.length; i += 1) {
    hash ^= values.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickForBuild<T>(options: readonly T[], r: ScoreResult, salt: string): T {
  return options[buildHash(r, salt) % options.length];
}

// Short, direct alternatives keep scouting reports from repeating the same line.
const STRENGTH: Record<AttributeKey, readonly string[]> = {
  height: ['Good size', 'Strong height advantage', 'Plays with size'],
  weight: ['Strong frame', 'Handles contact', 'Hard to move'],
  wingspan: ['Long reach', 'Uses length well', 'Covers space with length'],
  athleticism: ['Strong athlete', 'Explosive movement', 'Plays above the rim'],
  speed: ['Fast first step', 'Quick in the open floor', 'Gets up the court quickly'],
  ballHandling: ['Reliable handle', 'Creates off the dribble', 'Protects the ball'],
  shooting: ['Reliable shooter', 'Strong jump shot', 'Spaces the floor'],
  postScoring: ['Strong post game', 'Scores inside', 'Reliable on the block'],
  defense: ['Strong defender', 'Guards multiple positions', 'Makes stops'],
  passing: ['Good passer', 'Finds open teammates', 'Moves the ball well'],
  iq: ['Makes smart decisions', 'Reads the game well', 'Strong basketball IQ'],
  attitude: ['Good teammate', 'Plays the right way', 'Team-first approach'],
  clutch: ['Reliable late in games', 'Handles pressure', 'Makes big plays'],
  durability: ['Stays available', 'Durable player', 'Handles a heavy workload'],
};
const WEAKNESS: Record<AttributeKey, readonly string[]> = {
  height: ['Lacks size', 'Small for the position', 'Can be targeted by bigger players'],
  weight: ['Struggles with contact', 'Needs more strength', 'Can be pushed around'],
  wingspan: ['Limited reach', 'Has trouble contesting', 'Short arms hurt coverage'],
  athleticism: ['Limited athleticism', 'Lacks explosiveness', 'Does not play above the rim'],
  speed: ['Limited quickness', 'Slow in transition', 'Struggles to stay in front'],
  ballHandling: ['Loose handle', 'Struggles under pressure', 'Limited off the dribble'],
  shooting: ['Unreliable shooter', 'Inconsistent jump shot', 'Does not space the floor'],
  postScoring: ['Limited post game', 'Not a post threat', 'Struggles to finish inside'],
  defense: ['Limited defensive impact', 'Struggles to get stops', 'Targeted on defense'],
  passing: ['Limited passing vision', 'Misses open teammates', 'Turns the ball over'],
  iq: ['Makes poor decisions', 'Slow reads', 'Low basketball awareness'],
  attitude: ['Inconsistent effort', 'Can hurt team chemistry', 'Difficult teammate'],
  clutch: ['Quiet late in games', 'Unreliable in big moments', 'Struggles under pressure'],
  durability: ['Injury concern', 'May miss time', 'Struggles to stay healthy'],
};

const VERDICTS = {
  elite: [
    'A star who can lead a team.',
    'A high-level player with few weaknesses.',
    'Built to take over games.',
  ],
  starter: [
    'A strong starter who helps you win.',
    'A dependable player in any lineup.',
    'A quality two-way starter.',
  ],
  rotation: [
    'A useful rotation player.',
    'A solid role player.',
    'Good enough to earn real minutes.',
  ],
  project: [
    'A bench player with work to do.',
    'A limited player who needs development.',
    'Useful in the right matchup.',
  ],
  rough: [
    'This build is not ready for serious minutes.',
    'A major project with clear weaknesses.',
    'Likely fighting for a roster spot.',
  ],
} as const;

const ARCHETYPE_VARIANTS: Record<string, readonly string[]> = {
  '99 Overall': [
    'Anomaly',
    'Alien',
    'Basketball Player',
  ],
  GOAT: ['GOAT'],
  'Rec League Experiment': ['Rec League Experiment', 'Raw Project', 'Long-Term Project'],
  'Talented Headache': ['Talented Headache', 'High-Risk Talent', 'Unpredictable Star'],
  'Glass Cannon': ['Glass Cannon', 'Fragile Scorer', 'High-Risk Scorer'],
  'All-Tools Project': ['All-Tools Project', 'Raw Athlete', 'Athletic Project'],
  'Skill-Only Specialist': ['Skill-Only Specialist', 'Finesse Specialist', 'Skill-First Scorer'],
  'Lumbering Paint Project': ['Lumbering Paint Project', 'Paint-Bound Big', 'Slow Interior Big'],
  'Pocket Blur': ['Pocket Blur', 'Quick Little Guard', 'Speedy Guard'],
  'Point Forward': ['Point Forward', 'Playmaking Forward', 'Lead Forward'],
  'Stretch Big': ['Stretch Big', 'Shooting Big', 'Floor-Spacing Big'],
  'Interior Hub': ['Interior Hub', 'Playmaking Big', 'Post Playmaker'],
  'Rim-Running Anchor': ['Rim-Running Anchor', 'Rim Protector', 'Mobile Center'],
  'Bruising Post Scorer': ['Bruising Post Scorer', 'Power Post Scorer', 'Interior Scorer'],
  'Aerial Playmaker': ['Aerial Playmaker', 'Athletic Creator', 'Above-the-Rim Playmaker'],
  '3-and-D Wing': ['3-and-D Wing', 'Two-Way Wing', 'Perimeter Stopper'],
  'Defensive Playmaker': ['Defensive Playmaker', 'Two-Way Creator', 'Defensive Guard'],
  'Shot-Creating Sniper': ['Shot-Creating Sniper', 'Scoring Guard', 'Pull-Up Shooter'],
  'Movement Shooter': ['Movement Shooter', 'Off-Ball Shooter', 'Shooting Specialist'],
  'Floor General': ['Floor General', 'Pass-First Guard', 'Lead Playmaker'],
  'Slashing Playmaker': ['Slashing Playmaker', 'Driving Creator', 'Rim-Attacking Guard'],
  'Three-Level Scorer': ['Three-Level Scorer', 'Complete Scorer', 'All-Around Scorer'],
  'Lockdown Slasher': ['Lockdown Slasher', 'Two-Way Slasher', 'Defensive Finisher'],
  'Athletic Finisher': ['Athletic Finisher', 'Rim Finisher', 'Transition Threat'],
  'Skilled Shot Maker': ['Skilled Shot Maker', 'Crafty Scorer', 'Shot Maker'],
  'Glue Guy': ['Glue Guy', 'Winning Role Player', 'Team Connector'],
  'Complete Star': ['Complete Star', 'Two-Way Star', 'All-Around Star'],
  'Balanced Starter': ['Balanced Starter', 'Reliable Starter', 'Two-Way Starter'],
  'Bench Spark': ['Bench Spark', 'Energy Scorer', 'Rotation Spark'],
};

const ARCHETYPE_FAMILY = Object.entries(ARCHETYPE_VARIANTS).reduce((map, [family, variants]) => {
  for (const variant of variants) map[variant] = family;
  return map;
}, {} as Record<string, string>);

export function archetypeFamily(name: string): string {
  return ARCHETYPE_FAMILY[name] ?? name;
}

// Concise scouting report from the final scores.
export function analyzeBuild(r: ScoreResult): BuildAnalysis {
  const subs = ATTRIBUTES
    .filter(attribute => attribute.type === 'rating')
    .map(attribute => ({ key: attribute.key, v: r.subScores[attribute.key] }));

  const strengths = subs.filter(s => s.v >= 80).sort((a, b) => b.v - a.v)
    .slice(0, 4).map(s => pickForBuild(STRENGTH[s.key], r, `strength-${s.key}`));
  const weaknesses = subs.filter(s => s.v <= 45).sort((a, b) => a.v - b.v)
    .slice(0, 4).map(s => pickForBuild(WEAKNESS[s.key], r, `weakness-${s.key}`));
  if (!strengths.length) strengths.push(pickForBuild(
    ['No clear strength yet.', 'Does the basics well.', 'Plays within a role.'],
    r,
    'no-strength',
  ));
  if (!weaknesses.length) weaknesses.push(pickForBuild(
    ['No major weakness.', 'No obvious hole.', 'Well-rounded profile.'],
    r,
    'no-weakness',
  ));

  const ov = r.overall;
  const verdictPool =
    ov >= 90 ? VERDICTS.elite
    : ov >= 80 ? VERDICTS.starter
    : ov >= 70 ? VERDICTS.rotation
    : ov >= 58 ? VERDICTS.project
    : VERDICTS.rough;
  const verdict = pickForBuild(verdictPool, r, 'verdict');

  // One short note for lopsided or unusual builds.
  const { physical, skill } = r.categoryScores;
  const h = r.subScores.height;
  const flavorPool =
    ov >= 96 ? ['Very few teams could stop this build.', 'Elite on both ends.', 'Ready to dominate.']
    : physical - skill >= 25 ? ['Relies heavily on athletic ability.', 'The skills still need work.', 'Wins with physical tools.']
    : skill - physical >= 25 ? ['Skilled, but physically limited.', 'Wins with skill more than strength.', 'Needs protection on defense.']
    : r.injuryRisk >= 62 ? ['Health is the main concern.', 'Availability could be an issue.', 'The body may not hold up.']
    : h >= 92 && (r.subScores.ballHandling <= 45 || r.subScores.shooting <= 45)
      ? ['Best suited for the paint.', 'Needs to stay near the basket.', 'A traditional interior big.']
    : h <= 22 ? ['Extremely small for the court.', 'Size will always be a challenge.', 'Built like a very small guard.']
    : null;
  const flavor = flavorPool ? ` ${pickForBuild(flavorPool, r, 'flavor')}` : '';

  return { verdict: verdict + flavor, strengths, weaknesses };
}

function classifyArchetype(r: ScoreResult): string {
  const s = r.subScores;
  const physical = r.categoryScores.physical;
  const skill = r.categoryScores.skill;
  const mental = r.categoryScores.mental;
  const creation = avg(s.ballHandling, s.passing, s.iq);
  const scoring = avg(s.shooting, s.postScoring, s.ballHandling);
  const rimPresence = avg(s.height, s.wingspan, s.defense, s.postScoring);
  const mobility = avg(s.speed, s.athleticism);

  if (r.overall === 99) return '99 Overall';
  if (r.overall >= 96) return 'GOAT';

  // Strange builds get first dibs.
  if (r.overall < 50) return 'Rec League Experiment';
  if (s.attitude <= 38 && r.overall >= 70) return 'Talented Headache';
  if (r.injuryRisk >= 70 && scoring >= 74) return 'Glass Cannon';
  if (physical >= 76 && skill <= 45) return 'All-Tools Project';
  if (skill >= 76 && physical <= 45) return 'Skill-Only Specialist';
  if (s.height >= 88 && s.speed <= 45 && s.ballHandling <= 48) return 'Lumbering Paint Project';
  if (s.height <= 30 && s.postScoring <= 35 && mobility >= 72) return 'Pocket Blur';

  // Bigs and forwards.
  if (s.height >= 70 && s.passing >= 82 && s.ballHandling >= 68) return 'Point Forward';
  if (s.height >= 72 && s.shooting >= 80 && s.defense >= 62) return 'Stretch Big';
  if (rimPresence >= 80 && s.passing >= 72) return 'Interior Hub';
  if (rimPresence >= 82 && s.speed >= 62) return 'Rim-Running Anchor';
  if (s.postScoring >= 84 && s.weight >= 70) return 'Bruising Post Scorer';

  // Wings and guards.
  if (s.athleticism >= 84 && s.passing >= 76 && s.speed >= 74) return 'Aerial Playmaker';
  if (s.defense >= 82 && s.shooting >= 74) return '3-and-D Wing';
  if (s.defense >= 84 && creation >= 70) return 'Defensive Playmaker';
  if (s.shooting >= 86 && s.ballHandling >= 76) return 'Shot-Creating Sniper';
  if (s.shooting >= 86) return 'Movement Shooter';
  if (creation >= 84 && s.shooting >= 70) return 'Floor General';
  if (creation >= 80 && mobility >= 76) return 'Slashing Playmaker';
  if (scoring >= 82) return 'Three-Level Scorer';
  if (mobility >= 84 && s.defense >= 70) return 'Lockdown Slasher';

  // Broad fallbacks.
  if (physical >= skill + 15) return 'Athletic Finisher';
  if (skill >= physical + 15) return 'Skilled Shot Maker';
  if (mental >= 82 && r.overall >= 68) return 'Glue Guy';
  if (r.overall >= 84) return 'Complete Star';
  if (r.overall >= 72) return 'Balanced Starter';
  return 'Bench Spark';
}

export function buildArchetype(r: ScoreResult): string {
  const family = classifyArchetype(r);
  return pickForBuild(ARCHETYPE_VARIANTS[family] ?? [family], r, `archetype-${family}`);
}

export function buildArchetypeTitle(r: ScoreResult): string {
  const name = buildArchetype(r);
  if (name === 'GOAT') return 'You Created the GOAT';
  if (name === '99 Overall') return 'You Created a 99 Overall';
  return `You Created ${articleFor(name)} ${name}`;
}
