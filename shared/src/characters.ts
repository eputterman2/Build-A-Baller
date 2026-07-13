import type { Player } from './types';
import { spread } from './ratingCurve';

// Celebrities & fictional characters — pure fun. Scores are creative guesses at
// how each would fare on a basketball court, on the same 14-attribute scale.
// Tagged with the 'STAR' pseudo-team; exempt from the photo filter so they always
// appear (with a real photo where we can find one, else a wildcard initials avatar).
//
// C(name, pos, height, weight, wingspan,
//   athleticism, speed,
//   ballHandling, shooting, postScoring, defense, passing,
//   iq, attitude, clutch, durability)   -- raw; curve applied below.

type RawC = Omit<Player, 'id' | 'team'>;

function C(
  name: string, pos: string, height: number, weight: number, wingspan: number,
  athleticism: number, speed: number,
  ballHandling: number, shooting: number, postScoring: number, defense: number, passing: number,
  iq: number, attitude: number, clutch: number, durability: number,
): RawC {
  return { name, pos, height, weight, wingspan, athleticism, speed,
    ballHandling, shooting, postScoring, defense, passing, iq, attitude, clutch, durability };
}
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ROSTER: RawC[] = [
  // ---- Celebrities / real people ----
  C('Adam Sandler','F',84,245,98, 99,99, 99,99,99,99,99, 99,99,99,99),          // 99 everything — the GOAT
  C('Drake','G',72,185,76, 72,74, 72,74,56,60,70, 72,80,35,80),                 // Drake curse → no clutch
  C('Justin Bieber','G',69,165,71, 76,80, 76,74,50,62,68, 68,70,70,78),
  C('Timothée Chalamet','F',70,150,74, 58,64, 56,60,42,52,60, 78,78,62,70),
  C('LiAngelo Ball','G',77,215,82, 80,80, 80,88,64,70,74, 78,78,80,80),         // actually a shooter
  C('LaVar Ball','F',77,250,82, 74,66, 64,62,78,72,70, 70,96,76,84),            // all confidence
  C('Kevin Hart','G',64,140,66, 84,90, 80,68,38,64,78, 76,92,82,78),
  C('Lionel Messi','G',67,159,70, 90,92, 96,55,50,72,95, 96,88,94,84),          // unreal handle & vision
  C('Larry David','G',71,175,73, 45,50, 50,58,44,52,58, 80,40,55,68),
  C('Bernie Sanders','F',72,165,74, 35,40, 48,55,40,50,88, 82,84,60,64),        // believes in passing the ball
  C('Serena Williams','F',69,165,76, 95,88, 64,66,82,84,66, 84,88,95,88),       // elite athlete & competitor
  C('Alex Morgan','F',67,137,72, 92,94, 80,64,56,78,80, 84,86,90,84),
  // ---- Sitcom / cartoon characters ----
  C('Michael Scott','G',71,210,73, 40,42, 45,48,44,38,55, 30,72,40,70),         // bad at everything
  C('Jim Halpert','F',75,190,80, 80,78, 78,80,66,76,80, 82,86,82,84),           // the office athlete
  C('Peter Griffin','C',70,270,72, 35,28, 42,92,58,40,45, 26,50,62,76),         // elite shot, nothing else
  C('Lisa Simpson','G',52,70,54, 50,60, 56,64,30,52,70, 96,90,66,66),
  C('Stuart Little','G',12,1,14, 62,78, 70,60,20,50,66, 72,90,78,60),           // a mouse
  C('Air Bud','F',48,70,52, 88,86, 60,82,58,70,45, 35,99,84,84),                // ain't no rule says a dog can't ball
  // ---- Superheroes & villains ----
  C('Spider-Man','G',70,167,82, 99,95, 92,72,68,90,80, 88,85,90,85),
  C('Batman','F',74,210,80, 88,82, 80,72,72,95,82, 99,82,95,85),
  C('Wonder Woman','F',72,165,80, 96,88, 74,76,88,92,76, 90,95,94,96),
  C('The Hulk','C',96,1200,108, 95,70, 20,15,99,90,30, 40,30,82,99),
  C('She-Hulk','F',79,240,86, 92,80, 70,72,95,90,72, 88,86,86,96),
  C('Iron Man','F',75,230,80, 88,84, 72,90,80,84,78, 99,70,90,84),
  C('The Flash','G',74,190,78, 95,99, 80,72,55,80,82, 82,84,84,80),
  C('Bullseye','G',73,200,80, 84,82, 78,99,62,72,68, 80,40,88,76),              // never misses
  C('Bane','C',80,290,86, 86,70, 56,60,95,90,60, 88,40,84,95),
  C('Ant-Man','G',70,175,74, 82,84, 88,66,50,76,74, 80,82,80,76),               // shrinks past you
  C('Gamora','F',72,170,78, 90,90, 82,72,70,92,74, 86,74,90,84),
  C('Superman','F',76,235,84, 99,99, 65,70,95,95,70, 88,99,95,99),
  C('Supergirl','F',71,150,76, 96,96, 70,74,90,90,72, 84,92,90,96),
  C('Silver Surfer','F',74,200,84, 95,98, 66,70,84,84,70, 86,84,88,96),         // female Silver Surfer, cosmic
  C('Thanos','C',96,985,104, 92,66, 40,55,98,92,55, 92,40,86,96),
  C('Venom','C',75,260,92, 90,80, 64,58,92,90,56, 60,35,80,95),                 // tendrils → freakish length
  C('Starfire','F',76,160,82, 92,90, 74,82,82,82,76, 78,92,88,90),
  C('Jean Grey','G',66,135,70, 70,72, 80,88,72,80,92, 88,76,82,80),             // telekinetic passing/shooting
];

export const CHARACTERS: Player[] = ROSTER
  .map(raw => ({
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
    team: 'STAR',
  }));
