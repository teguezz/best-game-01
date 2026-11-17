// Keyboard and mouse state for the keeper. Movement keys (WASD and arrows) collapse into one
// direction vector; the mouse gives an aim point in the garden's logical coordinates and a
// held button that focus-fires the lantern. One-shot key presses (pause, mute, choosing an
// upgrade) are queued as edges so the main loop can consume each press exactly once.

export class Input {
  constructor(canvas, toLogical) {
    this.canvas = canvas;
    this.toLogical = toLogical;
    this.held = new Set();
    this.edges = [];
    this.dashQueued = false;
    this.mouse = { x: 640, y: 300, down: false, clicked: false };

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.edges.push(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'Space') {
        this.dashQueued = true;
      }
      if (event.code.startsWith('Arrow')) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.dashQueued = false;
      this.mouse.down = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    canvas.addEventListener('pointerdown', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.down = true;
      this.mouse.clicked = true;
    });
    window.addEventListener('pointerup', () => {
      this.mouse.down = false;
    });
  }

  /** The movement direction the held keys ask for, normalised (or the zero vector). */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) y -= 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  /** Take the oldest queued key press edge, or null when none is waiting. */
  takeEdge() {
    return this.edges.length > 0 ? this.edges.shift() : null;
  }

  /** Consume the dash request (Shift or Space pressed since the last step), once per press. */
  takeDash() {
    const was = this.dashQueued;
    this.dashQueued = false;
    return was;
  }

  /** Whether a key is currently held down. */
  isHeld(code) {
    return this.held.has(code);
  }

  /** Consume the mouse click flag (true once per press). */
  takeClick() {
    const was = this.mouse.clicked;
    this.mouse.clicked = false;
    return was;
  }
}
