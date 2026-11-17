# EMBERLIGHT — a lantern-keeper arena survival

You keep the last lantern in a dark garden. Moths and shadow-wisps swarm out of the night to
snuff its flame, and the flame is your life: if it dies, the garden goes dark. Survive the
full night — eight minutes — and dawn breaks. Every foe you snuff drops **cinders**; gather
them to level up and choose one of three **blessings** each level, building the keeper your
night demands. Three times a night the dark sends **UMBRA**, a boss wisp big enough to blot
out the trees, and it brings friends.

The night also **turns** as it deepens, four times: embers rain from the sky in a
**Cinderfall** (1:10), the swarm **surges** in a ring (2:52), a **Frost Gust** chills every
foe for five long seconds (4:48), and from 6:42 **the dark doubles** its pressure until
dawn. And after the first hundred seconds, something with amber eyes starts creeping
through the black toward your light.

An original game in plain JavaScript and canvas 2D — no libraries, no build step, no network.
All sound and music are synthesised live with WebAudio.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move the keeper |
| Shift / Space | Dash — a burst of speed in the move direction; nothing can bite you mid-dash (2.2 s cooldown) |
| Mouse | Aim — the lantern auto-casts ember bolts at the nearest foe |
| Hold mouse button | Focus fire: bolts hunt the foe nearest your cursor instead |
| 1 / 2 / 3 or click a card | Choose a blessing on level-up |
| P or Esc | Pause / resume |
| M | Sound on / off |
| Enter or click | Begin, and restart after dawn or darkness |

Keep moving: standing still is how lanterns die. The light around you shrinks as the flame
weakens, so a dim garden is a warning, not a mood.

## The swarm

- **Moth** — fast, fragile, flutters in crooked lines. One ember, early on.
- **Shard** — a splinter of a husk; faster and meaner than it looks.
- **Cinder Husk** — a slow cracked shell that splits into two shards when it breaks.
- **Dartmoth** — stalks, pauses, flashes, then dashes in a straight burning line.
- **Lurker** — nearly invisible in the dark: two amber eyes creep closer, crouch at the
  edge of the light with a grin, then lunge faster than you can walk. Dash, or be bitten.
- **Shadow-Wisp** — a big patient ghost; soaks up embers and bites hard.
- **UMBRA, THE SNUFFING DARK** — the boss, returning deeper at 1:55, 3:55 and 5:55, spawning
  moths as it comes. Felling it pays a shower of cinders.

## Blessings

Kindled Edge (damage), Quick Hands (cast speed), Twin Ember (+1 bolt per volley, ×4),
Piercing Embers (bolts fly through +1 foe, ×3),
Swift Boots (move speed), Cinder Charm (magnet), Stout Flame (max flame + mend), Orbit Spark
(a spark that circles and bites, ×4), Spark Fury (spark damage), Frost Aura (a slowing ring),
Gilded Cinders (XP), Banked Coals (mend now). Most stack; the cards say exactly what they do.

## Running it

- Play locally: `node serve.ts` in this repository, then open http://localhost:8080
  (any static file server pointed at `game/` works — it is plain files, `game/index.html`
  included, and makes zero network requests).
- Hand it in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
  `screenshots/` to `out/` and writes the `dossier.json` the judge reads.
- Self-test: open the game with `?probe=1` and it plays its own rules forward — spawning,
  levelling, the boss, a death and a dawn — and reports PASS/FAIL lines into the page.
- Screenshots: `shots.json` names the four staged scenes (`?shot=boss|title|levelup|dawn`),
  each played forward deterministically from its seed by an autopilot keeper.

## How it is built

One clear job per file, all of it hand-written for this game:

- `game/src/config.js` — every tuning number and the palette: night length, spawn curve,
  foe blueprints, boss times.
- `game/src/random.js` — a seeded mulberry32 generator; the world takes all chance from it,
  so staged scenes and probes are reproducible.
- `game/src/input.js` — keyboard and mouse state: held keys, press edges, the aim point.
- `game/src/audio.js` — the WebAudio sound kit: synthesised effects and a gentle pentatonic
  night pattern on a lookahead scheduler. No audio files.
- `game/src/upgrades.js` — the twelve blessings: what they do, their caps, the 1-of-3 roll.
- `game/src/events.js` — the night's four scripted turns (Cinderfall, the Swarm Surges, a
  Frost Gust, the Dark Doubles): when each fires, what it does, and the spawn/speed
  multipliers the world consults while one holds.
- `game/src/world.js` — the simulation: keeper (with a dash), flame, swarm AI (flutter,
  dash, split, the lurker's stalk-crouch-lunge, boss), piercing bolts, orbiting sparks,
  frost, cinders, particles, waves and scoring. Fixed-step, DOM-free, and it queues sound
  triggers for the shell to play.
- `game/src/render.js` — all drawing: the seeded garden, the darkness that closes as the
  flame fades, the creatures, the HUD, and every screen (title, blessing choice, pause,
  game over, dawn). Blessing icons are drawn from paths, never emoji.
- `game/src/shots.js` — the deterministic screenshot scenes and the autopilot keeper that
  plays them (and lends the dawn scene a staging-only boost so it can reach morning).
- `game/src/main.js` — boot, canvas fitting, the screen state machine, the fixed-step frame
  loop, and the `?shot=` / `?probe=1` modes.
- `main.ts` / `serve.ts` / `vendor/makefun-game.ts` — the hand-in program, the local static
  server, and the kit's dossier library (vendored, unchanged).

The simulation costs about 0.03 ms per step at full-night load in Node, so the frame budget
belongs to the painting, and entity counts are capped (130 foes, 420 particles) to keep it
that way on modest machines.
