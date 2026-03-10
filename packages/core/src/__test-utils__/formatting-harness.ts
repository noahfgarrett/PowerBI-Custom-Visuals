/**
 * Formatting settings coverage harness.
 *
 * Instantiates a visual, renders it with default settings, then re-renders
 * with each setting individually changed.  Reports which settings are
 * "phantom" — they exist in the UI but changing them has zero effect on
 * the rendered DOM or the formatting model visibility flags.
 */

// ── Slice introspection types ───────────────────────────────────────

type SliceType = 'toggle' | 'color' | 'number' | 'dropdown' | 'text' | 'unknown';

interface SliceInfo {
  cardName: string;
  cardDisplayName: string;
  sliceName: string;
  sliceType: SliceType;
  defaultValue: unknown;
  altValue: unknown;
  sliceRef: Record<string, unknown>;
}

export interface FormattingTestResult {
  cardName: string;
  cardDisplayName: string;
  sliceName: string;
  sliceType: string;
  domChanged: boolean;
  isPhantom: boolean;
}

// ── Slice type detection ────────────────────────────────────────────

function detectSliceType(slice: Record<string, unknown>): SliceType {
  const val = slice.value;
  if (Array.isArray(slice.items) && val && typeof val === 'object') return 'dropdown';
  if (typeof val === 'boolean') return 'toggle';
  if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    const inner = (val as Record<string, unknown>).value;
    if (typeof inner === 'string') return 'color';
  }
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') return 'text';
  return 'unknown';
}

// ── Alt value generation ────────────────────────────────────────────

function generateAltValue(slice: Record<string, unknown>, sliceType: SliceType): unknown {
  const val = slice.value;
  switch (sliceType) {
    case 'toggle':
      return !(val as boolean);
    case 'color':
      return { value: '#FF0000' };
    case 'number': {
      const n = val as number;
      return n === 0 ? 10 : n * 2;
    }
    case 'dropdown': {
      const items = slice.items as Array<{ value: string; displayName: string }>;
      const current = (val as { value: string }).value;
      const other = items.find((it) => it.value !== current);
      return other ?? items[0];
    }
    case 'text':
      return (val as string) === '' ? 'test-harness-value' : '';
    default:
      return val;
  }
}

// ── Settings introspection ──────────────────────────────────────────

function introspectSettings(model: { cards: Array<Record<string, unknown>> }): SliceInfo[] {
  const results: SliceInfo[] = [];

  for (const card of model.cards) {
    const cardName = (card.name as string) ?? 'unnamed';
    const cardDisplayName = (card.displayName as string) ?? cardName;

    const slices = card.slices as Array<Record<string, unknown>> | undefined;
    if (slices) {
      for (const slice of slices) {
        if (!slice.name || slice.value === undefined) continue;
        const sliceType = detectSliceType(slice);
        results.push({
          cardName, cardDisplayName,
          sliceName: slice.name as string, sliceType,
          defaultValue: structuredClone(slice.value),
          altValue: generateAltValue(slice, sliceType),
          sliceRef: slice,
        });
      }
    }

    const groups = card.groups as Array<Record<string, unknown>> | undefined;
    if (groups) {
      for (const group of groups) {
        const groupSlices = group.slices as Array<Record<string, unknown>> | undefined;
        if (!groupSlices) continue;
        for (const slice of groupSlices) {
          if (!slice.name || slice.value === undefined) continue;
          const sliceType = detectSliceType(slice);
          results.push({
            cardName, cardDisplayName,
            sliceName: slice.name as string, sliceType,
            defaultValue: structuredClone(slice.value),
            altValue: generateAltValue(slice, sliceType),
            sliceRef: slice,
          });
        }
      }
    }
  }

  return results;
}

// ── Visual lifecycle helpers ────────────────────────────────────────

interface IVisualLike {
  update(options: unknown): void;
}

