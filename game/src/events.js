// The night's scripted turns. Four times a night the garden changes its rules for a
// stretch: embers rain from the sky to be gathered, the swarm surges in a ring, a frost
// gust chills every foe, and near dawn the dark simply doubles its pressure. Each turn
// fires once, on its mark, announced by a banner; the world asks this module each step
// what the spawn rate and the swarm's speed should be, so the turns compose with the
// ordinary ramp instead of replacing it.

import { FIELD, NIGHT_SECONDS } from './config.js';

export const NIGHT_EVENTS = [
  { at: 70, id: 'cinderfall', banner: '☂ CINDERFALL — embers rain from the sky' },
  { at: 172, id: 'swarm', banner: 'THE SWARM SURGES' },
  { at: 288, id: 'frost', banner: 'A FROST GUST — the swarm is chilled' },
  { at: 402, id: 'darkdoubles', banner: 'THE DARK DOUBLES — hold on until dawn' },
];

export class NightEvents {
  constructor() {
    this.fired = new Set();
    this.spawnBoostUntil = -1;
    this.chillUntil = -1;
  }

  /** Fire any turn whose mark the night has reached. Called once per world step. */
  step(world) {
    for (const turn of NIGHT_EVENTS) {
      if (!this.fired.has(turn.id) && world.time >= turn.at) {
        this.fired.add(turn.id);
        this.fire(world, turn);
      }
    }
  }

  fire(world, turn) {
    world.showBanner(turn.banner, 3.2);
    if (turn.id === 'cinderfall') {
      // A windfall, scattered wide: worth a stoop, never worth dying for.
      for (let i = 0; i < 16; i += 1) {
        world.dropCinders(world.random.range(40, FIELD.width - 40), world.random.range(40, FIELD.height - 40), 1);
      }
      world.fx.push('pickup');
    } else if (turn.id === 'swarm') {
      const ring = 12;
      for (let i = 0; i < ring; i += 1) {
        const at = world.edgePoint();
        world.spawnFoe(i % 4 === 3 ? 'dart' : 'moth', at.x, at.y);
      }
      world.fx.push('boss');
    } else if (turn.id === 'frost') {
      this.chillUntil = world.time + 5;
      world.burst(world.p.x, world.p.y, 30, '#9fd8ff', 220);
      world.fx.push('gust');
    } else if (turn.id === 'darkdoubles') {
      this.spawnBoostUntil = NIGHT_SECONDS + 1;
      world.fx.push('boss');
    }
  }

  /** Spawn-interval multiplier: below 1 while the dark doubles, so foes arrive faster. */
  spawnFactor(world) {
    return world.time < this.spawnBoostUntil ? 0.55 : 1;
  }

  /** Foe-speed multiplier: the swarm crawls while a frost gust holds. */
  chillFactor(world) {
    return world.time < this.chillUntil ? 0.5 : 1;
  }
}
