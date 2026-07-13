import { ATTRIBUTES, PLAYERS } from '../shared/src/index';

const perfectRatings = PLAYERS.flatMap(player =>
  ATTRIBUTES
    .filter(attribute => player[attribute.key] === 100)
    .map(attribute => ({
      player: player.name,
      team: player.team,
      attribute: attribute.label,
    })),
);

console.log(`Perfect ratings: ${perfectRatings.length}`);
for (const rating of perfectRatings) {
  console.log(`${rating.player} (${rating.team}) - ${rating.attribute}`);
}
