/**
 * Shared rendering helpers for formatting settings.
 * Used by all visuals to apply axis, grid, data label, and title formatting.
 */

import powerbi from 'powerbi-visuals-api';
import type { AxisFormattingCard, DataLabelFormattingCard, NumberFormattingCard, ScrollFormattingCard, SortFormattingCard, TitleFormattingCard, ColorThemeFormattingCard, LegendFormattingCard, DateFilterFormattingCard } from './shared-settings';
import { formatNumber } from './format';
import type { DisplayUnits } from './format';
import { COLOR_THEMES, type ColorThemeName } from './colors';
import { prefersReducedMotion } from './animation';

import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;

// ── Default colors (used when user hasn't picked a color) ────────────

const DEFAULT_LABEL_COLOR = '#64748B';
const DEFAULT_DATA_LABEL_COLOR = '#475569';
const DEFAULT_AXIS_LINE_COLOR = '#CBD5E1';
const DEFAULT_GRID_LINE_COLOR = '#E2E8F0';
const DEFAULT_TITLE_COLOR = '#0F172A';

// ── Helpers ──────────────────────────────────────────────────────────

/** Resolve a ColorPicker value — returns the user's pick or a fallback. */
function resolveColor(
  picker: { value?: { value?: string } } | undefined,
  fallback: string,
): string {
  const v = picker?.value?.value;
  return v && v.length > 0 ? v : fallback;
}

/** Resolve an ItemDropdown value to its inner string value. */
export function resolveDropdown(
  dropdown: { value?: unknown } | undefined,
): string | undefined {
  const val = dropdown?.value;
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    return (val as { value?: string }).value;
  }
  return undefined;
}

export function attachEmptySpaceContextMenu(
  element: HTMLElement,
  selectionManager: ISelectionManager,
  createEmptySelectionId: () => ISelectionId,
  isEnabled: () => boolean = () => true,
): () => void {
  const handler = (event: MouseEvent): void => {
    if (!isEnabled()) return;
    event.preventDefault();
    void selectionManager.showContextMenu(createEmptySelectionId(), {
      x: event.clientX,
      y: event.clientY,
    });
  };

  element.addEventListener('contextmenu', handler);
  return () => element.removeEventListener('contextmenu', handler);
}

export interface HostHighContrastColors {
  enabled: boolean;
  foreground: string;
  background: string;
  foregroundSelected: string;
  hyperlink: string;
}

export function allowInteractions(host: IVisualHost): boolean {
  const hostWithCapabilities = host as unknown as {
    hostCapabilities?: { allowInteractions?: boolean };
  };
  return hostWithCapabilities.hostCapabilities?.allowInteractions !== false;
}

export function getHostHighContrastColors(host: IVisualHost): HostHighContrastColors {
  const palette = (host as unknown as {
    colorPalette?: {
      isHighContrast?: boolean;
      foreground?: unknown;
      background?: unknown;
      foregroundSelected?: unknown;
      hyperlink?: unknown;
    };
  }).colorPalette;

  const colorValue = (value: unknown, fallback: string): string => {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const nested = (value as { value?: unknown }).value;
      if (typeof nested === 'string' && nested.length > 0) return nested;
    }
    return fallback;
  };

  return {
    enabled: Boolean(palette?.isHighContrast),
    foreground: colorValue(palette?.foreground, '#000000'),
    background: colorValue(palette?.background, '#FFFFFF'),
    foregroundSelected: colorValue(palette?.foregroundSelected, '#000000'),
    hyperlink: colorValue(palette?.hyperlink, '#0000FF'),
  };
}

export function notifyRenderingStarted(host: IVisualHost, options: VisualUpdateOptions): void {
  host.eventService?.renderingStarted?.(options);
}

export function notifyRenderingFinished(host: IVisualHost, options: VisualUpdateOptions): void {
  host.eventService?.renderingFinished?.(options);
}

export function notifyRenderingFailed(host: IVisualHost, options: VisualUpdateOptions, reason?: string): void {
  host.eventService?.renderingFailed?.(options, reason);
}

export interface LandingPageConfig {
  title: string;
  description: string;
  steps?: string[];
  hint?: string;
}

export type EmptyVisualStateMode = 'unconfigured' | 'noData';

export function getVisualEmptyStateMode(dataView: DataView | undefined): EmptyVisualStateMode {
  const hasBoundRoles = (dataView?.metadata?.columns ?? []).some((column) =>
    Object.values(column.roles ?? {}).some(Boolean),
  );
  return hasBoundRoles ? 'noData' : 'unconfigured';
}

export function renderLandingPage(
  container: HTMLElement,
  config: LandingPageConfig,
  highContrast?: HostHighContrastColors,
): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'pbi-landing-page';
  shell.setAttribute('role', 'region');
  shell.setAttribute('aria-label', config.title);
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.alignItems = 'flex-start';
  shell.style.justifyContent = 'center';
  shell.style.gap = '12px';
  shell.style.width = 'calc(100% - 24px)';
  shell.style.maxWidth = '440px';
  shell.style.maxHeight = 'calc(100% - 24px)';
  shell.style.margin = '0 auto';
  shell.style.padding = '24px 28px';
  shell.style.boxSizing = 'border-box';
  shell.style.overflowY = 'auto';
  shell.style.overflowWrap = 'anywhere';
  shell.style.borderRadius = '8px';
  shell.style.border = `1px solid ${highContrast?.enabled ? highContrast.foreground : 'rgba(148, 163, 184, 0.28)'}`;
  shell.style.background = highContrast?.enabled
    ? highContrast.background
    : 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,250,252,0.94))';
  shell.style.boxShadow = highContrast?.enabled ? 'none' : '0 18px 40px rgba(15, 23, 42, 0.08)';
  shell.style.color = highContrast?.enabled ? highContrast.foreground : '#0F172A';

  const title = document.createElement('h2');
  title.className = 'pbi-landing-page-title';
  title.textContent = config.title;
  title.style.margin = '0';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0';
  shell.appendChild(title);

  const description = document.createElement('div');
  description.className = 'pbi-landing-page-description';
  description.textContent = config.description;
  description.style.lineHeight = '1.5';
  description.style.color = highContrast?.enabled ? highContrast.foreground : '#334155';
  shell.appendChild(description);

  if (config.steps && config.steps.length > 0) {
    const steps = document.createElement('ul');
    steps.className = 'pbi-landing-page-steps';
    steps.style.margin = '0';
    steps.style.paddingLeft = '18px';
    steps.style.lineHeight = '1.6';
    for (const step of config.steps) {
      const item = document.createElement('li');
      item.textContent = step;
      steps.appendChild(item);
    }
    shell.appendChild(steps);
  }

  if (config.hint) {
    const hint = document.createElement('div');
    hint.className = 'pbi-landing-page-hint';
    hint.textContent = config.hint;
    hint.style.fontSize = '13px';
    hint.style.lineHeight = '1.5';
    hint.style.color = highContrast?.enabled ? highContrast.foreground : '#475569';
    shell.appendChild(hint);
  }

  container.appendChild(shell);
  return shell;
}

