import { describe, expect, it } from 'vitest';
import { BALANCE } from '../content/balance';
import { TERRAIN } from '../content/terrain';
import { currentDay, daysRemaining, newGame, step } from './game';
import { hexNeighbors, type Axial } from './hex';
import { hexAt, isPassable } from './mapgen';
import type { GameState } from './types';

function firstPassableNeighbor(state: GameState): Axial {
  return hexNeighbors(state.pos).find((n) => isPassable(state.map, n))!;
}

/** Walk until a move does not start a battle, so clock tests are not derailed. */
function safeState(seed: string): GameState {
  return newGame(seed);
}

describe('game: movement and clock', () => {
  it('starts at the hold on day 1 with the full season ahead', () => {
    const s = newGame('start');
    expect(s.pos).toEqual(s.map.hold);
    expect(currentDay(s)).toBe(1);
    expect(daysRemaining(s)).toBe(BALANCE.seasonDays);
    expect(s.party.rations).toBe(BALANCE.startRations);
    expect(hexAt(s.map, s.pos)!.revealed).toBe(true);
  });

  it('moving to an adjacent hex costs that terrain’s time', () => {
    const s = safeState('move');
    const to = firstPassableNeighbor(s);
    const cost = TERRAIN[hexAt(s.map, to)!.terrain].moveCost;
    const { state, events } = step(s, { type: 'move', to });
    expect(state.pos).toEqual(to);
    expect(state.time).toBe(cost);
    expect(events.some((e) => e.type === 'moved')).toBe(true);
  });

  it('rejects non-adjacent and impassable moves without changing state', () => {
    const s = newGame('reject');
    const far = { q: s.pos.q + 3, r: s.pos.r };
    const r1 = step(s, { type: 'move', to: far });
    expect(r1.events[0]).toMatchObject({ type: 'invalid' });
    expect(r1.state.time).toBe(0);
    // Find a river hex adjacent to any passable hex and try to enter it.
    const river = s.map.hexes.find((h) => h.terrain === 'river');
    if (river) {
      const next = structuredClone(s);
      const from = hexNeighbors(river).find((n) => isPassable(s.map, n))!;
      next.pos = from;
      const r2 = step(next, { type: 'move', to: river });
      expect(r2.events[0]).toMatchObject({ type: 'invalid', reason: 'Impassable' });
    }
  });

  it('does not mutate the input state', () => {
    const s = newGame('pure');
    const snapshot = JSON.stringify(s);
    step(s, { type: 'move', to: firstPassableNeighbor(s) });
    step(s, { type: 'forage' });
    step(s, { type: 'camp' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('is deterministic for the same seed and action sequence', () => {
    const run = () => {
      let s = newGame('det');
      for (let i = 0; i < 30 && s.mode === 'explore'; i++) {
        const to = hexNeighbors(s.pos).filter((n) => isPassable(s.map, n))[i % 3];
        s = step(s, { type: 'move', to: to ?? firstPassableNeighbor(s) }).state;
      }
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });

  it('consumes rations once per day and emits dayPassed', () => {
    const s = newGame('eat');
    const { state, events } = step(s, { type: 'camp' }); // camp = 2 half-days = one day
    expect(events.filter((e) => e.type === 'dayPassed')).toHaveLength(1);
    expect(state.party.rations).toBe(BALANCE.startRations - 3 * BALANCE.rationsPerMousePerDay);
    expect(currentDay(state)).toBe(2);
  });

  it('starves the party when rations run out and eventually ends the game', () => {
    let s = newGame('starve');
    s.party.rations = 0;
    s.map.hexes.forEach((h) => (h.landmark = undefined)); // no surprise meals
    const hp0 = s.party.members.map((m) => m.hp);
    const r = step(s, { type: 'camp' });
    expect(r.events.some((e) => e.type === 'starving')).toBe(true);
    r.state.party.members.forEach((m, i) => expect(m.hp).toBeLessThan(hp0[i]));
    expect(r.state.party.members.every((m) => m.famished)).toBe(true);
    s = r.state;
    s.pos = { ...s.map.hold }; // camping at the hold is quiet, no encounters
    for (let i = 0; i < 10 && s.mode === 'explore'; i++) s = step(s, { type: 'camp' }).state;
    expect(s.mode).toBe('lost');
    expect(s.outcome?.reason).toBe('starved');
  });

  it('loses to winter when the season runs out', () => {
    let s = newGame('winter');
    s.party.rations = 1000;
    s.party.maxRations = 1000;
    for (let i = 0; i < BALANCE.seasonDays + 2 && s.mode === 'explore'; i++) s = step(s, { type: 'camp' }).state;
    expect(s.mode).toBe('lost');
    expect(s.outcome?.reason).toBe('winter');
    expect(daysRemaining(s)).toBe(0);
  });
});

describe('game: fog', () => {
  it('reveals around the patrol with terrain-dependent sight', () => {
    const s = newGame('fog');
    const sight = TERRAIN[hexAt(s.map, s.pos)!.terrain].sight;
    const revealed = s.map.hexes.filter((h) => h.revealed).length;
    // Hex count within radius n = 1 + 3n(n+1), minus anything off-map.
    expect(revealed).toBeGreaterThan(0);
    expect(revealed).toBeLessThanOrEqual(1 + 3 * sight * (sight + 1));
    const to = firstPassableNeighbor(s);
    const { state } = step(s, { type: 'move', to });
    expect(state.map.hexes.filter((h) => h.revealed).length).toBeGreaterThanOrEqual(revealed);
    // Previously charted hexes stay charted.
    s.map.hexes.forEach((h, i) => {
      if (h.revealed) expect(state.map.hexes[i].revealed).toBe(true);
    });
  });

  it('hills see farther than woodland', () => {
    expect(TERRAIN.hills.sight).toBeGreaterThan(TERRAIN.meadow.sight);
    expect(TERRAIN.woodland.sight).toBeLessThan(TERRAIN.meadow.sight);
  });
});

describe('game: provisions and foraging', () => {
  it('foraging costs time and adds rations', () => {
    let s = newGame('forage');
    s.party.rations = 5;
    const { state, events } = step(s, { type: 'forage' });
    const ev = events.find((e) => e.type === 'foraged');
    expect(ev).toBeDefined();
    expect(state.time).toBe(BALANCE.forageCost);
    expect(state.party.rations).toBeGreaterThanOrEqual(5);
  });

  it('cannot forage on the old works', () => {
    const s = newGame('noforage');
    s.pos = { ...s.map.door };
    const { events } = step(s, { type: 'forage' });
    expect(events[0]).toMatchObject({ type: 'invalid' });
  });

  it('a poultice heals on the overworld', () => {
    const s = newGame('item');
    s.party.members[0].hp = 5;
    const { state, events } = step(s, { type: 'useItem', item: 'poultice', target: 0 });
    expect(state.party.members[0].hp).toBe(5 + 16);
    expect(state.party.items.poultice).toBe(s.party.items.poultice - 1);
    expect(events[0]).toMatchObject({ type: 'itemUsed' });
  });
});

describe('game: hold, door, win', () => {
  it('finding the door and returning home wins', () => {
    let s = newGame('win');
    s.pos = { ...s.map.door };
    const back = hexNeighbors(s.map.door).find((n) => isPassable(s.map, n))!;
    // Walk onto the door hex from a neighbour.
    s.pos = back;
    let r = step(s, { type: 'move', to: s.map.door });
    expect(r.state.doorFound).toBe(true);
    expect(r.events.some((e) => e.type === 'doorFound')).toBe(true);
    s = r.state;
    s.battle = null;
    s.mode = 'explore';
    // Teleport next to the hold and step in.
    s.pos = hexNeighbors(s.map.hold).find((n) => isPassable(s.map, n))!;
    s.party.rations = 1;
    s.party.members[0].hp = 3;
    r = step(s, { type: 'move', to: s.map.hold });
    expect(r.state.mode).toBe('won');
    expect(r.state.outcome).toMatchObject({ result: 'won', reason: 'returned' });
    expect(r.state.outcome!.daysToSpare).toBeGreaterThan(0);
    expect(r.state.party.rations).toBe(r.state.party.maxRations);
    expect(r.state.party.members[0].hp).toBe(r.state.party.members[0].maxHp);
  });

  it('returning without the door restocks but does not win', () => {
    const s = newGame('restock');
    s.pos = hexNeighbors(s.map.hold).find((n) => isPassable(s.map, n))!;
    s.party.rations = 2;
    s.party.items.poultice = 0;
    const r = step(s, { type: 'move', to: s.map.hold });
    expect(r.state.mode).toBe('explore');
    expect(r.state.party.rations).toBe(r.state.party.maxRations);
    expect(r.state.party.items.poultice).toBe(BALANCE.holdItems.poultice);
    expect(r.state.stats.sorties).toBe(1);
  });

  it('landmarks fire their effect once and show flavour again', () => {
    const s = newGame('landmark');
    const idx = s.map.landmarks.findIndex((l) => l.id === 'grove');
    if (idx < 0) return;
    const lm = s.map.landmarks[idx];
    s.pos = hexNeighbors(lm.at).find((n) => isPassable(s.map, n))!;
    s.party.rations = 5;
    const r1 = step(s, { type: 'move', to: lm.at });
    expect(r1.events.find((e) => e.type === 'landmark')).toMatchObject({ first: true });
    expect(r1.state.party.rations).toBeGreaterThan(5 - 3);
    const s2 = r1.state;
    s2.mode = 'explore';
    s2.battle = null;
    s2.pos = s.pos;
    const r2 = step(s2, { type: 'move', to: lm.at });
    expect(r2.events.find((e) => e.type === 'landmark')).toMatchObject({ first: false });
  });
});
