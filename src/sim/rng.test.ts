import { describe, expect, it } from 'vitest';
import { hashSeed, nextFloat, Rng } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(hashSeed('acorn'));
    const b = new Rng(hashSeed('acorn'));
    const sa = Array.from({ length: 50 }, () => a.float());
    const sb = Array.from({ length: 50 }, () => b.float());
    expect(sa).toEqual(sb);
  });

  it('differs between seeds and streams', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(Rng.fromSeed('x', 0).state).not.toBe(Rng.fromSeed('x', 1).state);
  });

  it('produces floats in [0,1) and ints in range', () => {
    const r = new Rng(12345);
    for (let i = 0; i < 1000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('nextFloat is pure', () => {
    const [v1, s1] = nextFloat(99);
    const [v2, s2] = nextFloat(99);
    expect(v1).toBe(v2);
    expect(s1).toBe(s2);
  });

  it('weighted choice respects weights roughly', () => {
    const r = new Rng(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[r.weighted(['a', 'b'] as const, (x) => (x === 'a' ? 3 : 1))]++;
    expect(counts.a / counts.b).toBeGreaterThan(2.3);
    expect(counts.a / counts.b).toBeLessThan(3.8);
  });
});