export function renderNoDataState(
  container: HTMLElement,
  message = 'No data for the current selection.',
  highContrast?: HostHighContrastColors,
): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'pbi-no-data-state';
  shell.setAttribute('role', 'status');
  shell.setAttribute('aria-live', 'polite');
  shell.style.display = 'flex';
  shell.style.alignItems = 'center';
  shell.style.justifyContent = 'center';
  shell.style.width = 'calc(100% - 24px)';
  shell.style.maxWidth = '440px';
  shell.style.minHeight = '120px';
  shell.style.maxHeight = 'calc(100% - 24px)';
  shell.style.margin = '0 auto';
  shell.style.padding = '24px';
  shell.style.boxSizing = 'border-box';
  shell.style.overflow = 'auto';
  shell.style.overflowWrap = 'anywhere';
  shell.style.borderRadius = '8px';
  shell.style.border = `1px dashed ${highContrast?.enabled ? highContrast.foreground : 'rgba(148, 163, 184, 0.38)'}`;
  shell.style.background = highContrast?.enabled
    ? highContrast.background
    : 'linear-gradient(180deg, rgba(248,250,252,0.88), rgba(241,245,249,0.96))';
  shell.style.color = highContrast?.enabled ? highContrast.foreground : '#475569';
  shell.style.fontSize = '14px';
  shell.style.fontWeight = '600';
  shell.style.textAlign = 'center';
  shell.textContent = message;

  container.appendChild(shell);
  return shell;
}

export interface HighContrastStyleConfig {
  textSelectors?: string[];
  lineSelectors?: string[];
  fillSelectors?: string[];
  strokeSelectors?: string[];
}

interface HighContrastOriginalState {
  attributes?: Record<string, string | null>;
  styles?: Record<string, string>;
}

const HIGH_CONTRAST_STATE_ATTRIBUTE = 'data-pbi-high-contrast-original';

function rememberHighContrastState(
  element: HTMLElement | SVGElement,
  attributeNames: string[] = [],
  styleNames: string[] = [],
): void {
  const rawState = element.getAttribute(HIGH_CONTRAST_STATE_ATTRIBUTE);
  const state: HighContrastOriginalState = rawState
    ? JSON.parse(rawState) as HighContrastOriginalState
    : {};

  state.attributes ??= {};
  state.styles ??= {};

  for (const name of attributeNames) {
    if (!(name in state.attributes)) {
      state.attributes[name] = element.getAttribute(name);
    }
  }
  for (const name of styleNames) {
    if (!(name in state.styles)) {
      state.styles[name] = element.style.getPropertyValue(name);
    }
  }

  element.setAttribute(HIGH_CONTRAST_STATE_ATTRIBUTE, JSON.stringify(state));
}

function restoreHighContrastState(container: HTMLElement): void {
  const elements: Array<HTMLElement | SVGElement> = [container];
  container.querySelectorAll<HTMLElement | SVGElement>(`[${HIGH_CONTRAST_STATE_ATTRIBUTE}]`)
    .forEach((element) => elements.push(element));

  for (const element of elements) {
    const rawState = element.getAttribute(HIGH_CONTRAST_STATE_ATTRIBUTE);
    if (!rawState) continue;

    const state = JSON.parse(rawState) as HighContrastOriginalState;
    for (const [name, value] of Object.entries(state.attributes ?? {})) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    for (const [name, value] of Object.entries(state.styles ?? {})) {
      element.style.setProperty(name, value);
    }
    element.removeAttribute(HIGH_CONTRAST_STATE_ATTRIBUTE);
  }
}

export function applyBasicHighContrastStyles(
  container: HTMLElement,
  colors: HostHighContrastColors,
  config: HighContrastStyleConfig = {},
): void {
  if (!colors.enabled) {
    restoreHighContrastState(container);
    return;
  }

  rememberHighContrastState(container, [], ['background-color', 'color']);
  container.style.backgroundColor = colors.background;
  container.style.color = colors.foreground;

  const textSelectors = config.textSelectors ?? ['svg text', '.chart-title', '.chart-subtitle', '.pbi-shared-legend span'];
  const lineSelectors = config.lineSelectors ?? ['svg line', 'svg .domain'];
  const fillSelectors = config.fillSelectors ?? [];
  const strokeSelectors = config.strokeSelectors ?? [];

  const applyTextColor = (element: Element): void => {
    if (element instanceof SVGElement) {
      rememberHighContrastState(element, ['fill']);
      element.setAttribute('fill', colors.foreground);
    } else if (element instanceof HTMLElement) {
      rememberHighContrastState(element, [], ['color']);
      element.style.color = colors.foreground;
    }
  };

  const applyStrokeColor = (element: Element): void => {
    if (element instanceof SVGElement) {
      rememberHighContrastState(element, ['stroke']);
      element.setAttribute('stroke', colors.foreground);
    } else if (element instanceof HTMLElement) {
      rememberHighContrastState(element, [], ['border-color', 'color']);
      element.style.borderColor = colors.foreground;
      element.style.color = colors.foreground;
    }
  };

  const applyFillColor = (element: Element): void => {
    if (element instanceof SVGElement) {
      rememberHighContrastState(element, ['fill', 'stroke', 'stroke-width']);
      element.setAttribute('fill', colors.background);
      element.setAttribute('stroke', colors.foreground);
      element.setAttribute('stroke-width', element.getAttribute('stroke-width') || '2');
    } else if (element instanceof HTMLElement) {
      rememberHighContrastState(element, [], ['background-color', 'border-color', 'color']);
      element.style.backgroundColor = colors.background;
      element.style.borderColor = colors.foreground;
      element.style.color = colors.foreground;
    }
  };

  for (const selector of textSelectors) {
    container.querySelectorAll(selector).forEach(applyTextColor);
  }
  for (const selector of lineSelectors) {
    container.querySelectorAll(selector).forEach(applyStrokeColor);
  }
  for (const selector of fillSelectors) {
    container.querySelectorAll(selector).forEach(applyFillColor);
  }
  for (const selector of strokeSelectors) {
    container.querySelectorAll(selector).forEach(applyStrokeColor);
  }
}

