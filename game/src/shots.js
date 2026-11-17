// The staged scenes behind ?shot=title|boss|levelup|dawn|over. Each one plays the real rules
// forward from a fresh world with a fixed seed, steered by a simple autopilot keeper, so the
// frame is what a real game looks like and the same seed always gives the same frame. The
// dawn scene lends its autopilot a staging boost (shots only — normal play never sees it) so
// it can survive the whole night on its own.

import { FIELD, NIGHT_SECONDS, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_DAWN, EVENT_OVER } from './world.js';
import { SCREEN_DAWN, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const AIM_FREE = { x: 0, y: 0, focus: false };

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * A keeper who kites away from the swarm and stoops for cinders when the way is clear.
 * Returns a movement vector (not necessarily normalised; the world clamps by speed anyway).
 */
export function pilotMove(world) {
  const p = world.p;
  let fx = 0;
  let fy = 0;
  for (const foe of world.enemies) {
    const d = distance(p.x, p.y, foe.x, foe.y);
    if (d > 0.01 && d < 210) {
      const weight = ((210 - d) / 210) * (foe.kind === 'boss' ? 2.4 : 1);
      fx += ((p.x - foe.x) / d) * weight;
      fy += ((p.y - foe.y) / d) * weight;
    }
  }
  let cinder = null;
  let cinderD = 340;
  for (const c of world.cinders) {
    const d = distance(p.x, p.y, c.x, c.y);
    if (d < cinderD) { cinderD = d; cinder = c; }
  }
  if (cinder && fx * fx + fy * fy < 1.2) {
    fx += ((cinder.x - p.x) / (cinderD || 1)) * 0.55;
    fy += ((cinder.y - p.y) / (cinderD || 1)) * 0.55;
  }
  fx += ((FIELD.width / 2 - p.x) / FIELD.width) * 0.14;
  fy += ((FIELD.height / 2 - p.y) / FIELD.height) * 0.14;
  const length = Math.hypot(fx, fy);
  if (length < 0.05) return { x: 0, y: 0 };
  return { x: fx / length, y: fy / length };
}

/** Blessing picks for an autopilot keeper: raw killing power first, survival second. */
const PILOT_PRIORITY = ['twin', 'pierce', 'edge', 'hands', 'spark', 'stout', 'frost', 'fury', 'boots', 'charm', 'greed', 'coals'];

/** If the world is holding level-up choices open, take the autopilot's favourite. */
export function autoChoose(world) {
  if (!world.pendingChoices) return;
  let bestIndex = 0;
  let bestRank = PILOT_PRIORITY.length;
  world.pendingChoices.forEach((choice, index) => {
    const rank = PILOT_PRIORITY.indexOf(choice.id);
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      bestIndex = index;
    }
  });
  world.choose(bestIndex);
}

function runSteps(world, steps, pilot = true, choose = false) {
  for (let i = 0; i < steps; i += 1) {
    const mv = pilot ? pilotMove(world) : { x: 0, y: 0 };
    // A pressed autopilot dashes out of trouble, like a player would.
    if (pilot && world.p.dashCd <= 0 && (mv.x !== 0 || mv.y !== 0)) {
      const pressed = world.enemies.some((foe) => distance(world.p.x, world.p.y, foe.x, foe.y) < 80);
      if (pressed) mv.dash = true;
    }
    world.step(STEP, mv, AIM_FREE);
    if (choose) autoChoose(world);
    if (world.finished) break;
  }
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world, seed) {
  if (name === 'boss') {
    world.startRun();
    world.stagingBoost();
    let guard = 0;
    while (!world.boss && guard < 60 * 160) {
      world.step(STEP, pilotMove(world), AIM_FREE);
      autoChoose(world);
      guard += 1;
    }
    // Compose the cover: the boss closes on the keeper, a retinue presses in inside the
    // light, and a breath of real play (bolts in flight, sparks flying) finishes the frame.
    if (world.boss) {
      const p = world.p;
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      // Centre the keeper for the portrait, so the boss and its retinue share the frame
      // instead of crowding whichever edge the fight happened to reach.
      p.x = 520;
      p.y = 415;
      world.boss.x = clamp(p.x + 320, 90, FIELD.width - 90);
      world.boss.y = clamp(p.y - 70, 90, FIELD.height - 90);
      const retinue = ['wisp', 'moth', 'moth', 'husk', 'dart', 'moth', 'wisp'];
      retinue.forEach((kind, i) => {
        const angle = (i / retinue.length) * Math.PI * 2 + 0.45;
        const ring = 205 + (i % 3) * 55;
        world.spawnFoe(kind, clamp(p.x + Math.cos(angle) * ring, 24, FIELD.width - 24), clamp(p.y + Math.sin(angle) * ring, 24, FIELD.height - 24));
      });
      world.dropCinders(p.x + 120, p.y + 95, 8);
      // Dress the keeper for the portrait: orbiting sparks and a frost ring make the
      // light feel defended, and a lurker waits at the edge of it, all eyes.
      world.stats.sparkCount = Math.max(world.stats.sparkCount, 2);
      if (world.stats.frostRadius <= 0) { world.stats.frostRadius = 132; world.stats.frostSlow = 0.3; }
      world.spawnFoe('lurker', clamp(p.x - 320, 24, FIELD.width - 24), clamp(p.y + 165, 24, FIELD.height - 24));
      world.dropCinders(p.x - 140, p.y - 80, 6);
      runSteps(world, 42, true, true);
    }
    return SCREEN_PLAY;
  }
  if (name === 'levelup') {
    world.startRun();
    let guard = 0;
    while (!world.pendingChoices && guard < 60 * 120) {
      world.step(STEP, pilotMove(world), AIM_FREE);
      guard += 1;
    }
    if (!world.pendingChoices) world.addXp(world.xpNext + 1);
    return SCREEN_LEVELUP;
  }
  if (name === 'dawn') {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      world.random = createRandom(seed + attempt * 7919);
      world.startRun();
      world.stagingBoost();
      runSteps(world, Math.ceil(NIGHT_SECONDS / STEP) + 120, true, true);
      if (world.finished === EVENT_DAWN) return SCREEN_DAWN;
    }
    return SCREEN_DAWN;
  }
  if (name === 'over') {
    world.startRun();
    world.stats.flame = 7;
    for (let i = 0; i < 6; i += 1) world.spawnFoe('moth', world.p.x + 20, world.p.y + 10);
    runSteps(world, 60 * 20, false);
    return world.finished === EVENT_OVER ? SCREEN_OVER : SCREEN_PLAY;
  }
  // Title: a quiet garden, a few moths circling the light at a respectful distance.
  world.reset();
  for (let i = 0; i < 5; i += 1) {
    const at = world.edgePoint();
    world.spawnFoe('moth', at.x, at.y);
  }
  runSteps(world, 60 * 3, false);
  return SCREEN_TITLE;
}
