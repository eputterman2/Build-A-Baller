import { archetypeFamily } from './analysis';

export interface CustomDrawingBuildType {
  id: string;
  label: string;
  hint: string;
  archetypeFamilies: string[];
  matchesAll?: boolean;
}

export const CUSTOM_DRAWING_BUILD_TYPES: CustomDrawingBuildType[] = [
  {
    id: 'any',
    label: 'Any build',
    hint: 'Any build',
    archetypeFamilies: [],
    matchesAll: true,
  },
  {
    id: 'sharpshooter',
    label: 'Sharpshooter',
    hint: 'Shooting builds',
    archetypeFamilies: [
      'Shot-Creating Sniper',
      'Movement Shooter',
      'Stretch Big',
      'Three-Level Scorer',
      'Skilled Shot Maker',
      'Glass Cannon',
      'Skill-Only Specialist',
    ],
  },
  {
    id: 'slasher',
    label: 'Slasher',
    hint: 'Slashing and finishing builds',
    archetypeFamilies: [
      'Slashing Playmaker',
      'Athletic Finisher',
      'Aerial Playmaker',
      'Lockdown Slasher',
      'Pocket Blur',
    ],
  },
  {
    id: 'playmaker',
    label: 'Playmaker',
    hint: 'Playmaking builds',
    archetypeFamilies: [
      'Point Forward',
      'Interior Hub',
      'Floor General',
      'Slashing Playmaker',
      'Defensive Playmaker',
      'Aerial Playmaker',
      'Glue Guy',
    ],
  },
  {
    id: 'defender',
    label: 'Defender',
    hint: 'Defensive builds',
    archetypeFamilies: [
      '3-and-D Wing',
      'Defensive Playmaker',
      'Lockdown Slasher',
      'Rim-Running Anchor',
      'Interior Hub',
      'Glue Guy',
      'Complete Star',
    ],
  },
  {
    id: 'big',
    label: 'Big',
    hint: 'Interior and big-man builds',
    archetypeFamilies: [
      'Stretch Big',
      'Interior Hub',
      'Rim-Running Anchor',
      'Bruising Post Scorer',
      'Lumbering Paint Project',
    ],
  },
  {
    id: 'all-around',
    label: 'All-around',
    hint: 'All-around builds',
    archetypeFamilies: [
      '99 Overall',
      'GOAT',
      'Complete Star',
      'Balanced Starter',
      'All-Tools Project',
      'Point Forward',
      'Three-Level Scorer',
      '3-and-D Wing',
    ],
  },
  {
    id: 'wildcard',
    label: 'Wildcard',
    hint: 'Wildcard and project builds',
    archetypeFamilies: [
      'Rec League Experiment',
      'Bench Spark',
      'Talented Headache',
      'Glass Cannon',
      'Pocket Blur',
      'All-Tools Project',
      'Skill-Only Specialist',
    ],
  },
];

const BUILD_TYPE_BY_ID = new Map(CUSTOM_DRAWING_BUILD_TYPES.map(type => [type.id, type]));
const BUILD_TYPE_BY_LABEL = new Map(CUSTOM_DRAWING_BUILD_TYPES.map(type => [type.label.toLowerCase(), type]));
const BUILD_TYPE_BY_HINT = new Map(CUSTOM_DRAWING_BUILD_TYPES.map(type => [type.hint.toLowerCase(), type]));

export function customDrawingBuildHint(typeIds: string[]): string {
  const types = typeIds
    .map(id => BUILD_TYPE_BY_ID.get(id))
    .filter((type): type is CustomDrawingBuildType => Boolean(type));
  if (!types.length || types.some(type => type.matchesAll)) return 'Any build';
  return types.map(type => type.hint).join(', ');
}

export function parseCustomDrawingBuildHint(value?: string | null): string[] {
  const raw = (value || '').trim();
  if (!raw) return ['any'];
  const matches = raw
    .split(',')
    .map(part => part.trim().toLowerCase())
    .map(part => BUILD_TYPE_BY_ID.get(part) ?? BUILD_TYPE_BY_LABEL.get(part) ?? BUILD_TYPE_BY_HINT.get(part))
    .filter((type): type is CustomDrawingBuildType => Boolean(type));
  if (!matches.length) return ['any'];
  if (matches.some(type => type.matchesAll)) return ['any'];
  return Array.from(new Set(matches.map(type => type.id)));
}

export function customDrawingMatchesArchetype(buildHint: string | undefined | null, archetypeName: string): boolean {
  const selectedIds = parseCustomDrawingBuildHint(buildHint);
  const types = selectedIds
    .map(id => BUILD_TYPE_BY_ID.get(id))
    .filter((type): type is CustomDrawingBuildType => Boolean(type));
  if (!types.length || types.some(type => type.matchesAll)) return true;
  const family = archetypeFamily(archetypeName);
  return types.some(type => type.archetypeFamilies.includes(family));
}
