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

  // Neutral white tint. Previously carried a 5/10/20 blue bias to look
  // "frosted," but in Power BI Service the visual runs in a sandboxed iframe
  // where backdrop-filter can't sample the parent canvas — the bias then
  // stacked on top of the page background and read as a flat sky-blue cast.
  const defaultBg = isLight
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(20, 22, 30, ${opacity})`;

  const baseBg = withAlpha(backgroundColor, opacity) ?? defaultBg;

  // Top-down white highlight layered over the base tint. Creates a "glass
  // shine" that survives in Service, where backdrop-filter can't sample the
  // parent page and so produces no edge highlight on its own.
  const highlight = `linear-gradient(180deg, rgba(255, 255, 255, ${
    isLight ? 0.35 : 0.06
  }) 0%, rgba(255, 255, 255, 0) 45%)`;
  const bg = `${highlight}, ${baseBg}`;

  const borderColor = isLight
    ? 'rgba(255, 255, 255, 0.55)'
    : 'rgba(255, 255, 255, 0.10)';

  // Light mode uses NO outer shadow. The visual fills a rectangular PBI
  // viewport, so any outward shadow drawn on a rounded card bleeds into the
  // four triangular "corner gap" regions between the rounded edge and the
  // square viewport — reading as dark smudges over colored page backgrounds
  // (Service gradients). Dark mode keeps its shadow because PBI's dark host
  // chrome absorbs black cleanly with no visible smudging.
  const outerShadow = isLight
    ? ''
    : '0 8px 32px -4px rgba(0, 0, 0, 0.35)';

  const edgeShadow = edgeLight
    ? `inset 0 1px 0 rgba(255, 255, 255, ${isLight ? 1 : 0.12})`
    : '';

  const backdrop = `blur(${blur}px)`;

  const boxShadow = [outerShadow, edgeShadow].filter(Boolean).join(', ') || 'none';

  return {
    background: bg,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    border: `1px solid ${borderColor}`,
    boxShadow,
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
