# Fallowstar

A browser hex-crawl RPG about a patrol of guardmice and a world whose seasons are going wrong. Redwall and Mouse Guard above ground; Phantasy Star in the battles; something colder under the hills.

**The demo loop.** It is early autumn. Three guardmice leave Fallowstar Hold with short provisions to find a sealed door of the old builders somewhere in the unmapped wilds, and get home before first snow. Finding the door and returning is a win. Starving, the whole patrol falling in battle, or being caught out when winter arrives is a loss. A run takes fifteen to twenty minutes.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: simulation invariants and the balance harness
npm run build      # production build in dist/ (base path /fallowstar/)
npm run preview    # serve the production build
npm run sim        # verbose balance report over 200 seeds
```

Node 22 or newer. The only dependencies are TypeScript, Vite and Vitest.

**Deploying.** Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. The workflow tries to enable Pages on first run; if the deploy job is refused, set the repository's Pages source to "GitHub Actions" under Settings → Pages once. The built site assumes it is served from `/fallowstar/`; set `VITE_BASE=/` at build time for a root deployment.

## Playing

Tap or click a neighbouring hex to move. Drag to pan, pinch or scroll to zoom. The bottom bar forages, camps, opens the pouches, recentres, and opens the menu. On a keyboard: `Q E A D Z X` move in the six hex directions, `F` forage, `R` camp, `I` items, `C` centre, `+`/`-` zoom, `Esc` menu, `Enter` confirms a dialog, and digits pick battle commands.

Each move costs time by terrain, in half-days. The patrol eats three rations a day. Foraging takes half a day and depends on the ground; camping takes a day and mends the patrol unless it is hungry. Returning to the hold heals, restocks and resets the pouches, so a second sortie is possible if the season allows. The elders know roughly which way the door lies; from a hilltop the grey of the old works can be seen some way off. Progress saves automatically; the title screen offers to continue, and a new game takes an optional seed and shows the one in use.

## Architecture

The rule that matters more than any other: **the simulation never touches the DOM or the canvas.**

```
src/
  sim/        pure rules: no DOM, no canvas, no Date, no Math.random
  content/    plain data: terrain, enemies, encounter tables, techniques,
              items, party classes, landmarks, story text, balance knobs
  ui/         rendering and input: reads GameState, dispatches Actions
  main.ts     boots the App
```

`sim/game.ts` exposes `newGame(seed)` and `step(state, action) → { state, events }`. `GameState` is a plain JSON object; `step` clones it, applies one action, and returns the new state plus a list of typed events for the presentation layer to narrate. All randomness flows through a seeded generator whose state lives inside `GameState`, so a seed and an action sequence replay identically, and a save is just the serialised state.

| Module | Responsibility |
| --- | --- |
| `sim/rng.ts` | mulberry32 generator with a serialisable state; seed hashing |
| `sim/hex.ts` | axial coordinates, neighbours, distance, ranges, pixel conversion |
| `sim/mapgen.ts` | seeded map generation, lookups, reachability, pathfinding |
| `sim/fog.ts` | reveal rules by terrain sight; hill spotting of the ruins |
| `sim/game.ts` | the reducer: movement, clock, rations, forage, camp, landmarks, door, hold, win/loss |
| `sim/battle.ts` | round resolution: initiative, attacks, techniques, items, flee, rewards |
| `sim/party.ts` | party creation, levelling, restoration |
| `sim/save.ts` | JSON codec with a version check |
| `sim/bots.ts` | scripted careful/careless players for the balance harness |

The `ui/` layer is split the same way: `app.ts` owns the state and is the only caller of `step`; `mapRenderer.ts`, `battleRenderer.ts` and `glyphs.ts` draw; `input.ts` turns pointer events into taps, pans and pinches; `hud.ts`, `dialogs.ts`, `battleScreen.ts`, `title.ts` and `endScreen.ts` are plain DOM; `storage.ts` is the localStorage adapter; `describe.ts` turns events into sentences.

A later first-person dungeon view, or a port to another engine, replaces `ui/` and keeps `sim/` and `content/` whole. The door hex already carries its own terrain and position; "enter the door" would be one more action on the reducer.

## Content

Everything tunable lives in `src/content/` as plain TypeScript objects:

- `terrain.ts`: move cost, sight radius, forage yield and description per terrain.
- `enemies.ts`: stats, experience, flee modifier, loot and description per enemy.
- `encounters.ts`: per-terrain encounter chance and weighted tables with group sizes; the camp ambush table.
- `techniques.ts`: cost, targeting, kind and power of each technique.
- `items.ts`: item effects and whether they can be used outside battle.
- `party.ts`: the three guardmice, their base stats, growth and learned techniques.
- `landmarks.ts`: landmark placement rules, effects and first/return flavour text.
- `text.ts`: intro, door, hold, win and loss passages.
- `balance.ts`: season length, map size, door distance bands, rations, starvation, camp and forage costs, XP table, hold restock, battle maths.

`src/ui/palette.ts` holds the colours, kept out of `content/` so that the simulation stays free of presentation.

## Tests

`npm test` runs the Vitest suite under `src/sim/`:

- generator determinism and distribution;
- hex maths round trips;
- map invariants over forty seeds: hold and door exist, door sits in its distance and walking-cost bands and is reachable, terrain forms coherent regions, landmarks sit on matching reachable ground, the same seed yields the same map;
- movement, clock, rations, starvation, winter, fog, foraging, items, hold restock, landmarks and the win condition;
- battle determinism, damage floors, victory and loot, levelling, techniques, TP checks, smoke pods, flee odds and outcomes, party wipe, revival;
- the balance harness: scripted careful and careless players over many seeds, asserting that the careful one usually wins with a few days to spare and the careless one usually does not.

Design choices that the brief left open are recorded in `DECISIONS.md`.
