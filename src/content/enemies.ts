import type { EnemyId, ItemId } from '../sim/types';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  plural: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  xp: number;
  /** Added to the party's flee chance. Positive means easier to escape. */
  fleeBonus: number;
  loot: { rations: [number, number]; items?: Partial<Record<ItemId, number>> };
  description: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  beetle: {
    id: 'beetle',
    name: 'Ground Beetle',
    plural: 'Ground Beetles',
    hp: 16,
    atk: 6,
    def: 4,
    spd: 2,
    xp: 7,
    fleeBonus: 0.3,
    loot: { rations: [0, 1] },
    description: 'Armoured and slow. Hit it where the plates meet.',
  },
  wasp: {
    id: 'wasp',
    name: 'Wasp',
    plural: 'Wasps',
    hp: 9,
    atk: 7,
    def: 1,
    spd: 9,
    xp: 6,
    fleeBonus: -0.2,
    loot: { rations: [0, 0] },
    description: 'Late-season and angry. Fast, fragile, and never alone.',
  },
  shrew: {
    id: 'shrew',
    name: 'Shrew Bandit',
    plural: 'Shrew Bandits',
    hp: 22,
    atk: 8,
    def: 2,
    spd: 6,
    xp: 12,
    fleeBonus: 0,
    loot: { rations: [2, 5], items: { poultice: 1 } },
    description: 'Hungry, quick and mean. Carries what it has stolen.',
  },
  toad: {
    id: 'toad',
    name: 'Marsh Toad',
    plural: 'Marsh Toads',
    hp: 26,
    atk: 7,
    def: 3,
    spd: 3,
    xp: 11,
    fleeBonus: 0.2,
    loot: { rations: [0, 1] },
    description: 'Sits like a stone until the tongue comes out.',
  },
  centipede: {
    id: 'centipede',
    name: 'Centipede',
    plural: 'Centipedes',
    hp: 18,
    atk: 9,
    def: 2,
    spd: 7,
    xp: 10,
    fleeBonus: -0.1,
    loot: { rations: [0, 0] },
    description: 'Too many legs and a venomous bite. Lives under the thorns.',
  },
  snake: {
    id: 'snake',
    name: 'Grass Snake',
    plural: 'Grass Snakes',
    hp: 70,
    atk: 17,
    def: 5,
    spd: 5,
    xp: 45,
    fleeBonus: 0.35,
    loot: { rations: [3, 6], items: { honeycomb: 1 } },
    description: 'A river of muscle. The old guards say: do not fight it, and live.',
  },
};
