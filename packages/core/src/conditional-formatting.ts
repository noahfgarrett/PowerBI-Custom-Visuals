/**
 * Shared conditional formatting (threshold-based color rules).
 * Used by kpi-card, gauge-cluster, status-indicator, health-bar, progress-bar-stack, etc.
 */

export type ConditionalDirection = 'ascending' | 'descending';

export interface ConditionalConfig {
  enabled: boolean;
  /** Direction: ascending = low values are bad (red), descending = low values are good (green). */
  direction: ConditionalDirection;
  /** First threshold boundary. */
  threshold1: number;
  /** Second threshold boundary. */
  threshold2: number;
  /** Color for worst state (below threshold1 in ascending, above threshold2 in descending). */
  color1: string;
  /** Color for warning state (between thresholds). */
  color2: string;
  /** Color for best state (above threshold2 in ascending, below threshold1 in descending). */
  color3: string;
}

/** Default red/yellow/green traffic-light colors. */
const DEFAULT_COLORS = {
  bad: '#EF4444',
  warning: '#F59E0B',
  good: '#22C55E',
};

/**
 * Builds a ConditionalConfig from formatting card properties.
 * Handles missing or default values gracefully.
 */
export function buildConditionalConfig(
  enabled: boolean,
  direction: string | undefined,
  threshold1: number,
  threshold2: number,
  color1: string | undefined,
  color2: string | undefined,
  color3: string | undefined,
): ConditionalConfig {
  return {
    enabled,
    direction: direction === 'descending' ? 'descending' : 'ascending',
    threshold1: Math.min(threshold1, threshold2),
    threshold2: Math.max(threshold1, threshold2),
    color1: color1 || DEFAULT_COLORS.bad,
    color2: color2 || DEFAULT_COLORS.warning,
    color3: color3 || DEFAULT_COLORS.good,
  };
}

/**
 * Resolves the conditional color for a given value based on threshold config.
 *
 * **Ascending** (low = bad): value < t1 → color1 (bad), t1 <= value < t2 → color2 (warning), value >= t2 → color3 (good)
 * **Descending** (low = good): value < t1 → color3 (good), t1 <= value < t2 → color2 (warning), value >= t2 → color1 (bad)
 *
 * Returns `undefined` if conditional formatting is disabled, so callers can fall back to default colors.
 */
export function resolveConditionalColor(
  value: number | null | undefined,
  config: ConditionalConfig,
): string | undefined {
  if (!config.enabled || value == null || !isFinite(value)) return undefined;

  if (config.direction === 'ascending') {
    if (value < config.threshold1) return config.color1;
    if (value < config.threshold2) return config.color2;
    return config.color3;
  }

  // Descending: low = good
  if (value < config.threshold1) return config.color3;
  if (value < config.threshold2) return config.color2;
  return config.color1;
}

/**
 * Applies conditional colors to an array of elements based on their associated values.
 * Each element receives a fill or color style matching its threshold zone.
 *
 * @param elements - DOM elements to colorize.
 * @param values   - Corresponding numeric values (same length as elements).
 * @param config   - Conditional formatting configuration.
 * @param property - CSS property to set ('fill' for SVG, 'color' or 'backgroundColor' for HTML).
 */
export function applyConditionalColors(
  elements: ArrayLike<Element>,
  values: number[],
  config: ConditionalConfig,
  property: 'fill' | 'color' | 'backgroundColor' = 'fill',
): void {
  if (!config.enabled) return;

  const count = Math.min(elements.length, values.length);
  for (let i = 0; i < count; i++) {
    const color = resolveConditionalColor(values[i], config);
    if (color) {
      const el = elements[i];
      if (el instanceof SVGElement) {
        el.style.setProperty(property === 'backgroundColor' ? 'fill' : property, color);
      } else if (el instanceof HTMLElement) {
        el.style.setProperty(
          property === 'fill' ? 'color' : property === 'backgroundColor' ? 'background-color' : property,
          color,
        );
      }
    }
  }
}
