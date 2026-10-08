import type { MouseClassId, TechniqueId } from '../sim/types';

export interface MouseClassDef {
  id: MouseClassId;
  name: string;
  trade: string;
  hp: number;
  tp: number;
  atk: number;
  def: number;
  spd: number;
  techniques: TechniqueId[];
  /** Gained on each level. */
  growth: { hp: number; tp: number; atk: number; def: number };
  /** Techniques learned at level (index = level). */
  learn: Partial<Record<number, TechniqueId>>;
  description: string;
}

export const PARTY_CLASSES: Record<MouseClassId, MouseClassDef> = {
  pathfinder: {
    id: 'pathfinder',
    name: 'Tansy',
    trade: 'Pathfinder',
    hp: 34,
    tp: 6,
    atk: 9,
    def: 3,
    spd: 6,
    techniques: ['lunge'],
    growth: { hp: 6, tp: 2, atk: 2, def: 1 },
    learn: {},
    description: 'Leads from the front with a hazel spear. Knows the ways, and the weather.',
  },
  healer: {
    id: 'healer',
    name: 'Rowan',
    trade: 'Healer',
    hp: 28,
    tp: 14,
    atk: 5,
    def: 2,
    spd: 5,
    techniques: ['mend'],
    growth: { hp: 4, tp: 4, atk: 1, def: 1 },
    learn: { 2: 'salve' },
    description: 'Carries the satchel. Sings under her breath while she stitches.',
  },
  tinker: {
    id: 'tinker',
    name: 'Peck',
    trade: 'Tinker',
    hp: 26,
    tp: 12,
    atk: 5,
    def: 2,
    spd: 4,
    techniques: ['spark', 'ward'],
    growth: { hp: 4, tp: 4, atk: 1, def: 1 },
    learn: { 2: 'arc' },
    description: 'Collects old-builder scraps nobody else will touch, and has made them bite.',
  },
};

/** Marching order. Also the order commands are entered in battle. */
export const PARTY_ORDER: MouseClassId[] = ['pathfinder', 'healer', 'tinker'];
