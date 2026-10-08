import type { EnemyId, TerrainId } from '../sim/types';

export interface EncounterEntry {
  enemy: EnemyId;
  weight: number;
  /** Group size range, inclusive. */
  count: [number, number];
}

export interface EncounterTable {
  /** Chance of an encounter on entering a hex of this terrain. */
  chance: number;
  entries: EncounterEntry[];
}

export const ENCOUNTERS: Record<TerrainId, EncounterTable> = {
  meadow: {
    chance: 0.12,
    entries: [
      { enemy: 'beetle', weight: 5, count: [1, 2] },
      { enemy: 'wasp', weight: 3, count: [2, 3] },
      { enemy: 'shrew', weight: 2, count: [1, 1] },
    ],
  },
  woodland: {
    chance: 0.2,
    entries: [
      { enemy: 'beetle', weight: 4, count: [1, 2] },
      { enemy: 'wasp', weight: 3, count: [2, 3] },
      { enemy: 'shrew', weight: 4, count: [1, 2] },
      { enemy: 'centipede', weight: 2, count: [1, 1] },
    ],
  },
  bramble: {
    chance: 0.28,
    entries: [
      { enemy: 'centipede', weight: 5, count: [1, 2] },
      { enemy: 'wasp', weight: 4, count: [2, 4] },
      { enemy: 'shrew', weight: 3, count: [1, 2] },
      { enemy: 'snake', weight: 1, count: [1, 1] },
    ],
  },
  marsh: {
    chance: 0.25,
    entries: [
      { enemy: 'toad', weight: 6, count: [1, 2] },
      { enemy: 'wasp', weight: 2, count: [2, 3] },
      { enemy: 'centipede', weight: 2, count: [1, 1] },
      { enemy: 'snake', weight: 1, count: [1, 1] },
    ],
  },
  hills: {
    chance: 0.15,
    entries: [
      { enemy: 'beetle', weight: 5, count: [1, 3] },
      { enemy: 'shrew', weight: 3, count: [1, 2] },
      { enemy: 'snake', weight: 1, count: [1, 1] },
    ],
  },
  river: { chance: 0, entries: [] },
  ford: {
    chance: 0.15,
    entries: [
      { enemy: 'toad', weight: 5, count: [1, 1] },
      { enemy: 'shrew', weight: 3, count: [1, 2] },
    ],
  },
  ruin: {
    chance: 0.08,
    entries: [
      { enemy: 'beetle', weight: 4, count: [2, 3] },
      { enemy: 'centipede', weight: 3, count: [1, 2] },
    ],
  },
};

/** Who turns up when the patrol camps in the open. */
export const CAMP_ENCOUNTERS: EncounterEntry[] = [
  { enemy: 'beetle', weight: 4, count: [1, 2] },
  { enemy: 'shrew', weight: 4, count: [1, 2] },
  { enemy: 'centipede', weight: 2, count: [1, 1] },
];
