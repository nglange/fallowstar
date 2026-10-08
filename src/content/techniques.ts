import type { TechniqueId } from '../sim/types';

export type TechniqueTarget = 'enemy' | 'enemies' | 'ally' | 'party';

export interface TechniqueDef {
  id: TechniqueId;
  name: string;
  /** TP cost. */
  cost: number;
  target: TechniqueTarget;
  kind: 'damage' | 'heal' | 'ward';
  /** Damage/heal amount before variance; for 'damage' with ignoreDefense it is flat. */
  power: number;
  ignoreDefense?: boolean;
  description: string;
}

export const TECHNIQUES: Record<TechniqueId, TechniqueDef> = {
  lunge: {
    id: 'lunge',
    name: 'Lunge',
    cost: 3,
    target: 'enemy',
    kind: 'damage',
    power: 1.8,
    description: 'A committed thrust with the whole body behind it. Nearly double damage.',
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    cost: 3,
    target: 'ally',
    kind: 'heal',
    power: 14,
    description: 'Yarrow, thread and a steady paw. Heals one mouse.',
  },
  salve: {
    id: 'salve',
    name: 'Salve',
    cost: 6,
    target: 'party',
    kind: 'heal',
    power: 8,
    description: 'A shared tin of comfrey balm. Heals the whole patrol a little.',
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    cost: 3,
    target: 'enemy',
    kind: 'damage',
    power: 13,
    ignoreDefense: true,
    description: 'A salvaged cell discharges with a blue crack. Ignores armour.',
  },
  arc: {
    id: 'arc',
    name: 'Arc',
    cost: 6,
    target: 'enemies',
    kind: 'damage',
    power: 8,
    ignoreDefense: true,
    description: 'The cell is bridged across two wires. Everything in front of you smells of lightning.',
  },
  ward: {
    id: 'ward',
    name: 'Ward',
    cost: 4,
    target: 'party',
    kind: 'ward',
    power: 3,
    description: 'A humming old-builder trinket held aloft. The patrol takes less harm this battle.',
  },
};
