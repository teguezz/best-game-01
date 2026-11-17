// EMBERLIGHT tuning: every number that shapes a run lives here — the size of the garden, the
// length of the night, how the swarm grows, and what each creature is made of. The palette is
// here too, so the whole game shares one night-garden look: deep indigo dark, warm lantern
// amber, moth lavender, wisp teal, frost pale blue.

export const FIELD = { width: 1280, height: 720 };

/** A full night, in seconds: survive this long and dawn breaks. */
export const NIGHT_SECONDS = 480;
/** The fixed simulation step, in seconds; the world never advances by any other amount. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  speed: 238,
  maxFlame: 100,
  hurtCooldown: 0.45,
  startDamage: 6,
  startFireInterval: 0.55,
  startBolts: 1,
  boltSpeed: 640,
  startMagnet: 74,
  collectRadius: 24,
  sparkRadius: 56,
  sparkDamage: 9,
  dashBoost: 3.1,
  dashTime: 0.22,
  dashCooldown: 2.2,
};

/** Boss arrival times (seconds into the night) and the wave-banner minute marks. */
export const BOSS_TIMES = [115, 235, 355];
/** The same dark returns three times a night, deeper each time. */
export const BOSS_NAMES = ['UMBRA, THE SNUFFING DARK', 'UMBRA, THE DEEPER DARK', 'UMBRA, THE LAST DARK'];
export const WAVE_SECONDS = 60;

export const SPAWN = {
  startInterval: 1.25,
  endInterval: 0.3,
  enemyCap: 130,
  particleCap: 420,
  cinderCap: 320,
  floaterCap: 42,
};

/** Enemy blueprints: hp and damage are base values, scaled by the world's difficulty curve. */
export const FOES = {
  moth: { hp: 3, speed: 112, radius: 11, damage: 6, xp: 1, score: 10 },
  shard: { hp: 2, speed: 158, radius: 7, damage: 4, xp: 1, score: 5 },
  husk: { hp: 13, speed: 58, radius: 16, damage: 10, xp: 2, score: 25 },
  dart: { hp: 8, speed: 96, radius: 12, damage: 9, xp: 2, score: 30 },
  lurker: { hp: 16, speed: 74, radius: 13, damage: 12, xp: 3, score: 40 },
  wisp: { hp: 30, speed: 41, radius: 24, damage: 14, xp: 4, score: 50 },
  boss: { hp: 300, speed: 33, radius: 46, damage: 22, xp: 30, score: 500 },
};

export const COLORS = {
  skyTop: '#0a0f26',
  skyBottom: '#16204a',
  ground: '#0d1b16',
  groundFar: '#12241c',
  hedgeFar: '#0a1526',
  hedgeNear: '#060d18',
  lantern: '#ffb347',
  lanternCore: '#ffe9a8',
  ember: '#ff8a3d',
  emberHot: '#ffd76a',
  moth: '#cfc4e8',
  mothWing: '#9d8fc7',
  wisp: '#57e6c9',
  wispDeep: '#1d7a6c',
  husk: '#d98a4a',
  huskCrack: '#7a4416',
  shard: '#e8b07a',
  dart: '#e85d75',
  boss: '#8a6cff',
  bossDeep: '#3d2a8a',
  frost: '#9fd8ff',
  cinder: '#ffd76a',
  text: '#f3ead2',
  textDim: '#a89e83',
  danger: '#ff5d5d',
};
