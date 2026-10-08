/**
 * The game reducer. `step(state, action)` returns a new state and the list of
 * things that happened, for the presentation layer to narrate. The input state
 * is never mutated.
 *
 * Time is measured in half-days. Days tick when a half-day boundary with an
 * even index is crossed; each tick eats rations and checks for starvation and
 * the arrival of winter.
 */
import { BALANCE } from '../content/balance';
import { CAMP_ENCOUNTERS, ENCOUNTERS, type EncounterEntry } from '../content/encounters';
import { ITEMS } from '../content/items';
import { LANDMARKS } from '../content/landmarks';
import { TERRAIN } from '../content/terrain';
import { endBattle, resolveRound, startBattle } from './battle';
import { reveal, revealFromPosition } from './fog';
import { axialToPixel, hexAdjacent, hexEquals, type Axial } from './hex';
import { generateMap, hexAt, isPassable } from './mapgen';
import { allDown, createParty, isDown, restoreParty } from './party';
import { hashSeed, Rng } from './rng';
import type { Action, EnemyId, GameEvent, GameState, StepResult } from './types';

export const SAVE_VERSION = 1;

export function newGame(seed: string): GameState {
  const map = generateMap(seed);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: hashSeed(`${seed}/play`),
    map,
    party: createParty(),
    pos: { ...map.hold },
    time: 0,
    seasonDays: BALANCE.seasonDays,
    mode: 'explore',
    doorFound: false,
    battle: null,
    outcome: null,
    stats: { battles: 0, fled: 0, forages: 0, sorties: 0, hexesCharted: 0 },
  };
  state.stats.hexesCharted += revealFromPosition(state.map, state.pos);
  return state;
}

// ----- Derived values ---------------------------------------------------------

/** 1-based day number. */
export function currentDay(state: GameState): number {
  return Math.floor(state.time / 2) + 1;
}

export function daysRemaining(state: GameState): number {
  return Math.max(0, state.seasonDays - Math.floor(state.time / 2));
}

export function isAfternoon(state: GameState): boolean {
  return state.time % 2 === 1;
}

/** Read through a function so TypeScript does not narrow `mode` across mutations. */
function modeOf(state: GameState): GameState['mode'] {
  return state.mode;
}

export function atHold(state: GameState): boolean {
  return hexEquals(state.pos, state.map.hold);
}

/** Eight-point compass bearing from one hex to another, in pixel space. */
export function bearing(from: Axial, to: Axial): string {
  const a = axialToPixel(from, 1);
  const b = axialToPixel(to, 1);
  const angle = Math.atan2(-(b.y - a.y), b.x - a.x); // y grows downward on screen
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const idx = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return names[idx];
}

/** What the elders say about where the door lies. */
export function doorBearing(state: GameState): string {
  return bearing(state.map.hold, state.map.door);
}

export function canForage(state: GameState): boolean {
  const hex = hexAt(state.map, state.pos);
  return !!hex && TERRAIN[hex.terrain].forage !== null && state.mode === 'explore';
}

// ----- Reducer ---------------------------------------------------------------

export function step(input: GameState, action: Action): StepResult {
  const state = structuredClone(input);
  const events: GameEvent[] = [];
  switch (action.type) {
    case 'move':
      doMove(state, action.to, events);
      break;
    case 'forage':
      doForage(state, events);
      break;
    case 'camp':
      doCamp(state, events);
      break;
    case 'useItem':
      doUseItem(state, action.item, action.target, events);
      break;
    case 'battleRound':
      if (state.mode !== 'battle' || !state.battle) {
        events.push({ type: 'invalid', reason: 'Not in battle' });
      } else {
        events.push(...resolveRound(state, action.commands));
      }
      break;
    case 'endBattle':
      if (!state.battle || state.battle.phase === 'command') {
        events.push({ type: 'invalid', reason: 'Battle has not concluded' });
      } else {
        endBattle(state);
      }
      break;
  }
  return { state, events };
}

// ----- Time ------------------------------------------------------------------

/** Advance the clock; handles rations and starvation for each day that passes. */
function advanceTime(state: GameState, halfDays: number, events: GameEvent[]): void {
  const before = Math.floor(state.time / 2);
  state.time += halfDays;
  const after = Math.floor(state.time / 2);
  for (let d = before + 1; d <= after; d++) {
    dailyUpkeep(state, d + 1, events);
    if (state.mode === 'lost') return;
  }
}