/**
 * Resolve the user's selected color theme from a ColorThemeFormattingCard.
 * Returns a validated ColorThemeName, defaulting to 'default' for invalid values.
 */
export function resolveColorTheme(card: ColorThemeFormattingCard): ColorThemeName {
  const raw = resolveDropdown(card.colorTheme) ?? 'default';
  return (raw in COLOR_THEMES) ? raw as ColorThemeName : 'default';
}

/** Convert a grid/line style dropdown value to an SVG stroke-dasharray. */
function toDashArray(style: string | undefined): string {
  switch (style) {
    case 'dashed':
      return '4 3';
    case 'dotted':
      return '2 2';
    default:
      return 'none';
  }
}

// ── Chart Title ──────────────────────────────────────────────────────

export interface TitleLayoutConfig {
  /** Space below the title block in pixels. */
  titlePaddingBottom?: number;
  /** Space below the subtitle in pixels. */
  subtitlePaddingBottom?: number;
}

/**
 * Synchronizes title/subtitle formatting pane visibility with the title toggle.
 * When the title is hidden, the rest of the title block settings are hidden too.
 */
export function syncTitleFormattingVisibility(settings: TitleFormattingCard): void {
  const visible = Boolean(settings.showTitle.value);
  settings.titleText.visible = visible;
  settings.titleFontSize.visible = visible;
  settings.titleFontColor.visible = visible;
  settings.titleFontFamily.visible = visible;
  settings.titleFontWeight.visible = visible;
  settings.titleAlignment.visible = visible;
  settings.subtitleText.visible = visible;
  settings.subtitleFontSize.visible = visible;
  settings.subtitleFontColor.visible = visible;
  settings.subtitleFontFamily.visible = visible;
  settings.subtitleFontWeight.visible = visible;
}

/**
 * Synchronizes legend formatting pane visibility with the legend toggles.
 * When the legend is hidden, dependent controls are hidden too.
 */
export function syncLegendFormattingVisibility(settings: LegendFormattingCard): void {
  const showLegend = Boolean(settings.showLegend.value);
  const showInlineLabels = showLegend && Boolean(settings.showInlineLabels.value);

  settings.legendPosition.visible = showLegend;
  settings.legendFontSize.visible = showLegend;
  settings.legendFontColor.visible = showLegend;
  settings.legendFontFamily.visible = showLegend;
  settings.legendFontWeight.visible = showLegend;
  settings.legendAliases.visible = showLegend;
  settings.showInlineLabels.visible = showLegend;
  settings.inlineLabelFontSize.visible = showInlineLabels;
  settings.inlineLabelOffset.visible = showInlineLabels;
}

/**
 * Hides inline legend label controls for visuals that do not render them.
 * Call after syncLegendFormattingVisibility when the visual only supports
 * standard legend entries.
 */
export function hideInlineLegendFormatting(settings: LegendFormattingCard): void {
  settings.showInlineLabels.visible = false;
  settings.inlineLabelFontSize.visible = false;
  settings.inlineLabelOffset.visible = false;
}

/**
 * Synchronizes date-filter sub-setting visibility with the master toggle.
 * End Date is only shown when the filter is enabled and "End at Current Date"
 * is turned off.
 */
export function syncDateFilterFormattingVisibility(settings: DateFilterFormattingCard): void {
  const enabled = Boolean(settings.enableDateFilter.value);
  const endAtCurrentDate = Boolean(settings.endAtCurrentDate.value);

  settings.startDate.visible = enabled;
  settings.endAtCurrentDate.visible = enabled;
  settings.endDate.visible = enabled && !endAtCurrentDate;
}

type CardStyleVisibilitySettings = {
  cardStyleMode: { value?: unknown };
  backgroundOpacity: { visible?: boolean };
  backgroundColor: { visible?: boolean };
  borderRadius?: { visible?: boolean };
};

/**
 * Synchronizes shared card-style sub-setting visibility with the chosen card mode.
 * Appearance-only controls are hidden when the card style is disabled.
 */
export function syncCardStyleVisibility(settings: CardStyleVisibilitySettings): void {
  const cardMode = resolveDropdown(settings.cardStyleMode) ?? 'glass';
  const visible = cardMode !== 'none';
  settings.backgroundOpacity.visible = visible;
  settings.backgroundColor.visible = visible;
  if (settings.borderRadius) settings.borderRadius.visible = visible;
}

/**
 * Renders an optional chart title as the first child of the container.
 * Call at the top of update() after clearing.
 */
