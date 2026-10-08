/**
 * Scripted players for balance testing. They see only what a player sees:
 * revealed hexes, the party sheet, and the elders' bearing to the door.
 *
 * `careful` forages ahead of need, camps when hurt, flees snakes and turns
 * for home while there is still time. `careless` marches straight out,
 * fights everything and only forages when the pouches are already empty.
 */
import { BALANCE } from '../content/balance';
import { ENEMIES } from '../content/enemies';
import { TERRAIN } from '../content/terrain';
import { bearing, canForage, daysRemaining, newGame, step } from './game';
import { axialToPixel, hexDistance, hexKey, hexNeighbors, type Axial } from './hex';
import { hexAt } from './mapgen';
import { isDown } from './party';
import type { Action, BattleCommand, GameState, Hex, Outcome } from './types';

export type BotKind = 'careful' | 'careless';

export interface BotResult {
  seed: string;
  outcome: Outcome | null;
  days: number;
  battles: number;
  fled: number;
  forages: number;
  doorFound: boolean;
  steps: number;
}

/** Dijkstra over what the patrol knows: unrevealed hexes are assumed walkable at an average cost. */
function knownPath(state: GameState, to: Axial): Axial[] | null {
  const map = state.map;
  const cost = (h: Hex) => (h.revealed ? (TERRAIN[h.terrain].passable ? TERRAIN[h.terrain].moveCost : Infinity) : 2);
  const dist = new Map<string, number>();
  const prev = new Map<string, Axial>();
  const open: { h: Axial; d: number }[] = [{ h: state.pos, d: 0 }];
  dist.set(hexKey(state.pos), 0);
  const target = hexKey(to);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
    const { h, d } = open.splice(bi, 1)[0];
    if (d > (dist.get(hexKey(h)) ?? Infinity)) continue;
    if (hexKey(h) === target) break;
    for (const n of hexNeighbors(h)) {
      const nh = hexAt(map, n);
      if (!nh) continue;
      const c = cost(nh);
      if (!isFinite(c)) continue;
      const nd = d + c;
      const nk = hexKey(n);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, h);
        open.push({ h: n, d: nd });
      }
    }
  }
  if (!dist.has(target)) return null;
  const path: Axial[] = [];
  let cur = to;
  while (hexKey(cur) !== hexKey(state.pos)) {
    path.push(cur);
    cur = prev.get(hexKey(cur))!;
  }
  return path.reverse();
}

function pathCost(state: GameState, path: Axial[]): number {
  return path.reduce((s, h) => {
    const hex = hexAt(state.map, h)!;
    return s + (hex.revealed ? TERRAIN[hex.terrain].moveCost : 2);
  }, 0);
}

