import { describe, expect, it } from 'vitest';
import {
  axialToOffset,
  axialToPixel,
  hexDistance,
  hexNeighbors,
  hexesInRange,
  offsetToAxial,
  pixelToAxial,
} from './hex';

describe('hex', () => {
  it('distance and neighbours agree', () => {
    const c = { q: 3, r: -2 };
    for (const n of hexNeighbors(c)) expect(hexDistance(c, n)).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: -2, r: 5 })).toBe(5);
  });

  it('ranges have the right size', () => {
    expect(hexesInRange({ q: 0, r: 0 }, 0)).toHaveLength(1);
    expect(hexesInRange({ q: 0, r: 0 }, 1)).toHaveLength(7);
    expect(hexesInRange({ q: 2, r: 2 }, 3)).toHaveLength(37);
  });

  it('offset <-> axial round trips', () => {
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 7; col++) {
        expect(axialToOffset(offsetToAxial(col, row))).toEqual({ col, row });
      }
  });

  it('pixel <-> axial round trips', () => {
    for (let q = -5; q <= 5; q++)
      for (let r = -5; r <= 5; r++) {
        const p = axialToPixel({ q, r }, 20);
        expect(pixelToAxial(p.x + 3, p.y - 4, 20)).toEqual({ q, r });
      }
  });
});