/**
 * A dependency describes settings that must be set to non-default values
 * for a target setting to have any effect.
 *
 * Format: { 'cardName.sliceName': value }
 *
 * Example: to test patternFillSettings.patternOpacity, you need
 * patternFillSettings.enabled = true first:
 *   deps = { 'patternFillSettings.enabled': true }
 */
type SettingDeps = Record<string, Record<string, unknown>>;

function applyDeps(
  settings: Record<string, unknown>,
  deps: Record<string, unknown>,
): void {
  for (const [path, value] of Object.entries(deps)) {
    const [cardName, sliceProp] = path.split('.');
    if (!cardName || !sliceProp) continue;

    // Find the card by its .name property (not the JS property name)
    for (const key of Object.keys(settings)) {
      const card = settings[key] as Record<string, unknown> | undefined;
      if (!card || typeof card !== 'object') continue;
      if ((card.name as string) !== cardName) continue;

      // Try direct property on card first
      const slice = card[sliceProp] as Record<string, unknown> | undefined;
      if (slice && typeof slice === 'object' && 'value' in slice) {
        slice.value = value;
        break;
      }

      // Try slices array
      const slices = card.slices as Array<Record<string, unknown>> | undefined;
      if (slices) {
        const found = slices.find((s) => s.name === sliceProp);
        if (found) {
          found.value = value;
          break;
        }
      }
      break;
    }
  }
}

// ── Main harness ────────────────────────────────────────────────────

export interface HarnessConfig {
  /** Factory that creates a fresh visual + its settings instance. */
  createVisual: () => {
    visual: IVisualLike;
    settings: Record<string, unknown> & { cards: Array<Record<string, unknown>> };
    element: HTMLElement;
  };

  /** A DataView appropriate for this visual */
  dataView: unknown;

  /** Viewport size */
  viewport?: { width: number; height: number };

  /**
   * Dependencies for specific settings.
   * Key = 'cardName.sliceName' (the setting being tested).
   * Value = object of deps to apply: { 'otherCard.otherSlice': value }
   *
   * These deps are applied to BOTH the baseline and trial renders so
   * the comparison is fair — only the test slice differs.
   */
  deps?: Record<string, Record<string, unknown>>;

  /** Card names to skip entirely */
  skipCards?: string[];

  /** Individual settings to skip: 'cardName.sliceName' */
  skipSettings?: string[];

  /**
   * Settings known to be non-DOM-affecting by design.
   * These are reported but not marked as failures.
   * Examples: animation timing, drill-down breadcrumbs (no drill data).
   */
  expectedPhantoms?: string[];
}

function buildUpdateOptions(
  dataView: unknown,
  viewport: { width: number; height: number },
): unknown {
  return {
    dataViews: [dataView],
    viewport,
    type: 2,
    operationKind: 0,
  };
}

function renderVisual(
  config: HarnessConfig,
  deps: Record<string, unknown> | undefined,
  mutation?: { cardName: string; sliceName: string; value: unknown },
): string {
  const viewport = config.viewport ?? { width: 600, height: 400 };
  const instance = config.createVisual();

  // Apply dependencies (same for baseline and trial)
  if (deps) {
    applyDeps(instance.settings, deps);
  }

  // Apply the test mutation (trial only)
  if (mutation) {
    const slice = findSlice(instance.settings, mutation.cardName, mutation.sliceName);
    if (slice) {
      slice.value = mutation.value;
    }
  }

  instance.visual.update(buildUpdateOptions(config.dataView, viewport));
  const html = instance.element.innerHTML;
  instance.element.remove();
  return html;
}

/**
 * Runs a full formatting coverage sweep on a visual.
 */
