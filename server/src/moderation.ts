import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';
import { hasBlockedPublicContent, type PlayerIdentity } from '@shared/index';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const STRICT_COMPACT_FRAGMENTS = [
  'kike',
  'faggot',
  'nigger',
  'tranny',
  'wetback',
  'raghead',
  'towelhead',
  'beaner',
  'whitepower',
  'whitelightning',
  'heilhitler',
  'siegheil',
  'gasjew',
  'killalljew',
  'deathtojew',
  '1488',
];

const STRICT_COMPACT_WORDS = new Set([
  'spic',
  'gook',
  'coon',
  'dyke',
]);

function compactForModeration(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1{2,}/g, '$1');
}

export function hasDisallowedPublicContent(value: string): boolean {
  if (!value) return false;
  if (hasBlockedPublicContent(value) || matcher.hasMatch(value)) return true;

  const compact = compactForModeration(value);
  if (!compact) return false;
  if (STRICT_COMPACT_FRAGMENTS.some(fragment => compact.includes(fragment))) return true;
  if (STRICT_COMPACT_WORDS.has(compact)) return true;

  // Catch a common shortened spelling when it is used as a suffix or by itself.
  return compact === 'dik' || compact.endsWith('adik');
}

export function identityModerationError(identity: PlayerIdentity): string | null {
  if (hasDisallowedPublicContent(identity.playerName)) {
    return 'Name contains language that is not allowed.';
  }
  if (hasDisallowedPublicContent(identity.motto)) {
    return 'Motto contains language that is not allowed.';
  }
  return null;
}

export function safePublicUsername(username: string): string {
  return hasDisallowedPublicContent(username) ? 'moderated_user' : username;
}

export function safePublicIdentity(identity: PlayerIdentity): PlayerIdentity {
  return {
    ...identity,
    playerName: hasDisallowedPublicContent(identity.playerName) ? '' : identity.playerName,
    motto: hasDisallowedPublicContent(identity.motto) ? '' : identity.motto,
  };
}
