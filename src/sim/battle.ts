/**
 * Battle resolution, Phantasy Star style: the player enters one command per
 * standing mouse, then the whole round resolves in speed order. Pure; the only
 * randomness comes from the RNG state threaded through GameState.
 */
import { BALANCE } from '../content/balance';
import { ENEMIES } from '../content/enemies';
import { ITEMS } from '../content/items';
import { TECHNIQUES } from '../content/techniques';
import { allDown, grantXp, isDown } from './party';
import { Rng } from './rng';
import type {
  ActorRef,
  BattleCommand,
  BattleEvent,
  EnemyId,
  GameEvent,
  GameState,
  ItemId,
  TerrainId,
} from './types';

export function startBattle(state: GameState, enemies: EnemyId[], terrain: TerrainId): void {
  state.battle = {
    enemies: enemies.map((id) => ({ id, hp: ENEMIES[id].hp, maxHp: ENEMIES[id].hp })),
    round: 1,
    phase: 'command',
    ward: 0,
    terrain,
  };
  state.mode = 'battle';
  state.stats.battles++;
}

/** Chance that a flee attempt succeeds against the current enemies. */
export function fleeChance(state: GameState): number {
  const b = state.battle!;
  const living = b.enemies.filter((e) => e.hp > 0);
  if (living.length === 0) return 1;
  const bonus = living.reduce((s, e) => s + ENEMIES[e.id].fleeBonus, 0) / living.length;
  const enemySpd = living.reduce((s, e) => s + ENEMIES[e.id].spd, 0) / living.length;
  const standing = state.party.members.filter((m) => !isDown(m));
  const partySpd = standing.reduce((s, m) => s + m.spd, 0) / Math.max(1, standing.length);
  const p = BALANCE.baseFleeChance + bonus + 0.03 * (partySpd - enemySpd);
  return Math.min(0.95, Math.max(0.1, p));
}

function variance(rng: Rng, base: number): number {
  const v = BALANCE.damageVariance;
  return base * rng.range(1 - v, 1 + v);
}

function physicalDamage(rng: Rng, atk: number, def: number): number {
  return Math.max(1, Math.round(variance(rng, atk) - def));
}

