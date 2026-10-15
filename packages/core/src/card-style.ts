/**
 * Unified card-style system.
 *
 * Provides Glass, Elevated, Neumorphic, and additional report-safe
 * card styles with a single
 * `applyCardStyle` entry point.  The glass branch delegates to the
 * existing layered-backdrop approach in glass.ts; the remaining
 * presets are shadow-only (no backdrop-filter) for maximum crispness
 * and zero GPU compositing overhead.
 */

import { type ColorMode } from './colors';
import { applyGlassStyle, type GlassStyleOptions } from './glass';

// ── Types ──────────────────────────────────────────────────────────

export type CardStyleMode =
  | 'none'
  | 'glass'
  | 'elevated'
  | 'neumorphic'
  | 'outlined'
  | 'floating';

export interface CardStyleOptions {
  mode: CardStyleMode;
  colorMode?: ColorMode;
  /** Background opacity (0–1). */
  opacity?: number;
  /** Optional background color override (hex or rgb/rgba). */
  backgroundColor?: string;
  /** Border radius in px. Default: 12 */
  borderRadius?: number;
}

// ── Elevated ───────────────────────────────────────────────────────

interface CardCssResult {
  background: string;
  border: string;
  boxShadow: string;
  borderRadius: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function getElevatedStyle(options: CardStyleOptions): CardCssResult {
  const {
    colorMode = 'light',
    opacity = 0.92,
    borderRadius = 12,
  } = options;

  const isLight = colorMode === 'light';
  const base = parseColor(
    options.backgroundColor,
    isLight ? { r: 255, g: 255, b: 255 } : { r: 31, g: 35, b: 45 },
  );
  const background = [
    `linear-gradient(180deg, ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, isLight ? 0.22 : 0.08), clamp01(opacity + 0.03))} 0%, ${toRgba(mixColor(base, { r: 15, g: 23, b: 42 }, isLight ? 0.04 : 0.12), opacity)} 100%)`,
    toRgba(base, opacity),
  ].join(', ');

  const border = isLight
    ? `1px solid ${toRgba(mixColor(base, { r: 15, g: 23, b: 42 }, 0.12), 0.16)}`
    : `1px solid ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, 0.35), 0.12)}`;

  const boxShadow = isLight
    ? [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.78)}`,
        `0 10px 24px ${toRgba({ r: 15, g: 23, b: 42 }, 0.12)}`,
        `0 24px 56px ${toRgba({ r: 15, g: 23, b: 42 }, 0.12)}`,
        `0 42px 96px ${toRgba({ r: 15, g: 23, b: 42 }, 0.08)}`,
      ].join(', ')
    : [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.08)}`,
        `0 12px 28px ${toRgba({ r: 0, g: 0, b: 0 }, 0.34)}`,
        `0 28px 64px ${toRgba({ r: 0, g: 0, b: 0 }, 0.30)}`,
        `0 48px 110px ${toRgba({ r: 0, g: 0, b: 0 }, 0.22)}`,
      ].join(', ');

  return {
    background,
    border,
    boxShadow,
    borderRadius: `${borderRadius}px`,
  };
}

// ── Neumorphic ─────────────────────────────────────────────────────

function getNeumorphicStyle(options: CardStyleOptions): CardCssResult {
  const {
    colorMode = 'light',
    opacity = 0.92,
    borderRadius = 12,
  } = options;

  const isLight = colorMode === 'light';
  const base = parseColor(
    options.backgroundColor,
    isLight ? { r: 232, g: 238, b: 245 } : { r: 35, g: 39, b: 49 },
  );
  const background = [
    `linear-gradient(145deg, ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, isLight ? 0.20 : 0.06), clamp01(opacity + 0.02))} 0%, ${toRgba(mixColor(base, { r: 15, g: 23, b: 42 }, isLight ? 0.07 : 0.12), opacity)} 100%)`,
    toRgba(base, opacity),
  ].join(', ');

  const border = isLight
    ? `1px solid ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, 0.55), 0.72)}`
    : `1px solid ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, 0.18), 0.10)}`;

  const boxShadow = isLight
    ? [
        `inset 12px 12px 24px ${toRgba(mixColor(base, { r: 148, g: 163, b: 184 }, 0.65), 0.50)}`,
        `inset -12px -12px 24px ${toRgba({ r: 255, g: 255, b: 255 }, 0.92)}`,
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.58)}`,
      ].join(', ')
    : [
        `inset 12px 12px 24px ${toRgba({ r: 0, g: 0, b: 0 }, 0.46)}`,
        `inset -12px -12px 24px ${toRgba({ r: 255, g: 255, b: 255 }, 0.06)}`,
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.05)}`,
      ].join(', ');

  return {
    background,
    border,
    boxShadow,
    borderRadius: `${borderRadius}px`,
  };
}

