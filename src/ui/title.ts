/** Title screen: continue a saved patrol or start a new one with an optional seed. */
import { TEXT } from '../content/text';
import { drawMouseToken } from './glyphs';
import { button, el } from './hud';
import { hasSave, lastSeed } from './storage';

export interface TitleHandlers {
  onContinue(): void;
  onNew(seed: string): void;
}

export class TitleScreen {
  readonly el: HTMLElement;
  private input: HTMLInputElement;
  private continueBtn: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private raf = 0;

  constructor(root: HTMLElement, handlers: TitleHandlers) {
    this.el = el('div', 'screen');
    this.el.id = 'title';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 360;
    this.canvas.height = 360;
    const h1 = el('h1');
    h1.textContent = TEXT.title;
    const tag = el('p', 'tag');
    tag.textContent = TEXT.subtitle;
    const menu = el('div', 'menu');
    this.continueBtn = button('Continue the patrol', handlers.onContinue, 'btn primary');
    const seedRow = el('div', 'seedrow');
    this.input = document.createElement('input');
    this.input.placeholder = 'seed (optional)';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    const newBtn = button('New patrol', () => handlers.onNew(this.input.value.trim()));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') newBtn.click();
    });
    seedRow.append(this.input, newBtn);
    menu.append(this.continueBtn, seedRow);
    const foot = el('div', 'foot');
    foot.innerHTML =
      'Tap or click a neighbouring hex to move. Drag to pan, pinch or scroll to zoom.<br>Keys: Q E A D Z X move · F forage · R camp · I items · C centre';
    this.el.append(this.canvas, h1, tag, menu, foot);
    root.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.continueBtn.classList.toggle('hidden', !hasSave());
    const seed = lastSeed();
    this.input.value = '';
    this.input.placeholder = seed ? `seed (optional, last: ${seed})` : 'seed (optional)';
    const ctx = this.canvas.getContext('2d')!;
    const loop = (t: number) => {
      ctx.clearRect(0, 0, 360, 360);
      ctx.save();
      ctx.translate(180, 200);
      drawMouseToken(ctx, 150, t);
      ctx.restore();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  hide(): void {
    this.el.classList.add('hidden');
    cancelAnimationFrame(this.raf);
  }
}
