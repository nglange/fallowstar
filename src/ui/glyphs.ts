/**
 * Hand-drawn placeholder art: terrain glyphs, landmark icons, the party token
 * and the enemy sprites. Everything is drawn with canvas primitives and scaled
 * by a size parameter so it reads at any zoom.
 */
import type { EnemyId, LandmarkId, TerrainId } from '../sim/types';
import { TERRAIN_COLORS } from './palette';

type Ctx = CanvasRenderingContext2D;

// ----- Terrain ---------------------------------------------------------------

/** Draw a flat hexagon path centred at (0,0) with circumradius s. */
export function hexPath(ctx: Ctx, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = s * Math.cos(a);
    const y = s * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Small deterministic jitter so glyphs vary per hex without RNG. */
function jit(q: number, r: number, k: number): number {
  const v = Math.sin(q * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

export function drawTerrainGlyph(ctx: Ctx, terrain: TerrainId, s: number, q: number, r: number): void {
  const c = TERRAIN_COLORS[terrain];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (terrain) {
    case 'meadow': {
      ctx.strokeStyle = c.glyph;
      ctx.lineWidth = Math.max(1, s * 0.07);
      for (let i = 0; i < 3; i++) {
        const x = (jit(q, r, i) - 0.5) * s * 1.1;
        const y = (jit(q, r, i + 3) - 0.3) * s * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.18);
        ctx.lineTo(x - s * 0.1, y - s * 0.12);
        ctx.moveTo(x, y + s * 0.18);
        ctx.lineTo(x + s * 0.02, y - s * 0.2);
        ctx.moveTo(x, y + s * 0.18);
        ctx.lineTo(x + s * 0.12, y - s * 0.08);
        ctx.stroke();
      }
      if (jit(q, r, 9) > 0.6) {
        ctx.fillStyle = c.glyph2;
        ctx.beginPath();
        ctx.arc((jit(q, r, 10) - 0.5) * s, (jit(q, r, 11) - 0.5) * s * 0.8, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'woodland': {
      const n = 2 + (jit(q, r, 1) > 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * s * 0.42 + (jit(q, r, i) - 0.5) * s * 0.15;
        const y = (jit(q, r, i + 5) - 0.5) * s * 0.5;
        const rad = s * (0.2 + jit(q, r, i + 8) * 0.08);
        ctx.strokeStyle = c.glyph;
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.beginPath();
        ctx.moveTo(x, y + rad * 0.6);
        ctx.lineTo(x, y + rad * 1.5);
        ctx.stroke();
        ctx.fillStyle = jit(q, r, i + 20) > 0.5 ? c.glyph2 : '#d8782a';
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,230,160,0.35)';
        ctx.beginPath();
        ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bramble': {
      ctx.strokeStyle = c.glyph;
      ctx.lineWidth = Math.max(1, s * 0.07);
      for (let i = 0; i < 3; i++) {
        const x = (jit(q, r, i) - 0.5) * s * 0.9;
        const y = (jit(q, r, i + 3) - 0.5) * s * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.22, Math.PI * (0.2 + i * 0.5), Math.PI * (1.4 + i * 0.5));
        ctx.stroke();
        // thorns
        ctx.beginPath();
        ctx.moveTo(x + s * 0.2, y);
        ctx.lineTo(x + s * 0.3, y - s * 0.08);
        ctx.stroke();
      }
      ctx.fillStyle = c.glyph2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc((jit(q, r, i + 7) - 0.5) * s, (jit(q, r, i + 11) - 0.5) * s, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'marsh': {
      ctx.strokeStyle = c.glyph;
      ctx.lineWidth = Math.max(1, s * 0.08);
      for (let i = 0; i < 2; i++) {
        const y = (i - 0.5) * s * 0.5 + s * 0.1;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, y);
        ctx.quadraticCurveTo(-s * 0.25, y - s * 0.12, 0, y);
        ctx.quadraticCurveTo(s * 0.25, y + s * 0.12, s * 0.5, y);
        ctx.stroke();
      }
      ctx.strokeStyle = c.glyph2;
      ctx.lineWidth = Math.max(1, s * 0.06);
      for (let i = 0; i < 3; i++) {
        const x = (jit(q, r, i) - 0.5) * s * 1.0;
        ctx.beginPath();
        ctx.moveTo(x, s * 0.1);
        ctx.lineTo(x + s * 0.05, -s * 0.45);
        ctx.stroke();
        ctx.fillStyle = c.glyph2;
        ctx.beginPath();
        ctx.ellipse(x + s * 0.05, -s * 0.4, s * 0.04, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'hills': {
      ctx.strokeStyle = c.glyph;
      ctx.lineWidth = Math.max(1, s * 0.09);
      ctx.fillStyle = c.glyph2;
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * s * 0.5;
        const y = s * 0.2 - i * s * 0.25;
        const w = s * 0.42;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x, y - s * 0.6, x + w, y);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'river':
    case 'ford': {
      ctx.strokeStyle = c.glyph;
      ctx.lineWidth = Math.max(1, s * 0.08);
      for (let i = 0; i < 3; i++) {
        const y = (i - 1) * s * 0.32;
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, y);
        ctx.quadraticCurveTo(-s * 0.35, y - s * 0.12, 0, y);
        ctx.quadraticCurveTo(s * 0.35, y + s * 0.12, s * 0.7, y);
        ctx.stroke();
      }
      if (terrain === 'ford') {
        ctx.fillStyle = c.glyph2;
        ctx.strokeStyle = '#6b6b63';
        ctx.lineWidth = Math.max(1, s * 0.04);
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * s * 0.3;
          const y = (i % 2 ? 0.08 : -0.08) * s;
          ctx.beginPath();
          ctx.ellipse(x, y, s * 0.13, s * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }
    case 'ruin': {
      ctx.fillStyle = c.glyph;
      ctx.strokeStyle = '#3c4149';
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (let i = 0; i < 3; i++) {
        const x = (jit(q, r, i) - 0.5) * s * 0.9;
        const y = (jit(q, r, i + 3) - 0.5) * s * 0.8;
        const w = s * (0.25 + jit(q, r, i + 6) * 0.25);
        const h = s * 0.14;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((jit(q, r, i + 9) - 0.5) * 0.5);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      // a faint cold seam
      ctx.strokeStyle = 'rgba(185,240,255,0.45)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.3);
      ctx.lineTo(s * 0.4, -s * 0.35);
      ctx.stroke();
      break;
    }
  }
}

// ----- Points of interest ----------------------------------------------------

export function drawHold(ctx: Ctx, s: number): void {
  // Round burrow door set into a grassy mound, with a wisp of smoke.
  ctx.fillStyle = '#8c7a3c';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.25, s * 0.78, s * 0.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.strokeStyle = '#2d1f14';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.arc(0, s * 0.1, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e3b84e';
  ctx.beginPath();
  ctx.arc(s * 0.14, s * 0.12, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // chimney + smoke
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(s * 0.35, -s * 0.45, s * 0.14, s * 0.3);
  ctx.strokeStyle = 'rgba(240,230,210,0.8)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(s * 0.42, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.65, s * 0.42, -s * 0.8);
  ctx.stroke();
}

export function drawDoor(ctx: Ctx, s: number, t: number): void {
  // A tall metal door with a frost-line seam that pulses faintly.
  ctx.fillStyle = '#4a4f57';
  ctx.strokeStyle = '#2b2f35';
  ctx.lineWidth = Math.max(1, s * 0.06);
  const w = s * 0.7;
  const h = s * 1.1;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2 + s * 0.1, w, h, s * 0.12);
  ctx.fill();
  ctx.stroke();
  const glow = 0.5 + 0.5 * Math.sin(t / 600);
  ctx.strokeStyle = `rgba(185,240,255,${0.45 + glow * 0.5})`;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -h / 2 + s * 0.2);
  ctx.lineTo(0, h / 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(185,240,255,${0.3 + glow * 0.4})`;
  ctx.beginPath();
  ctx.arc(0, -s * 0.15, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

export function drawLandmark(ctx: Ctx, id: LandmarkId, s: number, visited: boolean): void {
  ctx.globalAlpha = visited ? 0.75 : 1;
  ctx.lineWidth = Math.max(1, s * 0.06);
  switch (id) {
    case 'burrow':
      ctx.fillStyle = '#2d1f14';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.34, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a1a';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.02, s * 0.3, s * 0.16, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 'stone':
      ctx.fillStyle = '#9aa0a6';
      ctx.strokeStyle = '#4a4f57';
      ctx.beginPath();
      ctx.roundRect(-s * 0.16, -s * 0.6, s * 0.32, s * 1.1, s * 0.06);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#4a4f57';
      ctx.lineWidth = Math.max(1, s * 0.035);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, -s * 0.4 + i * s * 0.25);
        ctx.lineTo(s * 0.08, -s * 0.3 + i * s * 0.25);
        ctx.stroke();
      }
      break;
    case 'grove':
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * s * 0.32;
        const y = i === 1 ? -s * 0.15 : s * 0.05;
        ctx.fillStyle = i === 1 ? '#e9a33d' : '#c8762c';
        ctx.beginPath();
        ctx.arc(x, y, s * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#6b3f1a';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc((i - 1.5) * s * 0.22, s * 0.45, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'relay':
      ctx.fillStyle = '#6e737a';
      ctx.strokeStyle = '#2b2f35';
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, s * 0.5);
      ctx.lineTo(-s * 0.06, -s * 0.6);
      ctx.lineTo(s * 0.06, -s * 0.6);
      ctx.lineTo(s * 0.12, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = visited ? '#3a5a40' : '#5cf07a';
      ctx.beginPath();
      ctx.arc(0, -s * 0.42, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'spring':
      ctx.fillStyle = '#4d7a8a';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.2, s * 0.4, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8cde0';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.05, 0, s * 0.1);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.05, 0, -s * 0.5);
      ctx.fill();
      break;
  }
  ctx.globalAlpha = 1;
}

// ----- Creatures ---------------------------------------------------------------

/** The patrol token: a round brown mouse with a pennant. */
export function drawMouseToken(ctx: Ctx, s: number, t: number): void {
  const bob = Math.sin(t / 350) * s * 0.03;
  ctx.save();
  ctx.translate(0, bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.42, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = Math.max(1.5, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.25);
  ctx.quadraticCurveTo(s * 0.65, s * 0.3, s * 0.6, -s * 0.05);
  ctx.stroke();
  // ears
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.arc(sx * s * 0.26, -s * 0.3, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1d8b8';
    ctx.beginPath();
    ctx.arc(sx * s * 0.26, -s * 0.3, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  ctx.fillStyle = '#8b5a2b';
  ctx.strokeStyle = '#2d1f14';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.4, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // belly, eyes, nose
  ctx.fillStyle = '#d9b48a';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.12, s * 0.22, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d1f14';
  ctx.beginPath();
  ctx.arc(-s * 0.13, -s * 0.08, s * 0.05, 0, Math.PI * 2);
  ctx.arc(s * 0.13, -s * 0.08, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0504a';
  ctx.beginPath();
  ctx.arc(0, s * 0.03, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // pennant
  ctx.strokeStyle = '#2d1f14';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.3);
  ctx.lineTo(-s * 0.42, -s * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#c8552a';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.75);
  ctx.lineTo(-s * 0.05, -s * 0.62);
  ctx.lineTo(-s * 0.42, -s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Enemy sprites, drawn facing the viewer, centred at (0,0), roughly `s` tall.
 * `t` is time for idle motion; `hurt` is 0..1 flash intensity.
 */
export function drawEnemy(ctx: Ctx, id: EnemyId, s: number, t: number, hurt = 0): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const breathe = Math.sin(t / 420) * 0.02 + 1;
  ctx.scale(breathe, 1 / breathe);
  const outline = '#1a110b';
  switch (id) {
    case 'beetle': {
      ctx.fillStyle = '#2b2a33';
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      // legs
      for (let i = 0; i < 3; i++) {
        for (const sx of [-1, 1]) {
          const y = -s * 0.1 + i * s * 0.18;
          ctx.beginPath();
          ctx.moveTo(sx * s * 0.3, y);
          ctx.lineTo(sx * s * 0.55, y - s * 0.1 + Math.sin(t / 200 + i) * s * 0.02);
          ctx.lineTo(sx * s * 0.62, y + s * 0.12);
          ctx.lineWidth = s * 0.05;
          ctx.stroke();
        }
      }
      // body
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.36, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // elytra seam + sheen
      ctx.strokeStyle = '#4b4a5a';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, s * 0.45);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,150,190,0.25)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.14, -s * 0.05, s * 0.1, s * 0.22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // head + mandibles
      ctx.fillStyle = '#1f1e26';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.38, s * 0.18, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f1e26';
      ctx.lineWidth = s * 0.05;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.1, -s * 0.48);
        ctx.quadraticCurveTo(sx * s * 0.2, -s * 0.62, sx * s * 0.06, -s * 0.66);
        ctx.stroke();
      }
      eyes(ctx, s, -s * 0.4, s * 0.09, '#e0c060');
      break;
    }
    case 'wasp': {
      const flap = Math.sin(t / 40) * 0.25;
      // wings
      ctx.fillStyle = 'rgba(220,235,255,0.55)';
      ctx.strokeStyle = 'rgba(120,140,170,0.7)';
      ctx.lineWidth = s * 0.02;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * s * 0.12, -s * 0.15);
        ctx.rotate(sx * (0.9 + flap));
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.3, s * 0.12, s * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // abdomen stripes
      ctx.fillStyle = '#e8b830';
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.22, s * 0.22, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.22, s * 0.22, s * 0.32, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#1a110b';
      for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.3, s * 0.02 + i * s * 0.16, s * 0.6, s * 0.07);
      ctx.restore();
      // stinger
      ctx.fillStyle = '#1a110b';
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, s * 0.5);
      ctx.lineTo(s * 0.05, s * 0.5);
      ctx.lineTo(0, s * 0.64);
      ctx.closePath();
      ctx.fill();
      // thorax + head
      ctx.fillStyle = '#3a2a10';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.12, s * 0.18, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8b830';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.36, s * 0.15, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      eyes(ctx, s, -s * 0.38, s * 0.09, '#2d1f14', s * 0.05);
      // antennae
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.025;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.06, -s * 0.47);
        ctx.quadraticCurveTo(sx * s * 0.2, -s * 0.6, sx * s * 0.14, -s * 0.7);
        ctx.stroke();
      }
      break;
    }
    case 'shrew': {
      // body
      ctx.fillStyle = '#6b5a4a';
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.18, s * 0.3, s * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9c8a76';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.25, s * 0.17, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      // stick / club
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(s * 0.32, s * 0.3);
      ctx.lineTo(s * 0.5, -s * 0.45);
      ctx.stroke();
      // head: long snout
      ctx.fillStyle = '#6b5a4a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, -s * 0.2);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.5, 0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.26, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.1, 0, 0, s * 0.06);
      ctx.quadraticCurveTo(-s * 0.1, 0, -s * 0.26, -s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2d1f14';
      ctx.beginPath();
      ctx.arc(0, s * 0.04, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // ears
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#6b5a4a';
        ctx.beginPath();
        ctx.arc(sx * s * 0.22, -s * 0.46, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      eyes(ctx, s, -s * 0.26, s * 0.1, '#d83a2a', s * 0.045);
      // bandit scarf
      ctx.fillStyle = '#8a2a2a';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.12, s * 0.22, s * 0.07, 0, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'toad': {
      ctx.fillStyle = '#6f8a3a';
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      // legs
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * s * 0.42, s * 0.32, s * 0.2, s * 0.12, sx * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // body
      ctx.beginPath();
      ctx.ellipse(0, s * 0.12, s * 0.46, s * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9c47a';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.26, s * 0.3, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // warts
      ctx.fillStyle = '#4f6a28';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc((jit(i, 3, 1) - 0.5) * s * 0.7, -s * 0.05 + (jit(i, 5, 2) - 0.5) * s * 0.3, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      // mouth
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, s * 0.02);
      ctx.quadraticCurveTo(0, s * 0.14 + Math.sin(t / 500) * s * 0.02, s * 0.32, s * 0.02);
      ctx.stroke();
      // eyes on top
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#6f8a3a';
        ctx.beginPath();
        ctx.arc(sx * s * 0.24, -s * 0.26, s * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e8c860';
        ctx.beginPath();
        ctx.arc(sx * s * 0.24, -s * 0.27, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a110b';
        ctx.beginPath();
        ctx.ellipse(sx * s * 0.24, -s * 0.27, s * 0.025, s * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'centipede': {
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      const segs = 7;
      for (let i = segs - 1; i >= 0; i--) {
        const y = -s * 0.42 + i * s * 0.13;
        const x = Math.sin(t / 300 + i * 0.8) * s * 0.06;
        const w = s * (0.14 + 0.02 * Math.sin(i));
        // legs
        ctx.strokeStyle = '#7a2a18';
        ctx.lineWidth = s * 0.03;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + sx * w, y);
          ctx.lineTo(x + sx * (w + s * 0.16), y - s * 0.04 + Math.sin(t / 120 + i) * s * 0.03);
          ctx.stroke();
        }
        ctx.fillStyle = i % 2 ? '#8a3a22' : '#a84a2a';
        ctx.strokeStyle = outline;
        ctx.beginPath();
        ctx.ellipse(x, y, w, s * 0.085, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // head
      ctx.fillStyle = '#5a1e12';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.5, s * 0.15, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#5a1e12';
      ctx.lineWidth = s * 0.03;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.08, -s * 0.58);
        ctx.lineTo(sx * s * 0.22, -s * 0.72);
        ctx.stroke();
      }
      eyes(ctx, s, -s * 0.52, s * 0.06, '#e0c060', s * 0.03);
      break;
    }
    case 'snake': {
      ctx.fillStyle = '#5c7a3a';
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.03;
      // coils
      const coil = (cx: number, cy: number, rx: number, ry: number) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      };
      coil(0, s * 0.3, s * 0.6, s * 0.2);
      coil(s * 0.05, s * 0.15, s * 0.5, s * 0.18);
      coil(-s * 0.05, 0, s * 0.42, s * 0.16);
      // pattern
      ctx.fillStyle = '#3a5222';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse((i - 4) * s * 0.13, s * 0.3 + (i % 2) * s * 0.06, s * 0.04, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // neck and head rising
      const sway = Math.sin(t / 700) * s * 0.05;
      ctx.fillStyle = '#5c7a3a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.0);
      ctx.quadraticCurveTo(-s * 0.3 + sway, -s * 0.35, sway, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.2 + sway, -s * 0.35, s * 0.1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sway, -s * 0.56, s * 0.2, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // collar (grass snake)
      ctx.fillStyle = '#e8d060';
      ctx.beginPath();
      ctx.ellipse(sway, -s * 0.42, s * 0.14, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      // tongue
      ctx.strokeStyle = '#c03040';
      ctx.lineWidth = s * 0.02;
      const flick = (Math.floor(t / 900) % 3 === 0) ? 1 : 0;
      if (flick) {
        ctx.beginPath();
        ctx.moveTo(sway, -s * 0.44);
        ctx.lineTo(sway, -s * 0.3);
        ctx.lineTo(sway - s * 0.04, -s * 0.24);
        ctx.moveTo(sway, -s * 0.3);
        ctx.lineTo(sway + s * 0.04, -s * 0.24);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(sway, 0);
      eyes(ctx, s, -s * 0.58, s * 0.09, '#e8c860', s * 0.04);
      ctx.restore();
      break;
    }
  }
  if (hurt > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${hurt * 0.8})`;
    ctx.fillRect(-s, -s, s * 2, s * 2);
  }
  ctx.restore();
}

function eyes(ctx: Ctx, s: number, y: number, dx: number, color: string, r = s * 0.04): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-dx, y, r, 0, Math.PI * 2);
  ctx.arc(dx, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Small portrait of a guardmouse for the battle party cards. */
export function drawMousePortrait(ctx: Ctx, s: number, tint: string): void {
  ctx.fillStyle = tint;
  ctx.strokeStyle = '#2d1f14';
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * s * 0.3, -s * 0.3, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d1f14';
  ctx.beginPath();
  ctx.arc(-s * 0.14, -s * 0.05, s * 0.05, 0, Math.PI * 2);
  ctx.arc(s * 0.14, -s * 0.05, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0504a';
  ctx.beginPath();
  ctx.arc(0, s * 0.1, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}
