// The blessings the flame can earn. Each level, the keeper is offered three of these, chosen
// from the ones not yet maxed; every blessing edits the run's stats in one clear way, and its
// `describe` line tells the player exactly what the card in front of them will do. Stacks are
// tracked on the stats object itself (stats.taken[id]). Icons are drawn by the renderer from
// the blessing's id, so no card depends on an emoji font existing.

function blessing(id, name, max, describe, apply) {
  return { id, name, max, describe, apply };
}

export const BLESSINGS = [
  blessing('edge', 'Kindled Edge', 99,
    (s) => `Ember damage +25% (now ${Math.round(s.damage * 1.25)})`,
    (s) => { s.damage *= 1.25; }),
  blessing('hands', 'Quick Hands', 99,
    () => 'Cast embers 18% faster',
    (s) => { s.fireInterval *= 0.82; }),
  blessing('twin', 'Twin Ember', 4,
    (s) => `Cast ${s.bolts + 1} bolts per volley`,
    (s) => { s.bolts += 1; }),
  blessing('boots', 'Swift Boots', 5,
    () => 'Move 12% faster',
    (s) => { s.speed *= 1.12; }),
  blessing('charm', 'Cinder Charm', 4,
    () => 'Cinder pull radius +45%',
    (s) => { s.magnet *= 1.45; }),
  blessing('stout', 'Stout Flame', 99,
    () => '+25 max flame and mend 30 now',
    (s) => { s.maxFlame += 25; s.flame = Math.min(s.maxFlame, s.flame + 30); }),
  blessing('spark', 'Orbit Spark', 4,
    (s) => `${s.sparkCount + 1} sparks circle the lantern`,
    (s) => { s.sparkCount += 1; }),
  blessing('fury', 'Spark Fury', 3,
    () => 'Orbiting sparks hit 60% harder',
    (s) => { s.sparkDamage *= 1.6; }),
  blessing('frost', 'Frost Aura', 4,
    (s) => (s.taken.frost ? 'Frost aura widens and bites deeper' : 'A frost aura slows nearby foes by 30%'),
    (s) => {
      if (!s.taken.frost) { s.frostRadius = 112; s.frostSlow = 0.3; }
      else { s.frostRadius += 36; s.frostSlow = Math.min(0.55, s.frostSlow + 0.08); }
    }),
  blessing('greed', 'Gilded Cinders', 3,
    () => 'Cinders grant 20% more growth',
    (s) => { s.xpGain *= 1.2; }),
  blessing('coals', 'Banked Coals', 99,
    () => 'Mend 40 flame right now',
    (s) => { s.flame = Math.min(s.maxFlame, s.flame + 40); }),
];

/** Roll `count` distinct blessings the stats can still take, using the world's random source. */
export function rollChoices(stats, random, count = 3) {
  const open = BLESSINGS.filter((b) => (stats.taken[b.id] ?? 0) < b.max);
  const chosen = [];
  const pool = open.slice();
  while (chosen.length < count && pool.length > 0) {
    const at = Math.floor(random.next() * pool.length);
    chosen.push(pool.splice(at, 1)[0]);
  }
  return chosen;
}

/** Apply a blessing and record the stack. */
export function applyBlessing(stats, chosen) {
  chosen.apply(stats);
  stats.taken[chosen.id] = (stats.taken[chosen.id] ?? 0) + 1;
}
