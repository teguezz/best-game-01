// EMBERLIGHT's boot and frame loop. It owns the canvas, the screen state machine (title →
// play → level-up / pause → dawn or dark), the sound triggers the world queues, and the two
// non-game modes the page supports: ?shot=<scene>&seed=<n> stages a deterministic scene for
// screenshots, and ?probe=1 runs a scripted self-test of the rules and reports into the page.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { Input } from './input.js';
import { SoundKit } from './audio.js';
import { EVENT_DAWN, EVENT_LEVELUP, EVENT_OVER, World } from './world.js';
import {
  SCREEN_DAWN, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE,
  drawScene, levelCardRect, pointInRect,
} from './render.js';
import { autoChoose, pilotMove, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - FIELD.width * scale) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - FIELD.height * scale) / 2)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem('emberlight-best')) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('emberlight-best', String(value));
  } catch {
    // A private window may refuse storage; the in-page best still stands for the session.
  }
}

// --- The scripted self-test behind ?probe=1 -------------------------------------------------

function runProbe() {
  const lines = [];
  const check = (name, ok) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  const aimFree = { x: 0, y: 0, focus: false };

  const world = new World(createRandom(42));
  world.startRun();
  let peakFoes = 0;
  for (let i = 0; i < 60 * 45; i += 1) {
    world.step(STEP, pilotMove(world), aimFree);
    peakFoes = Math.max(peakFoes, world.enemies.length);
  }
  check('foes spawn and press in', peakFoes >= 4);
  check('auto-cast snuffs foes', world.kills >= 3);
  check('score accrues', world.score > 0);

  // The pilot's run may already have levelled it once, choices open; settle those first so
  // the level-up path is tested from a clean slate. (Banked cinders can chain levels.)
  while (world.pendingChoices) world.choose(0);
  const levelBefore = world.level;
  world.addXp(world.xpNext + 1);
  check('cinders level the keeper up', world.level === levelBefore + 1 && Array.isArray(world.pendingChoices));
  check('three blessings are offered', world.pendingChoices.length === 3);
  while (world.pendingChoices) world.choose(0);
  check('choosing applies and clears', world.pendingChoices === null);

  world.time = 114.9;
  for (let i = 0; i < 40 && !world.boss; i += 1) world.step(STEP, pilotMove(world), aimFree);
  check('the boss arrives on schedule', world.boss !== null);

  const doomed = new World(createRandom(5));
  doomed.startRun();
  doomed.stats.flame = 6;
  doomed.spawnFoe('moth', doomed.p.x + 18, doomed.p.y);
  let guard = 0;
  while (!doomed.finished && guard < 60 * 10) {
    doomed.step(STEP, { x: 0, y: 0 }, aimFree);
    guard += 1;
  }
  check('a dead flame ends the night', doomed.finished === EVENT_OVER);

  const blessed = new World(createRandom(9));
  blessed.startRun();
  blessed.stagingBoost();
  guard = 0;
  while (!blessed.finished && guard < 60 * 500) {
    blessed.step(STEP, pilotMove(blessed), aimFree);
    autoChoose(blessed);
    guard += 1;
  }
  check('a kept flame reaches dawn', blessed.finished === EVENT_DAWN);

  const passed = lines.every((line) => line.startsWith('PASS'));
  document.title = `PROBE ${passed ? 'PASS' : 'FAIL'}`;
  const out = document.createElement('pre');
  out.id = 'probe-out';
  out.textContent = lines.join('\n');
  document.body.appendChild(out);
  for (const line of lines) console.log(`PROBE ${line}`);
  return passed;
}

// --- Modes -----------------------------------------------------------------------------------

if (params.has('probe')) {
  runProbe();
} else if (params.has('shot')) {
  const seed = Number(params.get('seed')) || 1;
  const world = new World(createRandom(seed));
  const screen = stageShot(params.get('shot') ?? 'title', world, seed);
  const view = { screen, mouse: { x: -99, y: -99 }, muted: true, best: 0, isBest: false };
  const paint = () => {
    drawScene(ctx, world, view);
    window.requestAnimationFrame(paint);
  };
  paint();
  window.__shotReady = true;
} else {
  playGame();
}

// --- The live game ----------------------------------------------------------------------------

