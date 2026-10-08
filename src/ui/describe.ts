/** Turns simulation events into sentences for the player. */
import { ENEMIES } from '../content/enemies';
import { ITEMS } from '../content/items';
import { PARTY_CLASSES } from '../content/party';
import { TECHNIQUES } from '../content/techniques';
import type { ActorRef, BattleEvent, GameEvent, GameState, ItemId } from '../sim/types';

export function enemyLabel(state: GameState, index: number): string {
  const b = state.battle;
  if (!b) return '';
  const e = b.enemies[index];
  const def = ENEMIES[e.id];
  const sameKind = b.enemies.filter((x) => x.id === e.id);
  if (sameKind.length <= 1) return def.name;
  const letter = String.fromCharCode(65 + b.enemies.filter((x, i) => x.id === e.id && i < index).length);
  return `${def.name} ${letter}`;
}

export function actorName(state: GameState, ref: ActorRef): string {
  return ref.side === 'party' ? state.party.members[ref.index].name : enemyLabel(state, ref.index);
}

export function describeBattle(state: GameState, ev: BattleEvent): string {
  switch (ev.type) {
    case 'roundStart':
      return `Round ${ev.round}.`;
    case 'fled':
      return 'The patrol runs for it, and gets clear.';
    case 'fleeFailed':
      return 'The patrol tries to run, but is cut off!';
    case 'defend':
      return `${actorName(state, ev.actor)} braces.`;
    case 'attack': {
      const a = actorName(state, ev.actor);
      const t = actorName(state, ev.target);
      if (ev.actor.side === 'party') {
        const verb = state.party.members[ev.actor.index].cls === 'pathfinder' ? 'spears' : 'strikes';
        return `${a} ${verb} the ${t} for ${ev.damage}.${ev.downed ? ` The ${t} is slain.` : ''}`;
      }
      return `The ${a} attacks ${t} for ${ev.damage}.${ev.downed ? ` ${t} falls!` : ''}`;
    }
    case 'technique': {
      const a = actorName(state, ev.actor);
      const tech = TECHNIQUES[ev.technique];
      if (tech.kind === 'damage') {
        const parts = ev.results.map(
          (r) => `the ${actorName(state, r.target)} for ${r.amount}${r.downed ? ' (slain)' : ''}`,
        );
        return `${a}’s ${tech.name} hits ${parts.join(', ')}.`;
      }
      if (tech.kind === 'heal') {
        const parts = ev.results.map((r) => `${actorName(state, r.target)} ${r.amount}`);
        return `${a} uses ${tech.name}: heals ${parts.join(', ')}.`;
      }
      return `${a} raises the Ward. The patrol is harder to hurt.`;
    }
    case 'item': {
      const item = ITEMS[ev.item];
      if (item.effect === 'flee') return `${actorName(state, ev.actor)} bursts a smoke pod!`;
      const t = actorName(state, ev.target);
      return `${actorName(state, ev.actor)} uses a ${item.name} on ${t} (+${ev.amount}).`;
    }
    case 'noTp':
      return `${actorName(state, ev.actor)} has no strength left for ${TECHNIQUES[ev.technique].name}.`;
    case 'victory': {
      const loot: string[] = [];
      if (ev.rations > 0) loot.push(`${ev.rations} rations`);
      for (const [item, n] of Object.entries(ev.items) as [ItemId, number][]) {
        loot.push(n === 1 ? `a ${ITEMS[item].name}` : `${n} ${ITEMS[item].plural}`);
      }
      return `Victory! Each mouse gains ${ev.xp} experience.${loot.length ? ` Found ${loot.join(' and ')}.` : ''}`;
    }
    case 'defeat':
      return 'The patrol has fallen.';
  }
}

export function describeLevelUp(state: GameState, member: number, level: number): string {
  const m = state.party.members[member];
  const learned = PARTY_CLASSES[m.cls].learn[level];
  return `${m.name} reaches level ${level}!${learned ? ` Learned ${TECHNIQUES[learned].name}.` : ''}`;
}

/** Short toast text for overworld events; null for ones that get their own dialog or are silent. */
export function toastFor(state: GameState, ev: GameEvent): string | null {
  switch (ev.type) {
    case 'foraged':
      return ev.gained > 0 ? `Foraged ${ev.gained} rations. Half a day gone.` : 'Nothing worth carrying. Half a day gone.';
    case 'camped':
      return 'The patrol camps for the day and mends a little.';
    case 'starving':
      return 'The pouches are empty. The patrol goes hungry and weakens.';
    case 'itemUsed': {
      const item = ITEMS[ev.item];
      return `${state.party.members[ev.target].name} uses a ${item.name} (+${ev.amount}).`;
    }
    case 'invalid':
      return ev.reason;
    case 'levelUp':
      return describeLevelUp(state, ev.member, ev.level);
    default:
      return null;
  }
}
