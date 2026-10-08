/**
 * Pointer handling for the map canvas: tap, drag-to-pan, pinch-to-zoom and
 * wheel zoom. Emits high-level callbacks; knows nothing about game rules.
 */
import type { Camera } from './camera';

export interface MapInputHandlers {
  onTap(sx: number, sy: number): void;
  onChange(): void;
}

interface PointerInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

export function attachMapInput(canvas: HTMLCanvasElement, camera: Camera, handlers: MapInputHandlers): void {
  const pointers = new Map<number, PointerInfo>();
  let pinchDist = 0;
  let moved = false;

  const localPos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    canvas.setPointerCapture(e.pointerId);
    const p = localPos(e);
    pointers.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, startTime: performance.now() });
    if (pointers.size === 1) moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      moved = true;
    }
    canvas.classList.add('dragging');
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    const info = pointers.get(e.pointerId);
    if (!info) return;
    const p = localPos(e);
    const dx = p.x - info.x;
    const dy = p.y - info.y;
    info.x = p.x;
    info.y = p.y;
    if (pointers.size === 1) {
      if (!moved && Math.hypot(p.x - info.startX, p.y - info.startY) > 8) moved = true;
      if (moved) {
        camera.panBy(dx, dy);
        handlers.onChange();
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (pinchDist > 0 && d > 0) camera.zoomAt(d / pinchDist, mx, my);
      pinchDist = d;
      // Pan with the pinch midpoint too.
      camera.panBy(dx / 2, dy / 2);
      handlers.onChange();
    }
    e.preventDefault();
  });

  const release = (e: PointerEvent) => {
    const info = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size === 0) canvas.classList.remove('dragging');
    if (!info) return;
    const dt = performance.now() - info.startTime;
    const dist = Math.hypot(info.x - info.startX, info.y - info.startY);
    if (!moved && dist < 10 && dt < 600 && pointers.size === 0) handlers.onTap(info.x, info.y);
    if (pointers.size < 2) pinchDist = 0;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener(
    'wheel',
    (e) => {
      const r = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      camera.zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
      handlers.onChange();
      e.preventDefault();
    },
    { passive: false },
  );

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
