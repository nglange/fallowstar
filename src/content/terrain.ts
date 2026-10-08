import type { TerrainId } from '../sim/types';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  /** Half-days to enter this hex. */
  moveCost: number;
  passable: boolean;
  /** Reveal radius when standing on this hex. */
  sight: number;
  /** Rations gained from a forage here; null means nothing grows. */
  forage: { min: number; max: number } | null;
  description: string;
}

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  meadow: {
    id: 'meadow',
    name: 'Meadow',
    moveCost: 1,
    passable: true,
    sight: 2,
    forage: { min: 2, max: 4 },
    description: 'Open grass gone to seed. Easy going, and the hawks know it.',
  },
  woodland: {
    id: 'woodland',
    name: 'Woodland',
    moveCost: 2,
    passable: true,
    sight: 1,
    forage: { min: 3, max: 6 },
    description: 'Beech and hazel, the leaves turning. Nuts underfoot, teeth in the shadows.',
  },
  bramble: {
    id: 'bramble',
    name: 'Bramble',
    moveCost: 3,
    passable: true,
    sight: 1,
    forage: { min: 2, max: 5 },
    description: 'A thicket of thorn. Slow to push through, but the berries are late and sweet.',
  },
  marsh: {
    id: 'marsh',
    name: 'Marsh',
    moveCost: 3,
    passable: true,
    sight: 2,
    forage: { min: 1, max: 2 },
    description: 'Sedge and standing water. Every step sinks, and the reeds are not empty.',
  },
  hills: {
    id: 'hills',
    name: 'Hills',
    moveCost: 2,
    passable: true,
    sight: 3,
    forage: { min: 1, max: 2 },
    description: 'Dry tussock and stone. A hard climb, but the whole country opens out below.',
  },
  river: {
    id: 'river',
    name: 'River',
    moveCost: 4,
    passable: false,
    sight: 2,
    forage: null,
    description: 'Cold and fast. No mouse crosses here; look for a ford.',
  },
  ford: {
    id: 'ford',
    name: 'Ford',
    moveCost: 2,
    passable: true,
    sight: 2,
    forage: { min: 1, max: 3 },
    description: 'Stepping stones where the river runs shallow. Wet feet and a clear way across.',
  },
  ruin: {
    id: 'ruin',
    name: 'Old Works',
    moveCost: 2,
    passable: true,
    sight: 2,
    forage: null,
    description: 'Grey slabs that are not stone. Nothing grows. The air hums very faintly.',
  },
};

export const TERRAIN_LIST: TerrainDef[] = Object.values(TERRAIN);
