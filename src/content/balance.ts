/**
 * Tuning knobs for the demo loop. Everything that decides how hard the season
 * is lives here, so a balance pass never touches rules code.
 */
export const BALANCE = {
  /** Map is a width x height rectangle of hexes. */
  mapWidth: 30,
  mapHeight: 30,

  /** Days in the season before first snow. */
  seasonDays: 36,

  /** Door is placed this many hexes from the hold (inclusive band). */
  doorDistance: { min: 10, max: 13 },

  /** How many minor landmarks to scatter. */
  landmarkCount: 7,
  landmarkMinDistanceFromHold: 3,
  landmarkMinSpacing: 3,

  /** Rations: one per mouse per day. */
  startRations: 24,
  maxRations: 40,
  rationsPerMousePerDay: 1,
  /** Fraction of max HP lost per day without food. */
  starveDamage: 0.2,

  /** Half-days a forage takes. */
  forageCost: 1,
  /** Half-days camping takes, and the fraction of HP/TP restored. */
  campCost: 2,
  campHeal: 0.4,
  campTp: 0.5,
  campEncounterChance: 0.12,

  /** Encounters cannot trigger on the hold, door or an unvisited landmark hex. */
  encounterGraceOnLandmark: true,

  /** XP needed to reach each level (index = level - 1). */
  xpTable: [0, 28, 70, 130],

  /** What the hold always has ready for the patrol. */
  holdItems: { poultice: 2, smokepod: 1, honeycomb: 1 } as const,

  /** Battle maths. */
  damageVariance: 0.2,
  defendMultiplier: 0.5,
  famishedAttackMultiplier: 0.75,
  baseFleeChance: 0.55,
} as const;
