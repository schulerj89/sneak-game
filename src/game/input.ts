import type { Vec2 } from './types';

export class InputController {
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  movement(): Vec2 {
    const x = Number(this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) -
      Number(this.pressed.has('KeyA') || this.pressed.has('ArrowLeft'));
    const z = Number(this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) -
      Number(this.pressed.has('KeyW') || this.pressed.has('ArrowUp'));
    const length = Math.hypot(x, z);
    return length > 0 ? { x: x / length, z: z / length } : { x: 0, z: 0 };
  }

  isPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };
}
