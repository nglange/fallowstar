/** Pan/zoom camera. World units are pixels at zoom 1 (hex circumradius = HEX_SIZE). */
import { axialToPixel, pixelToAxial, type Axial } from '../sim/hex';

export const HEX_SIZE = 34;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.45;
  maxZoom = 2.6;
  width = 1;
  height = 1;
  /** Smooth-follow target, if any. */
  private target: { x: number; y: number } | null = null;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.width / 2,
      y: (wy - this.y) * this.zoom + this.height / 2,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.width / 2) / this.zoom + this.x,
      y: (sy - this.height / 2) / this.zoom + this.y,
    };
  }

  hexToScreen(h: Axial): { x: number; y: number } {
    const p = axialToPixel(h, HEX_SIZE);
    return this.worldToScreen(p.x, p.y);
  }

  screenToHex(sx: number, sy: number): Axial {
    const w = this.screenToWorld(sx, sy);
    return pixelToAxial(w.x, w.y, HEX_SIZE);
  }

  panBy(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.target = null;
  }

  /** Zoom keeping the screen point (sx, sy) fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.target = null;
  }

  centerOn(h: Axial, immediate = false): void {
    const p = axialToPixel(h, HEX_SIZE);
    if (immediate) {
      this.x = p.x;
      this.y = p.y;
      this.target = null;
    } else {
      this.target = p;
    }
  }

  /** Advance the smooth follow; returns true if still moving. */
  tick(): boolean {
    if (!this.target) return false;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = null;
      return false;
    }
    this.x += dx * 0.18;
    this.y += dy * 0.18;
    return true;
  }
}