export function runFormattingCoverage(config: HarnessConfig): FormattingTestResult[] {
  const results: FormattingTestResult[] = [];
  const skipCardSet = new Set(config.skipCards ?? []);
  const skipSettingSet = new Set(config.skipSettings ?? []);

  // Introspect settings from a fresh instance
  const introspection = config.createVisual();
  const allSlices = introspectSettings(introspection.settings);
  introspection.element.remove();

  // Cache baselines keyed by dep fingerprint to avoid redundant renders
  const baselineCache = new Map<string, string>();

  for (const slice of allSlices) {
    if (skipCardSet.has(slice.cardName)) continue;
    if (skipSettingSet.has(`${slice.cardName}.${slice.sliceName}`)) continue;
    if (slice.sliceType === 'unknown') continue;

    const settingKey = `${slice.cardName}.${slice.sliceName}`;
    const deps = config.deps?.[settingKey];
    const depKey = deps ? JSON.stringify(deps) : '__default__';

    // Get or compute baseline for this dep configuration
    if (!baselineCache.has(depKey)) {
      baselineCache.set(depKey, renderVisual(config, deps));
    }
    const baselineHTML = baselineCache.get(depKey)!;

    // Render with the setting changed
    const trialHTML = renderVisual(config, deps, {
      cardName: slice.cardName,
      sliceName: slice.sliceName,
      value: slice.altValue,
    });

    const domChanged = trialHTML !== baselineHTML;

    results.push({
      cardName: slice.cardName,
      cardDisplayName: slice.cardDisplayName,
      sliceName: slice.sliceName,
      sliceType: slice.sliceType,
      domChanged,
      isPhantom: !domChanged,
    });
  }

  return results;
}

/**
 * Runs coverage for a single setting.
 */
export function runSingleSettingCoverage(
  config: HarnessConfig,
  cardName: string,
  sliceName: string,
): FormattingTestResult | null {
  const settingKey = `${cardName}.${sliceName}`;
  const deps = config.deps?.[settingKey];

  const baselineHTML = renderVisual(config, deps);

  const introspection = config.createVisual();
  const slice = findSlice(introspection.settings, cardName, sliceName);
  introspection.element.remove();

  if (!slice) return null;

  const sliceType = detectSliceType(slice);
  const altValue = generateAltValue(slice, sliceType);

  const trialHTML = renderVisual(config, deps, { cardName, sliceName, value: altValue });
  const domChanged = trialHTML !== baselineHTML;

  return {
    cardName,
    cardDisplayName: cardName,
    sliceName,
    sliceType,
    domChanged,
    isPhantom: !domChanged,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function findSlice(
  settings: Record<string, unknown>,
  cardName: string,
  sliceName: string,
): Record<string, unknown> | null {
  for (const key of Object.keys(settings)) {
    const card = settings[key] as Record<string, unknown> | undefined;
    if (!card || typeof card !== 'object') continue;
    if ((card.name as string) !== cardName) continue;

    // Direct property
    if (card[sliceName] && typeof card[sliceName] === 'object') {
      const s = card[sliceName] as Record<string, unknown>;
      if (s.name === sliceName) return s;
    }

    // Slices array
    const slices = card.slices as Array<Record<string, unknown>> | undefined;
    if (slices) {
      const found = slices.find((s) => s.name === sliceName);
      if (found) return found;
    }

    // Groups (CompositeCard)
    const groups = card.groups as Array<Record<string, unknown>> | undefined;
    if (groups) {
      for (const group of groups) {
        const groupSlices = group.slices as Array<Record<string, unknown>> | undefined;
        if (!groupSlices) continue;
        const found = groupSlices.find((s) => s.name === sliceName);
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Returns all cardName.sliceName paths for generating it.each test cases.
 */
export function getSettingPaths(
  settings: { cards: Array<Record<string, unknown>> },
  skipCards?: string[],
): Array<{ cardName: string; sliceName: string }> {
  const skipSet = new Set(skipCards ?? []);
  return introspectSettings(settings)
    .filter((s) => !skipSet.has(s.cardName) && s.sliceType !== 'unknown')
    .map((s) => ({ cardName: s.cardName, sliceName: s.sliceName }));
}
