/**
 * Core simulation types. Everything here is plain JSON-serialisable data; the
 * whole GameState round-trips through JSON for saving.
 */
import type { Axial } from './hex';
import type { RngState } from './rng';

export type TerrainId =
  | 'meadow'
  | 'woodland'
  | 'bramble'
  | 'marsh'
  | 'hills'
  | 'river'
  | 'ford'
  | 'ruin';

export type MouseClassId = 'pathfinder' | 'healer' | 'tinker';
export type EnemyId = 'beetle' | 'wasp' | 'shrew' | 'toad' | 'centipede' | 'snake';
export type TechniqueId = 'lunge' | 'mend' | 'salve' | 'spark' | 'arc' | 'ward';
export type ItemId = 'poultice' | 'smokepod' | 'honeycomb';
export type LandmarkId = 'burrow' | 'stone' | 'grove' | 'relay' | 'spring';

export interface Hex {
  q: number;
  r: number;
  terrain: TerrainId;
  /** Charted by the patrol. Once true it stays true. */
  revealed: boolean;
  /** Index into GameMap.landmarks, if a landmark sits here. */
  landmark?: number;
}

export interface LandmarkInstance {
  id: LandmarkId;
  at: Axial;
  visited: boolean;
  /** Times the landmark's effect has fired (some are one-shot). */
  uses: number;
}

export interface GameMap {
  width: number;
  height: number;
  /** Row-major in odd-r offset coordinates; see mapgen.hexAt. */
  hexes: Hex[];
  hold: Axial;
  door: Axial;
  landmarks: LandmarkInstance[];
}

export interface Mouse {
  cls: MouseClassId;
  name: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  tp: number;
  maxTp: number;
  atk: number;
  def: number;
  spd: number;
  techniques: TechniqueId[];
  /** Hungry: fights at a penalty until fed. */
  famished: boolean;
}

export interface Party {
  members: Mouse[];
  rations: number;
  maxRations: number;
  items: Record<ItemId, number>;
}

export interface EnemyInstance {
  id: EnemyId;
  hp: number;
  maxHp: number;
}

export type BattleCommand =
  | { kind: 'attack'; target: number }
  | { kind: 'technique'; technique: TechniqueId; target?: number }
  | { kind: 'item'; item: ItemId; target?: number }
  | { kind: 'defend' }
  | { kind: 'flee' };

export type BattlePhase = 'command' | 'victory' | 'defeat' | 'fled';

export interface BattleState {
  enemies: EnemyInstance[];
  round: number;
  phase: BattlePhase;
  /** Party-wide defence bonus from Ward, lasts the battle. */
  ward: number;
  /** Per-member: defending this round (set by the round resolver). */
  terrain: TerrainId;
}

export type GameMode = 'explore' | 'battle' | 'won' | 'lost';

export interface Outcome {
  result: 'won' | 'lost';
  reason: 'returned' | 'winter' | 'fallen' | 'starved';
  daysToSpare: number;
}

export interface Stats {
  battles: number;
  fled: number;
  forages: number;
  sorties: number;
  hexesCharted: number;
}

export interface GameState {
  version: number;
  seed: string;
  rng: RngState;
  map: GameMap;
  party: Party;
  pos: Axial;
  /** Elapsed time in half-days since the patrol set out. */
  time: number;
  seasonDays: number;
  mode: GameMode;
  doorFound: boolean;
  battle: BattleState | null;
  outcome: Outcome | null;
  stats: Stats;
}

// ----- Actions ---------------------------------------------------------------

export type Action =
  | { type: 'move'; to: Axial }
  | { type: 'forage' }
  | { type: 'camp' }
  | { type: 'useItem'; item: ItemId; target: number }
  | { type: 'battleRound'; commands: (BattleCommand | null)[] }
  | { type: 'endBattle' };

// ----- Events ----------------------------------------------------------------

export interface ActorRef {
  side: 'party' | 'enemy';
  index: number;
}

export type BattleEvent =
  | { type: 'roundStart'; round: number }
  | { type: 'fled' }
  | { type: 'fleeFailed' }
  | { type: 'attack'; actor: ActorRef; target: ActorRef; damage: number; downed: boolean }
  | { type: 'defend'; actor: ActorRef }
  | {
      type: 'technique';
      actor: ActorRef;
      technique: TechniqueId;
      results: { target: ActorRef; amount: number; downed: boolean }[];
    }
  | { type: 'item'; actor: ActorRef; item: ItemId; target: ActorRef; amount: number }
  | { type: 'noTp'; actor: ActorRef; technique: TechniqueId }
  | { type: 'victory'; xp: number; rations: number; items: Partial<Record<ItemId, number>> }
  | { type: 'defeat' };

export type GameEvent =
  | { type: 'moved'; to: Axial; cost: number }
  | { type: 'dayPassed'; day: number; eaten: number }
  | { type: 'starving'; damage: number }
  | { type: 'revealed'; count: number }
  | { type: 'landmark'; landmark: LandmarkId; index: number; first: boolean; gained?: string }
  | { type: 'doorFound' }
  | { type: 'hold'; firstReturnWithDoor: boolean }
  | { type: 'foraged'; gained: number; cost: number }
  | { type: 'camped'; cost: number }
  | { type: 'itemUsed'; item: ItemId; target: number; amount: number }
  | { type: 'encounter'; enemies: EnemyId[] }
  | { type: 'battle'; event: BattleEvent }
  | { type: 'levelUp'; member: number; level: number }
  | { type: 'ended'; outcome: Outcome }
  | { type: 'invalid'; reason: string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