function playGame() {
  const sound = new SoundKit();
  const input = new Input(canvas, toLogical);
  const world = new World(createRandom((Date.now() % 2147483647) || 1));
  // A few moths drift around the lantern on the title screen.
  for (let i = 0; i < 5; i += 1) {
    const at = world.edgePoint();
    world.spawnFoe('moth', at.x, at.y);
  }
  let screen = SCREEN_TITLE;
  let best = loadBest();
  let isBest = false;
  let muted = false;
  let endShownAt = 0;
  const view = { screen, mouse: input.mouse, muted, best, isBest };
  // A read-only window handle so a test driver (or a curious player in devtools) can watch
  // the run's state; the game itself never reads it.
  window.__emberlight = { world, state: () => ({ screen, muted, best }) };

  const SOUND_FOR = {
    shoot: () => sound.shoot(),
    hit: () => sound.hit(),
    die: () => sound.die(),
    pickup: () => sound.pickup(),
    levelup: () => sound.levelUp(),
    hurt: () => sound.hurt(),
    boss: () => sound.bossWarn(),
    bossdie: () => sound.bossDie(),
    dawn: () => sound.dawn(),
    over: () => sound.over(),
    choose: () => sound.choose(),
  };

  function drainFx() {
    const played = new Set();
    for (const name of world.fx) {
      if (played.has(name)) continue;
      played.add(name);
      const play = SOUND_FOR[name];
      if (play) play();
    }
    world.fx.length = 0;
  }

  function setScreen(next) {
    screen = next;
    view.screen = next;
    statusLine.textContent = `EMBERLIGHT — ${next}`;
  }

  function beginRun() {
    sound.unlock();
    sound.startMusic();
    world.startRun();
    isBest = false;
    view.isBest = false;
    setScreen(SCREEN_PLAY);
  }

  function finishRun() {
    if (world.score > best) {
      best = world.score;
      view.best = best;
      isBest = true;
      view.isBest = true;
      saveBest(best);
    }
    endShownAt = performance.now();
  }

  function handleEvents(events) {
    if (events & EVENT_LEVELUP) setScreen(SCREEN_LEVELUP);
    if (events & EVENT_OVER) {
      finishRun();
      setScreen(SCREEN_OVER);
    }
    if (events & EVENT_DAWN) {
      finishRun();
      setScreen(SCREEN_DAWN);
    }
  }

  function chooseBlessing(index) {
    if (!world.pendingChoices || index >= world.pendingChoices.length) return;
    world.choose(index);
    drainFx();
    setScreen(SCREEN_PLAY);
  }

  // Losing the window mid-night pauses the run instead of feeding the keeper to the dark.
  window.addEventListener('blur', () => {
    if (screen === SCREEN_PLAY) setScreen(SCREEN_PAUSE);
  });

  function handleEdges() {
    let code = input.takeEdge();
    while (code !== null) {
      if (code === 'KeyM') {
        muted = !muted;
        view.muted = muted;
        sound.setMuted(muted);
      } else if (screen === SCREEN_TITLE && (code === 'Enter' || code === 'Space')) {
        beginRun();
      } else if (screen === SCREEN_PLAY && (code === 'KeyP' || code === 'Escape')) {
        setScreen(SCREEN_PAUSE);
      } else if (screen === SCREEN_PAUSE && (code === 'KeyP' || code === 'Escape' || code === 'Enter')) {
        setScreen(SCREEN_PLAY);
      } else if (screen === SCREEN_LEVELUP && (code === 'Digit1' || code === 'Digit2' || code === 'Digit3')) {
        chooseBlessing(Number(code.slice(-1)) - 1);
      } else if ((screen === SCREEN_OVER || screen === SCREEN_DAWN) && (code === 'Enter' || code === 'Space')) {
        beginRun();
      }
      code = input.takeEdge();
    }
  }

  function handleClick() {
    if (!input.takeClick()) return;
    sound.unlock();
    const { x, y } = input.mouse;
    if (screen === SCREEN_TITLE) {
      beginRun();
    } else if (screen === SCREEN_LEVELUP) {
      for (let i = 0; i < 3; i += 1) {
        if (pointInRect(x, y, levelCardRect(i))) {
          chooseBlessing(i);
          break;
        }
      }
    } else if ((screen === SCREEN_OVER || screen === SCREEN_DAWN) && performance.now() - endShownAt > 500) {
      beginRun(); // Any click restarts once the end screen has had a moment to land.
    }
  }

  /** Title-screen ambience: the moths circle the light but never land a bite. */
  function stepTitle(dt) {
    world.time += dt;
    world.stepFxAndDressing(dt);
    for (const foe of world.enemies) {
      foe.age += dt;
      const dx = world.p.x - foe.x;
      const dy = world.p.y - foe.y;
      const d = Math.hypot(dx, dy) || 1;
      const approach = d > 170 ? 26 : 0;
      const orbit = 34;
      foe.x += (dx / d) * approach * dt + (-dy / d) * orbit * dt;
      foe.y += (dy / d) * approach * dt + (dx / d) * orbit * dt;
    }
  }

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += dt;
    handleEdges();
    handleClick();
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      if (screen === SCREEN_PLAY) {
        const aim = { x: input.mouse.x, y: input.mouse.y, focus: input.mouse.down };
        handleEvents(world.step(STEP, input.moveVector(), aim));
        drainFx();
        if (screen !== SCREEN_PLAY) break;
      } else if (screen === SCREEN_TITLE) {
        stepTitle(STEP);
      } else {
        world.stepFxAndDressing(STEP);
      }
    }
    if (steps === 5) accumulator = 0;
    view.mouse = input.mouse;
    drawScene(ctx, world, view);
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}
