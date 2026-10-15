import { describe, expect, it } from 'vitest';
import { applyCardStyle } from '../card-style';

describe('card-style', () => {
  it('applies a stronger elevated treatment', () => {
    const element = document.createElement('div');

    applyCardStyle(element, {
      mode: 'elevated',
      colorMode: 'light',
      opacity: 0.9,
      borderRadius: 18,
    });

    expect(element.style.boxShadow).toContain('0 42px 96px');
    expect(element.style.boxShadow).toContain('inset 0 1px 0');
    expect(element.style.border).toContain('rgba');
    expect(element.style.borderRadius).toBe('18px');
  });

  it('applies an inset neumorphic treatment', () => {
    const element = document.createElement('div');

    applyCardStyle(element, {
      mode: 'neumorphic',
      colorMode: 'light',
      opacity: 0.94,
    });

    expect(element.style.boxShadow).toContain('inset 12px 12px 24px');
    expect(element.style.boxShadow).toContain('inset -12px -12px 24px');
    expect(element.style.border).toContain('rgba');
  });

  it('supports outlined and floating presets', () => {
    const outlined = document.createElement('div');
    const floating = document.createElement('div');

    applyCardStyle(outlined, {
      mode: 'outlined',
      colorMode: 'light',
    });
    applyCardStyle(floating, {
      mode: 'floating',
      colorMode: 'dark',
    });

    expect(outlined.style.boxShadow).toContain('0 0 0 1px');
    expect(floating.style.boxShadow).toContain('0 78px 156px');
    expect(outlined.style.border).toContain('rgba');
    expect(floating.style.border).toContain('rgba');
  });

  it('clears glass styling when switching to none', () => {
    const element = document.createElement('div');

    applyCardStyle(element, {
      mode: 'glass',
      colorMode: 'light',
    });
    expect(element.querySelector('.pbi-glass-backdrop')).not.toBeNull();

    applyCardStyle(element, {
      mode: 'none',
      colorMode: 'light',
    });

    expect(element.querySelector('.pbi-glass-backdrop')).toBeNull();
    expect(element.style.background).toBe('');
    expect(element.style.border).toBe('');
    expect(element.style.boxShadow).toBe('');
  });
});
