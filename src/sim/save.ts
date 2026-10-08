/**
 * Save codec. The whole GameState is plain data, so saving is JSON. The
 * presentation layer decides where the string goes (localStorage, a file...).
 */
import { SAVE_VERSION } from './game';
import type { GameState } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState | null {
  try {
    const data = JSON.parse(json) as Partial<GameState>;
    if (!data || data.version !== SAVE_VERSION || !data.map || !data.party || !data.pos) return null;
    return data as GameState;
  } catch {
    return null;
  }
}
