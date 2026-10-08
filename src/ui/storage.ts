/** localStorage adapter. The sim produces the JSON; this just stores it. */
import { deserialize, serialize } from '../sim/save';
import type { GameState } from '../sim/types';

const SAVE_KEY = 'fallowstar.save.v1';
const SEED_KEY = 'fallowstar.lastSeed';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
    localStorage.setItem(SEED_KEY, state.seed);
  } catch {
    /* storage full or unavailable; play on without saving */
  }
}

export function loadGame(): GameState | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    return json ? deserialize(json) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function lastSeed(): string | null {
  try {
    return localStorage.getItem(SEED_KEY);
  } catch {
    return null;
  }
}

const WORDS_A = ['amber', 'hazel', 'bracken', 'ember', 'sorrel', 'thistle', 'rowan', 'fallow', 'sedge', 'copper', 'dusk', 'frost'];
const WORDS_B = ['hollow', 'ridge', 'brook', 'burrow', 'heath', 'coppice', 'moor', 'dell', 'fen', 'tor', 'warren', 'glade'];

/** A memorable random seed; this is presentation-side randomness, the seed is then shown to the player. */
export function randomSeed(): string {
  const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
  const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
  return `${a}-${b}-${Math.floor(Math.random() * 90 + 10)}`;
}
