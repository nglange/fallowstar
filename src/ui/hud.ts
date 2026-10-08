/** Overworld HUD: top status bar, party mini-cards, hex info, bottom action bar. */
import { BALANCE } from '../content/balance';
import { ITEMS } from '../content/items';
import { LANDMARKS } from '../content/landmarks';
import { PARTY_CLASSES } from '../content/party';
import { TERRAIN } from '../content/terrain';
import { atHold, canForage, currentDay, daysRemaining, doorBearing, isAfternoon } from '../sim/game';
import { hexEquals, type Axial } from '../sim/hex';
import { hexAt } from '../sim/mapgen';
import type { GameState } from '../sim/types';

export interface HudHandlers {
  onForage(): void;
  onCamp(): void;
  onItems(): void;
  onCenter(): void;
  onMenu(): void;
}

export class Hud {
  private top: HTMLElement;
  private party: HTMLElement;
  private hexInfo: HTMLElement;
  private forageBtn: HTMLButtonElement;
  private campBtn: HTMLButtonElement;
  private itemsBtn: HTMLButtonElement;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.top = el('div', 'hud-top');
    this.party = el('div', 'hud-party');
    this.hexInfo = el('div', 'hex-info');
    const bottom = el('div', 'hud-bottom');
    this.forageBtn = button('Forage', handlers.onForage);
    this.campBtn = button('Camp', handlers.onCamp);
    this.itemsBtn = button('Items', handlers.onItems);
    bottom.append(this.forageBtn, this.campBtn, this.itemsBtn, button('Centre', handlers.onCenter), button('Menu', handlers.onMenu));
    root.append(this.top, this.party, this.hexInfo, bottom);
  }

  render(state: GameState, selected: Axial | null): void {
    const day = currentDay(state);
    const left = daysRemaining(state);
    const rations = state.party.rations;
    const perDay = state.party.members.length * BALANCE.rationsPerMousePerDay;
    const rationDays = Math.floor(rations / perDay);
    const rationClass = rations <= perDay * 2 ? 'crit' : rations <= perDay * 5 ? 'low' : '';
    const leftClass = left <= 5 ? 'critical' : left <= 12 ? 'urgent' : '';
    this.top.innerHTML = `
      <div>
        <div class="day">Day ${day} <span class="sub">· ${isAfternoon(state) ? 'Afternoon' : 'Morning'}</span></div>
        <div class="sub">Early autumn · ${state.doorFound ? 'Door found. Go home.' : atHold(state) ? `The door lies ${doorBearing(state)}` : `Searching ${doorBearing(state)}`}</div>
      </div>
      <div class="stat ${rationClass}" title="Rations (the patrol eats ${perDay} a day)">
        <span>\u{1F330}</span><span class="num">${rations}</span><span class="sub">rations<br>(${rationDays}d)</span>
      </div>
      <div class="daysleft ${leftClass}"><div class="num">${left}</div><div class="sub">days to snow</div></div>`;

    this.party.innerHTML = state.party.members
      .map((m) => {
        const hpPct = Math.round((m.hp / m.maxHp) * 100);
        const hpClass = hpPct <= 25 ? 'crit' : hpPct <= 50 ? 'low' : '';
        return `<div class="mini-mouse">
          <span class="nm">${m.name}</span><span class="bar hp ${hpClass}"><i style="width:${hpPct}%"></i></span>
          <span>${m.hp}/${m.maxHp}${m.famished ? ' <span class="famished">hungry</span>' : ''}</span>
          <span class="bar tp"><i style="width:${Math.round((m.tp / m.maxTp) * 100)}%"></i></span>
        </div>`;
      })
      .join('');

    const look = selected ?? state.pos;
    const hex = hexAt(state.map, look);
    if (hex && hex.revealed) {
      const t = TERRAIN[hex.terrain];
      let title = t.name;
      let desc = t.description;
      if (hexEquals(look, state.map.hold)) {
        title = 'Fallowstar Hold';
        desc = 'Home. Rest, restock, and set out again.';
      } else if (hexEquals(look, state.map.door)) {
        title = 'The Sealed Door';
        desc = state.doorFound ? 'You have found it. Now get home.' : 'Something waits in the grey.';
      } else if (hex.landmark !== undefined) {
        const lm = state.map.landmarks[hex.landmark];
        title = LANDMARKS[lm.id].name;
        desc = lm.visited ? `${t.name}. Visited.` : `${t.name}. Unvisited.`;
      }
      const here = hexEquals(look, state.pos);
      const costText = here ? '' : ` · ${t.passable ? `${t.moveCost / 2} day${t.moveCost === 2 ? '' : 's'} to enter` : 'impassable'}`;
      this.hexInfo.innerHTML = `<b>${title}</b>${here ? ' (here)' : ''}${costText}<br>${desc}`;
      this.hexInfo.classList.remove('hidden');
    } else {
      this.hexInfo.classList.add('hidden');
    }

    const hereHex = hexAt(state.map, state.pos)!;
    const forage = TERRAIN[hereHex.terrain].forage;
    this.forageBtn.disabled = !canForage(state) || state.party.rations >= state.party.maxRations;
    this.forageBtn.innerHTML = forage
      ? `Forage<small>${forage.min}–${forage.max} rations · ½ day</small>`
      : `Forage<small>nothing here</small>`;
    this.campBtn.innerHTML = `Camp<small>+${Math.round(BALANCE.campHeal * 100)}% hp · 1 day</small>`;
    const itemCount = Object.entries(state.party.items)
      .filter(([id, n]) => n > 0 && ITEMS[id as keyof typeof ITEMS].overworld)
      .reduce((s, [, n]) => s + n, 0);
    this.itemsBtn.innerHTML = `Items<small>${itemCount} usable</small>`;
    this.itemsBtn.disabled = itemCount === 0;
  }
}

export function partyTrade(cls: keyof typeof PARTY_CLASSES): string {
  return PARTY_CLASSES[cls].trade;
}

export function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function button(label: string, onClick: () => void, className = 'btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = className;
  b.innerHTML = label;
  b.addEventListener('click', onClick);
  return b;
}