export function renderChartTitle(
  container: HTMLElement,
  settings: TitleFormattingCard,
  layout?: TitleLayoutConfig,
): void {
  const text = settings.titleText.value;
  const subtitleText = settings.subtitleText.value;
  if (!settings.showTitle.value && !subtitleText) return;

  const fontFamily = resolveDropdown(settings.titleFontFamily) || "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
  const textAlign = resolveDropdown(settings.titleAlignment) ?? 'center';
  const titleWeight = resolveDropdown(settings.titleFontWeight) ?? 'bold';
  const titlePaddingBottom = layout?.titlePaddingBottom ?? 4;
  const subtitlePaddingBottom = layout?.subtitlePaddingBottom ?? 4;

  let titleEl: HTMLDivElement | null = null;
  if (settings.showTitle.value && text) {
    titleEl = document.createElement('div');
    titleEl.className = 'chart-title';
    titleEl.textContent = text;
    titleEl.style.fontSize = `${settings.titleFontSize.value}px`;
    titleEl.style.color = resolveColor(settings.titleFontColor, DEFAULT_TITLE_COLOR);
    titleEl.style.textAlign = textAlign;
    titleEl.style.fontWeight = titleWeight === 'bold' ? '600' : '400';
    titleEl.style.marginBottom = `${titlePaddingBottom}px`;
    titleEl.style.lineHeight = '1.3';
    titleEl.style.fontFamily = fontFamily;
    titleEl.style.position = 'relative';
    titleEl.style.zIndex = '1';
    titleEl.style.width = '100%';
    titleEl.style.minWidth = '0';
    titleEl.style.boxSizing = 'border-box';
    titleEl.style.overflowWrap = 'anywhere';
    titleEl.setAttribute('role', 'heading');
    titleEl.setAttribute('aria-level', '2');
    container.insertBefore(titleEl, container.firstChild);
  }

  // Render subtitle after the title if provided
  if (subtitleText) {
    const subtitleFontFamily = resolveDropdown(settings.subtitleFontFamily) || fontFamily;
    const subtitleWeight = resolveDropdown(settings.subtitleFontWeight) ?? 'normal';

    const sub = document.createElement('div');
    sub.className = 'chart-subtitle';
    sub.textContent = subtitleText;
    sub.style.fontSize = `${settings.subtitleFontSize.value}px`;
    sub.style.color = resolveColor(settings.subtitleFontColor, '#64748B');
    sub.style.fontFamily = subtitleFontFamily;
    sub.style.textAlign = textAlign;
    sub.style.fontWeight = subtitleWeight === 'bold' ? '600' : '400';
    sub.style.marginBottom = `${subtitlePaddingBottom}px`;
    sub.style.lineHeight = '1.3';
    sub.style.position = 'relative';
    sub.style.zIndex = '1';
    sub.style.width = '100%';
    sub.style.minWidth = '0';
    sub.style.boxSizing = 'border-box';
    sub.style.overflowWrap = 'anywhere';

    // Insert subtitle right after the title element when present.
    if (titleEl) {
      container.insertBefore(sub, titleEl.nextSibling);
    } else {
      container.insertBefore(sub, container.firstChild);
    }
  }
}

// ── Data Label Formatting ───────────────────────────────────────────

/**
 * Applies data label font color, size, and weight to elements matching `selector`.
 * Works with both SVG <text> elements (uses fill/font-size attrs) and
 * HTML elements (uses style.color/fontSize).
 *
 * Call after all labels are rendered.
 *
 * @param container - The visual's root container element.
 * @param settings  - DataLabelFormattingCard instance.
 * @param selector  - CSS selector for the label elements (e.g. '.waterfall-value').
 */
export function applyDataLabelFormatting(
  container: HTMLElement,
  settings: DataLabelFormattingCard,
  selector: string,
): void {
  const color = resolveColor(settings.dataLabelFontColor, DEFAULT_DATA_LABEL_COLOR);
  const size = settings.dataLabelFontSize.value;
  const weight = resolveDropdown(settings.dataLabelFontWeight) ?? 'normal';
  const fontFamily = resolveDropdown(settings.dataLabelFontFamily) || undefined;
  const position = resolveDropdown(settings.dataLabelPosition) || 'auto';

  const elements = container.querySelectorAll(selector);
  for (const el of elements) {
    if (el instanceof SVGElement) {
      el.style.setProperty('fill', color);
      el.style.setProperty('font-size', `${size}px`);
      el.style.setProperty('font-weight', weight);
      if (fontFamily) el.style.setProperty('font-family', fontFamily);
      el.setAttribute('data-label-position', position);

      // Apply simple position offsets for SVG text elements
      if (el instanceof SVGTextElement) {
        if (position === 'above') {
          el.setAttribute('dominant-baseline', 'auto');
          el.setAttribute('dy', '-8');
        } else if (position === 'below') {
          el.setAttribute('dominant-baseline', 'hanging');
          el.setAttribute('dy', '8');
        } else if (position === 'inside') {
          el.setAttribute('dominant-baseline', 'hanging');
          el.setAttribute('dy', '4');
        } else if (position === 'outside') {
          el.setAttribute('dominant-baseline', 'auto');
          el.setAttribute('dy', '-12');
        }
      }
    } else if (el instanceof HTMLElement) {
      el.style.color = color;
      el.style.fontSize = `${size}px`;
      el.style.fontWeight = weight;
      if (fontFamily) el.style.fontFamily = fontFamily;
      el.setAttribute('data-label-position', position);
    }
  }
}

// ── Axis Formatting ─────────────────────────────────────────────────

/**
 * Applies axis label color, size, and line styling to an axis <g> group.
 * Works with both D3 axes (.tick > text, .domain) and raw SVG (direct text/line children).
 *
 * @param axisGroup - The SVGGElement containing axis elements.
 * @param settings  - AxisFormattingCard instance.
 */
