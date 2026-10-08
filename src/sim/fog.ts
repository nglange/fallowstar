/**
 * Fog of war. Hexes are charted as the patrol approaches and stay charted.
 * Sight depends on the terrain the patrol stands on: hills see far, woodland
 * and bramble hardly past the next trunk.
 */
import { TERRAIN } from '../content/terrain';
import { hexesInRange, type Axial } from './hex';
import { hexAt } from './mapgen';
import type { GameMap } from './types';

export function sightFrom(map: GameMap, pos: Axial): number {
  const hex = hexAt(map, pos);
  return hex ? TERRAIN[hex.terrain].sight : 1;
}

/** Reveal everything within `radius` of `pos`. Returns the number of newly charted hexes. */
export function reveal(map: GameMap, pos: Axial, radius: number): number {
  let newly = 0;
  for (const h of hexesInRange(pos, radius)) {
    const hex = hexAt(map, h);
    if (hex && !hex.revealed) {
      hex.revealed = true;
      newly++;
    }
  }
  return newly;
}

export function revealFromPosition(map: GameMap, pos: Axial): number {
  return reveal(map, pos, sightFrom(map, pos));
}
