/**
 * Unified card-style system.
 *
 * Provides Glass, Elevated, and Neumorphic card styles with a single
 * `applyCardStyle` entry point.  The glass branch delegates to the
 * existing layered-backdrop approach in glass.ts; elevated and
 * neumorphic are shadow-only (no backdrop-filter) for maximum
 * crispness and zero GPU compositing overhead.
 */

import { type ColorMode } from './colors';
import { applyGlassStyle, type GlassStyleOptions } from './glass';

// ── Types ──────────────────────────────────────────────────────────

export type CardStyleMode = 'none' | 'glass' | 'elevated' | 'neumorphic';

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

function getElevatedStyle(options: CardStyleOptions): CardCssResult {
  const {
    colorMode = 'light',
    opacity = 0.92,
    borderRadius = 12,
  } = options;

  const isLight = colorMode === 'light';
  const bg = options.backgroundColor
    ? applyAlpha(options.backgroundColor, opacity)
    : isLight
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(30, 32, 40, ${opacity})`;

  const border = isLight
    ? '1px solid rgba(0, 0, 0, 0.06)'
    : '1px solid rgba(255, 255, 255, 0.06)';

  const boxShadow = isLight
    ? [
        '0 1px 2px rgba(0, 0, 0, 0.06)',
        '0 4px 16px rgba(0, 0, 0, 0.08)',
        '0 12px 40px rgba(0, 0, 0, 0.04)',
      ].join(', ')
    : [
        '0 1px 3px rgba(0, 0, 0, 0.20)',
        '0 6px 20px rgba(0, 0, 0, 0.25)',
        '0 16px 48px rgba(0, 0, 0, 0.15)',
      ].join(', ');

  return {
    background: bg,
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
  const bg = options.backgroundColor
    ? applyAlpha(options.backgroundColor, opacity)
    : isLight
      ? `rgba(235, 238, 245, ${opacity})`
      : `rgba(35, 38, 48, ${opacity})`;

  const border = isLight
    ? '1px solid rgba(255, 255, 255, 0.3)'
    : '1px solid rgba(255, 255, 255, 0.04)';

  const boxShadow = isLight
    ? [
        '-6px -6px 16px rgba(255, 255, 255, 0.7)',
        '6px 6px 16px rgba(166, 180, 200, 0.4)',
        'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      ].join(', ')
    : [
        '-6px -6px 16px rgba(60, 65, 80, 0.5)',
        '6px 6px 16px rgba(0, 0, 0, 0.5)',
        'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      ].join(', ');

  return {
    background: bg,
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
 * - `elevated`    — clean multi-layer shadow, no blur
 * - `neumorphic`  — soft extruded dual-shadow, no blur
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

  // Elevated or neumorphic — shadow-only styles
  const styles = mode === 'elevated'
    ? getElevatedStyle(options)
    : getNeumorphicStyle(options);

  element.style.background = styles.background;
  element.style.border = styles.border;
  element.style.boxShadow = styles.boxShadow;
  element.style.borderRadius = styles.borderRadius;
  element.style.overflow = 'hidden';
}

// ── Helpers ────────────────────────────────────────────────────────

function applyAlpha(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*(\d*\.?\d+))?\s*\)$/i,
  );
  if (rgbMatch) {
    const r = clamp255(Number(rgbMatch[1]));
    const g = clamp255(Number(rgbMatch[2]));
    const b = clamp255(Number(rgbMatch[3]));
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  const hex = trimmed.replace(/^#/, '');
  const normalized =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(255, 255, 255, ${safeAlpha})`;
  }

  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function clamp255(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}
