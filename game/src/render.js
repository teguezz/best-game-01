// EMBERLIGHT's drawing: one canvas, no images — the night garden, its creatures and every
// screen are painted from paths and gradients each frame. The garden's hedges, trees, grass
// and fireflies come from a fixed decorative seed, so the scene is the same garden every
// night; only the swarm changes. Screens are values the main loop passes in; this file also
// owns the layout rectangles for the clickable cards and buttons, so what is drawn and what
// can be clicked can never drift apart.

import { BOSS_NAMES, COLORS, FIELD, NIGHT_SECONDS, PLAYER } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_DAWN = 'dawn';

const TAU = Math.PI * 2;
const W = FIELD.width;
const H = FIELD.height;

// --- The garden's fixed dressing, grown once from a decorative seed -----------------------

function growGarden() {
  const random = createRandom(20261115);
  const trees = [];
  for (let i = 0; i < 9; i += 1) {
    trees.push({ x: random.range(-40, W + 40), y: random.range(-30, 90), s: random.range(0.7, 1.5), layer: i % 2 });
  }
  const tufts = [];
  for (let i = 0; i < 130; i += 1) {
    tufts.push({ x: random.range(0, W), y: random.range(0, H), s: random.range(0.6, 1.4), tone: random.next() });
  }
  const flowers = [];
  for (let i = 0; i < 46; i += 1) {
    flowers.push({ x: random.range(10, W - 10), y: random.range(10, H - 10), hue: random.pick(['#b48ce8', '#e88ca0', '#8cc7e8', '#e8d28c']), phase: random.range(0, TAU) });
  }
  const flies = [];
  for (let i = 0; i < 22; i += 1) {
    flies.push({ x: random.range(0, W), y: random.range(0, H), phase: random.range(0, TAU), speed: random.range(0.2, 0.6) });
  }
  return { trees, tufts, flowers, flies };
}

const GARDEN = growGarden();

// --- Small helpers ------------------------------------------------------------------------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

// --- Layout the main loop clicks against ---------------------------------------------------

export function levelCardRect(index) {
  const w = 300;
  const h = 216;
  const gap = 24;
  const total = w * 3 + gap * 2;
  return { x: (W - total) / 2 + index * (w + gap), y: 292, w, h };
}

export function beginButtonRect() {
  return { x: W / 2 - 170, y: 552, w: 340, h: 58 };
}

