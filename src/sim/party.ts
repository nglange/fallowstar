/** Party creation, levelling and shared helpers. Pure. */
import { BALANCE } from '../content/balance';
import { PARTY_CLASSES, PARTY_ORDER } from '../content/party';
import type { GameEvent, ItemId, Mouse, Party } from './types';

export function createParty(): Party {
  const members: Mouse[] = PARTY_ORDER.map((cls) => {
    const def = PARTY_CLASSES[cls];
    return {
      cls,
      name: def.name,
      level: 1,
      xp: 0,
      hp: def.hp,
      maxHp: def.hp,
      tp: def.tp,
      maxTp: def.tp,
      atk: def.atk,
      def: def.def,
      spd: def.spd,
      techniques: [...def.techniques],
      famished: false,
    };
  });
  return {
    members,
    rations: BALANCE.startRations,
    maxRations: BALANCE.maxRations,
    items: { ...BALANCE.holdItems },
  };
}

export function isDown(m: Mouse): boolean {
  return m.hp <= 0;
}

export function livingMembers(party: Party): number[] {
  return party.members.map((_, i) => i).filter((i) => !isDown(party.members[i]));
}

export function allDown(party: Party): boolean {
  return party.members.every(isDown);
}

/** Full restoration at the hold. */
export function restoreParty(party: Party): void {
  for (const m of party.members) {
    m.hp = m.maxHp;
    m.tp = m.maxTp;
    m.famished = false;
  }
  party.rations = party.maxRations;
  for (const [item, count] of Object.entries(BALANCE.holdItems) as [ItemId, number][]) {
    party.items[item] = Math.max(party.items[item] ?? 0, count);
  }
}

export function grantXp(party: Party, memberIndex: number, xp: number, events: GameEvent[]): void {
  const m = party.members[memberIndex];
  m.xp += xp;
  const table = BALANCE.xpTable;
  while (m.level < table.length && m.xp >= table[m.level]) {
    m.level++;
    const def = PARTY_CLASSES[m.cls];
    m.maxHp += def.growth.hp;
    m.hp = Math.min(m.maxHp, m.hp + def.growth.hp);
    m.maxTp += def.growth.tp;
    m.tp = Math.min(m.maxTp, m.tp + def.growth.tp);
    m.atk += def.growth.atk;
    m.def += def.growth.def;
    const learned = def.learn[m.level];
    if (learned && !m.techniques.includes(learned)) m.techniques.push(learned);
    events.push({ type: 'levelUp', member: memberIndex, level: m.level });
  }
}

export function xpToNext(m: Mouse): number | null {
  const table = BALANCE.xpTable;
  return m.level < table.length ? table[m.level] - m.xp : null;
}
