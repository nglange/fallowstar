/**
 * The battle screen: command entry per mouse, then playback of the resolved
 * round's events with simple animation. Dispatches rounds through the handlers
 * it is given; owns no rules.
 */
import { ENEMIES } from '../content/enemies';
import { ITEMS } from '../content/items';
import { PARTY_CLASSES } from '../content/party';
import { TECHNIQUES } from '../content/techniques';
import { fleeChance } from '../sim/battle';
import { isDown } from '../sim/party';
import type { BattleCommand, GameEvent, GameState, ItemId, TechniqueId } from '../sim/types';
import { BattleRenderer, type EnemyDisplay } from './battleRenderer';
import { describeBattle, describeLevelUp, enemyLabel } from './describe';
import { button, el } from './hud';

export interface BattleHandlers {
  round(commands: (BattleCommand | null)[]): { state: GameState; events: GameEvent[] };
  end(): void;
}

type Stage =
  | { kind: 'main' }
  | { kind: 'target'; then: (target: number) => void }
  | { kind: 'ally'; then: (target: number) => void }
  | { kind: 'technique' }
  | { kind: 'item' }
  | { kind: 'playing' }
  | { kind: 'done' };

export class BattleScreen {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: BattleRenderer;
  private partyEl: HTMLElement;
  private logEl: HTMLElement;
  private menuEl: HTMLElement;
  private state!: GameState;
  private display: EnemyDisplay[] = [];
  private partyDisplay: { hp: number; tp: number }[] = [];
  private commands: (BattleCommand | null)[] = [];
  private member = 0;
  private stage: Stage = { kind: 'main' };
  private target: number | null = null;
  private raf = 0;
  private active = false;
  private skip = false;
  private playTimer = 0;

