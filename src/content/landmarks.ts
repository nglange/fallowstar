import type { ItemId, LandmarkId, TerrainId } from '../sim/types';

export type LandmarkEffect =
  | { kind: 'heal' }
  | { kind: 'reveal'; radius: number }
  | { kind: 'item'; item: ItemId; count: number }
  | { kind: 'rations'; amount: number }
  | { kind: 'none' };

export interface LandmarkDef {
  id: LandmarkId;
  name: string;
  /** Terrain the landmark may be placed on. */
  terrains: TerrainId[];
  /** How many of these to place at most in one map. */
  maxCount: number;
  effect: LandmarkEffect;
  /** Does the effect fire every visit (true) or only the first? */
  repeatable: boolean;
  first: string;
  again: string;
}

export const LANDMARKS: Record<LandmarkId, LandmarkDef> = {
  burrow: {
    id: 'burrow',
    name: 'Abandoned Burrow',
    terrains: ['meadow', 'hills', 'woodland'],
    maxCount: 2,
    effect: { kind: 'heal' },
    repeatable: true,
    first:
      'A rabbit hole, long empty, the entrance half-closed with leaf litter. Inside it is dry and smells of nothing. The patrol sleeps properly for the first time in days.',
    again: 'The burrow is as you left it. You rest, and set out again.',
  },
  stone: {
    id: 'stone',
    name: 'Standing Stone',
    terrains: ['meadow', 'hills'],
    maxCount: 2,
    effect: { kind: 'reveal', radius: 4 },
    repeatable: false,
    first:
      'A single grey post, taller than an oak, perfectly smooth. Lines are cut into its face: not words, but the land. Tansy traces them with a claw and the country around you comes clear in her head.',
    again: 'The stone hums faintly if you press an ear to it. The map it gave you still holds.',
  },
  grove: {
    id: 'grove',
    name: 'Hazel Grove',
    terrains: ['woodland', 'meadow'],
    maxCount: 2,
    effect: { kind: 'rations', amount: 8 },
    repeatable: false,
    first:
      'Hazels bent with nuts, more than the jays have found. You fill every pouch and still leave some on the branch.',
    again: 'The grove has been picked clean, by you or by the jays. A few husks crunch underfoot.',
  },
  relay: {
    id: 'relay',
    name: 'Builder Relay',
    terrains: ['meadow', 'hills', 'marsh'],
    maxCount: 1,
    effect: { kind: 'item', item: 'honeycomb', count: 2 },
    repeatable: false,
    first:
      'A metal spike half-buried in the turf, cold to the touch, with a dead green eye near the top. Peck pries a panel open and comes away with two cells still warm, and a troubled look.',
    again: 'The relay is quiet. Peck pats it as you pass, the way you would an old dog.',
  },
  spring: {
    id: 'spring',
    name: 'Clear Spring',
    terrains: ['hills', 'woodland'],
    maxCount: 1,
    effect: { kind: 'item', item: 'poultice', count: 2 },
    repeatable: false,
    first:
      'Water comes straight out of the rock, cold enough to hurt. Rowan gathers plantain and moss from the bank and wraps two fresh poultices while the others drink.',
    again: 'You drink at the spring. It is as cold as before.',
  },
};

export const LANDMARK_LIST: LandmarkDef[] = Object.values(LANDMARKS);
