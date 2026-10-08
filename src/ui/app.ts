/**
 * Application shell. Owns the GameState, routes player input to simulation
 * actions, narrates the resulting events, and switches screens. This is the
 * only place that calls `step`.
 */
import { ITEMS } from '../content/items';
import { LANDMARKS } from '../content/landmarks';
import { TEXT } from '../content/text';
import { doorBearing, newGame, step } from '../sim/game';
import { HEX_DIRECTIONS, hexAdd, hexAdjacent, type Axial } from '../sim/hex';
import { hexAt, isPassable } from '../sim/mapgen';
import type { Action, GameEvent, GameState, ItemId } from '../sim/types';
import { BattleScreen } from './battleScreen';
import { Camera } from './camera';
import { Dialogs } from './dialogs';
import { toastFor } from './describe';
import { EndScreen } from './endScreen';
import { button, el, Hud } from './hud';
import { attachMapInput } from './input';
import { MapRenderer } from './mapRenderer';
import { clearSave, loadGame, randomSeed, saveGame } from './storage';
import { TitleScreen } from './title';

export class App {
  private state: GameState | null = null;
  private world: HTMLElement;
  private canvas: HTMLCanvasElement;
  private camera = new Camera();
  private renderer: MapRenderer;
  private hud: Hud;
  private dialogs: Dialogs;
  private title: TitleScreen;
  private battle: BattleScreen;
  private end: EndScreen;
  private screen: 'title' | 'world' | 'battle' | 'end' = 'title';

