// The staged scenes behind ?shot=title|boss|levelup|dawn|over. Each one plays the real rules
// forward from a fresh world with a fixed seed, steered by a simple autopilot keeper, so the
// frame is what a real game looks like and the same seed always gives the same frame. The
// dawn scene lends its autopilot a staging boost (shots only — normal play never sees it) so
// it can survive the whole night on its own.

import { BOSS_NAMES, FIELD, NIGHT_SECONDS, STEP } from './config.js';
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

function clampField(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Final dressing for the boss portrait, laid over the frame the real play produced: the
 * lurker caught crouching at the edge of the light, a piercing volley frozen mid-flight,
 * fresh bursts at full bloom, and the keeper mid-dash out of the press. Nothing here steps
 * the world, so the fight's numbers stay exactly what the play earned.
 */
function dressBossPortrait(world) {
  const p = world.p;
  const lurker = world.spawnFoe('lurker',
    clampField(p.x - 238, 24, FIELD.width - 24), clampField(p.y + 118, 24, FIELD.height - 24));
  lurker.state = 'crouch';
  lurker.stateT = 0.5;
  lurker.r *= 1.35;
  // Silhouettes in the outer dark, so no quadrant of the frame sits empty: the siege
  // reaches past the light on every side.
  const fillers = [
    ['wisp', 425, -215], ['husk', 440, 190], ['moth', -425, -150], ['dart', -455, 60],
  ];
  for (const [kind, dx, dy] of fillers) {
    const foe = world.spawnFoe(kind,
      clampField(p.x + dx, 24, FIELD.width - 24), clampField(p.y + dy, 24, FIELD.height - 24));
    foe.age = 1.2;
  }
  if (world.boss) {
    const aim = Math.atan2(world.boss.y - p.y, world.boss.x - p.x);
    for (let i = 0; i < 5; i += 1) {
      const d = 50 + i * 49;
      world.bolts.push({
        x: p.x + Math.cos(aim) * d, y: p.y - 6 + Math.sin(aim) * d,
        vx: Math.cos(aim) * 640, vy: Math.sin(aim) * 640,
        dmg: world.stats.damage, life: 1.1,
      });
    }
    world.floater(world.boss.x - 26, world.boss.y - world.boss.r - 16, '28');
    const wisp = world.enemies.find((foe) => foe.kind === 'wisp');
    if (wisp) world.burst(wisp.x, wisp.y, 14, '#57e6c9', 160);
  }
  const husk = world.enemies.find((foe) => foe.kind === 'husk');
  if (husk) {
    husk.chilled = true;
    world.burst(husk.x, husk.y, 10, '#9fd8ff', 120);
  }
  let chilled = 0;
  for (const foe of world.enemies) {
    if (chilled >= 2) break;
    if (foe.kind === 'wisp' || foe.kind === 'dart') {
      foe.chilled = true;
      chilled += 1;
    }
  }
  world.burst(p.x, p.y - 8, 14, '#ffd76a', 130);
  p.dashT = 0.16;
  p.dashX = -0.8;
  p.dashY = 0.6;
  const bossIndex = Math.min(Math.max(world.bossesSpawned - 1, 0), BOSS_NAMES.length - 1);
  world.showBanner(`⚠ ${BOSS_NAMES[bossIndex]} ⚠`, 3.2);
  world.shake = 0;
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
    // Compose the cover: the boss closes on the keeper, a full court of every foe kind
    // presses in inside the light, and a breath of real play (bolts in flight, sparks
    // flying) finishes the frame before the final dressing is laid over it.
    if (world.boss) {
      const p = world.p;
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      // Centre the keeper for the portrait, so the boss and its retinue share the frame
      // instead of crowding whichever edge the fight happened to reach.
      p.x = 600;
      p.y = 395;
      world.boss.x = clamp(p.x + 315, 90, FIELD.width - 90);
      world.boss.y = clamp(p.y - 55, 90, FIELD.height - 90);
      const retinue = ['wisp', 'moth', 'husk', 'dart', 'moth', 'wisp', 'shard', 'husk', 'moth', 'dart', 'shard', 'moth'];
      retinue.forEach((kind, i) => {
        const angle = (i / retinue.length) * Math.PI * 2 + 0.35;
        const ring = 200 + (i % 3) * 52;
        world.spawnFoe(kind, clamp(p.x + Math.cos(angle) * ring, 24, FIELD.width - 24), clamp(p.y + Math.sin(angle) * ring, 24, FIELD.height - 24));
      });
      // Dress the keeper for the portrait: a triple piercing volley, orbiting sparks and
      // a frost ring make the light feel defended, and cinders glitter across the field.
      world.stats.bolts = Math.max(world.stats.bolts, 3);
      world.stats.pierce = Math.max(world.stats.pierce, 2);
      world.stats.sparkCount = Math.max(world.stats.sparkCount, 2);
      if (world.stats.frostRadius <= 0) { world.stats.frostRadius = 132; world.stats.frostSlow = 0.3; }
      world.dropCinders(p.x + 120, p.y + 95, 8);
      world.dropCinders(p.x - 140, p.y - 80, 6);
      world.dropCinders(p.x + 30, p.y - 190, 6);
      world.dropCinders(p.x - 260, p.y + 40, 5);
      runSteps(world, 42, true, true);
      dressBossPortrait(world);
    }
    return SCREEN_PLAY;
  }
  if (name === 'levelup') {
    world.startRun();
    world.stagingBoost();
    // Play deep into the night and hold the first offer, from level 4 on, that puts the
    // piercing blessing on the table: the new cards are the ones worth showing, and a
    // mid-night offer carries a busier garden and a weightier score behind the cards.
    let guard = 0;
    while (guard < 60 * 300 && !world.finished) {
      world.step(STEP, pilotMove(world), AIM_FREE);
      guard += 1;
      if (!world.pendingChoices) continue;
      if (world.level >= 4 && world.pendingChoices.some((choice) => choice.id === 'pierce')) break;
      autoChoose(world);
    }
    if (!world.pendingChoices) world.addXp(world.xpNext + 1);
    // A held breath of the swarm behind the cards: the night does not stop pressing
    // just because the flame is choosing, and their shapes crowd the dimmed garden.
    const ring = ['moth', 'wisp', 'dart', 'moth', 'husk', 'moth'];
    ring.forEach((kind, i) => {
      const angle = (i / ring.length) * Math.PI * 2 + 0.8;
      const d = 215 + (i % 2) * 55;
      world.spawnFoe(kind,
        clampField(world.p.x + Math.cos(angle) * d, 24, FIELD.width - 24),
        clampField(world.p.y + Math.sin(angle) * d, 24, FIELD.height - 24));
    });
    world.banner.t = 0;
    return SCREEN_LEVELUP;
  }
  if (name === 'dawn') {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      world.random = createRandom(seed + attempt * 7919);
      world.startRun();
      world.stagingBoost();
      runSteps(world, Math.ceil(NIGHT_SECONDS / STEP) + 120, true, true);
      if (world.finished === EVENT_DAWN) {
        // A last breath of gold over the keeper: dawn's own confetti, caught at full
        // bloom. The run is already decided, so its numbers stay exactly as earned.
        world.burst(world.p.x, world.p.y - 6, 34, '#ffe9a8', 200);
        world.burst(world.p.x, world.p.y - 6, 16, '#fff6d8', 130);
        world.banner.t = 0;
        world.shake = 0;
        return SCREEN_DAWN;
      }
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
  // One of the night's newer terrors keeps the garden's edge: a lurker crouched in the
  // dark corner, amber eyes on the lantern — the very eyes the title text warns about.
  const lurker = world.spawnFoe('lurker', FIELD.width - 235, FIELD.height - 205);
  lurker.state = 'crouch';
  lurker.stateT = 0.5;
  lurker.r *= 1.3;
  world.dropCinders(FIELD.width / 2 - 90, FIELD.height / 2 + 130, 4);
  return SCREEN_TITLE;
}
