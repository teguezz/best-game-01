// EMBERLIGHT's simulation: the keeper, the lantern flame, the swarm, the bosses, the cinders
// and every spark in between. The world advances only in fixed steps and takes all of its
// chance from the seeded random it was built with, so a staged scene always unfolds the same
// way. It knows nothing about the DOM: the main loop feeds it a movement vector and an aim
// point each step, reads event bits back, and drains the `fx` queue to play sounds.

import { BOSS_NAMES, BOSS_TIMES, FIELD, FOES, NIGHT_SECONDS, PLAYER, SPAWN, WAVE_SECONDS } from './config.js';
import { applyBlessing, rollChoices } from './upgrades.js';

export const EVENT_LEVELUP = 1;
export const EVENT_OVER = 2;
export const EVENT_DAWN = 4;

const TAU = Math.PI * 2;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** The cinders needed to leave `level` behind. */
export function xpForLevel(level) {
  return Math.round(5 + level * 4 + level * level * 0.6);
}

export class World {
  constructor(random) {
    this.random = random;
    this.reset();
  }

  /** Back to a quiet garden at the title screen: no run, a few moths drifting for atmosphere. */
  reset() {
    this.time = 0;
    this.kills = 0;
    this.score = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.p = { x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius, hurtT: 0, faceX: 1, faceY: 0 };
    this.stats = {
      flame: PLAYER.maxFlame,
      maxFlame: PLAYER.maxFlame,
      damage: PLAYER.startDamage,
      fireInterval: PLAYER.startFireInterval,
      bolts: PLAYER.startBolts,
      speed: PLAYER.speed,
      magnet: PLAYER.startMagnet,
      xpGain: 1,
      sparkCount: 0,
      sparkDamage: PLAYER.sparkDamage,
      frostRadius: 0,
      frostSlow: 0,
      taken: {},
    };
    this.enemies = [];
    this.bolts = [];
    this.cinders = [];
    this.particles = [];
    this.floaters = [];
    this.fx = [];
    this.fireTimer = 0.3;
    this.spawnTimer = 0.8;
    this.sparkAngle = 0;
    this.boss = null;
    this.bossesSpawned = 0;
    this.pendingChoices = null;
    this.lastWave = 0;
    this.banner = { text: '', t: 0, max: 1 };
    this.shake = 0;
    this.finished = 0; // 0 = running, EVENT_OVER or EVENT_DAWN once decided
    this.scoreFrac = 0;
  }

  /** Begin a run: a fresh keeper at dusk, the swarm already gathering. */
  startRun() {
    this.reset();
    this.showBanner('Night falls — keep the flame alive until dawn', 3.4);
  }

  showBanner(text, seconds = 2.6) {
    this.banner = { text, t: seconds, max: seconds };
  }

  difficultyHp() {
    return 1 + this.time / 88;
  }

  difficultyDamage() {
    return 1 + this.time / 380;
  }

  spawnInterval() {
    // The ramp is eased: the first half of the night stays breathable while a keeper learns
    // the garden, and the pressure arrives in earnest toward dawn.
    const f = Math.min(1, this.time / NIGHT_SECONDS);
    const eased = Math.pow(f, 1.6);
    return SPAWN.startInterval + (SPAWN.endInterval - SPAWN.startInterval) * eased;
  }

  /** A point just inside a random edge of the garden. */
  edgePoint() {
    const r = this.random;
    const side = r.int(0, 3);
    if (side === 0) return { x: r.range(20, FIELD.width - 20), y: 16 };
    if (side === 1) return { x: r.range(20, FIELD.width - 20), y: FIELD.height - 16 };
    if (side === 2) return { x: 16, y: r.range(20, FIELD.height - 20) };
    return { x: FIELD.width - 16, y: r.range(20, FIELD.height - 20) };
  }

  spawnFoe(kind, x, y) {
    const base = FOES[kind];
    const hp = Math.round(base.hp * this.difficultyHp());
    const foe = {
      kind, x, y, vx: 0, vy: 0,
      hp, maxHp: hp,
      r: base.radius, speed: base.speed * this.random.range(0.9, 1.1),
      dmg: base.damage, xpValue: base.xp, scoreValue: base.score,
      age: 0, phase: this.random.range(0, TAU),
      flashT: 0, sparkT: 0, chilled: false,
      state: 'stalk', stateT: 0, dashX: 0, dashY: 0, spawnT: 2.4,
    };
    this.enemies.push(foe);
    return foe;
  }