function dailyUpkeep(state: GameState, day: number, events: GameEvent[]): void {
  const party = state.party;
  const needed = party.members.length * BALANCE.rationsPerMousePerDay;
  const eaten = Math.min(party.rations, needed);
  party.rations -= eaten;
  events.push({ type: 'dayPassed', day, eaten });
  if (eaten < needed) {
    let dmg = 0;
    for (const m of party.members) {
      const hit = Math.ceil(m.maxHp * BALANCE.starveDamage);
      m.hp = Math.max(0, m.hp - hit);
      m.famished = true;
      dmg += hit;
    }
    events.push({ type: 'starving', damage: dmg });
    if (allDown(party)) {
      state.mode = 'lost';
      state.outcome = { result: 'lost', reason: 'starved', daysToSpare: 0 };
      events.push({ type: 'ended', outcome: state.outcome });
    }
  } else {
    for (const m of party.members) {
      m.famished = false;
      if (isDown(m)) m.hp = 1; // a fed mouse gets back on its feet
    }
  }
}

function checkWinter(state: GameState, events: GameEvent[]): void {
  if (state.mode === 'won' || state.mode === 'lost') return;
  if (Math.floor(state.time / 2) >= state.seasonDays) {
    state.mode = 'lost';
    state.outcome = { result: 'lost', reason: 'winter', daysToSpare: 0 };
    events.push({ type: 'ended', outcome: state.outcome });
  }
}

// ----- Overworld actions -----------------------------------------------------

function doMove(state: GameState, to: Axial, events: GameEvent[]): void {
  if (state.mode !== 'explore') return void events.push({ type: 'invalid', reason: 'Cannot move now' });
  if (!hexAdjacent(state.pos, to)) return void events.push({ type: 'invalid', reason: 'Not adjacent' });
  if (!isPassable(state.map, to)) return void events.push({ type: 'invalid', reason: 'Impassable' });

  const hex = hexAt(state.map, to)!;
  const cost = TERRAIN[hex.terrain].moveCost;
  advanceTime(state, cost, events);
  if (modeOf(state) === 'lost') return;
  state.pos = { q: to.q, r: to.r };
  events.push({ type: 'moved', to: state.pos, cost });

  const newly = revealFromPosition(state.map, state.pos);
  state.stats.hexesCharted += newly;
  if (newly > 0) events.push({ type: 'revealed', count: newly });

  let safe = false;
  if (hexEquals(to, state.map.hold)) {
    safe = true;
    arriveAtHold(state, events);
    if (modeOf(state) === 'won') return;
  } else if (hexEquals(to, state.map.door)) {
    safe = true;
    if (!state.doorFound) {
      state.doorFound = true;
      events.push({ type: 'doorFound' });
    }
  } else if (hex.landmark !== undefined) {
    const lm = state.map.landmarks[hex.landmark];
    safe = BALANCE.encounterGraceOnLandmark && !lm.visited;
    visitLandmark(state, hex.landmark, events);
  }

  if (!safe) rollEncounter(state, ENCOUNTERS[hex.terrain].chance, ENCOUNTERS[hex.terrain].entries, events);
  checkWinter(state, events);
}

function arriveAtHold(state: GameState, events: GameEvent[]): void {
  restoreParty(state.party);
  state.stats.sorties++;
  events.push({ type: 'hold', firstReturnWithDoor: state.doorFound });
  if (state.doorFound) {
    state.mode = 'won';
    state.outcome = { result: 'won', reason: 'returned', daysToSpare: daysRemaining(state) };
    events.push({ type: 'ended', outcome: state.outcome });
  }
}