/** Angle difference in radians between the bearing to `h` and the door's bearing. */
function sectorError(state: GameState, h: Axial): number {
  const a = axialToPixel(state.map.hold, 1);
  const b = axialToPixel(h, 1);
  const d = axialToPixel(state.map.door, 1);
  const ang = Math.atan2(-(b.y - a.y), b.x - a.x);
  const doorAng = Math.atan2(-(d.y - a.y), d.x - a.x);
  // Players only know the 8-point name, so snap the door angle to its sector centre.
  const snapped = Math.round(doorAng / (Math.PI / 4)) * (Math.PI / 4);
  let diff = Math.abs(ang - snapped);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

/** Per-run bot memory: targets that turned out to be unreachable through known ground. */
interface Memory {
  excluded: Set<string>;
  idle: number;
}

/** Where to walk next while searching for the door. */
function searchTarget(state: GameState, mem: Memory): Axial | null {
  const map = state.map;
  const doorHex = hexAt(map, map.door)!;
  if (doorHex.revealed) return map.door;
  // Nearest unrevealed hex in the distance band, sweeping the narrow wedge the
  // bearing implies before widening to the neighbouring sectors.
  for (const wedge of [Math.PI / 8 + 0.08, Math.PI / 4 + 0.05]) {
    let best: { h: Axial; score: number } | null = null;
    for (const h of map.hexes) {
      if (h.revealed || mem.excluded.has(hexKey(h))) continue;
      const d = hexDistance(h, map.hold);
      if (d < BALANCE.doorDistance.min || d > BALANCE.doorDistance.max) continue;
      const err = sectorError(state, h);
      if (err > wedge) continue;
      const walk = hexDistance(h, state.pos);
      // Prefer hills: they reveal more and can spot the ruins from afar.
      const hill = h.terrain === 'hills' ? -1.5 : 0;
      const score = walk + err * 2 + hill;
      if (!best || score < best.score) best = { h: { q: h.q, r: h.r }, score };
    }
    if (best) return best.h;
  }
  return null;
}

function nearestKnown(state: GameState, pred: (h: Hex) => boolean): Axial | null {
  let best: { h: Axial; d: number } | null = null;
  for (const h of state.map.hexes) {
    if (!h.revealed || !pred(h)) continue;
    const d = hexDistance(h, state.pos);
    if (d > 0 && (!best || d < best.d)) best = { h: { q: h.q, r: h.r }, d };
  }
  return best?.h ?? null;
}

function stepToward(state: GameState, target: Axial, mem: Memory): Action | null {
  const path = knownPath(state, target);
  if (!path || path.length === 0) {
    mem.excluded.add(hexKey(target));
    return null;
  }
  // The path may run through unrevealed hexes that turn out to be river; the
  // reducer rejects the move and we will re-plan next turn.
  return { type: 'move', to: path[0] };
}

function lowestHpEnemy(state: GameState): number {
  const b = state.battle!;
  let best = -1;
  b.enemies.forEach((e, i) => {
    if (e.hp > 0 && (best < 0 || e.hp < b.enemies[best].hp)) best = i;
  });
  return best;
}

function battleCommands(state: GameState, kind: BotKind): (BattleCommand | null)[] {
  const b = state.battle!;
  const party = state.party;
  const snake = b.enemies.some((e) => e.id === 'snake' && e.hp > 0);
  const threat = b.enemies.filter((e) => e.hp > 0).reduce((s, e) => s + ENEMIES[e.id].atk, 0);
  if (kind === 'careful' && snake) {
    if ((party.items.smokepod ?? 0) > 0) return party.members.map((m, i) => (i === 0 && !isDown(m) ? { kind: 'item', item: 'smokepod' } : null));
    return party.members.map((m) => (!isDown(m) ? { kind: 'flee' } : null));
  }
  // Careless also runs if a snake has them at a quarter health: even a fool wants to live.
  if (kind === 'careless' && snake && party.members.some((m) => !isDown(m) && m.hp < m.maxHp * 0.25)) {
    return party.members.map((m) => (!isDown(m) ? { kind: 'flee' } : null));
  }
  const target = lowestHpEnemy(state);
  return party.members.map((m): BattleCommand | null => {
    if (isDown(m)) return null;
    const hurt = party.members.filter((x) => !isDown(x) && x.hp < x.maxHp * 0.45);
    if (m.cls === 'healer' && kind === 'careful') {
      if (hurt.length >= 2 && m.techniques.includes('salve') && m.tp >= 6) return { kind: 'technique', technique: 'salve' };
      if (hurt.length >= 1 && m.tp >= 3) return { kind: 'technique', technique: 'mend', target: party.members.indexOf(hurt[0]) };
      if ((party.items.poultice ?? 0) > 0 && hurt.length >= 1) return { kind: 'item', item: 'poultice', target: party.members.indexOf(hurt[0]) };
      return { kind: 'attack', target };
    }
    if (m.cls === 'tinker') {
      const living = b.enemies.filter((e) => e.hp > 0).length;
      if (kind === 'careful' && living >= 2 && m.techniques.includes('arc') && m.tp >= 6) return { kind: 'technique', technique: 'arc' };
      if (m.tp >= 3 && (kind === 'careless' || threat >= 12)) return { kind: 'technique', technique: 'spark', target };
      return { kind: 'attack', target };
    }
    if (m.cls === 'pathfinder' && m.tp >= 3 && b.enemies[target].hp > 14) return { kind: 'technique', technique: 'lunge', target };
    return { kind: 'attack', target };
  });
}

function careful(state: GameState, mem: Memory): Action {
  const party = state.party;
  const here = hexAt(state.map, state.pos)!;
  const perDay = party.members.length * BALANCE.rationsPerMousePerDay;
  const homePath = knownPath(state, state.map.hold);
  const homeDays = homePath ? pathCost(state, homePath) / 2 : 99;
  const left = daysRemaining(state);
  const goingHome = state.doorFound || left <= homeDays + 2;

  // Heal up with items when badly hurt.
  const worst = party.members.filter((m) => !isDown(m)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (worst && worst.hp < worst.maxHp * 0.35 && (party.items.poultice ?? 0) > 0) {
    return { type: 'useItem', item: 'poultice', target: party.members.indexOf(worst) };
  }
  const avgHp = party.members.reduce((s, m) => s + m.hp / m.maxHp, 0) / party.members.length;
  const spare = left - homeDays;
  if (avgHp < 0.5 && party.rations >= perDay * 2 && spare > 2) return { type: 'camp' };

  // Keep a few days of food in hand; forage where it is worth the half day.
  const forage = TERRAIN[here.terrain].forage;
  const daysOfFood = party.rations / perDay;
  const want = goingHome ? Math.min(homeDays + 1, 4) : 4;
  const roomToCarry = party.rations < party.maxRations - 2;
  if (canForage(state) && forage && roomToCarry && daysOfFood < want && forage.max >= 4) {
    return { type: 'forage' };
  }
  // Hungry on poor ground: head for the nearest green hex we know of.
  if (daysOfFood < 1.5 && (!forage || forage.max < 4)) {
    const green = nearestKnown(state, (h) => (TERRAIN[h.terrain].forage?.max ?? 0) >= 4);
    if (green) {
      const a = stepToward(state, green, mem);
      if (a) return a;
    }
  }

  // Walk. If the planner cannot find a way, try the next target before resorting to a rest.
  for (let tries = 0; tries < 4; tries++) {
    const target = goingHome ? state.map.hold : searchTarget(state, mem);
    if (!target) break;
    const a = stepToward(state, target, mem);
    if (a) return a;
    if (goingHome) break;
  }
  return { type: 'camp' };
}

function careless(state: GameState, mem: Memory): Action {
  const party = state.party;
  const here = hexAt(state.map, state.pos)!;
  if (party.rations === 0 && canForage(state) && TERRAIN[here.terrain].forage) return { type: 'forage' };
  for (let tries = 0; tries < 4; tries++) {
    const target = state.doorFound ? state.map.hold : searchTarget(state, mem);
    if (!target) break;
    const a = stepToward(state, target, mem);
    if (a) return a;
    if (state.doorFound) break;
  }
  return { type: 'camp' };
}

export function runBot(seed: string, kind: BotKind, maxSteps = 600): BotResult {
  let state = newGame(seed);
  let steps = 0;
  let lastInvalid = 0;
  const mem: Memory = { excluded: new Set(), idle: 0 };
  while (state.mode !== 'won' && state.mode !== 'lost' && steps < maxSteps) {
    steps++;
    let action: Action;
    if (state.mode === 'battle') {
      action = state.battle!.phase === 'command' ? { type: 'battleRound', commands: battleCommands(state, kind) } : { type: 'endBattle' };
    } else {
      action = kind === 'careful' ? careful(state, mem) : careless(state, mem);
    }
    const res = step(state, action);
    const invalid = res.events.some((e) => e.type === 'invalid');
    if (invalid) {
      // A planned step into unseen river: reveal it in our planner by trying a neighbour instead.
      lastInvalid++;
      if (lastInvalid > 3) res.state = step(state, { type: 'camp' }).state;
    } else {
      lastInvalid = 0;
    }
    state = res.state;
  }
  return {
    seed,
    outcome: state.outcome,
    days: Math.floor(state.time / 2) + 1,
    battles: state.stats.battles,
    fled: state.stats.fled,
    forages: state.stats.forages,
    doorFound: state.doorFound,
    steps,
  };
}

export function bearingOf(state: GameState): string {
  return bearing(state.map.hold, state.map.door);
}