  pickKind() {
    const t = this.time;
    const weights = [['moth', 10]];
    if (t > 35) weights.push(['husk', 3.4]);
    if (t > 80) weights.push(['dart', 2.8]);
    if (t > 130) weights.push(['wisp', 2.4]);
    let total = 0;
    for (const [, w] of weights) total += w;
    let roll = this.random.next() * total;
    for (const [kind, w] of weights) {
      roll -= w;
      if (roll <= 0) return kind;
    }
    return 'moth';
  }

  spawnBoss() {
    const index = this.bossesSpawned;
    const at = this.edgePoint();
    const boss = this.spawnFoe('boss', FIELD.width / 2, 30);
    boss.x = at.x;
    boss.hp = boss.maxHp = Math.round(FOES.boss.hp * (1 + index * 0.9) * (1 + this.time / 300));
    this.boss = boss;
    this.bossesSpawned += 1;
    this.showBanner(`⚠ ${BOSS_NAMES[index]} ⚠`, 3.2);
    this.fx.push('boss');
    this.burst(boss.x, boss.y, 26, '#8a6cff', 190);
  }

  burst(x, y, count, color, speed = 140) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= SPAWN.particleCap) return;
      const angle = this.random.range(0, TAU);
      const v = this.random.range(speed * 0.25, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: this.random.range(0.3, 0.8), max: 0.8,
        size: this.random.range(1.5, 3.6), color, drag: 2.6,
      });
    }
  }

  floater(x, y, text, color = '#ffd76a') {
    if (this.floaters.length >= SPAWN.floaterCap) this.floaters.shift();
    this.floaters.push({ x, y, life: 0.8, text, color });
  }

  dropCinders(x, y, totalValue) {
    let remaining = totalValue;
    while (remaining > 0) {
      const value = Math.min(remaining, 5);
      remaining -= value;
      if (this.cinders.length >= SPAWN.cinderCap) {
        this.cinders[0].value += value;
        continue;
      }
      const angle = this.random.range(0, TAU);
      const v = this.random.range(20, 90);
      this.cinders.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        value, age: this.random.range(0, TAU),
      });
    }
  }

  damageFoe(foe, amount) {
    foe.hp -= amount;
    foe.flashT = 0.09;
    this.floater(foe.x + this.random.range(-8, 8), foe.y - foe.r - 4, `${Math.round(amount)}`);
    this.fx.push('hit');
    if (foe.hp > 0) return;
    this.killFoe(foe);
  }

  killFoe(foe) {
    foe.dead = true;
    this.kills += 1;
    this.score += foe.scoreValue;
    const colors = { moth: '#cfc4e8', shard: '#e8b07a', husk: '#d98a4a', dart: '#e85d75', wisp: '#57e6c9', boss: '#8a6cff' };
    this.burst(foe.x, foe.y, foe.kind === 'boss' ? 60 : 10, colors[foe.kind] ?? '#ffffff', foe.kind === 'boss' ? 260 : 150);
    this.dropCinders(foe.x, foe.y, foe.xpValue);
    if (foe.kind === 'husk') {
      for (let i = 0; i < 2; i += 1) {
        const shard = this.spawnFoe('shard', foe.x + this.random.range(-10, 10), foe.y + this.random.range(-10, 10));
        shard.age = this.random.range(0, 2);
      }
    }
    if (foe.kind === 'boss') {
      this.boss = null;
      this.shake = Math.max(this.shake, 11);
      this.fx.push('bossdie');
      this.showBanner('The dark recoils… for now', 2.6);
    } else {
      this.fx.push('die');
    }
  }

  addXp(value) {
    this.xp += value * this.stats.xpGain;
    let events = 0;
    while (this.xp >= this.xpNext && !this.pendingChoices) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = xpForLevel(this.level);
      this.pendingChoices = rollChoices(this.stats, this.random, 3);
      this.fx.push('levelup');
      this.burst(this.p.x, this.p.y, 30, '#ffd76a', 200);
      events |= EVENT_LEVELUP;
    }
    return events;
  }

  /** Apply one of the pending level-up choices (index into pendingChoices). */
  choose(index) {
    if (!this.pendingChoices || !this.pendingChoices[index]) return;
    applyBlessing(this.stats, this.pendingChoices[index]);
    this.pendingChoices = null;
    this.fx.push('choose');
    // A level banked while choosing (from a cinder collected the same step) rolls fresh choices.
    if (this.xp >= this.xpNext) this.addXp(0);
  }

  /** Staging-only boost, used by the screenshot scenes so an autopilot keeper can reach dawn. */
  stagingBoost() {
    this.stats.damage *= 3;
    this.stats.speed *= 1.12;
    this.stats.magnet *= 2.2;
    this.stats.maxFlame += 160;
    this.stats.flame = this.stats.maxFlame;
  }

  volley(aim) {
    if (this.enemies.length === 0) {
      this.fireTimer = 0.06;
      return;
    }
    const sorted = this.enemies.slice().sort((a, b) =>
      distance(this.p.x, this.p.y, a.x, a.y) - distance(this.p.x, this.p.y, b.x, b.y));
    let anchor = sorted[0];
    if (aim.focus) {
      let best = Infinity;
      for (const foe of this.enemies) {
        const d = distance(aim.x, aim.y, foe.x, foe.y);
        if (d < best) { best = d; anchor = foe; }
      }
    }
    const count = this.stats.bolts;
    for (let i = 0; i < count; i += 1) {
      const target = aim.focus ? anchor : sorted[i % sorted.length];
      const baseAngle = Math.atan2(target.y - this.p.y, target.x - this.p.x);
      const spread = (i - (count - 1) / 2) * 0.07;
      const angle = baseAngle + spread;
      this.bolts.push({
        x: this.p.x, y: this.p.y - 6,
        vx: Math.cos(angle) * PLAYER.boltSpeed, vy: Math.sin(angle) * PLAYER.boltSpeed,
        dmg: this.stats.damage, life: 1.1,
      });
    }
    this.fx.push('shoot');
  }

  /**
   * Advance the world one fixed step. `move` is a normalised direction, `aim` is
   * { x, y, focus }. Returns the event bits raised during the step.
   */
  step(dt, move, aim) {
    let events = 0;
    this.stepFxAndDressing(dt);
    if (this.finished) return events;

    this.time += dt;
    this.scoreFrac += dt * 5;
    if (this.scoreFrac >= 1) {
      const whole = Math.floor(this.scoreFrac);
      this.score += whole;
      this.scoreFrac -= whole;
    }
    if (this.time >= NIGHT_SECONDS) {
      this.finished = EVENT_DAWN;
      this.score += 2000;
      this.fx.push('dawn');
      this.burst(this.p.x, this.p.y, 60, '#ffe9a8', 240);
      return EVENT_DAWN;
    }

    this.stepPlayer(dt, move);
    events |= this.stepCasting(dt, aim);
    this.stepSpawning(dt);
    this.stepEnemies(dt);
    if (this.finished === EVENT_OVER) return EVENT_OVER;
    this.stepBolts(dt);
    events |= this.stepCinders(dt);
    return events;
  }

  /** Particles, floaters, banner and shake always animate, even on end screens. */
  stepFxAndDressing(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx -= pt.vx * pt.drag * dt;
      pt.vy -= pt.vy * pt.drag * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.p.hurtT > 0) this.p.hurtT -= dt;
  }

  stepPlayer(dt, move) {
    const s = this.stats;
    this.p.x = Math.min(FIELD.width - this.p.radius, Math.max(this.p.radius, this.p.x + move.x * s.speed * dt));
    this.p.y = Math.min(FIELD.height - this.p.radius, Math.max(this.p.radius, this.p.y + move.y * s.speed * dt));
    if (move.x !== 0 || move.y !== 0) {
      this.p.faceX = move.x;
      this.p.faceY = move.y;
    }
    // The lantern sheds a slow trail of embers as the keeper moves.
    if ((move.x !== 0 || move.y !== 0) && this.random.chance(0.35)) {
      this.particles.push({
        x: this.p.x + this.random.range(-6, 6), y: this.p.y + this.random.range(-2, 8),
        vx: this.random.range(-14, 14), vy: this.random.range(-26, -8),
        life: this.random.range(0.3, 0.7), max: 0.7, size: this.random.range(1.2, 2.4),
        color: '#ff8a3d', drag: 0.6,
      });
    }
  }

  stepCasting(dt, aim) {
    const s = this.stats;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.volley(aim);
      this.fireTimer = Math.max(this.fireTimer + s.fireInterval, 0.02);
    }
    // Orbiting sparks circle the lantern and bite whatever they touch.
    this.sparkAngle += dt * 2.7;
    if (s.sparkCount > 0) {
      for (let i = 0; i < s.sparkCount; i += 1) {
        const angle = this.sparkAngle + (i * TAU) / s.sparkCount;
        const sx = this.p.x + Math.cos(angle) * PLAYER.sparkRadius;
        const sy = this.p.y + Math.sin(angle) * PLAYER.sparkRadius;
        for (const foe of this.enemies) {
          if (foe.sparkT <= 0 && distance(sx, sy, foe.x, foe.y) < foe.r + 13) {
            foe.sparkT = 0.35;
            this.damageFoe(foe, s.sparkDamage);
          }
        }
      }
    }
    return 0;
  }

  stepSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.enemies.length < SPAWN.enemyCap) {
        const at = this.edgePoint();
        this.spawnFoe(this.pickKind(), at.x, at.y);
      }
      this.spawnTimer += this.spawnInterval() * this.random.range(0.75, 1.25);
    }
    const wave = Math.floor(this.time / WAVE_SECONDS);
    if (wave > this.lastWave) {
      this.lastWave = wave;
      this.showBanner(`Wave ${wave + 1} — the dark thickens`, 2.6);
      const ring = 5 + wave * 2;
      for (let i = 0; i < ring && this.enemies.length < SPAWN.enemyCap; i += 1) {
        const at = this.edgePoint();
        this.spawnFoe('moth', at.x, at.y);
      }
    }
    if (this.bossesSpawned < BOSS_TIMES.length && this.time >= BOSS_TIMES[this.bossesSpawned]) {
      this.spawnBoss();
    }
  }

  foeSpeedFactor(foe) {
    const s = this.stats;
    if (s.frostRadius > 0 && distance(this.p.x, this.p.y, foe.x, foe.y) < s.frostRadius + foe.r) {
      foe.chilled = true;
      return 1 - s.frostSlow;
    }
    foe.chilled = false;
    return 1;
  }

  stepEnemies(dt) {
    const p = this.p;
    for (const foe of this.enemies) {
      foe.age += dt;
      if (foe.flashT > 0) foe.flashT -= dt;
      if (foe.sparkT > 0) foe.sparkT -= dt;
      const factor = this.foeSpeedFactor(foe);
      const toPlayer = Math.atan2(p.y - foe.y, p.x - foe.x);
      let vx = 0;
      let vy = 0;
      if (foe.kind === 'moth' || foe.kind === 'shard') {
        const wobble = Math.sin(foe.age * 9 + foe.phase) * 0.55;
        const angle = toPlayer + wobble * 0.6;
        vx = Math.cos(angle) * foe.speed;
        vy = Math.sin(angle) * foe.speed;
      } else if (foe.kind === 'dart') {
        foe.stateT -= dt;
        if (foe.state === 'stalk') {
          vx = Math.cos(toPlayer) * foe.speed;
          vy = Math.sin(toPlayer) * foe.speed;
          if (distance(p.x, p.y, foe.x, foe.y) < 270) { foe.state = 'aim'; foe.stateT = 0.55; }
        } else if (foe.state === 'aim') {
          vx = Math.cos(toPlayer) * foe.speed * 0.12;
          vy = Math.sin(toPlayer) * foe.speed * 0.12;
          if (foe.stateT <= 0) {
            foe.state = 'dash';
            foe.stateT = 0.32;
            foe.dashX = Math.cos(toPlayer);
            foe.dashY = Math.sin(toPlayer);
          }
        } else if (foe.state === 'dash') {
          vx = foe.dashX * 545;
          vy = foe.dashY * 545;
          if (foe.stateT <= 0) { foe.state = 'rest'; foe.stateT = 0.7; }
        } else {
          vx = Math.cos(toPlayer) * foe.speed * 0.3;
          vy = Math.sin(toPlayer) * foe.speed * 0.3;
          if (foe.stateT <= 0) foe.state = 'stalk';
        }
      } else {
        // husk, wisp and the boss simply advance, inexorable.
        vx = Math.cos(toPlayer) * foe.speed;
        vy = Math.sin(toPlayer) * foe.speed;
        if (foe.kind === 'boss') {
          foe.spawnT -= dt;
          if (foe.spawnT <= 0 && this.enemies.length < SPAWN.enemyCap) {
            foe.spawnT = 2.4;
            this.spawnFoe('moth', foe.x + this.random.range(-30, 30), foe.y + this.random.range(-30, 30));
          }
        }
      }
      foe.vx = vx * factor;
      foe.vy = vy * factor;
      foe.x += foe.vx * dt;
      foe.y += foe.vy * dt;
      foe.x = Math.min(FIELD.width - 6, Math.max(6, foe.x));
      foe.y = Math.min(FIELD.height - 6, Math.max(6, foe.y));
    }
    // A gentle separation keeps the swarm from stacking into one blob.
    const list = this.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = (a.r + b.r) * 0.82;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5 * 30 * dt;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
    // Contact: whatever reaches the lantern bites at the flame.
    for (const foe of this.enemies) {
      if (this.p.hurtT <= 0 && distance(p.x, p.y, foe.x, foe.y) < foe.r + p.radius - 2) {
        this.stats.flame -= foe.dmg * this.difficultyDamage();
        this.p.hurtT = PLAYER.hurtCooldown;
        this.shake = Math.max(this.shake, 6);
        this.fx.push('hurt');
        this.burst(p.x, p.y, 12, '#ff5d5d', 160);
        if (this.stats.flame <= 0) {
          this.stats.flame = 0;
          this.finished = EVENT_OVER;
          this.fx.push('over');
        }
      }
    }
    this.enemies = this.enemies.filter((foe) => !foe.dead);
  }

  stepBolts(dt) {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0) continue;
      for (const foe of this.enemies) {
        if (!foe.dead && distance(bolt.x, bolt.y, foe.x, foe.y) < foe.r + 5) {
          bolt.life = 0;
          this.burst(bolt.x, bolt.y, 3, '#ffd76a', 90);
          this.damageFoe(foe, bolt.dmg);
          break;
        }
      }
    }
    this.bolts = this.bolts.filter((bolt) => bolt.life > 0);
    this.enemies = this.enemies.filter((foe) => !foe.dead);
  }

  stepCinders(dt) {
    let events = 0;
    const s = this.stats;
    for (const cinder of this.cinders) {
      cinder.age += dt * 3;
      const d = distance(this.p.x, this.p.y, cinder.x, cinder.y);
      if (d < s.magnet) {
        const pull = 560 * (1 - d / (s.magnet * 1.6));
        cinder.vx += ((this.p.x - cinder.x) / (d || 1)) * pull * dt * 4;
        cinder.vy += ((this.p.y - cinder.y) / (d || 1)) * pull * dt * 4;
      } else {
        cinder.vx -= cinder.vx * 3 * dt;
        cinder.vy -= cinder.vy * 3 * dt;
      }
      cinder.x += cinder.vx * dt;
      cinder.y += cinder.vy * dt;
      if (d < PLAYER.collectRadius) {
        cinder.taken = true;
        this.burst(cinder.x, cinder.y, 2, '#ffd76a', 60);
        events |= this.addXp(cinder.value);
        if (this.fx.filter((name) => name === 'pickup').length < 3) this.fx.push('pickup');
      }
    }
    this.cinders = this.cinders.filter((cinder) => !cinder.taken);
    return events;
  }
}