export function applyAxisFormatting(
  axisGroup: SVGGElement,
  settings: AxisFormattingCard,
): void {
  const labelColor = resolveColor(settings.axisLabelColor, DEFAULT_LABEL_COLOR);
  const labelSize = settings.axisLabelSize.value;
  const lineColor = resolveColor(settings.axisLineColor, DEFAULT_AXIS_LINE_COLOR);
  const lineWidth = settings.axisLineWidth.value;

  const labelFontFamily = resolveDropdown(settings.axisLabelFontFamily) || '';
  const labelFontWeight = resolveDropdown(settings.axisLabelFontWeight) ?? 'normal';

  // Style all text elements (axis labels) — covers D3 .tick text AND raw SVG text
  const texts = axisGroup.querySelectorAll<SVGTextElement>('text');
  for (const text of texts) {
    text.style.setProperty('fill', labelColor);
    text.style.setProperty('font-size', `${labelSize}px`);
    text.style.setProperty('font-weight', labelFontWeight);
    if (labelFontFamily) {
      text.style.setProperty('font-family', labelFontFamily);
    }
  }

  // Style axis lines and domain path — covers D3 .domain + .tick line AND raw SVG line
  const lines = axisGroup.querySelectorAll<SVGElement>('line, .domain');
  for (const line of lines) {
    line.style.setProperty('stroke', lineColor);
    line.style.setProperty('stroke-width', `${lineWidth}`);
  }
}

// ── Grid Formatting ─────────────────────────────────────────────────

/**
 * Applies grid line color, style, and visibility.
 * Works with both D3 grid groups (containing .tick line) and raw SVG groups.
 *
 * @param gridGroup - The SVGGElement containing grid lines.
 * @param settings  - AxisFormattingCard instance.
 */
export function applyGridFormatting(
  gridGroup: SVGGElement,
  settings: AxisFormattingCard,
): void {
  if (!settings.showGridLines.value) {
    gridGroup.style.display = 'none';
    return;
  }

  gridGroup.style.display = '';

  const gridColor = resolveColor(settings.gridLineColor, DEFAULT_GRID_LINE_COLOR);
  const gridDash = toDashArray(resolveDropdown(settings.gridLineStyle));
  const gridWidth = settings.gridLineWidth.value;
  const gridOpacityRaw = settings.gridLineOpacity.value;
  // gridLineOpacity is on a 0-100 scale (default 100); convert to 0-1
  const gridOpacity = typeof gridOpacityRaw === 'number' ? String(gridOpacityRaw / 100) : '0.6';

  const lines = gridGroup.querySelectorAll<SVGElement>('line');
  for (const line of lines) {
    line.style.setProperty('stroke', gridColor);
    line.style.setProperty('stroke-dasharray', gridDash);
    line.style.setProperty('stroke-opacity', gridOpacity);
    if (gridWidth > 0) {
      line.style.setProperty('stroke-width', `${gridWidth}`);
    }
  }
}

// ── Container-Level Convenience ─────────────────────────────────────

/**
 * Applies axis + grid formatting to ALL matching groups in a container.
 * Convenience wrapper that finds SVG elements by selector and applies formatting.
 *
 * @param container     - The visual's root container element.
 * @param settings      - AxisFormattingCard instance.
 * @param axisSelector  - CSS selector for axis groups (e.g. '.waterfall-axis').
 * @param gridSelector  - CSS selector for grid groups (e.g. '.waterfall-grid'). Optional.
 */
export function applyAllAxisFormatting(
  container: HTMLElement,
  settings: AxisFormattingCard,
  axisSelector: string,
  gridSelector?: string,
): void {
  const svg = container.querySelector('svg');
  if (!svg) return;

  svg.querySelectorAll<SVGGElement>(axisSelector).forEach((el) => {
    applyAxisFormatting(el, settings);
  });

  if (gridSelector) {
    svg.querySelectorAll<SVGGElement>(gridSelector).forEach((el) => {
      applyGridFormatting(el, settings);
    });
  }
}

// ── Sort Order Helper ───────────────────────────────────────────────

/** A sortable item with a name and a numeric value. */
export interface SortableItem {
  name: string;
  value: number;
}

/**
 * Applies the user's sort order to an array of items.
 * Returns a new sorted array (does not mutate the original).
 *
 * @param items    - The array of items to sort. Each must have `name` and `value`.
 * @param settings - SortFormattingCard instance.
 * @returns A new array in the requested sort order.
 */
export function applySortOrder<T extends SortableItem>(
  items: T[],
  settings: SortFormattingCard,
): T[] {
  const sortBy = resolveDropdown(settings.sortBy) ?? 'dataOrder';

  if (sortBy === 'dataOrder') return items;

  const sorted = [...items];
  switch (sortBy) {
    case 'valueAsc':
      sorted.sort((a, b) => a.value - b.value);
      break;
    case 'valueDesc':
      sorted.sort((a, b) => b.value - a.value);
      break;
    case 'nameAsc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'nameDesc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }

  return sorted;
}

// ── Number Format Helper ────────────────────────────────────────────

/**
 * Formats a number using the user's NumberFormattingCard settings.
 * Reads displayUnits, decimalPlaces, prefix, and suffix from the card.
 *
 * @param value    - The number to format.
 * @param settings - NumberFormattingCard instance.
 * @returns The formatted string (e.g. "$1.2M", "42K%").
 */
export function formatWithSettings(
  value: number | null | undefined,
  settings: NumberFormattingCard,
): string {
  const units = resolveDropdown(settings.displayUnits) as DisplayUnits | undefined;
  const decimals = settings.decimalPlaces.value;
  const prefix = settings.valuePrefix.value ?? '';
  const suffix = settings.valueSuffix.value ?? '';

  return formatNumber(value, {
    displayUnits: units ?? 'auto',
    decimals: decimals >= 0 ? decimals : undefined, // -1 = auto
    prefix,
    suffix,
    abbreviate: true,
  });
}

// ── Shared Legend Renderer ──────────────────────────────────────────

export interface LegendItem {
  label: string;
  color: string;
  /** Optional: if true, this item is currently filtered out (dimmed). */
  filtered?: boolean;
}

