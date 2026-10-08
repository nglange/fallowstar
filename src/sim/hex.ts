/**
 * Axial hex coordinates (pointy-top orientation).
 *
 * q runs along the "columns", r along the rows. The third cube coordinate is
 * s = -q - r. Offset coordinates ("odd-r") are only used to lay the map out as
 * a rectangle and for array indexing.
 */

export interface Axial {
  q: number;
  r: number;
}

export const HEX_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 }, // east
  { q: 1, r: -1 }, // north-east
  { q: 0, r: -1 }, // north-west
  { q: -1, r: 0 }, // west
  { q: -1, r: 1 }, // south-west
  { q: 0, r: 1 }, // south-east
];

export function axial(q: number, r: number): Axial {
  return { q, r };
}

export function hexKey(h: Axial): string {
  return `${h.q},${h.r}`;
}

export function hexEquals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexNeighbors(h: Axial): Axial[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

export function hexDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function hexAdjacent(a: Axial, b: Axial): boolean {
  return hexDistance(a, b) === 1;
}

/** All hexes within `radius` of the centre (inclusive), including the centre. */
export function hexesInRange(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      out.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return out;
}

/** Odd-r offset <-> axial conversion, used to lay the map out on a rectangle. */
export function offsetToAxial(col: number, row: number): Axial {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

export function axialToOffset(h: Axial): { col: number; row: number } {
  return { col: h.q + ((h.r - (h.r & 1)) >> 1), row: h.r };
}

/** Pointy-top axial -> pixel centre, for a hex of circumradius `size`. */
export function axialToPixel(h: Axial, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (h.q + h.r / 2),
    y: size * 1.5 * h.r,
  };
}

/** Pixel -> nearest axial hex (cube rounding). */
export function pixelToAxial(x: number, y: number, size: number): Axial {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return cubeRound(q, r);
}

export function cubeRound(fq: number, fr: number): Axial {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  let s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  else s = -q - r;
  // Normalise -0 so coordinates compare and serialise cleanly.
  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}
