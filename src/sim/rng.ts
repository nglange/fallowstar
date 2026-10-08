/**
 * Seeded random number generation.
 *
 * The generator state is a single 32-bit integer so it can live inside the
 * serialisable GameState. Every rule in the simulation draws from a state it is
 * handed and returns the advanced state, so a given seed plus the same sequence
 * of actions always replays identically.
 */

export type RngState = number;

/** Hash an arbitrary seed string to a 32-bit state (cyrb53-derived, low word). */
export function hashSeed(seed: string): RngState {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = (h1 ^ h2) >>> 0;
  return out === 0 ? 0x9e3779b9 : out;
}

/** mulberry32: returns [value in [0,1), nextState]. */
export function nextFloat(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/**
 * A tiny mutable cursor over an RngState for code that makes many draws in a
 * row (map generation, battle rounds). Call `.state` at the end to persist.
 */
export class Rng {
  constructor(public state: RngState) {}

  static fromSeed(seed: string, stream = 0): Rng {
    // Mix the stream index in so sub-generators (map, encounters) do not
    // accidentally share a sequence.
    return new Rng(hashSeed(`${seed}#${stream}`));
  }

  float(): number {
    const [v, s] = nextFloat(this.state);
    this.state = s;
    return v;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)];
  }

  /** Weighted choice; weights need not be normalised. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += weight(it);
    let roll = this.float() * total;
    for (const it of items) {
      roll -= weight(it);
      if (roll < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