export interface LegendConfig {
  items: LegendItem[];
  position: 'top' | 'bottom' | 'left' | 'right';
  fontSize: number;
  fontColor: string;
  /** Called when a legend item is clicked (for click-to-filter). */
  onItemClick?: (item: LegendItem, index: number) => void;
  /** Called when a legend item is hovered (for hover-dim). */
  onItemHover?: (item: LegendItem | null, index: number) => void;
  /** Optional font family override. Falls back to Segoe UI system stack. */
  fontFamily?: string;
  /** Optional font weight override. Falls back to 'normal'. */
  fontWeight?: string;
  /** Legend container padding on the horizontal axis. */
  paddingX?: number;
  /** Legend container padding on the vertical axis. */
  paddingY?: number;
  /** Gap between legend entries. */
  itemGap?: number;
  /** Gap between the swatch and label within a legend item. */
  entryGap?: number;
  /** Swatch size in pixels. */
  swatchSize?: number;
  /** Maximum legend-label width before truncation. Default: 180px. */
  maxLabelWidth?: number;
  /** Comma-separated label overrides. Position-matched: alias[0] → item[0], etc. */
  aliases?: string;
}

/**
 * Renders a shared legend with click-to-filter and hover-dim support.
 * Creates an HTML div-based legend (not SVG) for consistent layout across charts.
 * Returns the legend element for positioning within the container.
 */
export function renderLegend(
  container: HTMLElement,
  config: LegendConfig,
): HTMLElement {
  const existing = container.querySelector('.pbi-shared-legend');
  if (existing) existing.remove();

  const legend = document.createElement('div');
  legend.className = 'pbi-shared-legend';
  legend.setAttribute('role', config.onItemClick ? 'group' : 'list');
  legend.setAttribute('aria-label', 'Legend');

  const isVertical = config.position === 'left' || config.position === 'right';
  const paddingX = config.paddingX ?? 8;
  const paddingY = config.paddingY ?? 4;
  const itemGap = config.itemGap ?? (isVertical ? 4 : 12);
  const entryGap = config.entryGap ?? 4;
  const swatchSize = config.swatchSize ?? 10;
  const maxLabelWidth = config.maxLabelWidth ?? 180;

  legend.style.display = 'flex';
  legend.style.flexDirection = isVertical ? 'column' : 'row';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = `${itemGap}px`;
  legend.style.justifyContent = isVertical ? 'flex-start' : 'center';
  legend.style.alignItems = isVertical ? 'flex-start' : 'center';
  legend.style.padding = `${paddingY}px ${paddingX}px`;
  legend.style.fontSize = `${config.fontSize}px`;
  legend.style.fontFamily = config.fontFamily || "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
  legend.style.fontWeight = config.fontWeight || 'normal';
  legend.style.userSelect = 'none';
  legend.style.maxWidth = '100%';
  legend.style.maxHeight = '100%';
  legend.style.minWidth = '0';
  legend.style.boxSizing = 'border-box';
  legend.style.overflowX = isVertical ? 'hidden' : 'auto';
  legend.style.overflowY = isVertical ? 'auto' : 'hidden';

  // Parse comma-separated aliases for label overrides
  const aliasList = config.aliases
    ? config.aliases.split(',').map((a) => a.trim())
    : [];

  for (let i = 0; i < config.items.length; i++) {
    const item = config.items[i];
    const alias = aliasList[i];
    const displayLabel = (alias && alias.length > 0) ? alias : item.label;
    const entry = document.createElement('div');
    entry.className = 'pbi-legend-item';
    entry.style.display = 'flex';
    entry.style.alignItems = 'center';
    entry.style.gap = `${entryGap}px`;
    entry.style.cursor = config.onItemClick ? 'pointer' : 'default';
    entry.style.opacity = item.filtered ? '0.35' : '1';
    entry.style.transition = prefersReducedMotion() ? 'none' : 'opacity 0.2s ease';
    entry.setAttribute('aria-label', displayLabel);

    if (config.onItemClick) {
      entry.setAttribute('role', 'button');
      entry.setAttribute('aria-pressed', String(!item.filtered));
      entry.tabIndex = 0;
    } else {
      entry.setAttribute('role', 'listitem');
    }

    const swatch = document.createElement('span');
    swatch.style.width = `${swatchSize}px`;
    swatch.style.height = `${swatchSize}px`;
    swatch.style.borderRadius = '2px';
    swatch.style.backgroundColor = item.color;
    swatch.style.flexShrink = '0';
    swatch.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.style.color = config.fontColor || '#64748B';
    label.style.fontWeight = config.fontWeight || 'normal';
    label.style.whiteSpace = 'nowrap';
    label.style.maxWidth = `${maxLabelWidth}px`;
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.textContent = displayLabel;
    label.title = label.textContent;

    entry.appendChild(swatch);
    entry.appendChild(label);

    if (config.onItemClick) {
      const idx = i;
      entry.addEventListener('click', () => config.onItemClick!(item, idx));
      entry.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        config.onItemClick!(item, idx);
      });
    }
    if (config.onItemHover) {
      const idx = i;
      entry.addEventListener('mouseenter', () => config.onItemHover!(item, idx));
      entry.addEventListener('mouseleave', () => config.onItemHover!(null, -1));
      entry.addEventListener('focus', () => config.onItemHover!(item, idx));
      entry.addEventListener('blur', () => config.onItemHover!(null, -1));
    }

    legend.appendChild(entry);
  }

  // Insert legend in correct position relative to SVG/chart
  if (config.position === 'top') {
    container.insertBefore(legend, container.firstChild);
  } else if (config.position === 'bottom') {
    container.appendChild(legend);
  } else if (config.position === 'left') {
    legend.style.position = 'absolute';
    legend.style.left = '0';
    legend.style.top = '0';
    legend.style.height = '100%';
    container.insertBefore(legend, container.firstChild);
  } else {
    legend.style.position = 'absolute';
    legend.style.right = '0';
    legend.style.top = '0';
    legend.style.height = '100%';
    container.appendChild(legend);
  }

  return legend;
}

// ── Hover Dim Utility ──────────────────────────────────────────────

export interface HoverDimConfig {
  /** All elements that participate in hover-dim (e.g. bars, lines, arcs). */
  elements: ArrayLike<Element>;
  /** Opacity for non-hovered ("dimmed") elements. Default: 0.2 */
  dimOpacity?: number;
  /** Opacity for the hovered element. Default: 1 */
  activeOpacity?: number;
  /** CSS transition duration for smooth dim. Default: '0.2s' */
  transition?: string;
}

