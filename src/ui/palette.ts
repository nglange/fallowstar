/** Colours for the overworld and battle screens. Warm autumn above, cold metal below. */
import type { TerrainId } from '../sim/types';

export const PALETTE = {
  bark: '#2a1b12',
  parchment: '#cdbfa6',
  parchmentLine: '#b7a688',
  ink: '#2d1f14',
  cream: '#f3e7cf',
  gold: '#e3b84e',
  ember: '#c8552a',
  moss: '#5f7d3e',
  cold: '#8fd3e8',
  danger: '#b3392b',
  heal: '#6fa84a',
  tp: '#5b8fd6',
} as const;

export interface TerrainColors {
  fill: string;
  edge: string;
  glyph: string;
  glyph2: string;
}

export const TERRAIN_COLORS: Record<TerrainId, TerrainColors> = {
  meadow: { fill: '#d9b556', edge: '#b8963f', glyph: '#8a6a1c', glyph2: '#e8e0c0' },
  woodland: { fill: '#c0692d', edge: '#9a5020', glyph: '#6b2f10', glyph2: '#e9a33d' },
  bramble: { fill: '#7d4b5c', edge: '#5e3545', glyph: '#3d1c2b', glyph2: '#c9627d' },
  marsh: { fill: '#7d9470', edge: '#5f7554', glyph: '#4d7a8a', glyph2: '#3f5b2d' },
  hills: { fill: '#c99a62', edge: '#a67b47', glyph: '#8b5a2b', glyph2: '#e2c391' },
  river: { fill: '#5f8fb0', edge: '#4a7591', glyph: '#a8cde0', glyph2: '#3e6a86' },
  ford: { fill: '#6b98b4', edge: '#4a7591', glyph: '#a8cde0', glyph2: '#9b9a90' },
  ruin: { fill: '#767b83', edge: '#565b63', glyph: '#4a4f57', glyph2: '#b9f0ff' },
};
