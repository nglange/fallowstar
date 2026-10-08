import { describe, expect, it } from 'vitest';
import { BALANCE } from '../content/balance';
import { TERRAIN } from '../content/terrain';
import { hexDistance, hexKey } from './hex';
import { generateMap, hexAt, reachableFrom, shortestPath } from './mapgen';

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

describe('mapgen', () => {
  it('same seed gives the same map', () => {
    const a = generateMap('fallowstar');
    const b = generateMap('fallowstar');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds give different maps', () => {
    expect(JSON.stringify(generateMap('a'))).not.toBe(JSON.stringify(generateMap('b')));
  });

  it('hold and door exist, door is in the distance band and reachable', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const hold = hexAt(map, map.hold);
      const door = hexAt(map, map.door);
      expect(hold, seed).toBeDefined();
      expect(door, seed).toBeDefined();
      expect(TERRAIN[hold!.terrain].passable).toBe(true);
      expect(door!.terrain).toBe('ruin');
      const d = hexDistance(map.hold, map.door);
      expect(d).toBeGreaterThanOrEqual(BALANCE.doorDistance.min);
      expect(d).toBeLessThanOrEqual(BALANCE.doorDistance.max);
      expect(reachableFrom(map, map.hold).has(hexKey(map.door))).toBe(true);
      expect(shortestPath(map, map.hold, map.door)).not.toBeNull();
    }
  });

  it('hold is near the centre', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const center = { q: map.width / 2 - map.height / 4, r: map.height / 2 };
      expect(hexDistance(map.hold, center)).toBeLessThanOrEqual(5);
    }
  });

  it('has the expected size and only valid terrain', () => {
    const map = generateMap('size');
    expect(map.hexes).toHaveLength(map.width * map.height);
    for (const h of map.hexes) expect(TERRAIN[h.terrain]).toBeDefined();
  });

  it('forms coherent regions rather than noise', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = generateMap(seed);
      let coherent = 0;
      let counted = 0;
      for (const h of map.hexes) {
        if (h.terrain === 'river' || h.terrain === 'ford' || h.terrain === 'ruin') continue;
        counted++;
        const same = [
          { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
          { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
        ].filter((d) => hexAt(map, { q: h.q + d.q, r: h.r + d.r })?.terrain === h.terrain).length;
        if (same >= 2) coherent++;
      }
      expect(coherent / counted, seed).toBeGreaterThan(0.85);
    }
  });

  it('places landmarks on matching, reachable terrain away from the hold', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const reach = reachableFrom(map, map.hold);
      expect(map.landmarks.length).toBeGreaterThanOrEqual(4);
      for (const [i, lm] of map.landmarks.entries()) {
        const hex = hexAt(map, lm.at)!;
        expect(hex.landmark).toBe(i);
        expect(reach.has(hexKey(lm.at))).toBe(true);
        expect(hexDistance(lm.at, map.hold)).toBeGreaterThanOrEqual(BALANCE.landmarkMinDistanceFromHold);
      }
    }
  });

  it('starts fully fogged', () => {
    const map = generateMap('fog');
    expect(map.hexes.every((h) => !h.revealed)).toBe(true);
  });
});
