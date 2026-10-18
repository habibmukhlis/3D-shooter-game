import type { GameContext, GameSystem } from '../core/GameContext';

/** Discrete, edge-triggered actions. Keyboard, mouse and touch all funnel into these. */
export type DiscreteAction =
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4'
  | 'weapon5'
  | 'weaponNext'
  | 'weaponPrev'
  | 'reload'
  | 'interact'
  | 'interactRelease'
  | 'nightVision'
  | 'binoculars'
  | 'crouch'
  | 'firePress'
  | 'grenade'
  | 'gadget';

/** Continuous (held) action state sampled every frame. */
export interface ActionState {
  /** -1 (left) .. 1 (right) */
  moveX: number;
  /** -1 (back) .. 1 (forward) */
  moveY: number;
  sprint: boolean;
  jump: boolean;
  fire: boolean;
  aim: boolean;
  /** -1 (left) .. 1 (right) */
  lean: number;
  interact: boolean;
}

const EMPTY_VIRTUAL: ActionState = {
  moveX: 0,
  moveY: 0,
  sprint: false,
  jump: false,
  fire: false,
  aim: false,
  lean: 0,
  interact: false,
};

type ActionListener = (action: DiscreteAction) => void;

/**
 * Unified input layer. Desktop events are captured here; touch controls feed
 * `setVirtual()` / `trigger()` / `addLook()` so gameplay code is device-agnostic.
 */
export class InputSystem implements GameSystem {
  private ctx: GameContext;
  private keys: Record<string, boolean> = {};
  private mouseFire = false;
  private mouseAim = false;
  private virtual: ActionState = { ...EMPTY_VIRTUAL };
  private listeners: ActionListener[] = [];
  private cleanup: (() => void)[] = [];
  private _isPointerLocked = false;
  private readonly state: ActionState = { ...EMPTY_VIRTUAL };

  /** True once any touch input has been seen (lets UI switch layouts). */
  public isTouchActive = false;

  private lastPointerLockExit = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.bindDesktop();
  }

  public get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  public onAction(fn: ActionListener): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Fire a discrete action from any source (keyboard, touch button, gamepad). */
  public trigger(action: DiscreteAction): void {
    if (this.ctx.isPaused || this.ctx.hasEnded) return;
    for (const fn of [...this.listeners]) fn(action);
  }

  /** Touch / virtual controls write their held state here. */
  public setVirtual(partial: Partial<ActionState>): void {
    Object.assign(this.virtual, partial);
    this.isTouchActive = true;
  }

  public resetVirtual(): void {
    this.virtual = { ...EMPTY_VIRTUAL };
  }

  /** Apply a look delta in raw pixels (mouse movement or touch drag). */
  public addLook(dx: number, dy: number, sensitivityScale = 1): void {
    if (this.ctx.isPaused || this.ctx.hasEnded) return;
    const p = this.ctx.player;
    const sens = 0.0022 * this.ctx.settings.mouseSensitivity * sensitivityScale;
    p.yaw -= dx * sens;
    const pitchDelta = dy * sens * (this.ctx.settings.invertY ? 1 : -1);
    p.pitch -= pitchDelta;
    const maxPitch = Math.PI / 2.05;
    p.pitch = Math.max(-maxPitch, Math.min(maxPitch, p.pitch));
  }

  public isKeyDown(code: string): boolean {
    return !!this.keys[code];
  }

  /** Merged keyboard + mouse + virtual state for this frame. */
  public getActions(): ActionState {
    const k = this.keys;
    const v = this.virtual;
    const s = this.state;
    let mx = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
    let my = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0);
    if (Math.abs(v.moveX) > Math.abs(mx)) mx = v.moveX;
    if (Math.abs(v.moveY) > Math.abs(my)) my = v.moveY;
    s.moveX = mx;
    s.moveY = my;
    s.sprint = !!k['ShiftLeft'] || !!k['ShiftRight'] || v.sprint;
    s.jump = !!k['Space'] || v.jump;
    s.fire = this.mouseFire || v.fire;
    s.aim = this.mouseAim || v.aim;
    let lean = (k['KeyE'] ? 1 : 0) - (k['KeyQ'] ? 1 : 0);
    if (Math.abs(v.lean) > Math.abs(lean)) lean = v.lean;
    s.lean = lean;
    // Only KeyF interacts; KeyE is reserved for tactical lean right
    s.interact = !!k['KeyF'] || v.interact;
    return s;
  }

  public update(): void {
    // Event driven; nothing to poll.
  }

  private bindDesktop(): void {
    const canvas = this.ctx.renderer.domElement;

    const onCanvasClick = () => {
      if (!this._isPointerLocked && !this.isTouchActive && !this.ctx.isPaused) {
        const elapsed = performance.now() - this.lastPointerLockExit;
        if (elapsed < 1100) return;
        try {
          const promise = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Gracefully ignore sync pointer lock error
        }
      }
    };
    canvas.addEventListener('click', onCanvasClick);
    this.cleanup.push(() => canvas.removeEventListener('click', onCanvasClick));

    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      this._isPointerLocked = locked;
      if (!locked) {
        this.lastPointerLockExit = performance.now();
        this.mouseFire = false;
        this.mouseAim = false;
      }
    };
    document.addEventListener('pointerlockchange', onLockChange);
    this.cleanup.push(() => document.removeEventListener('pointerlockchange', onLockChange));

    const onLockError = () => {
      this._isPointerLocked = false;
      this.lastPointerLockExit = performance.now();
    };
    document.addEventListener('pointerlockerror', onLockError);
    this.cleanup.push(() => document.removeEventListener('pointerlockerror', onLockError));

    const onMouseMove = (e: MouseEvent) => {
      if (!this._isPointerLocked) return;
      this.addLook(e.movementX, e.movementY);
    };
    document.addEventListener('mousemove', onMouseMove);
    this.cleanup.push(() => document.removeEventListener('mousemove', onMouseMove));

    const onMouseDown = (e: MouseEvent) => {
      if (!this._isPointerLocked) return;
      if (e.button === 0) {
        this.mouseFire = true;
        this.trigger('firePress');
      } else if (e.button === 2) {
        this.mouseAim = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouseFire = false;
      else if (e.button === 2) this.mouseAim = false;
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (!this._isPointerLocked) return;
      this.trigger(e.deltaY > 0 ? 'weaponNext' : 'weaponPrev');
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('wheel', onWheel, { passive: true });
    this.cleanup.push(() => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        this.keys[e.code] = true;
        return;
      }
      this.keys[e.code] = true;
      switch (e.code) {
        case 'Digit1': this.trigger('weapon1'); break;
        case 'Digit2': this.trigger('weapon2'); break;
        case 'Digit3': this.trigger('weapon3'); break;
        case 'Digit4': this.trigger('weapon4'); break;
        case 'Digit5': this.trigger('weapon5'); break;
        case 'KeyR': this.trigger('reload'); break;
        case 'KeyF': this.trigger('interact'); break;
        case 'KeyN': this.trigger('nightVision'); break;
        case 'KeyB': this.trigger('binoculars'); break;
        case 'KeyG': this.trigger('grenade'); break;
        case 'KeyX': this.trigger('gadget'); break;
        case 'ControlLeft':
        case 'KeyC': this.trigger('crouch'); break;
        default: break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyF') this.trigger('interactRelease');
    };
    const onBlur = () => {
      this.keys = {};
      this.mouseFire = false;
      this.mouseAim = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  public dispose(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    this.listeners = [];
  }
}