/**
 * Creates hover-dim behavior: when hovering one element, all others dim.
 * Returns a cleanup function to remove all listeners.
 */
export function createHoverDim(config: HoverDimConfig): () => void {
  const { elements, dimOpacity = 0.2, activeOpacity = 1, transition = '0.2s' } = config;
  const resolvedTransition = prefersReducedMotion() ? '0s' : transition;

  const cleanups: Array<() => void> = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement | SVGElement;

    const onEnter = (): void => {
      for (let j = 0; j < elements.length; j++) {
        const other = elements[j] as HTMLElement | SVGElement;
        other.style.transition = `opacity ${resolvedTransition} ease`;
        other.style.opacity = j === i ? String(activeOpacity) : String(dimOpacity);
      }
    };

    const onLeave = (): void => {
      for (let j = 0; j < elements.length; j++) {
        const other = elements[j] as HTMLElement | SVGElement;
        other.style.opacity = String(activeOpacity);
      }
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

// ── Sparkline Renderer ─────────────────────────────────────────────

export interface SparklineConfig {
  /** Values to plot. */
  values: number[];
  /** Width of the sparkline in px. */
  width: number;
  /** Height of the sparkline in px. */
  height: number;
  /** Line color. */
  lineColor: string;
  /** Line width. Default: 1.5 */
  lineWidth?: number;
  /** Fill color under the line (area chart mode). Null = no fill. */
  fillColor?: string;
  /** Fill opacity. Default: 0.15 */
  fillOpacity?: number;
  /** Whether to show a dot at the last value. Default: true */
  showEndDot?: boolean;
  /** End dot color. Defaults to lineColor. */
  endDotColor?: string;
}

/**
 * Renders a mini sparkline as an SVG element.
 * Returns the SVG element for insertion into a container.
 */
export function renderSparkline(config: SparklineConfig): SVGSVGElement {
  const {
    values,
    width,
    height,
    lineColor,
    lineWidth = 1.5,
    fillColor,
    fillOpacity = 0.15,
    showEndDot = true,
    endDotColor,
  } = config;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  if (values.length < 2) return svg;

  const padding = 2;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * plotW,
    y: padding + plotH - ((v - min) / range) * plotH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Area fill
  if (fillColor) {
    const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaD);
    area.setAttribute('fill', fillColor);
    area.setAttribute('opacity', String(fillOpacity));
    svg.appendChild(area);
  }

  // Line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathD);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', lineColor);
  line.setAttribute('stroke-width', String(lineWidth));
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);

  // End dot
  if (showEndDot && points.length > 0) {
    const last = points[points.length - 1];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(last.x));
    dot.setAttribute('cy', String(last.y));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', endDotColor ?? lineColor);
    svg.appendChild(dot);
  }

  return svg;
}

// ── Scrollable Chart Helper ─────────────────────────────────────────

export interface ScrollableChartOptions {
  container: HTMLElement;
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  scrollSettings: ScrollFormattingCard;
  availableChartWidth: number;
  availableChartHeight: number;
  direction: 'horizontal' | 'vertical';
  /** Padding between categories (px). Factored into the density check and expanded size. */
  categoryPadding?: number;
}

export interface ScrollableChartResult {
  svgParent: HTMLElement;
  svgWidth: number;
  svgHeight: number;
  chartWidth: number;
  chartHeight: number;
  isScrolling: boolean;
}

/** CSS class name for the scroll wrapper (used to detect duplicates). */
const SCROLL_WRAPPER_CLASS = 'pbi-scroll-wrapper';

/** Unique ID to ensure scrollbar styles are injected only once. */
const SCROLL_STYLE_ID = 'pbi-scroll-styles';

/**
 * Injects thin-scrollbar CSS into `document.head` if not already present.
 */
