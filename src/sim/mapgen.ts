/**
 * Procedural map generation.
 *
 * Pipeline: value-noise fields (elevation, moisture, thorn) -> percentile
 * classification into terrain -> cellular smoothing so regions cohere -> one
 * river carved by greedy descent with fords -> hold near the centre -> sealed
 * door in a distance band, reachable on foot -> scattered landmarks.
 *
 * Everything is driven by the seed string alone, so the same seed always yields
 * the same map regardless of what the player does afterwards.
 */
import { BALANCE } from '../content/balance';
import { LANDMARK_LIST, type LandmarkDef } from '../content/landmarks';
import { TERRAIN } from '../content/terrain';
import {
  axialToOffset,
  axialToPixel,
  hexDistance,
  hexKey,
  hexNeighbors,
  offsetToAxial,
  type Axial,
} from './hex';
import { hashSeed, Rng } from './rng';
import type { GameMap, Hex, LandmarkInstance, TerrainId } from './types';

export interface MapGenOptions {
  width?: number;
  height?: number;
  doorDistance?: { min: number; max: number };
  doorPathCost?: { min: number; max: number };
  landmarkCount?: number;
}

// ----- Lookup helpers --------------------------------------------------------

export function inBounds(map: GameMap, h: Axial): boolean {
  const { col, row } = axialToOffset(h);
  return col >= 0 && col < map.width && row >= 0 && row < map.height;
}

export function hexAt(map: GameMap, h: Axial): Hex | undefined {
  if (!inBounds(map, h)) return undefined;
  const { col, row } = axialToOffset(h);
  return map.hexes[row * map.width + col];
}

export function isPassable(map: GameMap, h: Axial): boolean {
  const hex = hexAt(map, h);
  return hex !== undefined && TERRAIN[hex.terrain].passable;
}

export function passableNeighbors(map: GameMap, h: Axial): Axial[] {
  return hexNeighbors(h).filter((n) => isPassable(map, n));
}

/** Set of hex keys reachable on foot from `start`. */
export function reachableFrom(map: GameMap, start: Axial): Set<string> {
  const seen = new Set<string>([hexKey(start)]);
  const queue: Axial[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of passableNeighbors(map, cur)) {
      const k = hexKey(n);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen;
}

/** Cheapest walking cost (half-days) from `start` to every reachable hex. */
export function walkingCosts(map: GameMap, start: Axial): Map<string, number> {
  const dist = new Map<string, number>();
  const open: { h: Axial; d: number }[] = [{ h: start, d: 0 }];
  dist.set(hexKey(start), 0);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
    const { h, d } = open.splice(bi, 1)[0];
    if (d > (dist.get(hexKey(h)) ?? Infinity)) continue;
    for (const n of passableNeighbors(map, h)) {
      const nk = hexKey(n);
      const nd = d + TERRAIN[hexAt(map, n)!.terrain].moveCost;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        open.push({ h: n, d: nd });
      }
    }
  }
  return dist;
}

/**
 * Dijkstra over passable hexes. `cost(hex)` is the price of entering a hex.
 * Returns the path excluding `from`, or null if unreachable.
 */
export function shortestPath(
  map: GameMap,
  from: Axial,
  to: Axial,
  cost: (hex: Hex) => number = (h) => TERRAIN[h.terrain].moveCost,
): Axial[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, Axial>();
  const open: { h: Axial; d: number }[] = [{ h: from, d: 0 }];
  dist.set(hexKey(from), 0);
  const target = hexKey(to);
  while (open.length) {
    // Small graph: linear scan for the minimum is fine.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
    const { h, d } = open.splice(bi, 1)[0];
    const hk = hexKey(h);
    if (d > (dist.get(hk) ?? Infinity)) continue;
    if (hk === target) break;
    for (const n of passableNeighbors(map, h)) {
      const nk = hexKey(n);
      const nd = d + cost(hexAt(map, n)!);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, h);
        open.push({ h: n, d: nd });
      }
    }
  }
  if (!dist.has(target)) return null;
  const path: Axial[] = [];
  let cur = to;
  while (hexKey(cur) !== hexKey(from)) {
    path.push(cur);
    cur = prev.get(hexKey(cur))!;
  }
  return path.reverse();
}

// ----- Noise -----------------------------------------------------------------

