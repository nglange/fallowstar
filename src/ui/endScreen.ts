/** Win/loss screen. */
import { TEXT } from '../content/text';
import { currentDay } from '../sim/game';
import type { GameState } from '../sim/types';
import { button, el } from './hud';

export interface EndHandlers {
  onTitle(): void;
  onRetry(seed: string): void;
}

export class EndScreen {
  readonly el: HTMLElement;

  constructor(root: HTMLElement, private handlers: EndHandlers) {
    this.el = el('div', 'screen hidden');
    this.el.id = 'end';
    root.appendChild(this.el);
  }

  show(state: GameState): void {
    const o = state.outcome!;
    this.el.className = `screen ${o.result}`;
    this.el.innerHTML = '';
    const h1 = el('h1');
    const paras: readonly string[] =
      o.result === 'won'
        ? TEXT.win
        : o.reason === 'winter'
          ? TEXT.lossWinter
          : o.reason === 'starved'
            ? TEXT.lossStarved
            : TEXT.lossFallen;
    h1.textContent =
      o.result === 'won'
        ? `Home, with ${o.daysToSpare} day${o.daysToSpare === 1 ? '' : 's'} to spare`
        : o.reason === 'winter'
          ? 'First snow'
          : o.reason === 'starved'
            ? 'The pouches ran empty'
            : 'The patrol has fallen';
    this.el.appendChild(h1);
    for (const p of paras) {
      const e = el('p');
      e.textContent = p;
      this.el.appendChild(e);
    }
    const stats = el('div', 'stats');
    stats.innerHTML = `Seed <b>${state.seed}</b> · Day ${currentDay(state)} · ${state.stats.hexesCharted} hexes charted · ${state.stats.battles} battles (${state.stats.fled} fled) · ${state.stats.forages} forages · ${state.stats.sorties} return${state.stats.sorties === 1 ? '' : 's'} to the hold`;
    this.el.appendChild(stats);
    const row = el('div', 'menu');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.append(
      button('Same seed again', () => this.handlers.onRetry(state.seed), 'btn'),
      button('New patrol', () => this.handlers.onTitle(), 'btn primary'),
    );
    this.el.appendChild(row);
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
