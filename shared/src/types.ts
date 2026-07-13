// Shared domain types used by both the React client and the Node server.
import type { BuildAccessories } from './accessories';

export type Conference = 'East' | 'West';
export type CategoryName = 'physical' | 'skill' | 'mental';

export interface Team {
  abbr: string;        // e.g. "BOS"
  name: string;        // e.g. "Boston Celtics"
  conference: Conference;
  color: string;       // primary team color for the wheel
}
export type AttributeType = 'measure' | 'rating';
export type ValueFormat = 'height' | 'weight' | 'rating';

export type AttributeKey =
  | 'height' | 'weight' | 'wingspan' | 'athleticism' | 'speed'
  | 'ballHandling' | 'shooting' | 'postScoring' | 'defense' | 'passing'
  | 'iq' | 'attitude' | 'clutch' | 'durability';

export interface Player {
  id: string;
  name: string;
  team: string;        // team abbreviation
  pos: string;
  height: number;      // inches
  weight: number;      // lbs
  wingspan: number;    // inches
  athleticism: number;
  speed: number;
  ballHandling: number;
  shooting: number;
  postScoring: number;
  defense: number;
  passing: number;
  iq: number;
  attitude: number;
  clutch: number;
  durability: number;
}

export interface Attribute {
  key: AttributeKey;
  label: string;
  category: CategoryName;
  type: AttributeType;
  format: ValueFormat;
}

export interface CategoryMeta {
  label: string;
  color: string;
}

export interface Modifier {
  icon: string;
  name: string;
  text: string;
}

export interface BuildBonus {
  name: string;
  text: string;
  points: number;
}

// The raw landed value per attribute (e.g. height in inches, shooting 0-100).
export type RawValues = Record<AttributeKey, number>;

// What the client submits to the server: which player each attribute came from.
export type PickMap = Record<AttributeKey, string>; // attrKey -> playerId

export interface ScoreResult {
  subScores: Record<AttributeKey, number>;
  rawSubScores: Record<AttributeKey, number>;
  categoryScores: Record<CategoryName, number>;
  overall: number;
  injuryRisk: number;
  modifiers: Modifier[];
  buildBonuses: BuildBonus[];
}

// Live, partial-build snapshot used to render the "player you're building" panel
// as picks come in. Anything not yet picked is null / absent.
export interface BuildPreview {
  base: Partial<Record<AttributeKey, number>>;          // sub-score before synergies
  sub: Partial<Record<AttributeKey, number>>;           // sub-score after synergies
  bodyAdjustments: Partial<Record<AttributeKey, number>>; // projected frame effect, including unpicked stats
  categoryScores: Record<CategoryName, number | null>;
  overall: number | null;
  injuryRisk: number | null;
  modifiers: Modifier[];
  buildBonuses: BuildBonus[];
  height: number | null;                                 // raw measured (inches)
  weight: number | null;                                 // raw measured (lbs)
  wingspan: number | null;                               // raw measured (inches)
  pickedCount: number;
}

export interface Grade {
  g: string;
  label: string;
}

export interface PlayerIdentity {
  playerName: string;
  motto: string;
  country: string;
}

// A persisted leaderboard build.
export interface BuildSummary {
  id: string;
  username: string;
  overall: number;
  grade: string;
  gradeLabel: string;
  createdAt: string;
  identity: PlayerIdentity;
  accessories: BuildAccessories;
  characterId: string;
}

export interface BuildDetail extends BuildSummary {
  result: ScoreResult;
  picks: PickMap;
}

export interface CollectionBuild extends BuildDetail {
  place: number | null;
}

export interface DrawingCollectionStat {
  cards: number;
  highestOverall: number;
  playerOfDayWins: number;
}

export type DrawingCollectionStats = Record<string, DrawingCollectionStat>;

export interface PlayerOfDay {
  date: string;
  build: BuildDetail | null;
}

export interface PlayerOfDayWin extends BuildDetail {
  winDate: string;
}

export interface PlayerOfDayLeader {
  username: string;
  wins: number;
}

export interface DrawingCollectionLeader {
  username: string;
  drawings: number;
}

export interface DrawingOption {
  id: string;
  name: string;
  src: string;
  minOverall: number;
  maxOverall: number;
  owned: boolean;
  eligible: boolean;
  current: boolean;
}

export interface PollOptionResult {
  id: string;
  label: string;
  votes: number;
}

export interface PlayerDrawingPoll {
  id: string;
  question: string;
  options: PollOptionResult[];
  totalVotes: number;
  viewerVoteOptionId: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
}
