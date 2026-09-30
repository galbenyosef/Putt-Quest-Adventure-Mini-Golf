// Mouse / keyboard input with pointer-lock (falls back to plain mouse movement when the lock is unavailable).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.locked = false;
    this.lockFailed = false;
    this.lockErrors = 0;
    this.dx = 0;
    this.dy = 0;
    this.down = false; // primary button held
    this.pressedEdge = false;
    this.releasedEdge = false;
    this.cancelEdge = false;
    this.downY = 0;
    this.curY = 0;
    this.keys = new Set();
    this.onKey = null;
    this.onLockChange = null;
    this.enabled = true;

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
      this.curY = e.clientY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) {
        if (!this.locked && !this.lockFailed) this.requestLock();
        this.down = true;
        this.pressedEdge = true;
        this.downY = e.clientY;
      } else if (e.button === 2) this.cancelEdge = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.down) {
        this.down = false;
        this.releasedEdge = true;
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        this.keys.add(e.code);
        return;
      }
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (this.down) {
        this.down = false;
        this.cancelEdge = true;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.lockErrors = 0;
        this.lockFailed = false;
      }
      if (was !== this.locked && this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      // Chrome refuses a re-lock right after Esc; only give up on pointer lock after repeated failures
      this.lockErrors++;
      if (this.lockErrors >= 3) this.lockFailed = true;
    });
  }

  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) {
      if (!this.canvas.requestPointerLock) this.lockFailed = true;
      return;
    }
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      this.lockFailed = true;
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  takeDelta() {
    const d = { x: this.dx, y: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
  takeEdges() {
    const e = { pressed: this.pressedEdge, released: this.releasedEdge, cancel: this.cancelEdge };
    this.pressedEdge = this.releasedEdge = this.cancelEdge = false;
    return e;
  }
  clearEdges() {
    this.pressedEdge = this.releasedEdge = this.cancelEdge = false;
    this.dx = this.dy = 0;
  }
}