export function againButtonRect() {
  return { x: W / 2 - 160, y: 512, w: 320, h: 56 };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// --- The world -----------------------------------------------------------------------------

function drawGarden(ctx, world, shakeX, shakeY) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(0.55, COLORS.skyBottom);
  sky.addColorStop(0.551, COLORS.groundFar);
  sky.addColorStop(1, COLORS.ground);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars, fading as dawn nears.
  const dawnF = world.time / NIGHT_SECONDS;
  ctx.fillStyle = `rgba(230, 236, 255, ${0.5 * (1 - dawnF)})`;
  for (let i = 0; i < 60; i += 1) {
    const sx = ((i * 197.3) % W) + shakeX * 0.2;
    const sy = (i * 89.7) % 210;
    ctx.fillRect(sx, sy, 2, 2);
  }
  // The moon rides across the top as the night passes, then sets as dawn breaks.
  const moonX = 90 + dawnF * (W - 180);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, dawnF - 0.92) / 0.08);
  ctx.fillStyle = '#e9edda';
  ctx.beginPath();
  ctx.arc(moonX, 54, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.skyTop;
  ctx.beginPath();
  ctx.arc(moonX + 7, 48, 14, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Two silhouette layers of trees and hedges, drifting a breath against the keeper.
  const parFarX = (W / 2 - world.p.x) * 0.02 + shakeX;
  const parNearX = (W / 2 - world.p.x) * 0.045 + shakeX;
  for (const layer of [0, 1]) {
    ctx.fillStyle = layer === 0 ? COLORS.hedgeFar : COLORS.hedgeNear;
    const off = layer === 0 ? parFarX : parNearX;
    for (const tree of GARDEN.trees) {
      if (tree.layer !== layer) continue;
      const tx = tree.x + off;
      ctx.beginPath();
      ctx.arc(tx, tree.y + 66 * tree.s, 44 * tree.s, 0, TAU);
      ctx.arc(tx - 30 * tree.s, tree.y + 84 * tree.s, 30 * tree.s, 0, TAU);
      ctx.arc(tx + 32 * tree.s, tree.y + 84 * tree.s, 32 * tree.s, 0, TAU);
      ctx.fill();
      ctx.fillRect(tx - 4 * tree.s, tree.y + 80 * tree.s, 8 * tree.s, 46 * tree.s);
    }
    ctx.fillRect(-60, H - (layer === 0 ? 66 : 40), W + 120, layer === 0 ? 66 : 40);
  }

  // Grass tufts and night flowers on the ground.
  for (const tuft of GARDEN.tufts) {
    ctx.strokeStyle = tuft.tone > 0.5 ? '#173527' : '#10251c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const gx = tuft.x + parNearX * 0.4;
    ctx.moveTo(gx, tuft.y);
    ctx.lineTo(gx - 4 * tuft.s, tuft.y - 9 * tuft.s);
    ctx.moveTo(gx, tuft.y);
    ctx.lineTo(gx + 4 * tuft.s, tuft.y - 10 * tuft.s);
    ctx.stroke();
  }
  for (const flower of GARDEN.flowers) {
    const glow = 0.35 + 0.3 * Math.sin(world.time * 1.4 + flower.phase);
    ctx.fillStyle = flower.hue;
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(flower.x + parNearX * 0.4, flower.y, 2.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Fireflies wander their slow loops.
  ctx.fillStyle = '#cfe89a';
  for (const fly of GARDEN.flies) {
    const fx = fly.x + Math.sin(world.time * fly.speed + fly.phase) * 26;
    const fy = fly.y + Math.cos(world.time * fly.speed * 0.8 + fly.phase) * 18;
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(world.time * 2 + fly.phase * 3));
    ctx.beginPath();
    ctx.arc(fx, fy, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFoe(ctx, foe) {
  const { x, y } = foe;
  shadow(ctx, x, y + foe.r * 0.8, foe.r * 0.9, foe.r * 0.32);
  ctx.save();
  ctx.translate(x, y);
  if (foe.kind === 'moth' || foe.kind === 'shard') {
    const flap = Math.sin(foe.age * 20 + foe.phase) * 0.7;
    ctx.fillStyle = foe.kind === 'moth' ? COLORS.mothWing : COLORS.husk;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap * 0.45));
      ctx.beginPath();
      ctx.ellipse(side * foe.r * 0.95, -foe.r * 0.2, foe.r * 0.95, foe.r * 0.5, side * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = foe.kind === 'moth' ? '#4a3f6e' : '#8a5a24';
    ctx.beginPath();
    ctx.ellipse(0, 0, foe.r * 0.55, foe.r * 0.8, 0, 0, TAU);
    ctx.fill();
  } else if (foe.kind === 'dart') {
    const angle = Math.atan2(foe.vy || 0.001, foe.vx || 0.001);
    ctx.rotate(foe.state === 'dash' || foe.state === 'aim' ? angle : foe.age * 0.4);
    if (foe.state === 'aim' && Math.sin(foe.age * 26) > 0) ctx.fillStyle = '#ffffff';
    else ctx.fillStyle = COLORS.dart;
    ctx.beginPath();
    ctx.moveTo(foe.r * 1.25, 0);
    ctx.lineTo(-foe.r * 0.8, foe.r * 0.62);
    ctx.lineTo(-foe.r * 0.35, 0);
    ctx.lineTo(-foe.r * 0.8, -foe.r * 0.62);
    ctx.closePath();
    ctx.fill();
  } else if (foe.kind === 'husk') {
    ctx.fillStyle = COLORS.husk;
    ctx.beginPath();
    ctx.arc(0, 0, foe.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = COLORS.huskCrack;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-foe.r * 0.6, -foe.r * 0.4);
    ctx.lineTo(-foe.r * 0.1, 0);
    ctx.lineTo(-foe.r * 0.5, foe.r * 0.55);
    ctx.moveTo(foe.r * 0.55, -foe.r * 0.6);
    ctx.lineTo(foe.r * 0.15, -foe.r * 0.05);
    ctx.lineTo(foe.r * 0.6, foe.r * 0.4);
    ctx.stroke();
    ctx.fillStyle = '#ffca7a';
    ctx.beginPath();
    ctx.arc(0, 0, foe.r * 0.26 + Math.sin(foe.age * 5) * 1.2, 0, TAU);
    ctx.fill();
  } else {
    // Wisp and boss: a ghost with a wavy skirt and a hollow stare.
    const boss = foe.kind === 'boss';
    const sway = Math.sin(foe.age * 2.2 + foe.phase) * 3;
    ctx.fillStyle = boss ? COLORS.bossDeep : COLORS.wispDeep;
    ctx.beginPath();
    ctx.arc(0, -foe.r * 0.15, foe.r, Math.PI, 0);
    const waves = 5;
    for (let i = 0; i <= waves; i += 1) {
      const wx = -foe.r + (2 * foe.r * i) / waves;
      const wy = foe.r * 0.72 + Math.sin(foe.age * 7 + i * 1.7) * foe.r * 0.14;
      ctx.lineTo(wx + sway * 0.3, wy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = boss ? COLORS.boss : COLORS.wisp;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, -foe.r * 0.2, foe.r * 0.78, Math.PI, 0);
    ctx.lineTo(foe.r * 0.78, foe.r * 0.5);
    ctx.lineTo(-foe.r * 0.78, foe.r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (boss) {
      ctx.strokeStyle = COLORS.boss;
      ctx.lineWidth = 4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * foe.r * 0.45, -foe.r * 0.85);
        ctx.quadraticCurveTo(side * foe.r * 0.8, -foe.r * 1.35, side * foe.r * 1.05, -foe.r * 1.1);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#0a0f26';
    const eyeR = foe.r * 0.11;
    ctx.beginPath();
    ctx.arc(-foe.r * 0.3, -foe.r * 0.25, eyeR, 0, TAU);
    ctx.arc(foe.r * 0.3, -foe.r * 0.25, eyeR, 0, TAU);
    ctx.fill();
  }
  if (foe.chilled) {
    ctx.fillStyle = 'rgba(159, 216, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, foe.r * 1.05, 0, TAU);
    ctx.fill();
  }
  if (foe.flashT > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(foe.flashT / 0.09) * 0.75})`;
    ctx.beginPath();
    ctx.arc(0, 0, foe.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (foe.kind !== 'boss' && foe.hp < foe.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - foe.r, y - foe.r - 10, foe.r * 2, 4);
    ctx.fillStyle = '#e8b07a';
    ctx.fillRect(x - foe.r, y - foe.r - 10, foe.r * 2 * Math.max(0, foe.hp / foe.maxHp), 4);
  }
}

function drawKeeper(ctx, world) {
  const p = world.p;
  shadow(ctx, p.x, p.y + 15, 15, 5);
  // Frost aura ring.
  if (world.stats.frostRadius > 0) {
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.4)';
    ctx.fillStyle = 'rgba(159, 216, 255, 0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, world.stats.frostRadius, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // Orbiting sparks.
  for (let i = 0; i < world.stats.sparkCount; i += 1) {
    const angle = world.sparkAngle + (i * TAU) / world.stats.sparkCount;
    const sx = p.x + Math.cos(angle) * PLAYER.sparkRadius;
    const sy = p.y + Math.sin(angle) * PLAYER.sparkRadius;
    ctx.fillStyle = 'rgba(255, 138, 61, 0.3)';
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.emberHot;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hurtT > 0.28) ctx.globalAlpha = 0.55;
  // Cloak.
  ctx.fillStyle = '#1e4256';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(13, 2, 10, 17);
  ctx.quadraticCurveTo(0, 21, -10, 17);
  ctx.quadraticCurveTo(-13, 2, 0, -14);
  ctx.fill();
  ctx.fillStyle = '#2a5a75';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(8, 0, 6, 15);
  ctx.quadraticCurveTo(0, 18, -6, 15);
  ctx.quadraticCurveTo(-8, 0, 0, -14);
  ctx.fill();
  // Head under the hood.
  ctx.fillStyle = '#e8c39e';
  ctx.beginPath();
  ctx.arc(0, -13, 6.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#16303f';
  ctx.beginPath();
  ctx.arc(0, -16, 7.5, Math.PI, TAU);
  ctx.fill();
  // The lantern, held out toward the facing side.
  const lx = p.faceX >= 0 ? 13 : -13;
  ctx.strokeStyle = '#0d1b16';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(lx, -10);
  ctx.stroke();
  ctx.fillStyle = '#3a2c14';
  ctx.fillRect(lx - 5, -17, 10, 13);
  ctx.fillStyle = COLORS.lanternCore;
  ctx.beginPath();
  ctx.arc(lx, -10.5, 3.6 + Math.sin(world.time * 9) * 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, world, shakeX, shakeY) {
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawGarden(ctx, world, shakeX, shakeY);
  // Cinders: little fallen sparks of the flame, waiting to be gathered.
  for (const cinder of world.cinders) {
    const pulse = 0.75 + 0.25 * Math.sin(cinder.age * 3);
    ctx.save();
    ctx.translate(cinder.x, cinder.y);
    ctx.rotate(cinder.age * 0.7);
    ctx.fillStyle = COLORS.cinder;
    const r = 4.6 * pulse + (cinder.value >= 5 ? 2.4 : 0);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.7, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const foe of world.enemies) drawFoe(ctx, foe);
  drawKeeper(ctx, world);
  // Ember bolts.
  for (const bolt of world.bolts) {
    ctx.fillStyle = 'rgba(255, 138, 61, 0.28)';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.emberHot;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 3.6, 0, TAU);
    ctx.fill();
  }
  // Particles, lit.
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Darkness: everything far from the lantern falls away into the night. The light shrinks
  // as the flame weakens — the keeper can feel the dark closing in.
  const flameF = world.stats.flame / world.stats.maxFlame;
  const lightR = 235 + 150 * flameF + Math.sin(world.time * 11) * 6 + Math.sin(world.time * 23) * 3;
  const dark = ctx.createRadialGradient(world.p.x, world.p.y, lightR * 0.42, world.p.x, world.p.y, lightR * 1.65);
  dark.addColorStop(0, 'rgba(4, 6, 18, 0)');
  dark.addColorStop(0.75, 'rgba(4, 6, 18, 0.42)');
  dark.addColorStop(1, 'rgba(3, 4, 12, 0.88)');
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
  // The lantern's own warm bloom, on top of the dark.
  ctx.globalCompositeOperation = 'lighter';
  const bloom = ctx.createRadialGradient(world.p.x, world.p.y - 8, 4, world.p.x, world.p.y - 8, lightR * 0.8);
  bloom.addColorStop(0, 'rgba(255, 170, 70, 0.30)');
  bloom.addColorStop(1, 'rgba(255, 140, 50, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(world.p.x - lightR, world.p.y - lightR, lightR * 2, lightR * 2);
  ctx.globalCompositeOperation = 'source-over';
  // Damage numbers.
  ctx.textAlign = 'center';
  ctx.font = '700 13px system-ui, sans-serif';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 0.4);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// --- HUD ------------------------------------------------------------------------------------

function bar(ctx, x, y, w, h, frac, fillStyle, backStyle = 'rgba(6, 10, 24, 0.72)') {
  ctx.fillStyle = backStyle;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fillStyle;
    roundRect(ctx, x + 2, y + 2, Math.max(h - 2, (w - 4) * Math.min(1, frac)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(243, 234, 210, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.stroke();
}

function drawHud(ctx, world, view) {
  ctx.textAlign = 'left';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('FLAME', 22, 30);
  const flameF = world.stats.flame / world.stats.maxFlame;
  const flameGrad = ctx.createLinearGradient(22, 0, 262, 0);
  flameGrad.addColorStop(0, '#ff5d3d');
  flameGrad.addColorStop(0.55, COLORS.lantern);
  flameGrad.addColorStop(1, COLORS.lanternCore);
  bar(ctx, 22, 36, 240, 16, flameF, flameGrad);
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(world.stats.flame)} / ${world.stats.maxFlame}`, 30, 48);

  // Night progress, top centre: the road from dusk to dawn.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`DAWN IN ${formatClock(NIGHT_SECONDS - world.time)}`, W / 2, 30);
  const nightGrad = ctx.createLinearGradient(W / 2 - 190, 0, W / 2 + 190, 0);
  nightGrad.addColorStop(0, '#31449e');
  nightGrad.addColorStop(0.7, '#7a4a8a');
  nightGrad.addColorStop(1, '#ff9a4d');
  bar(ctx, W / 2 - 190, 36, 380, 12, world.time / NIGHT_SECONDS, nightGrad);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('SCORE', W - 22, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText(`${world.score}`, W - 22, 54);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`☠ ${world.kills} snuffed`, W - 22, 74);

  // Boss bar, bottom centre.
  if (world.boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9b8ff';
    ctx.font = '700 13px system-ui, sans-serif';
    const index = Math.min(world.bossesSpawned - 1, BOSS_NAMES.length - 1);
    ctx.fillText(BOSS_NAMES[Math.max(0, index)], W / 2, H - 44);
    bar(ctx, W / 2 - 220, H - 38, 440, 12, world.boss.hp / world.boss.maxHp, '#8a6cff');
  }

  // XP bar along the very bottom, with the level badge.
  bar(ctx, 64, H - 20, W - 86, 12, world.xp / world.xpNext, '#ffd76a');
  ctx.fillStyle = COLORS.lantern;
  ctx.beginPath();
  ctx.arc(34, H - 14, 19, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#23160a';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${world.level}`, 34, H - 9);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LEVEL ${world.level} · ${Math.floor(world.xp)} / ${world.xpNext} cinders`, 64, H - 26);

  ctx.textAlign = 'right';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(168, 158, 131, 0.8)';
  ctx.fillText(view.muted ? 'M — sound: OFF' : 'WASD move · hold mouse: focus fire · P pause · M sound', W - 16, H - 26);

  // Wave banner.
  if (world.banner.t > 0) {
    const f = world.banner.t / world.banner.max;
    ctx.globalAlpha = Math.min(1, f * 2.2);
    ctx.textAlign = 'center';
    ctx.font = '800 30px Georgia, serif';
    ctx.fillStyle = COLORS.text;
    ctx.shadowColor = 'rgba(255, 150, 60, 0.65)';
    ctx.shadowBlur = 18;
    ctx.fillText(world.banner.text, W / 2, 128);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

// --- Screens ---------------------------------------------------------------------------------

function drawTitle(ctx, world, view) {
  ctx.fillStyle = 'rgba(5, 7, 18, 0.38)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '800 92px Georgia, serif';
  ctx.shadowColor = 'rgba(255, 150, 60, 0.8)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText('EMBERLIGHT', W / 2, 208);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 21px Georgia, serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('You keep the last lantern in a dark garden.', W / 2, 256);
  ctx.fillText('Moths and shadow-wisps are coming to snuff it. Hold the flame until dawn.', W / 2, 286);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('MOVE  WASD / arrows        AIM  mouse — hold to focus fire        PAUSE  P        SOUND  M', W / 2, 348);
  ctx.fillText('Gather cinders from the fallen to grow stronger. Choose a blessing each level.', W / 2, 376);
  ctx.fillText('Survive the full night — 8 minutes — and dawn is yours.', W / 2, 404);

  const rect = beginButtonRect();
  const hover = pointInRect(view.mouse.x, view.mouse.y, rect);
  ctx.fillStyle = hover ? '#ffbe6e' : COLORS.lantern;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.fillStyle = '#23160a';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText('BEGIN THE NIGHT', W / 2, rect.y + 38);
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press Enter', W / 2, rect.y + rect.h + 26);
  if (view.best > 0) {
    ctx.fillStyle = COLORS.cinder;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`Best score so far: ${view.best}`, W / 2, rect.y + rect.h + 56);
  }
}

/**
 * Blessing icons, drawn from paths so a card never depends on an emoji font. `s` is the
 * half-size of the icon's box, centred on (cx, cy).
 */
function drawBlessingIcon(ctx, id, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = 2.4;
  if (id === 'edge') {
    const grad = ctx.createLinearGradient(0, s, 0, -s);
    grad.addColorStop(0, '#ff5d3d');
    grad.addColorStop(1, '#ffd76a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.85, -s * 0.1, s * 0.55, s * 0.45);
    ctx.quadraticCurveTo(s * 0.3, s * 0.95, 0, s * 0.95);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.95, -s * 0.55, s * 0.45);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.1, 0, -s);
    ctx.fill();
  } else if (id === 'hands') {
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath();
    ctx.moveTo(s * 0.25, -s);
    ctx.lineTo(-s * 0.55, s * 0.25);
    ctx.lineTo(-s * 0.05, s * 0.25);
    ctx.lineTo(-s * 0.25, s);
    ctx.lineTo(s * 0.55, -s * 0.25);
    ctx.lineTo(s * 0.05, -s * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'twin') {
    for (const dx of [-s * 0.45, s * 0.45]) {
      ctx.fillStyle = 'rgba(255, 138, 61, 0.3)';
      ctx.beginPath();
      ctx.arc(dx, 0, s * 0.52, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(dx, 0, s * 0.3, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'boots') {
    ctx.fillStyle = '#b07a3f';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.9);
    ctx.lineTo(s * 0.25, -s * 0.9);
    ctx.lineTo(s * 0.25, s * 0.25);
    ctx.lineTo(s * 0.85, s * 0.55);
    ctx.lineTo(s * 0.85, s * 0.9);
    ctx.lineTo(-s * 0.3, s * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8c39e';
    ctx.beginPath();
    ctx.moveTo(s * 0.25, -s * 0.3);
    ctx.lineTo(s * 0.72, -s * 0.05);
    ctx.moveTo(s * 0.25, 0);
    ctx.lineTo(s * 0.66, s * 0.22);
    ctx.stroke();
  } else if (id === 'charm') {
    ctx.strokeStyle = '#e85d5d';
    ctx.lineWidth = s * 0.42;
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.62, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    ctx.fillStyle = '#f3ead2';
    ctx.fillRect(-s * 0.83, s * 0.28, s * 0.42, s * 0.55);
    ctx.fillRect(s * 0.41, s * 0.28, s * 0.42, s * 0.55);
  } else if (id === 'stout') {
    ctx.fillStyle = '#3a2c14';
    roundRect(ctx, -s * 0.55, -s * 0.55, s * 1.1, s * 1.45, 4);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(0, s * 0.15, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(0, -s * 0.55);
    ctx.stroke();
  } else if (id === 'spark') {
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.95, s * 0.42, -0.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 0.42, s * 0.2, 0, TAU);
    ctx.fill();
  } else if (id === 'fury') {
    ctx.strokeStyle = '#ff8a3d';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = (i * TAU) / 8;
      const inner = i % 2 === 0 ? s * 0.3 : s * 0.45;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, TAU);
    ctx.fill();
  } else if (id === 'frost') {
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 6; i += 1) {
      const a = (i * TAU) / 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
      ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
      ctx.lineTo(Math.cos(a + 0.6) * s * 0.8, Math.sin(a + 0.6) * s * 0.8);
      ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
      ctx.lineTo(Math.cos(a - 0.6) * s * 0.8, Math.sin(a - 0.6) * s * 0.8);
      ctx.stroke();
    }
  } else if (id === 'greed') {
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * TAU) / 10;
      const r = i % 2 === 0 ? s * 0.95 : s * 0.42;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // coals: a mending heart.
    ctx.fillStyle = '#ff7a6e';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.bezierCurveTo(-s * 1.05, s * 0.05, -s * 0.6, -s * 0.85, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.6, -s * 0.85, s * 1.05, s * 0.05, 0, s * 0.8);
    ctx.fill();
  }
  ctx.restore();
}

function drawLevelUp(ctx, world, view) {
  ctx.fillStyle = 'rgba(4, 6, 16, 0.74)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '800 40px Georgia, serif';
  ctx.fillStyle = '#ffd9a0';
  ctx.shadowColor = 'rgba(255, 150, 60, 0.7)';
  ctx.shadowBlur = 22;
  ctx.fillText('THE FLAME GROWS', W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`Level ${world.level} — choose a blessing`, W / 2, 204);
  const choices = world.pendingChoices ?? [];
  ctx.font = '600 14px system-ui, sans-serif';
  choices.forEach((choice, i) => {
    const rect = levelCardRect(i);
    const hover = pointInRect(view.mouse.x, view.mouse.y, rect);
    ctx.save();
    if (hover) ctx.translate(0, -6);
    ctx.fillStyle = hover ? 'rgba(46, 36, 18, 0.96)' : 'rgba(16, 20, 38, 0.96)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.strokeStyle = hover ? COLORS.lantern : 'rgba(243, 234, 210, 0.3)';
    ctx.lineWidth = hover ? 3 : 1.5;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.stroke();
    drawBlessingIcon(ctx, choice.id, rect.x + rect.w / 2, rect.y + 48, 26);
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(choice.name, rect.x + rect.w / 2, rect.y + 106);
    ctx.font = '600 14.5px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const lines = wrapText(ctx, choice.describe(world.stats), rect.w - 36);
    lines.forEach((line, li) => ctx.fillText(line, rect.x + rect.w / 2, rect.y + 138 + li * 20));
    const taken = world.stats.taken[choice.id] ?? 0;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cinder;
    ctx.fillText(taken > 0 ? `Taken ×${taken} · press ${i + 1}` : `Press ${i + 1}`, rect.x + rect.w / 2, rect.y + rect.h - 16);
    ctx.restore();
  });
}

function drawStats(ctx, world, view) {
  const rows = [
    ['Score', `${world.score}`],
    ['Foes snuffed', `${world.kills}`],
    ['Night endured', formatClock(Math.min(world.time, NIGHT_SECONDS))],
    ['Level reached', `${world.level}`],
    ['Bosses felled', `${world.bossesSpawned - (world.boss ? 1 : 0)}`],
  ];
  ctx.font = '600 18px system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 318 + i * 34;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(label, W / 2 - 18, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(value, W / 2 + 18, y);
  });
  if (view.isBest) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.cinder;
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText('★ A new best score ★', W / 2, 318 + rows.length * 34 + 8);
  }
}

function drawEndButton(ctx, view, label) {
  const rect = againButtonRect();
  const hover = pointInRect(view.mouse.x, view.mouse.y, rect);
  ctx.fillStyle = hover ? '#ffbe6e' : COLORS.lantern;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.fillStyle = '#23160a';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, rect.y + 37);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press Enter', W / 2, rect.y + rect.h + 24);
}

function drawOver(ctx, world, view) {
  ctx.fillStyle = 'rgba(16, 4, 8, 0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '800 56px Georgia, serif';
  ctx.fillStyle = '#ff8a7a';
  ctx.fillText('THE LIGHT HAS GONE OUT', W / 2, 208);
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('The garden darkens, and the moths dance on.', W / 2, 248);
  drawStats(ctx, world, view);
  drawEndButton(ctx, view, 'LIGHT IT AGAIN');
}

function drawDawn(ctx, world, view) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255, 166, 88, 0.30)');
  grad.addColorStop(1, 'rgba(255, 120, 60, 0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10, 8, 20, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '800 64px Georgia, serif';
  ctx.shadowColor = 'rgba(255, 190, 90, 0.85)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('DAWN BREAKS', W / 2, 208);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('The flame endured the whole night. The garden is safe — this time.', W / 2, 248);
  drawStats(ctx, world, view);
  drawEndButton(ctx, view, 'PLAY AGAIN');
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 16, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '800 52px Georgia, serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('PAUSED', W / 2, 330);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Press P or Esc to return to the night', W / 2, 372);
}

