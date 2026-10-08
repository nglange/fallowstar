/**
 * Draws the overworld onto a canvas from a GameState and a Camera. Read-only
 * with respect to the simulation.
 */
import { axialToOffset, hexEquals, hexNeighbors, offsetToAxial, type Axial } from '../sim/hex';
import { hexAt, isPassable } from '../sim/mapgen';
import type { GameState } from '../sim/types';
import { Camera, HEX_SIZE } from './camera';
import { drawDoor, drawHold, drawLandmark, drawMouseToken, drawTerrainGlyph, hexPath } from './glyphs';
import { PALETTE, TERRAIN_COLORS } from './palette';

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** Hex the player has tapped for information. */
  selected: Axial | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    public camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.camera.resize(rect.width, rect.height);
  }

  draw(state: GameState, time: number): void {
    const { ctx, camera } = this;
    const W = camera.width;
    const H = camera.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PALETTE.bark;
    ctx.fillRect(0, 0, W, H);

    const s = HEX_SIZE * camera.zoom;
    const map = state.map;
    const margin = s * 1.5;

    // Visible row/col bounds (approximate; we cull per hex anyway).
    const tl = camera.screenToHex(-margin, -margin);
    const br = camera.screenToHex(W + margin, H + margin);
    const rowMin = Math.max(0, axialToOffset(tl).row - 1);
    const rowMax = Math.min(map.height - 1, axialToOffset(br).row + 1);

    // Pass 1: fills (unrevealed as parchment, revealed as terrain).
    for (let row = rowMin; row <= rowMax; row++) {
      const colMin = Math.max(0, axialToOffset(camera.screenToHex(-margin, camera.hexToScreen(offsetToAxial(0, row)).y)).col - 1);
      const colMax = Math.min(map.width - 1, axialToOffset(camera.screenToHex(W + margin, camera.hexToScreen(offsetToAxial(0, row)).y)).col + 1);
      for (let col = colMin; col <= colMax; col++) {
        const a = offsetToAxial(col, row);
        const hex = hexAt(map, a)!;
        const p = camera.hexToScreen(a);
        if (p.x < -margin || p.y < -margin || p.x > W + margin || p.y > H + margin) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        hexPath(ctx, s + 0.6);
        if (!hex.revealed) {
          ctx.fillStyle = PALETTE.parchment;
          ctx.fill();
          ctx.strokeStyle = PALETTE.parchmentLine;
          ctx.lineWidth = 1;
          hexPath(ctx, s - 1);
          ctx.stroke();
        } else {
          const c = TERRAIN_COLORS[hex.terrain];
          ctx.fillStyle = c.fill;
          ctx.fill();
          ctx.strokeStyle = c.edge;
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.stroke();
          if (s > 9) drawTerrainGlyph(ctx, hex.terrain, s, hex.q, hex.r);
        }
        ctx.restore();
      }
    }

    // Pass 2: points of interest on revealed hexes.
    for (const lm of map.landmarks) {
      const hex = hexAt(map, lm.at)!;
      if (!hex.revealed) continue;
      const p = camera.hexToScreen(lm.at);
      if (p.x < -margin || p.y < -margin || p.x > W + margin || p.y > H + margin) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      drawLandmark(ctx, lm.id, s * 0.9, lm.visited);
      ctx.restore();
    }
    {
      const p = camera.hexToScreen(map.hold);
      ctx.save();
      ctx.translate(p.x, p.y);
      drawHold(ctx, s * 0.9);
      ctx.restore();
    }
    if (hexAt(map, map.door)!.revealed) {
      const p = camera.hexToScreen(map.door);
      ctx.save();
      ctx.translate(p.x, p.y);
      drawDoor(ctx, s * 0.9, time);
      ctx.restore();
    }

    // Pass 3: move targets and selection.
    if (state.mode === 'explore') {
      const pulse = 0.55 + 0.25 * Math.sin(time / 400);
      for (const n of hexNeighbors(state.pos)) {
        const hex = hexAt(map, n);
        if (!hex) continue;
        const p = camera.hexToScreen(n);
        ctx.save();
        ctx.translate(p.x, p.y);
        hexPath(ctx, s - Math.max(2, s * 0.1));
        if (isPassable(map, n)) {
          ctx.strokeStyle = `rgba(243,231,207,${pulse})`;
          ctx.lineWidth = Math.max(1.5, s * 0.07);
          ctx.setLineDash([s * 0.25, s * 0.18]);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(40,20,10,0.35)';
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (this.selected && hexAt(map, this.selected)?.revealed) {
      const p = camera.hexToScreen(this.selected);
      ctx.save();
      ctx.translate(p.x, p.y);
      hexPath(ctx, s - 1);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.stroke();
      ctx.restore();
    }

    // Pass 4: the patrol.
    {
      const p = camera.hexToScreen(state.pos);
      ctx.save();
      ctx.translate(p.x, p.y);
      drawMouseToken(ctx, s * 0.8, time);
      ctx.restore();
    }

    // Vignette toward the edges to frame the map.
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(42,27,18,0)');
    g.addColorStop(1, 'rgba(42,27,18,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /** Is this hex the hold? Used by the HUD. */
  static isHold(state: GameState, h: Axial): boolean {
    return hexEquals(state.map.hold, h);
  }
}
