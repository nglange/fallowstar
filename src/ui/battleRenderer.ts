/** Draws the battle scene: a terrain-coloured backdrop and the enemies facing the player. */
import { ENEMIES } from '../content/enemies';
import type { EnemyInstance, TerrainId } from '../sim/types';
import { drawEnemy } from './glyphs';
import { PALETTE, TERRAIN_COLORS } from './palette';

export interface EnemyDisplay {
  hp: number;
  /** 0..1 white flash, decays. */
  hurt: number;
  /** Shake offset time. */
  shakeUntil: number;
}

export class BattleRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  width = 1;
  height = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  /** Centre and size of enemy slot i of n. */
  slot(i: number, n: number, id: string): { x: number; y: number; size: number } {
    const W = this.width;
    const H = this.height;
    const slotW = W / n;
    let size = Math.min(H * 0.5, slotW * 0.78, 220);
    if (id === 'snake') size = Math.min(H * 0.72, W * 0.7, 320);
    return { x: slotW * (i + 0.5), y: H * 0.56, size };
  }

  hitTest(enemies: EnemyInstance[], sx: number, sy: number): number | null {
    const n = enemies.length;
    for (let i = 0; i < n; i++) {
      if (enemies[i].hp <= 0) continue;
      const s = this.slot(i, n, enemies[i].id);
      if (Math.abs(sx - s.x) < s.size * 0.5 && Math.abs(sy - s.y) < s.size * 0.6) return i;
    }
    return null;
  }

  draw(
    terrain: TerrainId,
    enemies: EnemyInstance[],
    labels: string[],
    display: EnemyDisplay[],
    target: number | null,
    time: number,
  ): void {
    const { ctx } = this;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const c = TERRAIN_COLORS[terrain];
    const cold = terrain === 'ruin';
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, cold ? '#1a2026' : '#3b281b');
    sky.addColorStop(0.55, cold ? '#2b3540' : '#7a4a28');
    sky.addColorStop(0.56, c.edge);
    sky.addColorStop(1, c.fill);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // horizon haze and a low sun
    if (!cold) {
      ctx.fillStyle = 'rgba(227,184,78,0.35)';
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.22, Math.min(W, H) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    // ground texture stripes
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = H * 0.58 + i * i * H * 0.012;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const n = enemies.length;
    for (let i = 0; i < n; i++) {
      const e = enemies[i];
      const d = display[i];
      const s = this.slot(i, n, e.id);
      const alive = d.hp > 0;
      ctx.save();
      const shake = time < d.shakeUntil ? Math.sin(time / 18) * 6 : 0;
      ctx.translate(s.x + shake, s.y);
      ctx.globalAlpha = alive ? 1 : 0.18;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, s.size * 0.52, s.size * 0.42, s.size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      drawEnemy(ctx, e.id, s.size, time + i * 1000, alive ? d.hurt : 0);
      ctx.restore();

      // target marker
      if (target === i && alive) {
        const bob = Math.sin(time / 180) * 4;
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - s.size * 0.72 + bob);
        ctx.lineTo(s.x + 10, s.y - s.size * 0.72 + bob);
        ctx.lineTo(s.x, s.y - s.size * 0.72 + 14 + bob);
        ctx.closePath();
        ctx.fill();
      }
      // name + hp bar
      ctx.font = `${Math.max(11, Math.min(14, W / 28))}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = alive ? PALETTE.cream : 'rgba(243,231,207,0.4)';
      ctx.fillText(labels[i], s.x, s.y + s.size * 0.62 + 16);
      const bw = Math.min(110, W / n - 16);
      const bx = s.x - bw / 2;
      const by = s.y + s.size * 0.62 + 22;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = PALETTE.ember;
      ctx.fillRect(bx, by, bw * Math.max(0, d.hp / ENEMIES[e.id].hp), 6);
    }
  }
}
