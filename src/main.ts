// Milestone 1 entry: generate a map from a seed and render it with pan/zoom.
import './ui/style.css';
import { generateMap } from './sim/mapgen';
import type { GameState } from './sim/types';
import { Camera } from './ui/camera';
import { attachMapInput } from './ui/input';
import { MapRenderer } from './ui/mapRenderer';

const seed = new URLSearchParams(location.search).get('seed') ?? 'fallowstar';
const map = generateMap(seed);
for (const h of map.hexes) h.revealed = true;

const state = {
  version: 1, seed, rng: 0, map, pos: map.hold, time: 0, seasonDays: 36,
  mode: 'explore', doorFound: false, battle: null, outcome: null,
  party: { members: [], rations: 0, maxRations: 0, items: { poultice: 0, smokepod: 0, honeycomb: 0 } },
  stats: { battles: 0, fled: 0, forages: 0, sorties: 0, hexesCharted: 0 },
} satisfies GameState;

const root = document.getElementById('app')!;
const canvas = document.createElement('canvas');
canvas.id = 'map-canvas';
root.appendChild(canvas);
const camera = new Camera();
const renderer = new MapRenderer(canvas, camera);
attachMapInput(canvas, camera, { onTap: () => {}, onChange: () => {} });
const resize = () => renderer.resize();
window.addEventListener('resize', resize);
resize();
camera.centerOn(map.hold, true);
const loop = (t: number) => {
  camera.tick();
  renderer.draw(state, t);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
