/** Modal dialog queue and transient toasts. */

export interface DialogButton {
  label: string;
  primary?: boolean;
  cold?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface DialogSpec {
  title?: string;
  paragraphs: string[];
  gain?: string;
  cold?: boolean;
  buttons?: DialogButton[];
  /** Custom content inserted before the buttons. */
  body?: HTMLElement;
}

export class Dialogs {
  private queue: DialogSpec[] = [];
  private current: HTMLElement | null = null;
  private drainCallbacks: (() => void)[] = [];
  private toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(private root: HTMLElement) {
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    root.appendChild(this.toastEl);
  }

  get open(): boolean {
    return this.current !== null;
  }

  show(spec: DialogSpec): void {
    this.queue.push(spec);
    if (!this.current) this.next();
  }

  /** Run `fn` once no dialogs are open (immediately if none are). */
  then(fn: () => void): void {
    if (!this.current && this.queue.length === 0) fn();
    else this.drainCallbacks.push(fn);
  }

  /** Pressing Enter/Space activates the primary button of the open dialog. */
  activatePrimary(): boolean {
    if (!this.current) return false;
    const btn = this.current.querySelector<HTMLButtonElement>('.btn.primary') ?? this.current.querySelector<HTMLButtonElement>('.btn');
    btn?.click();
    return true;
  }

  private next(): void {
    const spec = this.queue.shift();
    if (!spec) {
      const cbs = this.drainCallbacks;
      this.drainCallbacks = [];
      cbs.forEach((cb) => cb());
      return;
    }
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal' + (spec.cold ? ' cold' : '');
    if (spec.title) {
      const h = document.createElement('h2');
      h.textContent = spec.title;
      modal.appendChild(h);
    }
    for (const p of spec.paragraphs) {
      const el = document.createElement('p');
      el.textContent = p;
      modal.appendChild(el);
    }
    if (spec.gain) {
      const el = document.createElement('p');
      el.className = 'gain';
      el.textContent = spec.gain;
      modal.appendChild(el);
    }
    if (spec.body) modal.appendChild(spec.body);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const buttons = spec.buttons ?? [{ label: 'Continue', primary: true }];
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.cold ? ' cold' : '') + (b.danger ? ' danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        this.close();
        b.onClick?.();
      });
      actions.appendChild(btn);
    }
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    this.root.appendChild(backdrop);
    this.current = backdrop;
  }

  close(): void {
    if (!this.current) return;
    this.current.remove();
    this.current = null;
    this.next();
  }

  hideToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toastEl.classList.remove('show');
  }

  toast(text: string, ms = 2600): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