export function ensureScrollStyles(): void {
  if (document.getElementById(SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLL_STYLE_ID;
  style.textContent = `
    .${SCROLL_WRAPPER_CLASS} {
      scroll-behavior: smooth;
      scrollbar-width: thin;
    }
    .${SCROLL_WRAPPER_CLASS} > svg {
      width: auto !important;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar-track {
      background: transparent;
    }
    .${SCROLL_WRAPPER_CLASS}::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.4);
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a scrollable wrapper around a chart when categories exceed available
 * space at the configured minimum width per category.
 *
 * If scroll is not needed (few categories or disabled), returns the container
 * as-is with the original dimensions — zero overhead.
 */
export function createScrollableChart(options: ScrollableChartOptions): ScrollableChartResult {
  const {
    container,
    viewportWidth,
    viewportHeight,
    categoryCount,
    scrollSettings,
    availableChartWidth,
    availableChartHeight,
    direction,
  } = options;

  const enabled = scrollSettings.enableScroll.value;
  const minWidth = scrollSettings.minCategoryWidth.value;
  const padding = options.categoryPadding ?? 0;

  const isHorizontal = direction === 'horizontal';
  const availableSize = isHorizontal ? availableChartWidth : availableChartHeight;
  const requiredSize = categoryCount * minWidth + Math.max(0, categoryCount - 1) * padding;
  const needsScroll = enabled && categoryCount > 0 && requiredSize > availableSize;

  if (!needsScroll) {
    return {
      svgParent: container,
      svgWidth: viewportWidth,
      svgHeight: viewportHeight,
      chartWidth: availableChartWidth,
      chartHeight: availableChartHeight,
      isScrolling: false,
    };
  }

  ensureScrollStyles();

  const expandedSize = requiredSize;

  const wrapper = document.createElement('div');
  wrapper.className = SCROLL_WRAPPER_CLASS;

  if (isHorizontal) {
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'hidden';
    wrapper.style.width = '100%';
    wrapper.style.height = `${viewportHeight}px`;

    const expandedSvgWidth = viewportWidth - availableChartWidth + expandedSize;

    container.appendChild(wrapper);

    return {
      svgParent: wrapper,
      svgWidth: expandedSvgWidth,
      svgHeight: viewportHeight,
      chartWidth: expandedSize,
      chartHeight: availableChartHeight,
      isScrolling: true,
    };
  }

  // Vertical scroll
  wrapper.style.overflowX = 'hidden';
  wrapper.style.overflowY = 'auto';
  wrapper.style.width = `${viewportWidth}px`;
  wrapper.style.height = '100%';

  const expandedSvgHeight = viewportHeight - availableChartHeight + expandedSize;

  container.appendChild(wrapper);

  return {
    svgParent: wrapper,
    svgWidth: viewportWidth,
    svgHeight: expandedSvgHeight,
    chartWidth: availableChartWidth,
    chartHeight: expandedSize,
    isScrolling: true,
  };
}

// ── Date Filter Helper ──────────────────────────────────────────────

/**
 * Convert an ISO week number + year to the Monday of that week (epoch ms).
 * ISO 8601: week 1 is the week containing the first Thursday of the year.
 */
function weekToDate(week: number, year: number): number {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1 .. Sun=7
  // Monday of week 1
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
  // Advance to the requested week
  const target = new Date(week1Monday.getTime());
  target.setDate(week1Monday.getDate() + (week - 1) * 7);
  return target.getTime();
}

/** Work-week pattern: WW51'2025, WW51'25, WW51-2025, WW51 2025, ww01'2024, etc. */
const WW_PATTERN = /^[Ww]{2}(\d{1,2})['\s\-/](\d{2,4})$/;

/**
 * Parse a date string into epoch ms.
 * Supports: YYYY-MM-DD, MM/DD/YYYY, Date-parseable strings,
 * and work-week formats like WW51'2025, WW01'24, WW12-2025.
 * Returns NaN if the string is not a valid date.
 */
function parseDateValue(raw: unknown): number {
  if (raw == null) return NaN;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (s.length === 0) return NaN;

  // Try work-week format first
  const wwMatch = WW_PATTERN.exec(s);
  if (wwMatch) {
    const week = parseInt(wwMatch[1], 10);
    let year = parseInt(wwMatch[2], 10);
    if (year < 100) year += 2000; // WW51'25 → 2025
    if (week >= 1 && week <= 53 && year >= 1900 && year <= 2100) {
      return weekToDate(week, year);
    }
  }

  // Standard date parsing
  const t = new Date(s).getTime();
  return t;
}

export interface DateFilterConfig {
  enabled: boolean;
  startDate: string;
  endAtCurrentDate: boolean;
  endDate: string;
}

/**
 * Returns true if the column's type descriptor indicates a date/datetime column.
 * Use this to guard `getDateFilterIndices` — text columns whose values happen to
 * parse as dates (e.g. "2024", "May", "01/02") should never be date-filtered.
 */
export function isDateColumn(source: { type?: { dateTime?: boolean; temporal?: unknown } } | undefined): boolean {
  if (!source?.type) return false;
  return source.type.dateTime === true || source.type.temporal != null;
}

/**
 * Returns a Set of row indices that pass the date filter.
 * The `categoryValues` array is the raw category column values from the dataView.
 * If the filter is disabled or both dates are empty, returns null (meaning "include all").
 */
export function getDateFilterIndices(
  categoryValues: ReadonlyArray<unknown>,
  config: DateFilterConfig,
): Set<number> | null {
  if (!config.enabled) return null;

  const hasStart = config.startDate.trim().length > 0;
  const useCurrentEnd = config.endAtCurrentDate;
  const hasEnd = useCurrentEnd || config.endDate.trim().length > 0;
  if (!hasStart && !hasEnd) return null;

  const startMs = hasStart ? parseDateValue(config.startDate) : -Infinity;
  // End of current day (23:59:59.999) when using current date
  const endMs = useCurrentEnd
    ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999).getTime()
    : (hasEnd ? parseDateValue(config.endDate) : Infinity);

  // If dates are invalid, skip filtering to avoid hiding all data
  if (hasStart && Number.isNaN(startMs)) return null;
  if (!useCurrentEnd && hasEnd && Number.isNaN(endMs)) return null;

  const indices = new Set<number>();
  for (let i = 0; i < categoryValues.length; i++) {
    const val = parseDateValue(categoryValues[i]);
    if (Number.isNaN(val)) {
      // Non-date category values — include them (don't hide non-date data)
      indices.add(i);
      continue;
    }
    if (val >= startMs && val <= endMs) {
      indices.add(i);
    }
  }
  return indices;
}

// ── Inline End-of-Line Labels ──────────────────────────────────────────

export interface InlineLabelItem {
  label: string;
  x: number;
  y: number;
  color: string;
}

export interface InlineLabelConfig {
  items: InlineLabelItem[];
  fontSize: number;
  offset: number;
  fontFamily?: string;
}

/**
 * Renders inline labels at the end of each line series inside an SVG group.
 * Labels are placed to the right of the last data point, colored to match
 * the series. Overlapping labels are nudged apart vertically.
 */
export function renderInlineLabels(
  g: SVGGElement,
  config: InlineLabelConfig,
): void {
  const { items, fontSize, offset, fontFamily } = config;
  if (items.length === 0) return;

  // Sort by y position to detect overlaps
  const sorted = items.map((item, idx) => ({ ...item, idx }))
    .sort((a, b) => a.y - b.y);

  // Nudge overlapping labels apart (minimum spacing = fontSize)
  const minSpacing = fontSize * 1.2;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.y - prev.y < minSpacing) {
      curr.y = prev.y + minSpacing;
    }
  }

  const ns = 'http://www.w3.org/2000/svg';
  for (const item of sorted) {
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('class', 'pbi-inline-label');
    text.setAttribute('x', String(item.x + offset));
    text.setAttribute('y', String(item.y));
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', `${fontSize}px`);
    text.setAttribute('fill', item.color);
    text.setAttribute('font-family', fontFamily || "'Segoe UI', sans-serif");
    text.textContent = item.label;
    g.appendChild(text);
  }
}
