/**
 * Shared entrance animation utilities.
 * All functions return a cancel() cleanup function.
 */

// ── Easing Functions ──────────────────────────────────────────────

/** Deceleration curve — fast start, smooth stop. */
export function cubicOut(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/** Spring-like overshoot easing. */
export function springEase(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/** Smooth hermite interpolation (ease-in-out). */
export function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// ── Animation Helpers ─────────────────────────────────────────────

interface CancelFn {
  (): void;
}

const MAX_ANIMATION_DURATION = 60_000;
const MAX_ANIMATION_DELAY = 10_000;

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hasAnimationFrame(): boolean {
  return typeof globalThis.requestAnimationFrame === 'function'
    && typeof globalThis.cancelAnimationFrame === 'function';
}

/**
 * Whether the user has requested reduced motion in OS/browser settings.
 * This is checked per call to support runtime preference changes.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Clamp duration to a safe range for stable RAF math. */
function resolveDuration(duration: number): number {
  return clampFinite(duration, 0, MAX_ANIMATION_DURATION);
}

/** Clamp delay and disable staggering when reduced motion is enabled. */
function resolveDelay(delay: number): number {
  if (prefersReducedMotion()) return 0;
  return clampFinite(delay, 0, MAX_ANIMATION_DELAY);
}

/**
 * Core animation loop. Calls `onFrame(progress)` with eased 0→1 progress.
 * Returns a cancel function.
 */
export function animate(
  duration: number,
  easingFn: (t: number) => number,
  onFrame: (progress: number) => void,
  onComplete?: () => void
): CancelFn {
  const resolvedDuration = resolveDuration(duration);
  if (prefersReducedMotion() || resolvedDuration === 0 || !hasAnimationFrame()) {
    onFrame(1);
    onComplete?.();
    return () => { /* no-op */ };
  }

  let rafId: number | null = null;
  let startTime: number | null = null;
  let cancelled = false;

  function tick(timestamp: number): void {
    if (cancelled) return;
    if (startTime === null) startTime = timestamp;

    const elapsed = timestamp - startTime;
    const rawProgress = Math.min(elapsed / resolvedDuration, 1);
    const easedProgress = easingFn(rawProgress);

    onFrame(easedProgress);

    if (rawProgress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Animates a number counting up from `from` to `to`.
 * Calls `onUpdate` with the current interpolated value.
 */
export function countUp(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): CancelFn {
  return animate(
    duration,
    cubicOut,
    (progress) => {
      const value = from + (to - from) * progress;
      onUpdate(value);
    },
    onComplete
  );
}

/**
 * Animates a bar growing from 0 to its target size.
 * Sets the element's transform scaleY (or scaleX for horizontal).
 */
export function growBar(
  element: HTMLElement | SVGElement,
  delay: number,
  duration: number,
  direction: 'vertical' | 'horizontal' = 'vertical'
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  const prop = direction === 'vertical' ? 'scaleY' : 'scaleX';
  const origin = direction === 'vertical' ? 'bottom' : 'left';

  if (element instanceof HTMLElement) {
    element.style.transformOrigin = origin;
    element.style.transform = `${prop}(0)`;
  } else {
    element.setAttribute('transform-origin', origin);
    element.style.transform = `${prop}(0)`;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, cubicOut, (progress) => {
      element.style.transform = `${prop}(${progress})`;
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    element.style.transform = '';
    element.style.transformOrigin = '';
  };
}

/**
 * Animates an SVG path drawing itself via stroke-dashoffset.
 */
export function drawPath(
  pathElement: SVGPathElement,
  duration: number,
  delay: number = 0
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  const length = pathElement.getTotalLength();
  pathElement.style.strokeDasharray = `${length}`;
  pathElement.style.strokeDashoffset = `${length}`;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, cubicOut, (progress) => {
      pathElement.style.strokeDashoffset = `${length * (1 - progress)}`;
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    pathElement.style.strokeDasharray = '';
    pathElement.style.strokeDashoffset = '';
  };
}

/**
 * Animates an SVG arc sweeping from startAngle to endAngle.
 * Calls `onUpdate` with the current angle for the caller to redraw.
 */
export function sweepArc(
  startAngle: number,
  endAngle: number,
  duration: number,
  onUpdate: (currentAngle: number) => void,
  onComplete?: () => void
): CancelFn {
  return animate(
    duration,
    cubicOut,
    (progress) => {
      const current = startAngle + (endAngle - startAngle) * progress;
      onUpdate(current);
    },
    onComplete
  );
}

/**
 * Fade + slide entrance animation.
 */
export function fadeSlideIn(
  element: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
  duration: number,
  delay: number = 0
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  const translations: Record<string, string> = {
    up: 'translateY(20px)',
    down: 'translateY(-20px)',
    left: 'translateX(20px)',
    right: 'translateX(-20px)',
  };

  element.style.opacity = '0';
  element.style.transform = translations[direction];

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, cubicOut, (progress) => {
      element.style.opacity = `${progress}`;
      const dist = 20 * (1 - progress);
      const axis = direction === 'up' || direction === 'down' ? 'Y' : 'X';
      const sign = direction === 'up' || direction === 'left' ? 1 : -1;
      element.style.transform = `translate${axis}(${dist * sign}px)`;
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    element.style.opacity = '';
    element.style.transform = '';
  };
}

// ── Additional Easing Functions ──────────────────────────────────

/** Bounce-out easing — settles with diminishing bounces. */
export function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1;
    return n1 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / d1;
    return n1 * t2 * t2 + 0.984375;
  }
}

// ── Advanced Animation Helpers ──────────────────────────────────

/**
 * Spring-bounce pop-in: scales element from 0 → 1 with spring overshoot.
 * Used for scatter dots, dumbbell endpoints, timeline markers.
 */
export function popIn(
  element: HTMLElement | SVGElement,
  delay: number,
  duration: number = 500
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  element.style.transform = 'scale(0)';
  element.style.opacity = '0';

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, springEase, (progress) => {
      element.style.transform = `scale(${progress})`;
      element.style.opacity = `${Math.min(progress * 2, 1)}`;
    }, () => {
      element.style.transform = 'scale(1)';
      element.style.opacity = '1';
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    element.style.transform = '';
    element.style.opacity = '';
  };
}

/**
 * Wave-pattern grid reveal for waffle/heatmap cells.
 * Fills elements in a ripple pattern from the specified corner.
 */
export function rippleFill(
  elements: (HTMLElement | SVGElement)[],
  gridCols: number,
  duration: number,
  stagger: number = 30,
  direction: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-left'
): CancelFn {
  const resolvedDuration = resolveDuration(duration);
  const resolvedStagger = resolveDelay(stagger);
  const cancellers: CancelFn[] = [];

  // Calculate Manhattan distance from origin corner for each element
  const gridRows = Math.ceil(elements.length / gridCols);

  elements.forEach((el, i) => {
    const row = Math.floor(i / gridCols);
    const col = i % gridCols;

    let dist: number;
    switch (direction) {
      case 'top-left': dist = row + col; break;
      case 'top-right': dist = row + (gridCols - 1 - col); break;
      case 'bottom-left': dist = (gridRows - 1 - row) + col; break;
      case 'bottom-right': dist = (gridRows - 1 - row) + (gridCols - 1 - col); break;
    }

    el.style.opacity = '0';
    el.style.transform = 'scale(0)';

    const delay = resolveDelay(dist * resolvedStagger);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelAnim: CancelFn | null = null;

    timeoutId = setTimeout(() => {
      cancelAnim = animate(resolvedDuration, cubicOut, (progress) => {
        el.style.opacity = `${progress}`;
        el.style.transform = `scale(${progress})`;
      }, () => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
      });
    }, delay);

    cancellers.push(() => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      cancelAnim?.();
      el.style.opacity = '';
      el.style.transform = '';
    });
  });

  return () => {
    for (const cancel of cancellers) cancel();
  };
}

/**
 * Scale with overshoot — element bounces past target then settles.
 * Used for donut hover-explode, polar bloom, sunburst drill.
 */
export function springScale(
  element: HTMLElement | SVGElement,
  delay: number,
  duration: number = 400,
  fromScale: number = 0,
  toScale: number = 1
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  element.style.transform = `scale(${fromScale})`;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, springEase, (progress) => {
      const current = fromScale + (toScale - fromScale) * progress;
      element.style.transform = `scale(${current})`;
    }, () => {
      element.style.transform = `scale(${toScale})`;
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    element.style.transform = '';
  };
}

/**
 * Pulsing glow effect via CSS box-shadow animation.
 * Loops indefinitely until cancelled. Used for status indicators.
 */
export function pulseGlow(
  element: HTMLElement,
  color: string,
  duration: number = 1500
): CancelFn {
  if (prefersReducedMotion() || !hasAnimationFrame()) {
    element.style.boxShadow = `0 0 8px rgba(${hexToRgbComponents(color)}, 0.35)`;
    return () => {
      element.style.boxShadow = '';
    };
  }

  const resolvedDuration = Math.max(resolveDuration(duration), 250);
  let rafId: number | null = null;
  let startTime: number | null = null;
  let cancelled = false;

  function tick(timestamp: number): void {
    if (cancelled) return;
    if (startTime === null) startTime = timestamp;

    const elapsed = timestamp - startTime;
    // Sine wave: 0→1→0 per cycle
    const phase = (Math.sin((elapsed / resolvedDuration) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const spread = 4 + phase * 16;
    const opacity = 0.3 + phase * 0.5;

    element.style.boxShadow = `0 0 ${spread}px rgba(${hexToRgbComponents(color)}, ${opacity})`;
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    element.style.boxShadow = '';
  };
}

/** Convert hex color to "r, g, b" string for rgba(). */
function hexToRgbComponents(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  const normalized = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '0, 0, 0';
  }

  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

/**
 * Gravity-drop from above with bounce landing.
 * Used for waterfall chart blocks (Tetris-style).
 */
export function fallIn(
  element: HTMLElement | SVGElement,
  delay: number,
  duration: number = 600,
  distance: number = 40
): CancelFn {
  const resolvedDelay = resolveDelay(delay);
  const resolvedDuration = resolveDuration(duration);
  element.style.transform = `translateY(-${distance}px)`;
  element.style.opacity = '0';

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelAnim: CancelFn | null = null;

  timeoutId = setTimeout(() => {
    cancelAnim = animate(resolvedDuration, bounceOut, (progress) => {
      const y = distance * (1 - progress);
      element.style.transform = `translateY(-${y}px)`;
      element.style.opacity = `${Math.min(progress * 3, 1)}`;
    }, () => {
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    });
  }, resolvedDelay);

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    cancelAnim?.();
    element.style.transform = '';
    element.style.opacity = '';
  };
}

/**
 * SVG path morph: interpolates between two path `d` attribute strings.
 * Both paths must have the same number/types of commands.
 */
export function morphPath(
  pathElement: SVGPathElement,
  fromD: string,
  toD: string,
  duration: number
): CancelFn {
  const fromNums = parsePathNumbers(fromD);
  const toNums = parsePathNumbers(toD);
  const template = buildPathTemplate(fromD);

  // Graceful fallback: if path structures don't match, just snap
  if (fromNums.length !== toNums.length) {
    pathElement.setAttribute('d', toD);
    return () => { /* no-op */ };
  }

  return animate(duration, cubicOut, (progress) => {
    const interpolated = fromNums.map((fromVal, i) => {
      const toVal = toNums[i];
      return fromVal + (toVal - fromVal) * progress;
    });
    pathElement.setAttribute('d', fillPathTemplate(template, interpolated));
  }, () => {
    pathElement.setAttribute('d', toD);
  });
}

/** Extract all numeric values from an SVG path `d` string. */
function parsePathNumbers(d: string): number[] {
  const matches = d.match(/-?\d+\.?\d*(e[+-]?\d+)?/gi);
  return matches ? matches.map(Number) : [];
}

/** Replace numbers in path with placeholders for interpolation. */
function buildPathTemplate(d: string): string {
  return d.replace(/-?\d+\.?\d*(e[+-]?\d+)?/gi, '@@');
}

/** Fill placeholders with interpolated values. */
function fillPathTemplate(template: string, values: number[]): string {
  let i = 0;
  return template.replace(/@@/g, () => {
    const val = values[i++];
    return val !== undefined ? val.toFixed(2) : '0';
  });
}

// ── Constants ─────────────────────────────────────────────────────

/** Default animation durations (ms). */
export const DURATION = {
  fast: 300,
  normal: 600,
  slow: 1000,
  /** Stagger delay between sequential items (e.g., bar chart bars). */
  stagger: 50,
} as const;
