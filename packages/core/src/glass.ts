/**
 * Glassmorphic styling utilities.
 * Applies the frosted-glass card effect used across all visuals.
 */

import { type ColorMode } from './colors';

export interface GlassStyleOptions {
  mode: ColorMode;
  /** Background opacity override (0–1). Light default: 0.70, dark default: 0.60 */
  opacity?: number;
  /** Optional background color override (hex or rgb/rgba). */
  backgroundColor?: string;
  /** Blur radius in px. Default: 12 */
  blur?: number;
  /** Border radius in px. Default: 12 */
  borderRadius?: number;
  /** Whether to add the inner top-edge highlight. Default: true */
  edgeLight?: boolean;
}

export interface GlassStyles {
  background: string;
  backdropFilter: string;
  WebkitBackdropFilter: string;
  border: string;
  boxShadow: string;
  borderRadius: string;
}

/**
 * Returns a CSS properties object for a glassmorphic card.
 */
export function getGlassStyle(options: GlassStyleOptions): GlassStyles {
  const {
    mode,
    opacity = mode === 'light' ? 0.7 : 0.6,
    backgroundColor,
    blur = 12,
    borderRadius = 12,
    edgeLight = true,
  } = options;

  const isLight = mode === 'light';

  // Light default uses a very slight cool tint (5, 10, 20 blue bias) so the
  // card reads as frosted glass rather than a flat white rectangle.
  const defaultBg = isLight
    ? `rgba(245, 249, 255, ${opacity})`
    : `rgba(20, 22, 30, ${opacity})`;

  const bg = withAlpha(backgroundColor, opacity) ?? defaultBg;

  // Light mode uses a visible grey-blue border and layered shadow so the card
  // is clearly defined on white Power BI report canvases (where white-on-white
  // borders and faint shadows are invisible).
  const borderColor = isLight
    ? 'rgba(180, 200, 230, 0.55)'
    : 'rgba(255, 255, 255, 0.10)';

  // Layered shadow: a tight subtle drop + a wider soft ambient.
  const shadowBase = isLight
    ? '0 2px 8px rgba(0, 0, 0, 0.10), 0 8px 32px rgba(100, 120, 160, 0.10)'
    : '0 8px 32px rgba(0, 0, 0, 0.35)';

  const edgeShadow = edgeLight
    ? `, inset 0 1px 0 rgba(255, 255, 255, ${isLight ? 0.80 : 0.08})`
    : '';

  const backdrop = `blur(${blur}px) saturate(1.4)`;

  return {
    background: bg,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    border: `1px solid ${borderColor}`,
    boxShadow: `${shadowBase}${edgeShadow}`,
    borderRadius: `${borderRadius}px`,
  };
}

function withAlpha(color: string | undefined, alpha: number): string | null {
  if (!color) return null;
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*(\d*\.?\d+))?\s*\)$/i
  );
  if (rgbMatch) {
    const r = clampColor(Number(rgbMatch[1]));
    const g = clampColor(Number(rgbMatch[2]));
    const b = clampColor(Number(rgbMatch[3]));
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  const hex = trimmed.replace(/^#/, '');
  const normalized = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function clampColor(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Class name for the glass backdrop layer created by applyGlassStyle. */
const GLASS_BACKDROP_CLASS = 'pbi-glass-backdrop';

/**
 * Applies glassmorphic styles to a container using a layered approach.
 *
 * `backdrop-filter` forces GPU compositing of **all** children, which degrades
 * SVG text/label crispness.  To avoid this, the blur + tinted background are
 * placed on a separate absolutely-positioned div behind the content, while the
 * container itself only receives border, shadow, and border-radius.
 *
 * Pass `null` for options to reset / remove glass styles.
 */
export function applyGlassStyle(
  element: HTMLElement,
  options: GlassStyleOptions | null,
): void {
  // Remove any previous glass backdrop layer
  const prev = element.querySelector(`.${GLASS_BACKDROP_CLASS}`);
  if (prev) prev.remove();

  if (options === null) {
    // Reset all glass styles on the container
    element.style.background = '';
    element.style.backdropFilter = '';
    (element.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
    element.style.border = '';
    element.style.boxShadow = '';
    element.style.isolation = '';
    element.style.overflow = '';
    return;
  }

  const styles = getGlassStyle(options);

  // Container keeps border, shadow, radius — but NOT backdrop-filter
  element.style.border = styles.border;
  element.style.boxShadow = styles.boxShadow;
  element.style.borderRadius = styles.borderRadius;
  element.style.overflow = 'hidden';
  element.style.background = 'transparent';
  element.style.backdropFilter = '';
  (element.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
  element.style.position = 'relative';
  // Create a stacking context so the z-index:-1 backdrop stays scoped
  // inside this container rather than escaping to the parent context.
  element.style.isolation = 'isolate';

  // Backdrop div carries the blur + tinted background behind the content
  const bg = document.createElement('div');
  bg.className = GLASS_BACKDROP_CLASS;
  bg.style.position = 'absolute';
  bg.style.inset = '0';
  bg.style.zIndex = '-1';
  bg.style.borderRadius = styles.borderRadius;
  bg.style.background = styles.background;
  bg.style.backdropFilter = styles.backdropFilter;
  (bg.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = styles.WebkitBackdropFilter;
  bg.style.pointerEvents = 'none';
  element.insertBefore(bg, element.firstChild);
}

/**
 * Returns CSS string for use in stylesheets or template literals.
 */
export function getGlassCss(options: GlassStyleOptions): string {
  const s = getGlassStyle(options);
  return [
    `background: ${s.background}`,
    `backdrop-filter: ${s.backdropFilter}`,
    `-webkit-backdrop-filter: ${s.WebkitBackdropFilter}`,
    `border: ${s.border}`,
    `box-shadow: ${s.boxShadow}`,
    `border-radius: ${s.borderRadius}`,
  ].join(';\n  ');
}