/** Draw the whole frame: the world, its darkness, the HUD and the current screen's overlay. */
export function drawScene(ctx, world, view) {
  const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
  const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
  drawWorld(ctx, world, shakeX, shakeY);
  // A dying flame throbs red at the edges of sight — danger the player can feel.
  const flameF = world.stats.flame / world.stats.maxFlame;
  if (view.screen === SCREEN_PLAY && flameF < 0.3) {
    const pulse = 0.1 + 0.08 * Math.sin(world.time * 6);
    const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.86);
    edge.addColorStop(0, 'rgba(160, 20, 20, 0)');
    edge.addColorStop(1, `rgba(160, 20, 20, ${pulse + (0.3 - flameF) * 0.5})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }
  // The focus-fire reticle: where the keeper's will is pointed while the mouse is held.
  if (view.screen === SCREEN_PLAY && view.mouse.down) {
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(view.mouse.x, view.mouse.y, 11, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 215, 106, 0.9)';
    ctx.beginPath();
    ctx.arc(view.mouse.x, view.mouse.y, 2, 0, TAU);
    ctx.fill();
  }
  if (view.screen !== SCREEN_TITLE) drawHud(ctx, world, view);
  if (view.screen === SCREEN_TITLE) drawTitle(ctx, world, view);
  else if (view.screen === SCREEN_LEVELUP) drawLevelUp(ctx, world, view);
  else if (view.screen === SCREEN_PAUSE) drawPause(ctx);
  else if (view.screen === SCREEN_OVER) drawOver(ctx, world, view);
  else if (view.screen === SCREEN_DAWN) drawDawn(ctx, world, view);
}
