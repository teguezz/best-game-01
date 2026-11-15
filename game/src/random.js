// A small seeded random generator (mulberry32). The world takes all of its chance from an
// object like this, so a staged screenshot scene or a probe run with a fixed seed always
// unfolds the same way, while real play seeds it from the clock.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** An integer in [min, max]. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** One item of the array. */
    pick: (items) => items[Math.floor(next() * items.length)],
    /** True with the given probability. */
    chance: (probability) => next() < probability,
  };
}