  constructor(root: HTMLElement) {
    // Overworld
    this.world = el('div', 'screen hidden');
    this.world.id = 'world';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'map-canvas';
    this.world.appendChild(this.canvas);
    this.renderer = new MapRenderer(this.canvas, this.camera);
    this.hud = new Hud(this.world, {
      onForage: () => this.dispatch({ type: 'forage' }),
      onCamp: () => this.confirmCamp(),
      onItems: () => this.showItems(),
      onCenter: () => this.state && this.camera.centerOn(this.state.pos),
      onMenu: () => this.showMenu(),
    });
    root.appendChild(this.world);
    attachMapInput(this.canvas, this.camera, {
      onTap: (x, y) => this.tap(x, y),
      onChange: () => {},
    });

    this.battle = new BattleScreen(root, {
      round: (commands) => {
        const res = step(this.state!, { type: 'battleRound', commands });
        this.state = res.state;
        saveGame(this.state);
        return res;
      },
      end: () => this.leaveBattle(),
    });
    this.end = new EndScreen(root, {
      onTitle: () => this.showTitle(),
      onRetry: (seed) => this.startNew(seed),
    });
    this.title = new TitleScreen(root, {
      onContinue: () => this.continueGame(),
      onNew: (seed) => this.startNew(seed || randomSeed()),
    });
    this.dialogs = new Dialogs(root);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.key(e));
    this.resize();
    this.showTitle();
    this.loop(0);
  }

  // ----- Screens ----------------------------------------------------------------

  private showTitle(): void {
    this.screen = 'title';
    this.dialogs.hideToast();
    this.world.classList.add('hidden');
    this.battle.leave();
    this.end.hide();
    this.title.show();
  }

  private showWorld(): void {
    this.screen = 'world';
    this.title.hide();
    this.battle.leave();
    this.end.hide();
    this.world.classList.remove('hidden');
    this.resize();
  }

  private continueGame(): void {
    const s = loadGame();
    if (!s) return this.showTitle();
    this.state = s;
    if (s.mode === 'won' || s.mode === 'lost') {
      this.showEnd();
    } else if (s.mode === 'battle') {
      this.showWorld();
      this.camera.centerOn(s.pos, true);
      this.enterBattle();
    } else {
      this.showWorld();
      this.camera.centerOn(s.pos, true);
      this.renderer.selected = null;
      this.hud.render(s, null);
      this.dialogs.toast(`Seed: ${s.seed}`);
    }
  }

  private startNew(seed: string): void {
    this.state = newGame(seed);
    saveGame(this.state);
    this.showWorld();
    this.camera.zoom = Math.min(1.4, Math.max(0.8, this.camera.width / 420));
    this.camera.centerOn(this.state.pos, true);
    this.renderer.selected = null;
    this.hud.render(this.state, null);
    this.dialogs.show({
      title: 'Before the snow',
      paragraphs: [...TEXT.intro, TEXT.elders.replace('{bearing}', doorBearing(this.state))],
      gain: `Seed: ${seed}`,
      buttons: [{ label: 'Set out', primary: true }],
    });
  }

  private showEnd(): void {
    this.screen = 'end';
    this.dialogs.hideToast();
    this.world.classList.add('hidden');
    this.battle.leave();
    this.title.hide();
    this.end.show(this.state!);
    clearSave();
  }

  private enterBattle(): void {
    this.screen = 'battle';
    this.dialogs.hideToast();
    this.world.classList.add('hidden');
    this.battle.enter(this.state!);
  }

  private leaveBattle(): void {
    const res = step(this.state!, { type: 'endBattle' });
    this.state = res.state;
    saveGame(this.state);
    if (this.state.mode === 'lost' || this.state.mode === 'won') {
      this.showEnd();
      return;
    }
    this.showWorld();
    this.hud.render(this.state, this.renderer.selected);
    this.camera.centerOn(this.state.pos);
  }

  // ----- Dispatch ---------------------------------------------------------------

  private dispatch(action: Action): void {
    if (!this.state || this.screen !== 'world' || this.dialogs.open) return;
    const res = step(this.state, action);
    this.state = res.state;
    saveGame(this.state);
    this.handleEvents(res.events);
    this.hud.render(this.state, this.renderer.selected);
  }

  private handleEvents(events: GameEvent[]): void {
    const state = this.state!;
    let encounter = false;
    let ended = false;
    for (const ev of events) {
      switch (ev.type) {
        case 'moved':
          this.camera.centerOn(ev.to);
          this.renderer.selected = null;
          break;
        case 'landmark': {
          const def = LANDMARKS[ev.landmark];
          this.dialogs.show({
            title: def.name,
            paragraphs: [ev.first ? def.first : def.again],
            gain: ev.gained,
          });
          break;
        }
        case 'doorFound':
          this.dialogs.show({
            title: 'The Sealed Door',
            paragraphs: [...TEXT.door],
            cold: true,
            buttons: [{ label: 'Home, before the snow', primary: true, cold: true }],
          });
          break;
        case 'hold':
          if (!ev.firstReturnWithDoor) {
            this.dialogs.show({ title: 'Fallowstar Hold', paragraphs: [TEXT.holdReturn], gain: 'Healed, fed, restocked. The clock still runs.' });
          }
          break;
        case 'encounter':
          encounter = true;
          break;
        case 'ended':
          ended = true;
          break;
        case 'dayPassed':
          break;
        default: {
          const t = toastFor(state, ev);
          if (t) this.dialogs.toast(t, ev.type === 'starving' ? 4000 : 2600);
        }
      }
    }
    if (encounter) this.dialogs.then(() => this.enterBattle());
    else if (ended) this.dialogs.then(() => this.showEnd());
  }

  // ----- Input --------------------------------------------------------------------

  private tap(sx: number, sy: number): void {
    if (!this.state || this.screen !== 'world' || this.dialogs.open) return;
    const h = this.camera.screenToHex(sx, sy);
    const hex = hexAt(this.state.map, h);
    if (!hex) return;
    if (hexAdjacent(this.state.pos, h) && isPassable(this.state.map, h)) {
      this.dispatch({ type: 'move', to: h });
    } else if (hex.revealed) {
      this.renderer.selected = h;
      this.hud.render(this.state, h);
    }
  }

  private tryMove(dir: Axial): void {
    if (!this.state) return;
    const to = hexAdd(this.state.pos, dir);
    if (isPassable(this.state.map, to)) this.dispatch({ type: 'move', to });
    else this.dialogs.toast('No way through there.');
  }

  private key(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return;
    if (this.dialogs.open) {
      if (e.key === 'Enter' || e.key === ' ') {
        this.dialogs.activatePrimary();
        e.preventDefault();
      }
      return;
    }
    if (this.screen === 'battle') return this.battle.key(e);
    if (this.screen !== 'world') return;
    // Pointy-top directions: E, NE, NW, W, SW, SE.
    const dirs: Record<string, number> = { d: 0, e: 1, q: 2, a: 3, z: 4, x: 5, arrowright: 0, arrowleft: 3 };
    const k = e.key.toLowerCase();
    if (k in dirs) {
      this.tryMove(HEX_DIRECTIONS[dirs[k]]);
    } else if (k === 'arrowup') {
      this.tryMove(HEX_DIRECTIONS[e.shiftKey ? 2 : 1]);
    } else if (k === 'arrowdown') {
      this.tryMove(HEX_DIRECTIONS[e.shiftKey ? 4 : 5]);
    } else if (k === 'f') {
      this.dispatch({ type: 'forage' });
    } else if (k === 'r') {
      this.confirmCamp();
    } else if (k === 'i') {
      this.showItems();
    } else if (k === 'c') {
      if (this.state) this.camera.centerOn(this.state.pos);
    } else if (k === '+' || k === '=') {
      this.camera.zoomAt(1.2, this.camera.width / 2, this.camera.height / 2);
    } else if (k === '-') {
      this.camera.zoomAt(1 / 1.2, this.camera.width / 2, this.camera.height / 2);
    } else if (k === 'escape') {
      this.showMenu();
    }
  }

  // ----- Overworld dialogs ----------------------------------------------------------

  private confirmCamp(): void {
    if (!this.state || this.dialogs.open) return;
    this.dialogs.show({
      title: 'Camp for the day?',
      paragraphs: ['The patrol rests a full day, mends some wounds and recovers some strength. Hungry mice do not mend. Something may find you in the night.'],
      buttons: [
        { label: 'Camp', primary: true, onClick: () => this.dispatch({ type: 'camp' }) },
        { label: 'Not now' },
      ],
    });
  }

  private showItems(): void {
    if (!this.state || this.dialogs.open) return;
    const items = (Object.entries(this.state.party.items) as [ItemId, number][]).filter(
      ([id, n]) => n > 0 && ITEMS[id].overworld,
    );
    if (items.length === 0) return this.dialogs.toast('Nothing usable in the pouches.');
    const list = el('div', 'list');
    for (const [id, n] of items) {
      const it = ITEMS[id];
      list.appendChild(
        button(`<span class="row"><span>${it.name} ×${n}</span><span>${it.effect === 'heal' ? `heals ${it.power}` : `+${it.power} tp`}</span></span><small>${it.description}</small>`, () => {
          this.dialogs.close();
          this.pickMember(id);
        }),
      );
    }
    this.dialogs.show({ title: 'Pouches', paragraphs: [], body: list, buttons: [{ label: 'Close' }] });
  }

  private pickMember(item: ItemId): void {
    const list = el('div', 'list');
    this.state!.party.members.forEach((m, i) => {
      list.appendChild(
        button(`<span class="row"><span>${m.name}</span><span>${m.hp}/${m.maxHp} hp · ${m.tp}/${m.maxTp} tp</span></span>`, () => {
          this.dialogs.close();
          this.dispatch({ type: 'useItem', item, target: i });
        }),
      );
    });
    this.dialogs.show({ title: `Use ${ITEMS[item].name} on`, paragraphs: [], body: list, buttons: [{ label: 'Cancel' }] });
  }

  private showMenu(): void {
    if (!this.state || this.dialogs.open) return;
    const s = this.state;
    this.dialogs.show({
      title: 'Fallowstar',
      paragraphs: [
        `Seed: ${s.seed}. ${TEXT.elders.replace('{bearing}', doorBearing(s))}`,
        'Find a sealed door of the old builders and return to the hold before the snow. Each move costs time by terrain; the patrol eats three rations a day. Forage on green ground, camp to mend, and go home to restock.',
        'Move: tap a neighbouring hex, or Q E A D Z X. F forage, R camp, I items, C centre. Progress is saved automatically.',
      ],
      buttons: [
        { label: 'Back to the map', primary: true },
        { label: 'Quit to title', onClick: () => this.showTitle() },
        {
          label: 'Abandon patrol',
          danger: true,
          onClick: () =>
            this.dialogs.show({
              title: 'Abandon this patrol?',
              paragraphs: ['The saved game will be erased.'],
              buttons: [
                { label: 'Abandon', danger: true, onClick: () => { clearSave(); this.state = null; this.showTitle(); } },
                { label: 'Keep going', primary: true },
              ],
            }),
        },
      ],
    });
  }

  // ----- Loop -------------------------------------------------------------------------

  private resize(): void {
    if (this.screen === 'world') this.renderer.resize();
  }

  private loop = (t: number): void => {
    if (this.screen === 'world' && this.state) {
      this.camera.tick();
      // Always redraw: the token bobs and the move targets pulse. Cheap enough.
      this.renderer.draw(this.state, t);
    }
    requestAnimationFrame(this.loop);
  };
}
