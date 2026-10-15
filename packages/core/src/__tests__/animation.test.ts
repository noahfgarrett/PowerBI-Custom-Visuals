import { describe, expect, it } from 'vitest';

import { animate, pulseGlow } from '../animation';

describe('animation fallbacks', () => {
  it('completes immediately when requestAnimationFrame is unavailable', () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    let progressValue = 0;
    let completed = false;

    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');

    try {
      const cancel = animate(
        300,
        (t) => t,
        (progress) => {
          progressValue = progress;
        },
        () => {
          completed = true;
        },
      );

      expect(progressValue).toBe(1);
      expect(completed).toBe(true);
      expect(() => cancel()).not.toThrow();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });

  it('falls back to a static glow when requestAnimationFrame is unavailable', () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    const el = document.createElement('div');

    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');

    try {
      const cancel = pulseGlow(el, '#22C55E');
      expect(el.style.boxShadow).toContain('rgba(');
      cancel();
      expect(el.style.boxShadow).toBe('');
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});