export function resolveRound(state: GameState, commands: (BattleCommand | null)[]): GameEvent[] {
  const b = state.battle;
  const events: GameEvent[] = [];
  const push = (e: BattleEvent) => events.push({ type: 'battle', event: e });
  if (!b || b.phase !== 'command') {
    events.push({ type: 'invalid', reason: 'No battle in progress' });
    return events;
  }
  const rng = new Rng(state.rng);
  const party = state.party;
  push({ type: 'roundStart', round: b.round });

  // --- Flee is a party decision -------------------------------------------
  const wantsFlee = commands.some((c, i) => c?.kind === 'flee' && !isDown(party.members[i]));
  const smoke = commands.findIndex(
    (c, i) => c?.kind === 'item' && c.item === 'smokepod' && !isDown(party.members[i]),
  );
  if (smoke >= 0 && (party.items.smokepod ?? 0) > 0) {
    party.items.smokepod--;
    push({
      type: 'item',
      actor: { side: 'party', index: smoke },
      item: 'smokepod',
      target: { side: 'party', index: smoke },
      amount: 0,
    });
    push({ type: 'fled' });
    b.phase = 'fled';
    state.stats.fled++;
    state.rng = rng.state;
    return events;
  }
  if (wantsFlee) {
    if (rng.chance(fleeChance(state))) {
      push({ type: 'fled' });
      b.phase = 'fled';
      state.stats.fled++;
      state.rng = rng.state;
      return events;
    }
    push({ type: 'fleeFailed' });
    // The patrol loses its turn; enemies act freely.
    commands = commands.map(() => null);
  }

  // --- Build initiative order -------------------------------------------
  interface Actor {
    ref: ActorRef;
    spd: number;
    tie: number;
  }
  const actors: Actor[] = [];
  party.members.forEach((m, i) => {
    if (!isDown(m)) actors.push({ ref: { side: 'party', index: i }, spd: m.spd, tie: rng.float() });
  });
  b.enemies.forEach((e, i) => {
    if (e.hp > 0) actors.push({ ref: { side: 'enemy', index: i }, spd: ENEMIES[e.id].spd, tie: rng.float() });
  });
  actors.sort((x, y) => y.spd - x.spd || y.tie - x.tie);

  const defending = new Set<number>();
  const livingEnemies = () => b.enemies.map((_, i) => i).filter((i) => b.enemies[i].hp > 0);
  const livingParty = () => party.members.map((_, i) => i).filter((i) => !isDown(party.members[i]));

  const hurtEnemy = (index: number, amount: number) => {
    const e = b.enemies[index];
    e.hp = Math.max(0, e.hp - amount);
    return e.hp === 0;
  };
  const hurtMouse = (index: number, raw: number) => {
    const m = party.members[index];
    let dmg = Math.max(1, Math.round(raw - (m.def + b.ward)));
    if (defending.has(index)) dmg = Math.max(1, Math.round(dmg * BALANCE.defendMultiplier));
    m.hp = Math.max(0, m.hp - dmg);
    return { dmg, downed: m.hp === 0 };
  };

  for (const actor of actors) {
    if (b.phase !== 'command') break;
    if (actor.ref.side === 'party') {
      const i = actor.ref.index;
      const m = party.members[i];
      if (isDown(m)) continue;
      const cmd = commands[i];
      if (!cmd || cmd.kind === 'flee') continue;
      const atk = m.famished ? m.atk * BALANCE.famishedAttackMultiplier : m.atk;

      if (cmd.kind === 'defend') {
        defending.add(i);
        push({ type: 'defend', actor: actor.ref });
      } else if (cmd.kind === 'attack') {
        const alive = livingEnemies();
        if (alive.length === 0) continue;
        const t = alive.includes(cmd.target) ? cmd.target : alive[0];
        const dmg = physicalDamage(rng, atk, ENEMIES[b.enemies[t].id].def);
        const downed = hurtEnemy(t, dmg);
        push({ type: 'attack', actor: actor.ref, target: { side: 'enemy', index: t }, damage: dmg, downed });
      } else if (cmd.kind === 'technique') {
        const tech = TECHNIQUES[cmd.technique];
        if (!m.techniques.includes(tech.id) || m.tp < tech.cost) {
          push({ type: 'noTp', actor: actor.ref, technique: tech.id });
          continue;
        }
        m.tp -= tech.cost;
        const results: { target: ActorRef; amount: number; downed: boolean }[] = [];
        if (tech.kind === 'damage') {
          const alive = livingEnemies();
          if (alive.length === 0) continue;
          const targets =
            tech.target === 'enemies' ? alive : [alive.includes(cmd.target ?? -1) ? cmd.target! : alive[0]];
          for (const t of targets) {
            const def = ENEMIES[b.enemies[t].id].def;
            const raw = tech.ignoreDefense ? variance(rng, tech.power) : variance(rng, atk * tech.power) - def;
            const dmg = Math.max(1, Math.round(raw));
            results.push({ target: { side: 'enemy', index: t }, amount: dmg, downed: hurtEnemy(t, dmg) });
          }
        } else if (tech.kind === 'heal') {
          const targets =
            tech.target === 'party'
              ? livingParty()
              : [cmd.target !== undefined && !isDown(party.members[cmd.target]) ? cmd.target : i];
          for (const t of targets) {
            const tm = party.members[t];
            const amount = Math.min(tm.maxHp - tm.hp, Math.round(variance(rng, tech.power)));
            tm.hp += amount;
            results.push({ target: { side: 'party', index: t }, amount, downed: false });
          }
        } else if (tech.kind === 'ward') {
          b.ward = Math.max(b.ward, tech.power);
          for (const t of livingParty()) results.push({ target: { side: 'party', index: t }, amount: tech.power, downed: false });
        }
        push({ type: 'technique', actor: actor.ref, technique: tech.id, results });
      } else if (cmd.kind === 'item') {
        const item = ITEMS[cmd.item];
        if ((party.items[cmd.item] ?? 0) <= 0) continue;
        const t = cmd.target !== undefined && !isDown(party.members[cmd.target]) ? cmd.target : i;
        const tm = party.members[t];
        let amount = 0;
        if (item.effect === 'heal') {
          amount = Math.min(tm.maxHp - tm.hp, item.power);
          tm.hp += amount;
        } else if (item.effect === 'tp') {
          amount = Math.min(tm.maxTp - tm.tp, item.power);
          tm.tp += amount;
        } else {
          continue; // smokepod handled above
        }
        party.items[cmd.item]--;
        push({ type: 'item', actor: actor.ref, item: cmd.item as ItemId, target: { side: 'party', index: t }, amount });
      }

      if (livingEnemies().length === 0) {
        finishVictory(state, rng, events);
        break;
      }
    } else {
      const e = b.enemies[actor.ref.index];
      if (e.hp <= 0) continue;
      const targets = livingParty();
      if (targets.length === 0) break;
      const t = rng.pick(targets);
      const { dmg, downed } = hurtMouse(t, variance(rng, ENEMIES[e.id].atk));
      push({ type: 'attack', actor: actor.ref, target: { side: 'party', index: t }, damage: dmg, downed });
      if (allDown(party)) {
        push({ type: 'defeat' });
        b.phase = 'defeat';
        state.mode = 'lost';
        state.outcome = { result: 'lost', reason: 'fallen', daysToSpare: 0 };
        events.push({ type: 'ended', outcome: state.outcome });
        break;
      }
    }
  }

  if (b.phase === 'command') b.round++;
  state.rng = rng.state;
  return events;
}

function finishVictory(state: GameState, rng: Rng, events: GameEvent[]): void {
  const b = state.battle!;
  let xp = 0;
  let rations = 0;
  const items: Partial<Record<ItemId, number>> = {};
  for (const e of b.enemies) {
    const def = ENEMIES[e.id];
    xp += def.xp;
    rations += rng.int(def.loot.rations[0], def.loot.rations[1]);
    if (def.loot.items) {
      for (const [item, n] of Object.entries(def.loot.items) as [ItemId, number][]) {
        if (rng.chance(0.5)) items[item] = (items[item] ?? 0) + n;
      }
    }
  }
  const party = state.party;
  party.rations = Math.min(party.maxRations, party.rations + rations);
  for (const [item, n] of Object.entries(items) as [ItemId, number][]) {
    party.items[item] = (party.items[item] ?? 0) + n;
  }
  events.push({ type: 'battle', event: { type: 'victory', xp, rations, items } });
  party.members.forEach((m, i) => {
    if (!isDown(m)) grantXp(party, i, xp, events);
  });
  b.phase = 'victory';
}

/** Called when the player leaves the battle screen after it has concluded. */
export function endBattle(state: GameState): void {
  if (!state.battle) return;
  // Downed mice pick themselves up afterwards; a wipe is already a loss.
  if (state.battle.phase !== 'defeat') {
    for (const m of state.party.members) if (m.hp <= 0) m.hp = 1;
  }
  state.battle = null;
  if (state.mode === 'battle') state.mode = 'explore';
}