function lattice(seed: number, x: number, y: number): number {
  // Integer hash -> [0,1). Deterministic per (seed, x, y).
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = lattice(seed, x0, y0);
  const b = lattice(seed, x0 + 1, y0);
  const c = lattice(seed, x0, y0 + 1);
  const d = lattice(seed, x0 + 1, y0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** Fractal value noise in [0,1], sampled at pixel-space hex centres so it is isotropic. */
function fbm(seed: number, h: Axial, scale: number, octaves: number): number {
  const p = axialToPixel(h, 1);
  let amp = 1;
  let freq = 1 / scale;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(seed + i * 7919, p.x * freq + 100, p.y * freq + 100);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[i];
}

// ----- Generation ------------------------------------------------------------

export function generateMap(seed: string, opts: MapGenOptions = {}): GameMap {
  // Door placement can fail on an unlucky layout (e.g. the river boxes the hold
  // in). Vary a sub-seed and try again; the result is still a pure function of
  // the seed string.
  for (let attempt = 0; attempt < 24; attempt++) {
    const map = tryGenerate(seed, attempt, opts);
    if (map) return map;
  }
  throw new Error(`Could not generate a valid map for seed "${seed}"`);
}

function tryGenerate(seed: string, attempt: number, opts: MapGenOptions): GameMap | null {
  const width = opts.width ?? BALANCE.mapWidth;
  const height = opts.height ?? BALANCE.mapHeight;
  const doorBand = opts.doorDistance ?? BALANCE.doorDistance;
  const landmarkCount = opts.landmarkCount ?? BALANCE.landmarkCount;

  const rng = Rng.fromSeed(seed, 1000 + attempt);
  const noiseSeed = hashSeed(`${seed}/noise/${attempt}`);

  const hexes: Hex[] = [];
  const elevation: number[] = [];
  const moisture: number[] = [];
  const thorn: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const a = offsetToAxial(col, row);
      hexes.push({ q: a.q, r: a.r, terrain: 'meadow', revealed: false });
      elevation.push(fbm(noiseSeed, a, 7, 3));
      moisture.push(fbm(noiseSeed + 1013, a, 6, 3));
      thorn.push(fbm(noiseSeed + 2027, a, 4, 2));
    }
  }

  const map: GameMap = {
    width,
    height,
    hexes,
    hold: { q: 0, r: 0 },
    door: { q: 0, r: 0 },
    landmarks: [],
  };

  // Classification by percentile keeps proportions similar across seeds.
  const es = [...elevation].sort((a, b) => a - b);
  const ms = [...moisture].sort((a, b) => a - b);
  const ts = [...thorn].sort((a, b) => a - b);
  const hillCut = percentile(es, 0.8);
  const lowCut = percentile(es, 0.18);
  const wetCut = percentile(ms, 0.42);
  const woodCut = percentile(ms, 0.52);
  const thornCut = percentile(ts, 0.68);

  hexes.forEach((hex, i) => {
    const e = elevation[i];
    const m = moisture[i];
    if (e >= hillCut) hex.terrain = 'hills';
    else if (e <= lowCut && m >= wetCut) hex.terrain = 'marsh';
    else if (m >= woodCut) hex.terrain = thorn[i] >= thornCut ? 'bramble' : 'woodland';
    else hex.terrain = 'meadow';
  });

  smoothTerrain(map, 2);

  carveRiver(map, elevation, rng);

  // Hold: as close to the centre as possible, on dry ground, away from water.
  const center = offsetToAxial(width >> 1, height >> 1);
  const hold = findHold(map, center);
  if (!hold) return null;
  map.hold = hold;
  hexAt(map, hold)!.terrain = 'meadow';

  const reachable = reachableFrom(map, hold);
  const walkCost = walkingCosts(map, hold);

  // Door: far enough that the trip eats most of the season, and reachable.
  const pathBand = opts.doorPathCost ?? BALANCE.doorPathCost;
  const doorCandidates = hexes.filter((h) => {
    const d = hexDistance(h, hold);
    const c = walkCost.get(hexKey(h)) ?? Infinity;
    return (
      d >= doorBand.min &&
      d <= doorBand.max &&
      c >= pathBand.min &&
      c <= pathBand.max &&
      reachable.has(hexKey(h)) &&
      h.terrain !== 'ford' &&
      h.terrain !== 'marsh'
    );
  });
  if (doorCandidates.length === 0) return null;
  const doorHex = rng.weighted(doorCandidates, (h) =>
    h.terrain === 'hills' ? 3 : h.terrain === 'woodland' || h.terrain === 'bramble' ? 2 : 1,
  );
  map.door = { q: doorHex.q, r: doorHex.r };
  doorHex.terrain = 'ruin';
  for (const n of hexNeighbors(map.door)) {
    const nh = hexAt(map, n);
    if (nh && TERRAIN[nh.terrain].passable && rng.chance(0.45)) nh.terrain = 'ruin';
  }

  placeLandmarks(map, rng, reachable, landmarkCount);

  return map;
}

/** Replace isolated specks with the dominant neighbouring terrain. */
function smoothTerrain(map: GameMap, passes: number): void {
  for (let p = 0; p < passes; p++) {
    const next = map.hexes.map((h) => h.terrain);
    map.hexes.forEach((hex, i) => {
      const counts = new Map<TerrainId, number>();
      let same = 0;
      let total = 0;
      for (const n of hexNeighbors(hex)) {
        const nh = hexAt(map, n);
        if (!nh) continue;
        total++;
        counts.set(nh.terrain, (counts.get(nh.terrain) ?? 0) + 1);
        if (nh.terrain === hex.terrain) same++;
      }
      if (total >= 4 && same <= 1) {
        let best: TerrainId = hex.terrain;
        let bestN = -1;
        for (const [t, n] of counts) {
          if (n > bestN) {
            bestN = n;
            best = t;
          }
        }
        next[i] = best;
      }
    });
    map.hexes.forEach((h, i) => (h.terrain = next[i]));
  }
}