function visitLandmark(state: GameState, index: number, events: GameEvent[]): void {
  const lm = state.map.landmarks[index];
  const def = LANDMARKS[lm.id];
  const first = !lm.visited;
  lm.visited = true;
  let gained: string | undefined;
  if (first || def.repeatable) {
    lm.uses++;
    const party = state.party;
    switch (def.effect.kind) {
      case 'heal':
        for (const m of party.members) {
          m.hp = m.maxHp;
          m.tp = m.maxTp;
        }
        gained = 'The patrol is fully rested.';
        break;
      case 'reveal': {
        const n = reveal(state.map, lm.at, def.effect.radius);
        state.stats.hexesCharted += n;
        gained = `${n} hexes charted.`;
        break;
      }
      case 'item': {
        party.items[def.effect.item] = (party.items[def.effect.item] ?? 0) + def.effect.count;
        gained = `Gained ${def.effect.count} ${def.effect.count === 1 ? ITEMS[def.effect.item].name : ITEMS[def.effect.item].plural}.`;
        break;
      }
      case 'rations': {
        const add = Math.min(party.maxRations - party.rations, def.effect.amount);
        party.rations += add;
        gained = `Gained ${add} rations.`;
        break;
      }
      case 'none':
        break;
    }
  }
  events.push({ type: 'landmark', landmark: lm.id, index, first, gained });
}

function rollEncounter(state: GameState, chance: number, table: EncounterEntry[], events: GameEvent[]): void {
  if (table.length === 0 || chance <= 0) return;
  const rng = new Rng(state.rng);
  if (rng.chance(chance)) {
    const entry = rng.weighted(table, (e) => e.weight);
    const count = rng.int(entry.count[0], entry.count[1]);
    const enemies: EnemyId[] = Array.from({ length: count }, () => entry.enemy);
    state.rng = rng.state;
    const hex = hexAt(state.map, state.pos)!;
    startBattle(state, enemies, hex.terrain);
    events.push({ type: 'encounter', enemies });
  } else {
    state.rng = rng.state;
  }
}

function doForage(state: GameState, events: GameEvent[]): void {
  if (!canForage(state)) return void events.push({ type: 'invalid', reason: 'Nothing to forage here' });
  const hex = hexAt(state.map, state.pos)!;
  const forage = TERRAIN[hex.terrain].forage!;
  advanceTime(state, BALANCE.forageCost, events);
  if (modeOf(state) === 'lost') return;
  const rng = new Rng(state.rng);
  const gained = Math.min(state.party.maxRations - state.party.rations, rng.int(forage.min, forage.max));
  state.rng = rng.state;
  state.party.rations += gained;
  state.stats.forages++;
  events.push({ type: 'foraged', gained, cost: BALANCE.forageCost });
  // Rummaging makes noise; half the usual chance of trouble.
  rollEncounter(state, ENCOUNTERS[hex.terrain].chance * 0.5, ENCOUNTERS[hex.terrain].entries, events);
  checkWinter(state, events);
}

function doCamp(state: GameState, events: GameEvent[]): void {
  if (state.mode !== 'explore') return void events.push({ type: 'invalid', reason: 'Cannot camp now' });
  advanceTime(state, BALANCE.campCost, events);
  if (modeOf(state) === 'lost') return;
  for (const m of state.party.members) {
    if (isDown(m)) continue;
    // Hungry mice do not mend; only rested ones recover.
    if (!m.famished) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * BALANCE.campHeal));
    m.tp = Math.min(m.maxTp, m.tp + Math.round(m.maxTp * BALANCE.campTp));
  }
  events.push({ type: 'camped', cost: BALANCE.campCost });
  if (!atHold(state)) rollEncounter(state, BALANCE.campEncounterChance, CAMP_ENCOUNTERS, events);
  checkWinter(state, events);
}

function doUseItem(state: GameState, item: keyof typeof ITEMS, target: number, events: GameEvent[]): void {
  const def = ITEMS[item];
  const party = state.party;
  if (state.mode !== 'explore' || !def.overworld) return void events.push({ type: 'invalid', reason: 'Cannot use that now' });
  if ((party.items[item] ?? 0) <= 0) return void events.push({ type: 'invalid', reason: 'None left' });
  const m = party.members[target];
  if (!m) return void events.push({ type: 'invalid', reason: 'No such mouse' });
  let amount = 0;
  if (def.effect === 'heal') {
    amount = Math.min(m.maxHp - m.hp, def.power);
    m.hp += amount;
  } else if (def.effect === 'tp') {
    amount = Math.min(m.maxTp - m.tp, def.power);
    m.tp += amount;
  }
  party.items[item]--;
  events.push({ type: 'itemUsed', item, target, amount });
}
