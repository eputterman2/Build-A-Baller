import type { Player } from './types';
import { spread } from './ratingCurve';

// WNBA players — 20 top current + 10 historic greats. Same 14-attribute schema and
// rating curve as everyone else; tagged with the 'WNBA' pseudo-team.
//
// W(name, pos, height, weight, wingspan,
//   athleticism, speed,
//   ballHandling, shooting, postScoring, defense, passing,
//   iq, attitude, clutch, durability)   -- raw ratings; curve applied below.

type RawW = Omit<Player, 'id' | 'team'>;

function W(
  name: string, pos: string, height: number, weight: number, wingspan: number,
  athleticism: number, speed: number,
  ballHandling: number, shooting: number, postScoring: number, defense: number, passing: number,
  iq: number, attitude: number, clutch: number, durability: number,
): RawW {
  return { name, pos, height, weight, wingspan, athleticism, speed,
    ballHandling, shooting, postScoring, defense, passing, iq, attitude, clutch, durability };
}
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ROSTER: RawW[] = [
  // ---- Current ----
  W("A'ja Wilson",'F',76,195,80, 90,82, 76,82,92,92,78, 90,86,92,86),
  W('Breanna Stewart','F',76,170,82, 88,82, 82,88,86,88,80, 90,84,90,80),
  W('Caitlin Clark','G',72,155,74, 80,86, 92,94,60,72,96, 92,84,88,82),
  W('Sabrina Ionescu','G',71,165,73, 78,82, 88,90,62,74,90, 90,84,92,82),
  W('Napheesa Collier','F',73,175,78, 88,84, 78,82,84,90,76, 88,86,88,84),
  W('Alyssa Thomas','F',74,185,80, 84,80, 82,56,80,88,94, 90,84,84,82),
  W('Jonquel Jones','C',78,190,84, 84,78, 70,80,86,86,74, 86,82,84,80),
  W('Kelsey Plum','G',68,145,70, 80,86, 88,88,58,72,84, 86,80,88,84),
  W('Arike Ogunbowale','G',68,150,70, 84,86, 90,86,60,70,76, 80,78,90,82),
  W('Jackie Young','G',72,174,76, 84,82, 84,84,66,82,82, 86,86,86,84),
  W('Chelsea Gray','G',71,170,74, 76,80, 90,82,64,80,90, 92,84,94,82),
  W('Nneka Ogwumike','F',74,174,80, 88,82, 74,78,84,86,72, 88,90,84,86),
  W('Jewell Loyd','G',70,140,74, 86,86, 86,86,62,78,76, 84,80,86,82),
  W('Angel Reese','F',75,175,82, 86,80, 64,58,80,86,66, 80,82,78,80),
  W('Aliyah Boston','C',77,205,82, 84,78, 66,68,84,88,74, 86,88,82,84),
  W('Brittney Griner','C',81,205,88, 82,74, 58,66,88,92,60, 84,82,80,76),
  W('Kahleah Copper','G',73,160,78, 88,86, 82,80,68,82,68, 80,80,84,82),
  W('Satou Sabally','F',76,180,80, 86,82, 80,82,76,80,74, 82,82,82,76),
  W('Rhyne Howard','G',74,172,80, 86,84, 82,84,64,82,72, 80,80,82,80),
  W('DeWanna Bonner','F',76,137,82, 80,80, 76,82,72,82,72, 84,84,84,82),
  // ---- Historic ----
  W('Diana Taurasi','G',72,163,74, 80,80, 86,94,66,76,86, 94,82,96,84),
  W('Sue Bird','G',69,150,72, 76,82, 92,86,54,82,96, 96,90,92,86),
  W('Maya Moore','F',72,178,76, 90,86, 84,88,80,88,80, 90,88,92,82),
  W('Lisa Leslie','C',77,170,82, 88,80, 64,72,88,90,66, 88,86,86,82),
  W('Tamika Catchings','F',73,167,80, 90,84, 78,80,76,94,80, 90,90,88,82),
  W('Lauren Jackson','F',77,187,82, 86,80, 76,88,86,86,72, 88,82,88,72),
  W('Sheryl Swoopes','G',72,145,76, 90,86, 84,82,72,88,78, 86,82,88,80),
  W('Cynthia Cooper','G',70,150,72, 84,84, 86,86,64,76,82, 86,80,94,80),
  W('Candace Parker','F',76,175,82, 88,82, 84,82,84,86,86, 92,86,86,78),
  W('Tina Thompson','F',74,178,78, 82,80, 74,86,80,78,70, 84,84,84,82),
];

export const WNBA_PLAYERS: Player[] = ROSTER.map(raw => ({
  ...raw,
  athleticism: spread(raw.athleticism),
  speed: spread(raw.speed),
  ballHandling: spread(raw.ballHandling),
  shooting: spread(raw.shooting),
  postScoring: spread(raw.postScoring),
  defense: spread(raw.defense),
  passing: spread(raw.passing),
  iq: spread(raw.iq),
  attitude: spread(raw.attitude),
  clutch: spread(raw.clutch),
  durability: spread(raw.durability),
  id: slug(raw.name),
  team: 'WNBA',
}));