function carveRiver(map: GameMap, elevation: number[], rng: Rng): void {
  const center = offsetToAxial(map.width >> 1, map.height >> 1);
  const indexOf = (h: Axial) => {
    const { col, row } = axialToOffset(h);
    return row * map.width + col;
  };
  // Candidate sources: high ground well away from the centre.
  const sources = map.hexes
    .map((h, i) => ({ h, e: elevation[i] }))
    .filter(({ h }) => hexDistance(h, center) >= 7)
    .sort((a, b) => b.e - a.e)
    .slice(0, 40)
    .map(({ h }) => h);

  for (let tries = 0; tries < 6 && sources.length; tries++) {
    const startHex = rng.pick(sources);
    const start: Axial = { q: startHex.q, r: startHex.r };
    const path: Axial[] = [start];
    const visited = new Set<string>([hexKey(start)]);
    let cur: Axial = start;
    let lastDir: Axial | null = null;
    while (path.length < 60) {
      const options = hexNeighbors(cur)
        .filter((n) => inBounds(map, n) && !visited.has(hexKey(n)))
        .filter((n) => hexDistance(n, center) > 1);
      if (options.length === 0) break;
      const scored = options.map((n) => {
        const dir = { q: n.q - cur.q, r: n.r - cur.r };
        const turn = lastDir ? Math.abs(dir.q - lastDir.q) + Math.abs(dir.r - lastDir.r) : 0;
        return { n, score: elevation[indexOf(n)] + turn * 0.06 + rng.float() * 0.03 };
      });
      scored.sort((a, b) => a.score - b.score);
      const next = scored[0].n;
      lastDir = { q: next.q - cur.q, r: next.r - cur.r };
      path.push(next);
      visited.add(hexKey(next));
      cur = next;
      const { col, row } = axialToOffset(cur);
      if (col === 0 || row === 0 || col === map.width - 1 || row === map.height - 1) break;
    }
    if (path.length < 12) continue;

    path.forEach((h) => (hexAt(map, h)!.terrain = 'river'));
    // Fords every few hexes so the river shapes routes without walling them off.
    let i = rng.int(1, 3);
    while (i < path.length - 1) {
      hexAt(map, path[i])!.terrain = 'ford';
      i += rng.int(3, 5);
    }
    return;
  }
}

function findHold(map: GameMap, center: Axial): Axial | null {
  const candidates = map.hexes
    .filter((h) => hexDistance(h, center) <= 4)
    .sort((a, b) => hexDistance(a, center) - hexDistance(b, center));
  for (const c of candidates) {
    if (c.terrain === 'river' || c.terrain === 'ford') continue;
    const nearWater = hexNeighbors(c).some((n) => {
      const nh = hexAt(map, n);
      return nh && (nh.terrain === 'river' || nh.terrain === 'ford');
    });
    if (nearWater) continue;
    return { q: c.q, r: c.r };
  }
  return null;
}

function placeLandmarks(
  map: GameMap,
  rng: Rng,
  reachable: Set<string>,
  count: number,
): void {
  const pool: LandmarkDef[] = [];
  for (const def of LANDMARK_LIST) for (let i = 0; i < def.maxCount; i++) pool.push(def);
  rng.shuffle(pool);
  // Make sure each kind appears once before duplicates are considered.
  pool.sort((a, b) => {
    const ia = pool.indexOf(a);
    const ib = pool.indexOf(b);
    return ia - ib;
  });
  const placed: LandmarkInstance[] = [];
  const seenKinds = new Set<string>();
  const ordered = [...pool.filter((d) => !seenKinds.has(d.id) && seenKinds.add(d.id)), ...pool];

  for (const def of ordered) {
    if (placed.length >= count) break;
    if (placed.filter((p) => p.id === def.id).length >= def.maxCount) continue;
    const candidates = map.hexes.filter(
      (h) =>
        def.terrains.includes(h.terrain) &&
        h.landmark === undefined &&
        reachable.has(hexKey(h)) &&
        hexDistance(h, map.hold) >= BALANCE.landmarkMinDistanceFromHold &&
        hexDistance(h, map.door) >= 2 &&
        placed.every((p) => hexDistance(h, p.at) >= BALANCE.landmarkMinSpacing),
    );
    if (candidates.length === 0) continue;
    const hex = rng.pick(candidates);
    hex.landmark = placed.length;
    placed.push({ id: def.id, at: { q: hex.q, r: hex.r }, visited: false, uses: 0 });
  }
  map.landmarks = placed;
}
