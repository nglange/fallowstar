import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../content/enemies';
import { fleeChance, resolveRound, startBattle } from './battle';
import { newGame, step } from './game';
import type { BattleCommand, EnemyId, GameState } from './types';

function inBattle(seed: string, enemies: EnemyId[]): GameState {
  const s = newGame(seed);
  startBattle(s, enemies, 'meadow');
  return s;
}

const allAttack = (): BattleCommand[] => [
  { kind: 'attack', target: 0 },
  { kind: 'attack', target: 0 },
  { kind: 'attack', target: 0 },
];

describe('battle', () => {
  it('starts with full-health enemies and switches mode', () => {
    const s = inBattle('b1', ['beetle', 'wasp']);
    expect(s.mode).toBe('battle');
    expect(s.battle!.enemies.map((e) => e.hp)).toEqual([ENEMIES.beetle.hp, ENEMIES.wasp.hp]);
  });

  it('a round is deterministic for a given state', () => {
    const s = inBattle('b2', ['shrew']);
    const a = step(s, { type: 'battleRound', commands: allAttack() });
    const b = step(s, { type: 'battleRound', commands: allAttack() });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('attacks always do at least 1 damage and respect defence', () => {
    const s = inBattle('b3', ['beetle']);
    s.party.members.forEach((m) => (m.atk = 1));
    const r = step(s, { type: 'battleRound', commands: allAttack() });
    for (const e of r.events) {
      if (e.type === 'battle' && e.event.type === 'attack' && e.event.actor.side === 'party') {
        expect(e.event.damage).toBe(1);
      }
    }
  });

  it('killing every enemy yields victory, xp and loot', () => {
    let s = inBattle('b4', ['wasp']);
    s.party.members.forEach((m) => (m.atk = 50));
    const r = step(s, { type: 'battleRound', commands: allAttack() });
    const victory = r.events.find((e) => e.type === 'battle' && e.event.type === 'victory');
    expect(victory).toBeDefined();
    expect(r.state.battle!.phase).toBe('victory');
    expect(r.state.party.members[0].xp).toBe(ENEMIES.wasp.xp);
    s = step(r.state, { type: 'endBattle' }).state;
    expect(s.mode).toBe('explore');
    expect(s.battle).toBeNull();
  });

  it('enough xp levels a mouse up and teaches techniques', () => {
    let s = inBattle('b5', ['snake']);
    s.party.members.forEach((m) => (m.atk = 500));
    s.party.members[1].xp = 20;
    const r = step(s, { type: 'battleRound', commands: allAttack() });
    const lvl = r.events.filter((e) => e.type === 'levelUp');
    expect(lvl.length).toBeGreaterThan(0);
    const healer = r.state.party.members[1];
    expect(healer.level).toBeGreaterThanOrEqual(2);
    expect(healer.techniques).toContain('salve');
  });

  it('techniques cost TP, heal and damage as defined', () => {
    const s = inBattle('b6', ['beetle']);
    s.party.members[0].hp = 10;
    const tpBefore = s.party.members[1].tp;
    const r = step(s, {
      type: 'battleRound',
      commands: [
        { kind: 'defend' },
        { kind: 'technique', technique: 'mend', target: 0 },
        { kind: 'technique', technique: 'spark', target: 0 },
      ],
    });
    expect(r.state.party.members[1].tp).toBe(tpBefore - 3);
    expect(r.state.party.members[0].hp).toBeGreaterThan(10);
    expect(r.state.battle!.enemies[0].hp).toBeLessThan(ENEMIES.beetle.hp);
    const spark = r.events.find(
      (e) => e.type === 'battle' && e.event.type === 'technique' && e.event.technique === 'spark',
    );
    expect(spark).toBeDefined();
  });

  it('refuses a technique without enough TP', () => {
    const s = inBattle('b7', ['beetle']);
    s.party.members[2].tp = 0;
    const r = step(s, {
      type: 'battleRound',
      commands: [{ kind: 'defend' }, { kind: 'defend' }, { kind: 'technique', technique: 'spark', target: 0 }],
    });
    expect(r.events.some((e) => e.type === 'battle' && e.event.type === 'noTp')).toBe(true);
    expect(r.state.party.members[2].tp).toBe(0);
  });

  it('a smoke pod always escapes', () => {
    const s = inBattle('b8', ['snake']);
    const r = step(s, {
      type: 'battleRound',
      commands: [{ kind: 'item', item: 'smokepod' }, null, null],
    });
    expect(r.state.battle!.phase).toBe('fled');
    expect(r.state.party.items.smokepod).toBe(s.party.items.smokepod - 1);
  });

  it('fleeing a snake is the sensible option', () => {
    const s = inBattle('b9', ['snake']);
    expect(fleeChance(s)).toBeGreaterThan(0.75);
    const w = inBattle('b9', ['wasp', 'wasp', 'wasp']);
    expect(fleeChance(w)).toBeLessThan(fleeChance(s));
  });

  it('flee resolves to fled or fleeFailed, and failure gives enemies a free round', () => {
    let fled = 0;
    let failed = 0;
    for (let i = 0; i < 40; i++) {
      const s = inBattle(`flee-${i}`, ['wasp', 'wasp']);
      const r = step(s, { type: 'battleRound', commands: [{ kind: 'flee' }, null, null] });
      if (r.state.battle!.phase === 'fled') fled++;
      else {
        failed++;
        expect(r.events.some((e) => e.type === 'battle' && e.event.type === 'fleeFailed')).toBe(true);
        const partyActs = r.events.filter(
          (e) => e.type === 'battle' && e.event.type === 'attack' && e.event.actor.side === 'party',
        );
        expect(partyActs).toHaveLength(0);
      }
    }
    expect(fled).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  });

  it('the whole party falling is a loss', () => {
    const s = inBattle('b10', ['snake', 'snake', 'snake']);
    s.party.members.forEach((m) => (m.hp = 1));
    const r = step(s, { type: 'battleRound', commands: [{ kind: 'defend' }, { kind: 'defend' }, { kind: 'defend' }] });
    expect(r.state.mode).toBe('lost');
    expect(r.state.outcome).toMatchObject({ result: 'lost', reason: 'fallen' });
  });

  it('downed mice get up with 1 hp after a won battle', () => {
    const s = inBattle('b11', ['wasp']);
    s.party.members[1].hp = 0;
    s.party.members.forEach((m) => (m.atk = 99));
    const r = step(s, { type: 'battleRound', commands: [{ kind: 'attack', target: 0 }, null, { kind: 'attack', target: 0 }] });
    const after = step(r.state, { type: 'endBattle' }).state;
    expect(after.party.members[1].hp).toBe(1);
  });

  it('resolveRound reports invalid when not in battle', () => {
    const s = newGame('b12');
    expect(resolveRound(s, allAttack())[0]).toMatchObject({ type: 'invalid' });
  });
});
