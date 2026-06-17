import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputController } from './input';

describe('input controller', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears keyboard and virtual movement when the window loses focus', () => {
    const windowTarget = new EventTarget();
    const documentTarget = createDocumentTarget(false);
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const input = new InputController();
    windowTarget.dispatchEvent(keyEvent('keydown', 'KeyD'));
    input.setVirtualMovement({ x: 0, z: 1 });

    expect(input.isPressed('KeyD')).toBe(true);
    expect(input.movement()).toEqual({ x: 0.7071067811865475, z: 0.7071067811865475 });

    windowTarget.dispatchEvent(new Event('blur'));

    expect(input.isPressed('KeyD')).toBe(false);
    expect(input.movement()).toEqual({ x: 0, z: 0 });
    input.dispose();
  });

  it('clears movement when the document becomes hidden', () => {
    const windowTarget = new EventTarget();
    const documentTarget = createDocumentTarget(true);
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const input = new InputController();
    windowTarget.dispatchEvent(keyEvent('keydown', 'ArrowUp'));
    input.setVirtualMovement({ x: 1, z: 0 });

    documentTarget.dispatchEvent(new Event('visibilitychange'));

    expect(input.isPressed('ArrowUp')).toBe(false);
    expect(input.movement()).toEqual({ x: 0, z: 0 });
    input.dispose();
  });
});

function keyEvent(type: 'keydown' | 'keyup', code: string): Event {
  return Object.assign(new Event(type), { code });
}

function createDocumentTarget(hidden: boolean): Document {
  const target = new EventTarget();
  Object.defineProperty(target, 'hidden', { value: hidden, configurable: true });
  return target as Document;
}