  constructor(root: HTMLElement, private handlers: BattleHandlers) {
    this.el = el('div', 'screen hidden');
    this.el.id = 'battle';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'battle-canvas';
    this.renderer = new BattleRenderer(this.canvas);
    this.partyEl = el('div', 'battle-party');
    this.logEl = el('div', 'battle-log');
    this.menuEl = el('div', 'battle-menu');
    this.el.append(this.canvas, this.partyEl, this.logEl, this.menuEl, el('div', 'spacer'));
    root.appendChild(this.el);

    this.canvas.addEventListener('pointerdown', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const idx = this.renderer.hitTest(this.state.battle!.enemies, e.clientX - r.left, e.clientY - r.top);
      if (this.stage.kind === 'target' && idx !== null) this.stage.then(idx);
      else if (this.stage.kind === 'playing') this.skip = true;
    });
    this.logEl.addEventListener('pointerdown', () => {
      if (this.stage.kind === 'playing') this.skip = true;
    });
    window.addEventListener('resize', () => this.active && this.renderer.resize());
  }

  /** Called when a battle begins. */
  enter(state: GameState): void {
    this.state = state;
    this.el.classList.remove('hidden');
    this.active = true;
    this.renderer.resize();
    const b = state.battle!;
    this.display = b.enemies.map((e) => ({ hp: e.hp, hurt: 0, shakeUntil: 0 }));
    this.partyDisplay = state.party.members.map((m) => ({ hp: m.hp, tp: m.tp }));
    const kinds = [...new Set(b.enemies.map((e) => e.id))];
    const names = kinds.map((k) => {
      const n = b.enemies.filter((e) => e.id === k).length;
      return n === 1 ? `a ${ENEMIES[k].name}` : `${n} ${ENEMIES[k].plural}`;
    });
    this.log(`${names.join(' and ')} ${b.enemies.length === 1 ? 'blocks' : 'block'} the way!`);
    this.beginCommands();
    this.loop();
  }

  leave(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.playTimer);
    this.el.classList.add('hidden');
  }

  /** Keyboard: digits pick menu buttons, Escape goes back. */
  key(e: KeyboardEvent): void {
    if (!this.active) return;
    if (/^[1-9]$/.test(e.key)) {
      const btns = [...this.menuEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      btns[Number(e.key) - 1]?.click();
    } else if (e.key === 'Escape') {
      this.menuEl.querySelector<HTMLButtonElement>('button[data-back]')?.click();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (this.stage.kind === 'playing') this.skip = true;
      else this.menuEl.querySelector<HTMLButtonElement>('.btn.primary')?.click();
    }
  }

  // ----- Command entry --------------------------------------------------------

  private beginCommands(): void {
    this.commands = this.state.party.members.map(() => null);
    this.member = -1;
    this.nextMember();
  }

  private nextMember(): void {
    const members = this.state.party.members;
    let i = this.member + 1;
    while (i < members.length && isDown(members[i])) i++;
    if (i >= members.length) {
      this.submit();
      return;
    }
    this.member = i;
    this.setStage({ kind: 'main' });
  }

  private prevMember(): boolean {
    const members = this.state.party.members;
    let i = this.member - 1;
    while (i >= 0 && isDown(members[i])) i--;
    if (i < 0) return false;
    this.member = i;
    this.commands[i] = null;
    this.setStage({ kind: 'main' });
    return true;
  }

  private setCommand(cmd: BattleCommand): void {
    this.commands[this.member] = cmd;
    if (cmd.kind === 'flee' || (cmd.kind === 'item' && cmd.item === 'smokepod')) {
      this.submit();
      return;
    }
    this.nextMember();
  }

  private setStage(stage: Stage): void {
    this.stage = stage;
    this.target = null;
    this.renderMenu();
    this.renderParty();
  }

  private livingEnemies(): number[] {
    return this.state.battle!.enemies.map((_, i) => i).filter((i) => this.state.battle!.enemies[i].hp > 0);
  }

  private pickEnemy(then: (t: number) => void): void {
    const alive = this.livingEnemies();
    if (alive.length === 1) then(alive[0]);
    else this.setStage({ kind: 'target', then });
  }

  private pickAlly(then: (t: number) => void): void {
    this.setStage({ kind: 'ally', then });
  }

  private renderMenu(): void {
    const menu = this.menuEl;
    menu.innerHTML = '';
    const m = this.state.party.members[this.member];
    const prompt = (text: string) => {
      const p = el('div', 'prompt');
      p.textContent = text;
      menu.appendChild(p);
    };
    const back = (fn: () => void) => {
      const b = button('Back', fn);
      b.dataset.back = '1';
      menu.appendChild(b);
    };
    switch (this.stage.kind) {
      case 'main': {
        prompt(`${m.name} the ${PARTY_CLASSES[m.cls].trade}: what now?`);
        menu.appendChild(button('Attack', () => this.pickEnemy((t) => this.setCommand({ kind: 'attack', target: t }))));
        menu.appendChild(button(`Technique<small>${m.tp}/${m.maxTp} tp</small>`, () => this.setStage({ kind: 'technique' })));
        const itemCount = Object.values(this.state.party.items).reduce((s, n) => s + n, 0);
        const itemBtn = button(`Item<small>${itemCount} carried</small>`, () => this.setStage({ kind: 'item' }));
        itemBtn.disabled = itemCount === 0;
        menu.appendChild(itemBtn);
        menu.appendChild(button('Defend<small>half damage</small>', () => this.setCommand({ kind: 'defend' })));
        const pct = Math.round(fleeChance(this.state) * 100);
        menu.appendChild(button(`Flee<small>${pct}% · whole patrol</small>`, () => this.setCommand({ kind: 'flee' }), 'btn cold'));
        if (this.member > 0) {
          const b = button('Back', () => this.prevMember());
          b.dataset.back = '1';
          menu.appendChild(b);
        }
        break;
      }
      case 'target': {
        const then = this.stage.then;
        prompt(`${m.name}: which target? (or tap it)`);
        for (const i of this.livingEnemies()) {
          const e = this.state.battle!.enemies[i];
          const b = button(`${enemyLabel(this.state, i)}<small>${this.display[i].hp}/${e.maxHp}</small>`, () => then(i));
          b.addEventListener('pointerenter', () => (this.target = i));
          menu.appendChild(b);
        }
        back(() => this.setStage({ kind: 'main' }));
        break;
      }
      case 'ally': {
        const then = this.stage.then;
        prompt(`${m.name}: on whom?`);
        this.state.party.members.forEach((a, i) => {
          if (isDown(a)) return;
          menu.appendChild(button(`${a.name}<small>${a.hp}/${a.maxHp} hp · ${a.tp}/${a.maxTp} tp</small>`, () => then(i)));
        });
        back(() => this.setStage({ kind: 'main' }));
        break;
      }
      case 'technique': {
        prompt(`${m.name}: which technique? (${m.tp} tp)`);
        for (const id of m.techniques) {
          const t = TECHNIQUES[id as TechniqueId];
          const b = button(`${t.name}<small>${t.cost} tp · ${shortTech(id)}</small>`, () => {
            const cmd = (target?: number): BattleCommand => ({ kind: 'technique', technique: id as TechniqueId, target });
            if (t.target === 'enemy') this.pickEnemy((tg) => this.setCommand(cmd(tg)));
            else if (t.target === 'ally') this.pickAlly((tg) => this.setCommand(cmd(tg)));
            else this.setCommand(cmd());
          });
          b.title = t.description;
          b.disabled = m.tp < t.cost;
          menu.appendChild(b);
        }
        back(() => this.setStage({ kind: 'main' }));
        break;
      }
      case 'item': {
        prompt(`${m.name}: which item?`);
        for (const [id, n] of Object.entries(this.state.party.items) as [ItemId, number][]) {
          if (n <= 0) continue;
          const it = ITEMS[id];
          const b = button(`${it.name}<small>×${n} · ${shortItem(id)}</small>`, () => {
            if (it.effect === 'flee') this.setCommand({ kind: 'item', item: id });
            else this.pickAlly((tg) => this.setCommand({ kind: 'item', item: id, target: tg }));
          });
          b.title = it.description;
          menu.appendChild(b);
        }
        back(() => this.setStage({ kind: 'main' }));
        break;
      }
      case 'playing': {
        const b = button('▶ Skip', () => (this.skip = true), 'btn wide');
        menu.appendChild(b);
        break;
      }
      case 'done': {
        const phase = this.state.battle!.phase;
        const label = phase === 'victory' ? 'Carry on' : phase === 'fled' ? 'Keep moving' : 'Continue';
        menu.appendChild(button(label, () => this.handlers.end(), 'btn primary wide'));
        break;
      }
    }
  }

  private renderParty(): void {
    this.partyEl.innerHTML = this.state.party.members
      .map((m, i) => {
        const d = this.partyDisplay[i];
        const hpPct = Math.max(0, Math.round((d.hp / m.maxHp) * 100));
        const hpClass = hpPct <= 25 ? 'crit' : hpPct <= 50 ? 'low' : '';
        const active = this.stage.kind !== 'playing' && this.stage.kind !== 'done' && i === this.member;
        const cmd = this.commands[i];
        const chosen = cmd ? ` · ${commandLabel(cmd)}` : '';
        return `<div class="pcard ${active ? 'active' : ''} ${d.hp <= 0 ? 'down' : ''}">
          <div class="nm"><span>${m.name}</span><small>${PARTY_CLASSES[m.cls].trade}${m.famished ? ' · hungry' : ''}</small></div>
          <div class="bar hp ${hpClass}"><i style="width:${hpPct}%"></i></div>
          <div class="bar tp"><i style="width:${Math.round((d.tp / m.maxTp) * 100)}%"></i></div>
          <div class="vals"><span>${d.hp}/${m.maxHp} hp</span><span>${d.tp}/${m.maxTp} tp</span></div>
          <div class="vals"><span>${d.hp <= 0 ? 'down' : active ? 'choosing…' : chosen ? chosen.slice(3) : ''}</span></div>
        </div>`;
      })
      .join('');
  }

  private log(text: string): void {
    this.logEl.textContent = text;
  }

  // ----- Playback -------------------------------------------------------------

  private submit(): void {
    this.setStage({ kind: 'playing' });
    const res = this.handlers.round(this.commands);
    this.state = res.state;
    this.skip = false;
    this.play(res.events, 0);
  }

  private play(events: GameEvent[], i: number): void {
    if (i >= events.length) {
      this.finishPlayback();
      return;
    }
    const ev = events[i];
    let delay = 850;
    if (ev.type === 'battle') {
      const be = ev.event;
      this.log(describeBattle(this.state, be));
      if (be.type === 'roundStart') delay = 350;
      if (be.type === 'attack') {
        if (be.target.side === 'enemy') {
          const d = this.display[be.target.index];
          d.hp = Math.max(0, d.hp - be.damage);
          d.hurt = 1;
          d.shakeUntil = performance.now() + 220;
        } else {
          const p = this.partyDisplay[be.target.index];
          p.hp = Math.max(0, p.hp - be.damage);
          this.el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
        }
      } else if (be.type === 'technique') {
        if (be.actor.side === 'party') {
          const m = this.state.party.members[be.actor.index];
          this.partyDisplay[be.actor.index].tp = m.tp;
        }
        for (const r of be.results) {
          if (r.target.side === 'enemy') {
            const d = this.display[r.target.index];
            d.hp = Math.max(0, d.hp - r.amount);
            d.hurt = 1;
            d.shakeUntil = performance.now() + 220;
          } else if (TECHNIQUES[be.technique].kind === 'heal') {
            const p = this.partyDisplay[r.target.index];
            p.hp = Math.min(this.state.party.members[r.target.index].maxHp, p.hp + r.amount);
          }
        }
      } else if (be.type === 'item') {
        const p = this.partyDisplay[be.target.index];
        const it = ITEMS[be.item];
        if (it.effect === 'heal') p.hp = Math.min(this.state.party.members[be.target.index].maxHp, p.hp + be.amount);
        if (it.effect === 'tp') p.tp = Math.min(this.state.party.members[be.target.index].maxTp, p.tp + be.amount);
      } else if (be.type === 'victory' || be.type === 'defeat' || be.type === 'fled') {
        delay = 1200;
      }
    } else if (ev.type === 'levelUp') {
      this.log(describeLevelUp(this.state, ev.member, ev.level));
      delay = 1100;
    } else if (ev.type === 'ended') {
      delay = 0;
    } else {
      delay = 0;
    }
    this.renderParty();
    const wait = this.skip ? Math.min(delay, 120) : delay;
    this.playTimer = window.setTimeout(() => this.play(events, i + 1), wait);
  }

  private finishPlayback(): void {
    const b = this.state.battle!;
    // Sync display to truth.
    b.enemies.forEach((e, i) => (this.display[i].hp = e.hp));
    this.state.party.members.forEach((m, i) => {
      this.partyDisplay[i].hp = m.hp;
      this.partyDisplay[i].tp = m.tp;
    });
    if (b.phase === 'command') {
      this.beginCommands();
    } else {
      if (b.phase === 'victory') this.log(`${this.logEl.textContent} The way is clear.`);
      this.setStage({ kind: 'done' });
    }
  }

  // ----- Render loop ------------------------------------------------------------

  private loop = (): void => {
    if (!this.active) return;
    const now = performance.now();
    for (const d of this.display) d.hurt = Math.max(0, d.hurt - 0.06);
    const b = this.state.battle;
    if (b) {
      const labels = b.enemies.map((_, i) => enemyLabel(this.state, i));
      const target = this.stage.kind === 'target' ? this.target : null;
      this.renderer.draw(b.terrain, b.enemies, labels, this.display, target, now);
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}

function shortTech(id: TechniqueId): string {
  const t = TECHNIQUES[id];
  if (t.kind === 'damage') return t.target === 'enemies' ? 'hits all' : t.ignoreDefense ? 'pierces armour' : 'heavy blow';
  if (t.kind === 'heal') return t.target === 'party' ? 'heals all' : 'heals one';
  return 'party defence';
}

function shortItem(id: ItemId): string {
  const it = ITEMS[id];
  return it.effect === 'heal' ? `heals ${it.power}` : it.effect === 'tp' ? `+${it.power} tp` : 'escape';
}

function commandLabel(cmd: BattleCommand): string {
  switch (cmd.kind) {
    case 'attack':
      return 'Attack';
    case 'technique':
      return TECHNIQUES[cmd.technique].name;
    case 'item':
      return ITEMS[cmd.item].name;
    case 'defend':
      return 'Defend';
    case 'flee':
      return 'Flee';
  }
}