function getOutlinedStyle(options: CardStyleOptions): CardCssResult {
  const {
    colorMode = 'light',
    opacity = 0.9,
    borderRadius = 12,
  } = options;

  const isLight = colorMode === 'light';
  const base = parseColor(
    options.backgroundColor,
    isLight ? { r: 255, g: 255, b: 255 } : { r: 26, g: 30, b: 38 },
  );
  const background = [
    `linear-gradient(180deg, ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, isLight ? 0.12 : 0.05), clamp01(opacity + 0.02))} 0%, ${toRgba(base, opacity)} 100%)`,
    toRgba(base, opacity),
  ].join(', ');

  const border = isLight
    ? `1px solid ${toRgba(mixColor(base, { r: 100, g: 116, b: 139 }, 0.55), 0.36)}`
    : `1px solid ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, 0.30), 0.16)}`;

  const boxShadow = isLight
    ? [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.72)}`,
        `0 0 0 1px ${toRgba({ r: 15, g: 23, b: 42 }, 0.04)}`,
      ].join(', ')
    : [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.05)}`,
        `0 0 0 1px ${toRgba({ r: 255, g: 255, b: 255 }, 0.04)}`,
      ].join(', ');

  return {
    background,
    border,
    boxShadow,
    borderRadius: `${borderRadius}px`,
  };
}

function getFloatingStyle(options: CardStyleOptions): CardCssResult {
  const {
    colorMode = 'light',
    opacity = 0.88,
    borderRadius = 12,
  } = options;

  const isLight = colorMode === 'light';
  const base = parseColor(
    options.backgroundColor,
    isLight ? { r: 255, g: 255, b: 255 } : { r: 30, g: 34, b: 44 },
  );
  const background = [
    `radial-gradient(circle at top, ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, isLight ? 0.18 : 0.08), clamp01(opacity + 0.04))} 0%, ${toRgba(base, opacity)} 55%)`,
    `linear-gradient(180deg, ${toRgba(mixColor(base, { r: 255, g: 255, b: 255 }, isLight ? 0.10 : 0.04), clamp01(opacity + 0.02))} 0%, ${toRgba(mixColor(base, { r: 15, g: 23, b: 42 }, isLight ? 0.05 : 0.10), opacity)} 100%)`,
    toRgba(base, opacity),
  ].join(', ');

  const border = isLight
    ? `1px solid ${toRgba({ r: 255, g: 255, b: 255 }, 0.82)}`
    : `1px solid ${toRgba({ r: 255, g: 255, b: 255 }, 0.12)}`;

  const boxShadow = isLight
    ? [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.82)}`,
        `0 18px 38px ${toRgba({ r: 15, g: 23, b: 42 }, 0.12)}`,
        `0 44px 88px ${toRgba({ r: 15, g: 23, b: 42 }, 0.13)}`,
        `0 72px 144px ${toRgba({ r: 15, g: 23, b: 42 }, 0.08)}`,
      ].join(', ')
    : [
        `inset 0 1px 0 ${toRgba({ r: 255, g: 255, b: 255 }, 0.08)}`,
        `0 18px 40px ${toRgba({ r: 0, g: 0, b: 0 }, 0.38)}`,
        `0 46px 96px ${toRgba({ r: 0, g: 0, b: 0 }, 0.32)}`,
        `0 78px 156px ${toRgba({ r: 0, g: 0, b: 0 }, 0.24)}`,
      ].join(', ');

  return {
    background,
    border,
    boxShadow,
    borderRadius: `${borderRadius}px`,
  };
}

// ── Unified entry point ────────────────────────────────────────────

/**
 * Applies a card style to a container element.
 *
 * - `none`        — strips all card styling
 * - `glass`       — layered frosted-glass (delegates to applyGlassStyle)
 * - `elevated`    — clearer lifted panel with stronger depth
 * - `neumorphic`  — inset / pressed surface
 * - `outlined`    — crisp framed panel with minimal shadow
 * - `floating`    — deeper detached panel with long ambient shadow
 */
export function applyCardStyle(
  element: HTMLElement,
  options: CardStyleOptions,
): void {
  const { mode } = options;

  // Glass delegates to the existing layered approach
  if (mode === 'glass') {
    const glassOpts: GlassStyleOptions = {
      mode: options.colorMode ?? 'light',
      opacity: options.opacity,
      backgroundColor: options.backgroundColor,
      borderRadius: options.borderRadius,
    };
    applyGlassStyle(element, glassOpts);
    return;
  }

  // For non-glass modes, remove any previous glass backdrop
  applyGlassStyle(element, null);

  if (mode === 'none') {
    element.style.borderRadius = '';
    element.style.overflow = '';
    return;
  }

  const styles = mode === 'elevated'
    ? getElevatedStyle(options)
    : mode === 'neumorphic'
      ? getNeumorphicStyle(options)
      : mode === 'outlined'
        ? getOutlinedStyle(options)
        : getFloatingStyle(options);

  element.style.background = styles.background;
  element.style.border = styles.border;
  element.style.boxShadow = styles.boxShadow;
  element.style.borderRadius = styles.borderRadius;
  element.style.overflow = 'hidden';
}

// ── Helpers ────────────────────────────────────────────────────────

function parseColor(color: string | undefined, fallback: RgbColor): RgbColor {
  if (!color) return fallback;
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*(\d*\.?\d+))?\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      r: clamp255(Number(rgbMatch[1])),
      g: clamp255(Number(rgbMatch[2])),
      b: clamp255(Number(rgbMatch[3])),
    };
  }

  const hex = trimmed.replace(/^#/, '');
  const normalized =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;

  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColor(base: RgbColor, target: RgbColor, amount: number): RgbColor {
  const ratio = clamp01(amount);
  return {
    r: clamp255(base.r + (target.r - base.r) * ratio),
    g: clamp255(base.g + (target.g - base.g) * ratio),
    b: clamp255(base.b + (target.b - base.b) * ratio),
  };
}

function toRgba(color: RgbColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp01(alpha)})`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clamp255(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}
