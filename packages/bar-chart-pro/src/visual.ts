/**
 * Bar Chart Pro — Power BI IVisual implementation.
 * Supports grouped, stacked, combo, horizontal, and diverging chart modes
 * with glassmorphic styling, staggered entrance animations, and line overlays.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BarChartProSettings } from './settings';
import {
  formatNumber,
  formatWithSettings,
  animate,
  drawPath,
  cubicOut,
  DURATION,
  getTheme,
  getHostChartColor,
  withOpacity,
  getGlassStyle,
  growBar,
  fadeSlideIn,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  createScrollableChart,
  resolveDropdown,
  renderLegend,
  renderHorizontalReferenceLine,
  renderVerticalReferenceLine,
  computeStatValue,
  computeRegression,
  renderTrendLine,
  resolveConditionalColor,
  buildConditionalConfig,
  renderAnnotations,
  buildAnnotationConfig,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  type LegendItem,
  type StatType,
  type TrendType,
  type SeriesFormatting,
  type LineStyleType,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
  resolveColorTheme,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

type ChartMode = 'grouped' | 'stacked' | 'stacked100' | 'combo' | 'horizontal' | 'diverging';
type DataLabelMode = 'none' | 'above' | 'inside';
type LegendPosition = 'bottom' | 'top' | 'left' | 'right';
type LineStyle = 'solid' | 'dashed';

interface BarSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface LineSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface ChartData {
  categories: string[];
  categoryLabelsByKey: Record<string, string>;
  categorySelectionIds: ISelectionId[];
  barSeries: BarSeries[];
  lineSeries: LineSeries[];
  targetValue: number | null;
  isEmpty: boolean;
  /** Color override for the "Others" category when Top N is enabled */
  othersColor?: string;
  /** Whether the data has a sub-category level for drill-down */
  hasSubCategory: boolean;
  /** Map from category label to its sub-category ChartData */
  subCategoryMap: Map<string, ChartData>;
}

/** Margin around the SVG chart area */
interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MARGIN_DEFAULT: Margin = { top: 8, right: 12, bottom: 36, left: 44 };
const MARGIN_SECONDARY_Y: Margin = { top: 8, right: 44, bottom: 36, left: 44 };
const LEGEND_HEIGHT_MIN = 28;
const MIN_BAR_WIDTH = 2;
const LINE_DOT_RADIUS = 4;

// ── Visual ──────────────────────────────────────────────────────────

export class BarChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BarChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private gradientIdCounter = 0;
  /** Cached resolved per-series formats for the current render cycle */
  private cachedSeriesFormats: SeriesFormatting[] = [];

  /** Chain of category values the user has drilled into */
  private drillPath: string[] = [];
  /** Full extracted data, kept for drill-down without re-parsing */
  private currentData: ChartData | null = null;
  /** Last known viewport for re-renders on drill navigation */
  private currentViewport: powerbi.IViewport = { width: 300, height: 300 };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BarChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('bar-chart-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BarChartProSettings,
        dataView,
      );
    }

    // Extract data
    const rawData = this.extractData(dataView);
    const data = this.applyTopN(rawData);
    this.currentData = data;
    this.currentViewport = options.viewport;

    // Populate per-series formatting groups and cache resolved formats
    this.populateSeriesFormattingGroups(dataView, data);
    this.cachedSeriesFormats = [
      ...data.barSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color)),
      ...data.lineSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, data.barSeries.length + i, s.color)),
    ];

    // Hide axis selectors when not in combo mode
    const rawMode = resolveDropdown(this.settings.chartMode.mode) ?? 'grouped';
    const isCombo = rawMode === 'combo' || (rawMode === 'grouped' && data.lineSeries.length > 0);
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = isCombo;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = isCombo;

    // Hide secondary axis card when not in combo mode
    this.settings.secondaryAxisSettings.showSecondaryYAxis.visible = isCombo;

    // Hide shared card's showDataLabels toggle — bar-chart-pro uses barSettings.showDataLabels dropdown instead
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    // Hide shared card's dataLabelPosition — bar-chart-pro uses barSettings.showDataLabels (none/above/inside) for positioning
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // ── Conditional visibility for mode-specific and toggle-dependent settings ──
    const s = this.settings;

    // Line Settings — hide when not in combo mode
    s.lineSettings.showDots.visible = isCombo;
    s.lineSettings.showLineDataLabels.visible = isCombo;
    s.lineSettings.lineGradientFill.visible = isCombo;
    s.lineSettings.lineGradientOpacity.visible = isCombo && s.lineSettings.lineGradientFill.value;

    // Secondary Axis — hide title when showSecondaryYAxis is off or not combo
    s.secondaryAxisSettings.secondaryYAxisTitle.visible = s.secondaryAxisSettings.showSecondaryYAxis.value && isCombo;

    // Pattern Fill — hide sub-settings when disabled
    s.patternFillSettings.pattern.visible = s.patternFillSettings.enabled.value;
    s.patternFillSettings.patternOpacity.visible = s.patternFillSettings.enabled.value;

    // Variance Indicators — hide sub-settings when show is off
    s.varianceSettings.showDelta.visible = s.varianceSettings.show.value;
    s.varianceSettings.showArrow.visible = s.varianceSettings.show.value;
    s.varianceSettings.positiveColor.visible = s.varianceSettings.show.value;
    s.varianceSettings.negativeColor.visible = s.varianceSettings.show.value;

    // Benchmark Band — hide sub-settings when show is off
    s.benchmarkBandSettings.lowerBound.visible = s.benchmarkBandSettings.show.value;
    s.benchmarkBandSettings.upperBound.visible = s.benchmarkBandSettings.show.value;
    s.benchmarkBandSettings.bandColor.visible = s.benchmarkBandSettings.show.value;
    s.benchmarkBandSettings.bandOpacity.visible = s.benchmarkBandSettings.show.value;
    s.benchmarkBandSettings.label.visible = s.benchmarkBandSettings.show.value;

    // Top N — hide sub-settings when disabled
    s.topNSettings.topN.visible = s.topNSettings.enabled.value;
    s.topNSettings.othersLabel.visible = s.topNSettings.enabled.value;
    s.topNSettings.othersColor.visible = s.topNSettings.enabled.value;
    s.topNSettings.sortBy.visible = s.topNSettings.enabled.value;

    // Drill-Down — hide sub-settings when disabled
    s.drillDownSettings.showBreadcrumb.visible = s.drillDownSettings.enabled.value;
    s.drillDownSettings.breadcrumbFontSize.visible = s.drillDownSettings.enabled.value;
    s.drillDownSettings.breadcrumbColor.visible = s.drillDownSettings.enabled.value;

    // Animation — hide sub-settings when disabled
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;
    s.animationSettings.staggerDelay.visible = s.animationSettings.enabled.value;

    // Reset drill if data changed structurally
    if (data.isEmpty || !data.hasSubCategory) {
      this.drillPath = [];
    }

    // Apply glass effect
    this.applyCardStyle();

    // Resolve drill path to get the effective data
    const effectiveData = this.resolveDrillData(data);

    // Render
    if (effectiveData.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(effectiveData, options.viewport);
    }
  }

  // ── Per-Series Formatting ─────────────────────────────────────────

  /**
   * Dynamically populate the SeriesFormattingCard with one group per
   * data column (values + lineValues), reading persisted per-series
   * overrides from the dataView objects.
   */
  private populateSeriesFormattingGroups(dataView: DataView | undefined, data: ChartData): void {
    const colorLookup = new Map<string, string>();
    for (const s of data.barSeries) colorLookup.set(s.name, s.color);
    for (const s of data.lineSeries) colorLookup.set(s.name, s.color);

    populateSeriesFormattingGroups(
      this.settings.seriesFormattingCard,
      dataView,
      ['values', 'lineValues'],
      colorLookup,
      { hideLineProps: (role) => !!role['values'] },
    );
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ChartData {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const empty: ChartData = {
      categories: [],
      categoryLabelsByKey: {},
      categorySelectionIds: [],
      barSeries: [],
      lineSeries: [],
      targetValue: null,
      isEmpty: true,
      hasSubCategory: false,
      subCategoryMap: new Map<string, ChartData>(),
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const subCategoryColumn = categorical.categories && categorical.categories.length > 1
      ? categorical.categories[1]
      : null;
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    const hasSubCategory = subCategoryColumn !== null;

    // Extract category labels and stable unique keys.
    const categoryLabels = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );
    const categories = categoryLabels.map((label, idx) => `${idx}::${label}`);
    const categoryLabelsByKey: Record<string, string> = {};
    categories.forEach((key, idx) => {
      categoryLabelsByKey[key] = categoryLabels[idx];
    });

    const categorySelectionIds = categories.map((_, idx) =>
      this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, idx)
        .createSelectionId(),
    );

    if (categories.length === 0) return empty;

    const barSeries: BarSeries[] = [];
    const lineSeries: LineSeries[] = [];
    let targetValue: number | null = null;
    let colorIdx = 0;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['values']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        barSeries.push({
          name: col.source.displayName ?? `Series ${barSeries.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx, themeName),
        });
        colorIdx++;
      }

      if (role['lineValues']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        lineSeries.push({
          name: col.source.displayName ?? `Line ${lineSeries.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx, themeName),
        });
        colorIdx++;
      }

      if (role['target'] && col.values.length > 0) {
        // Use the first non-null target value (it's a constant measure)
        for (const v of col.values) {
          if (typeof v === 'number') {
            targetValue = v;
            break;
          }
        }
      }
    }

    // Build sub-category map for drill-down when sub-category column is present
    const subCategoryMap = new Map<string, ChartData>();

    if (hasSubCategory && subCategoryColumn) {
      // Group rows by parent category label
      const catGroups = new Map<string, number[]>();
      for (let i = 0; i < categoryLabels.length; i++) {
        const catLabel = categoryLabels[i];
        const existing = catGroups.get(catLabel);
        if (existing) {
          existing.push(i);
        } else {
          catGroups.set(catLabel, [i]);
        }
      }

      for (const [catLabel, rowIndices] of catGroups) {
        // Build sub-category data for this parent category
        const subLabels: string[] = [];
        const subKeys: string[] = [];
        const subSelectionIds: ISelectionId[] = [];
        const subLabelsByKey: Record<string, string> = {};

        for (let si = 0; si < rowIndices.length; si++) {
          const ri = rowIndices[si];
          const subRaw = subCategoryColumn.values[ri];
          const subLabel = subRaw !== null && subRaw !== undefined ? String(subRaw) : '';
          const subKey = `${si}::${subLabel}`;
          subLabels.push(subLabel);
          subKeys.push(subKey);
          subLabelsByKey[subKey] = subLabel;
          subSelectionIds.push(
            this.host.createSelectionIdBuilder()
              .withCategory(categoryColumn, ri)
              .withCategory(subCategoryColumn, ri)
              .createSelectionId(),
          );
        }

        const subBarSeries: BarSeries[] = barSeries.map((series, seriesIdx) => {
          const subVals = rowIndices.map((ri) => series.values[ri]);
          return {
            name: series.name,
            values: subVals,
            color: getHostChartColor(this.host.colorPalette, seriesIdx, themeName),
          };
        });

        const subLineSeries: LineSeries[] = lineSeries.map((series, seriesIdx) => {
          const subVals = rowIndices.map((ri) => series.values[ri]);
          return {
            name: series.name,
            values: subVals,
            color: getHostChartColor(this.host.colorPalette, barSeries.length + seriesIdx, themeName),
          };
        });

        subCategoryMap.set(catLabel, {
          categories: subKeys,
          categoryLabelsByKey: subLabelsByKey,
          categorySelectionIds: subSelectionIds,
          barSeries: subBarSeries,
          lineSeries: subLineSeries,
          targetValue,
          isEmpty: subBarSeries.length === 0,
          hasSubCategory: false,
          subCategoryMap: new Map<string, ChartData>(),
        });
      }

      // When sub-category is present, aggregate categories to unique parent categories
      // for the top-level view
      const uniqueCatLabels: string[] = [];
      const uniqueCatKeys: string[] = [];
      const uniqueCatLabelsByKey: Record<string, string> = {};
      const uniqueCatSelectionIds: ISelectionId[] = [];
      const seenCats = new Set<string>();

      for (let i = 0; i < categoryLabels.length; i++) {
        const catLabel = categoryLabels[i];
        if (!seenCats.has(catLabel)) {
          seenCats.add(catLabel);
          const key = `${uniqueCatLabels.length}::${catLabel}`;
          uniqueCatLabels.push(catLabel);
          uniqueCatKeys.push(key);
          uniqueCatLabelsByKey[key] = catLabel;
          uniqueCatSelectionIds.push(
            this.host.createSelectionIdBuilder()
              .withCategory(categoryColumn, i)
              .createSelectionId(),
          );
        }
      }

      // Aggregate bar series values per unique category
      const aggregatedBarSeries: BarSeries[] = barSeries.map((series, seriesIdx) => {
        const aggVals: (number | null)[] = [];
        for (const catLabel of uniqueCatLabels) {
          const indices = catGroups.get(catLabel) ?? [];
          let sum: number | null = null;
          for (const ri of indices) {
            const v = series.values[ri];
            if (v !== null) {
              sum = (sum ?? 0) + v;
            }
          }
          aggVals.push(sum);
        }
        return {
          name: series.name,
          values: aggVals,
          color: getHostChartColor(this.host.colorPalette, seriesIdx, themeName),
        };
      });

      const aggregatedLineSeries: LineSeries[] = lineSeries.map((series, seriesIdx) => {
        const aggVals: (number | null)[] = [];
        for (const catLabel of uniqueCatLabels) {
          const indices = catGroups.get(catLabel) ?? [];
          let sum: number | null = null;
          for (const ri of indices) {
            const v = series.values[ri];
            if (v !== null) {
              sum = (sum ?? 0) + v;
            }
          }
          aggVals.push(sum);
        }
        return {
          name: series.name,
          values: aggVals,
          color: getHostChartColor(this.host.colorPalette, barSeries.length + seriesIdx, themeName),
        };
      });

      return {
        categories: uniqueCatKeys,
        categoryLabelsByKey: uniqueCatLabelsByKey,
        categorySelectionIds: uniqueCatSelectionIds,
        barSeries: aggregatedBarSeries,
        lineSeries: aggregatedLineSeries,
        targetValue,
        isEmpty: aggregatedBarSeries.length === 0,
        hasSubCategory: true,
        subCategoryMap,
      };
    }

    return {
      categories,
      categoryLabelsByKey,
      categorySelectionIds,
      barSeries,
      lineSeries,
      targetValue,
      isEmpty: barSeries.length === 0,
      hasSubCategory: false,
      subCategoryMap,
    };
  }

  // ── Top N Grouping ──────────────────────────────────────────────

  private applyTopN(data: ChartData): ChartData {
    const topNSettings = this.settings.topNSettings;
    if (!topNSettings.enabled.value || data.isEmpty) return data;

    const n = Math.max(1, topNSettings.topN.value);
    if (data.categories.length <= n) return data;

    const sortBy = resolveDropdown(topNSettings.sortBy) ?? 'value';

    // Build an index array to sort categories
    const indices = data.categories.map((_, i) => i);

    if (sortBy === 'name') {
      indices.sort((a, b) => {
        const labelA = data.categoryLabelsByKey[data.categories[a]] ?? '';
        const labelB = data.categoryLabelsByKey[data.categories[b]] ?? '';
        return labelA.localeCompare(labelB);
      });
    } else {
      // Sort by total value across all bar series (descending)
      indices.sort((a, b) => {
        let totalA = 0;
        let totalB = 0;
        for (const series of data.barSeries) {
          const va = series.values[a];
          const vb = series.values[b];
          if (va !== null) totalA += Math.abs(va);
          if (vb !== null) totalB += Math.abs(vb);
        }
        return totalB - totalA;
      });
    }

    const topIndices = indices.slice(0, n);
    const remainingIndices = indices.slice(n);

    if (remainingIndices.length === 0) return data;

    // Build the "Others" category key
    const othersLabel = topNSettings.othersLabel.value || 'Others';
    const othersKey = `${data.categories.length}::${othersLabel}`;

    // Build new categories array
    const newCategories = topIndices.map((i) => data.categories[i]);
    newCategories.push(othersKey);

    // Build new categoryLabelsByKey
    const newCategoryLabelsByKey: Record<string, string> = {};
    for (const key of newCategories) {
      newCategoryLabelsByKey[key] = data.categoryLabelsByKey[key] ?? key;
    }
    newCategoryLabelsByKey[othersKey] = othersLabel;

    // Build new categorySelectionIds — use the first remaining category's ID as a
    // placeholder for "Others"; PBI requires an ISelectionId. We use the first
    // top category's selection id builder produces one, but for Others we just
    // reuse the first remaining entry (it won't drill but avoids null issues).
    const newSelectionIds = topIndices.map((i) => data.categorySelectionIds[i]);
    newSelectionIds.push(data.categorySelectionIds[remainingIndices[0]]);

    // Build new barSeries with summed "Others" values
    const othersColor = topNSettings.othersColor.value?.value ?? '#94A3B8';
    const newBarSeries: BarSeries[] = data.barSeries.map((series) => {
      const newValues: (number | null)[] = topIndices.map((i) => series.values[i]);
      // Sum remaining values for "Others"
      let othersSum: number | null = null;
      for (const i of remainingIndices) {
        const v = series.values[i];
        if (v !== null) {
          othersSum = (othersSum ?? 0) + v;
        }
      }
      newValues.push(othersSum);
      return {
        name: series.name,
        values: newValues,
        color: series.color,
      };
    });

    // Build new lineSeries similarly
    const newLineSeries: LineSeries[] = data.lineSeries.map((series) => {
      const newValues: (number | null)[] = topIndices.map((i) => series.values[i]);
      let othersSum: number | null = null;
      for (const i of remainingIndices) {
        const v = series.values[i];
        if (v !== null) {
          othersSum = (othersSum ?? 0) + v;
        }
      }
      newValues.push(othersSum);
      return {
        name: series.name,
        values: newValues,
        color: series.color,
      };
    });

    return {
      categories: newCategories,
      categoryLabelsByKey: newCategoryLabelsByKey,
      categorySelectionIds: newSelectionIds,
      barSeries: newBarSeries,
      lineSeries: newLineSeries,
      targetValue: data.targetValue,
      isEmpty: false,
      othersColor,
      hasSubCategory: data.hasSubCategory,
      subCategoryMap: data.subCategoryMap,
    };
  }

  // ── Drill-Down Resolution ───────────────────────────────────────

  private resolveDrillData(data: ChartData): ChartData {
    if (!this.settings.drillDownSettings.enabled.value || this.drillPath.length === 0) {
      return data;
    }

    // Walk the drill path to find the target sub-data
    let current = data;
    for (const segment of this.drillPath) {
      const sub = current.subCategoryMap.get(segment);
      if (sub) {
        current = sub;
      } else {
        // Path is invalid, reset
        this.drillPath = [];
        return data;
      }
    }
    return current;
  }

  // ── Breadcrumb ────────────────────────────────────────────────────

  private renderBreadcrumb(): void {
    const ds = this.settings.drillDownSettings;
    if (!ds.showBreadcrumb.value || this.drillPath.length === 0) return;

    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'bar-chart-breadcrumb';
    breadcrumb.style.display = 'flex';
    breadcrumb.style.alignItems = 'center';
    breadcrumb.style.gap = '4px';
    breadcrumb.style.padding = '4px 8px';
    breadcrumb.style.fontSize = `${fontSize}px`;
    breadcrumb.style.color = color;
    breadcrumb.style.flexWrap = 'wrap';

    // "All" root segment
    const allSpan = document.createElement('span');
    allSpan.textContent = 'All';
    allSpan.style.cursor = 'pointer';
    allSpan.style.textDecoration = 'underline';
    allSpan.style.color = color;
    allSpan.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      this.drillPath = [];
      this.reRenderWithDrill();
    });
    breadcrumb.appendChild(allSpan);

    for (let i = 0; i < this.drillPath.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.color = color;
      breadcrumb.appendChild(sep);

      const segment = document.createElement('span');
      segment.textContent = this.drillPath[i];
      segment.style.color = color;

      if (i < this.drillPath.length - 1) {
        segment.style.cursor = 'pointer';
        segment.style.textDecoration = 'underline';
        const targetIndex = i;
        segment.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.drillPath = this.drillPath.slice(0, targetIndex + 1);
          this.reRenderWithDrill();
        });
      } else {
        segment.style.fontWeight = '600';
      }

      breadcrumb.appendChild(segment);
    }

    this.container.appendChild(breadcrumb);

    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(breadcrumb, 'left', DURATION.fast);
      this.cancelAnimations.push(cancel);
    }
  }

  private reRenderWithDrill(): void {
    if (!this.currentData) return;
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    const effectiveData = this.resolveDrillData(this.currentData);
    if (effectiveData.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(effectiveData, this.currentViewport);
    }
  }

  // ── Card Style ──────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      // Reset glass styles
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ─────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'bar-chart-empty';
    emptyEl.textContent = 'Add a Category and at least one Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ─────────────────────────────────────────────────

  private render(data: ChartData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    // Render breadcrumb if drilled
    if (this.settings.drillDownSettings.enabled.value && this.drillPath.length > 0) {
      this.renderBreadcrumb();
    }

    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('click', this.handleBackgroundClick);

    const rawMode = this.getChartMode();
    // Auto-switch to combo when line data is present and mode is grouped (default)
    const mode: ChartMode = rawMode === 'grouped' && data.lineSeries.length > 0 ? 'combo' : rawMode;
    const s = this.settings;

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value && (data.barSeries.length > 1 || data.lineSeries.length > 0);
    const legendPos = this.getLegendPosition();
    const legendFontSize = s.legendFormattingCard.legendFontSize.value;
    const legendReserve = showLegend ? Math.max(LEGEND_HEIGHT_MIN, legendFontSize + 16) : 0;

    // Margins
    const hasSecondaryY = mode === 'combo' && s.secondaryAxisSettings.showSecondaryYAxis.value && data.lineSeries.length > 0;
    const margin: Margin = hasSecondaryY ? { ...MARGIN_SECONDARY_Y } : { ...MARGIN_DEFAULT };

    if (!s.axisFormattingCard.showXAxis.value) margin.bottom = 8;
    if (!s.axisFormattingCard.showYAxis.value) margin.left = 8;
    // Expand margins when axis titles are set to prevent clipping
    if (s.axisFormattingCard.xAxisTitle.value && s.axisFormattingCard.showXAxis.value) margin.bottom += 20;
    if (s.axisFormattingCard.yAxisTitle.value && s.axisFormattingCard.showYAxis.value) margin.left += 18;
    if (hasSecondaryY && s.secondaryAxisSettings.secondaryYAxisTitle.value) margin.right += 18;
    if (legendPos === 'top') margin.top += legendReserve;
    if (legendPos === 'left') margin.left += 80;
    if (legendPos === 'right') margin.right += 80;

    // Compute chart dimensions
    const padding = 12; // CSS padding on container
    const baseSvgWidth = viewport.width - padding * 2;
    const baseSvgHeight = viewport.height - padding * 2 - (legendPos === 'bottom' || legendPos === 'top' ? legendReserve : 0);
    const baseChartWidth = Math.max(0, baseSvgWidth - margin.left - margin.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - margin.top - margin.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support
    const scrollDir = mode === 'horizontal' ? 'vertical' as const : 'horizontal' as const;
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: baseSvgWidth,
      viewportHeight: baseSvgHeight,
      categoryCount: data.categories.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseChartWidth,
      availableChartHeight: baseChartHeight,
      direction: scrollDir,
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderLegend(data);
    }

    // SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'bar-chart-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Gradient defs (created once per render, shared by all bars)
    this.gradientIdCounter = 0;
    const useGradient = s.barSettings.useGradient.value;
    const defs = useGradient ? svg.append('defs') : null;

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Dispatch to mode-specific renderer
    switch (mode) {
      case 'horizontal':
        this.renderHorizontal(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'stacked':
        this.renderStacked(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'stacked100':
        this.renderStacked100(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'diverging':
        this.renderDiverging(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'combo':
        this.renderCombo(chartGroup, data, chartWidth, chartHeight, hasSecondaryY, defs);
        break;
      case 'grouped':
      default:
        this.renderGrouped(chartGroup, data, chartWidth, chartHeight, defs);
        break;
    }

    // Legend (bottom, left, or right)
    if (showLegend && legendPos !== 'top') {
      this.renderLegend(data);
    }

  // Apply axis and grid formatting from settings
  const svgEl = this.container.querySelector('svg');
  if (svgEl) {
    svgEl.querySelectorAll('[class*="bar-chart-axis"]').forEach((el) => {
      applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
    });
    svgEl.querySelectorAll('[class*="bar-chart-grid"]').forEach((el) => {
      applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
    });

    // Pattern fill defs
    this.applyPatternFillDefs(d3.select(svgEl as SVGSVGElement));

    // Apply data label formatting (must run after labels are rendered)
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bar-chart-label');
  }

  // Accessibility
  this.applyAccessibility(data);
}

  // ── Grouped Mode ────────────────────────────────────────────────

  private renderGrouped(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Scales
    const x0 = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(Math.max(0, Math.min(0.9, 0.1 + spacing * 0.02)))
      .paddingOuter(0.05);

    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const x1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const allValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yMax = d3.max(allValues) ?? 0;
    const y = d3.scaleLinear()
      .domain(this.applyYAxisOverrides([0, yMax * 1.1]))
      .nice()
      .range([height, 0]);

    // Grid + axes
    this.renderGrid(g, y, width, height);
    this.renderAxes(g, x0, y, width, height, null, data.categoryLabelsByKey);

    // Pre-compute per-series formatting
    const barSeriesFormats = data.barSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    // Bars
    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined) return;

        const sf = barSeriesFormats[serIdx];
        const barX = (x0(cat) ?? 0) + (x1(String(serIdx)) ?? 0);
        const barW = Math.max(MIN_BAR_WIDTH, x1.bandwidth());
        const barY = y(val);
        const barH = height - barY;

        const conditionalFill = this.getConditionalBarColor(val);
        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barW / 2))
          .attr('ry', Math.min(cornerRadius, barW / 2))
          .attr('fill', conditionalFill ?? this.getBarFill(defs, sf.color, 'vertical', this.getOthersColor(data, catIdx)))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

        this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');
        // Use the global data label dropdown as the primary control;
        // per-series showLabels is a secondary override
        if (this.getDataLabelMode() !== 'none' || sf.showLabels) {
          this.renderDataLabel(g, barX + barW / 2, barY, barH, val, height);
        }
      });
    });

    // Target line & overlays
    this.renderTargetLine(g, data.targetValue, y, width);
    this.renderReferenceLine(g, y, width, allValues);
    this.renderBenchmarkBand(g, y, width);
    this.renderTrendLineOverlay(g, allValues, (i) => (x0(data.categories[i]) ?? 0) + x0.bandwidth() / 2, y);
    this.renderAnnotationOverlay(g, data, x0, y);

    // Variance indicators (per-category, first series only)
    if (data.barSeries.length > 0) {
      const firstVals = data.barSeries[0].values.filter((v): v is number => v !== null);
      const xPositions = data.categories.map((cat) => (x0(cat) ?? 0) + x0.bandwidth() / 2);
      this.renderVarianceIndicators(g, firstVals, data.targetValue, xPositions, y);
    }
  }

  // ── Stacked Mode ────────────────────────────────────────────────

  private renderStacked(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(Math.max(0, Math.min(0.9, 0.1 + spacing * 0.02)))
      .paddingOuter(0.05);

    // Compute stacked positive and negative totals per category
    const stackedMax = data.categories.map((_, catIdx) => {
      let posTotal = 0;
      let negTotal = 0;
      for (const series of data.barSeries) {
        const v = series.values[catIdx];
        if (v !== null && v !== undefined) {
          if (v > 0) posTotal += v;
          else if (v < 0) negTotal += v;
        }
      }
      return { posTotal, negTotal };
    });

    const yMax = d3.max(stackedMax, (d) => d.posTotal) ?? 0;
    const yMin = d3.min(stackedMax, (d) => d.negTotal) ?? 0;
    const y = d3.scaleLinear()
      .domain(this.applyYAxisOverrides([yMin * 1.1, yMax * 1.1]))
      .nice()
      .range([height, 0]);

    this.renderGrid(g, y, width, height);
    this.renderAxes(g, x, y, width, height, null, data.categoryLabelsByKey);

    // Pre-compute per-series formatting
    const barSeriesFormats = data.barSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    data.categories.forEach((cat, catIdx) => {
      let posCumulative = 0;
      let negCumulative = 0;
      const barW = Math.max(MIN_BAR_WIDTH, x.bandwidth());

      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined) return;

        const isNegative = val < 0;
        const cumulative = isNegative ? negCumulative : posCumulative;

        const barX = x(cat) ?? 0;
        const barY = isNegative ? y(cumulative) : y(cumulative + val);
        const barH = Math.abs(y(cumulative) - y(cumulative + val));

        // Only round the outermost segment (top for positive, bottom for negative)
        const isOuterSegment = serIdx === data.barSeries.length - 1 ||
          data.barSeries.slice(serIdx + 1).every((s) => {
            const sv = s.values[catIdx];
            if (sv === null || sv === undefined) return true;
            // Check same sign — only consider same-direction segments
            return isNegative ? sv >= 0 : sv <= 0;
          });

        const rx = isOuterSegment ? Math.min(cornerRadius, barW / 2) : 0;
        const ry = isOuterSegment ? Math.min(cornerRadius, barW / 2) : 0;

        const sf = barSeriesFormats[serIdx];
        const conditionalFill = this.getConditionalBarColor(val);
        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', Math.max(0, barH))
          .attr('rx', rx)
          .attr('ry', ry)
          .attr('fill', conditionalFill ?? this.getBarFill(defs, sf.color, 'vertical', this.getOthersColor(data, catIdx)))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

        this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');

        if (isNegative) {
          negCumulative += val;
        } else {
          posCumulative += val;
        }
      });

      // Data labels on top of positive stack and bottom of negative stack
      if (this.getDataLabelMode() !== 'none') {
        if (posCumulative > 0) {
          this.renderDataLabel(g, (x(cat) ?? 0) + barW / 2, y(posCumulative), height - y(posCumulative), posCumulative, height);
        }
        if (negCumulative < 0) {
          this.renderDataLabel(g, (x(cat) ?? 0) + barW / 2, y(negCumulative), y(negCumulative) - y(0), negCumulative, height);
        }
      }
    });

    // Compute stacked totals for trend line and variance indicators
    // Uses net total (positive + negative) for accurate trend representation
    const stackedTotals = data.categories.map((_, catIdx) => {
      let total = 0;
      for (const series of data.barSeries) {
        const v = series.values[catIdx];
        if (v !== null && v !== undefined) total += v;
      }
      return total;
    });

    const stackedValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    this.renderTargetLine(g, data.targetValue, y, width);
    this.renderReferenceLine(g, y, width, stackedValues);
    this.renderBenchmarkBand(g, y, width);
    this.renderTrendLineOverlay(g, stackedTotals, (i) => (x(data.categories[i]) ?? 0) + x.bandwidth() / 2, y);
    this.renderAnnotationOverlay(g, data, x, y);

    // Variance indicators — compare stacked totals per category against target
    const xPositions = data.categories.map((cat) => (x(cat) ?? 0) + x.bandwidth() / 2);
    this.renderVarianceIndicators(g, stackedTotals, data.targetValue, xPositions, y);
  }

  // ── 100% Stacked Mode ───────────────────────────────────────────

  private renderStacked100(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(Math.max(0, Math.min(0.9, 0.1 + spacing * 0.02)))
      .paddingOuter(0.05);

    // Compute category totals for normalization using absolute values.
    // Negative values contribute their absolute value to the 100% total
    // since percentages cannot be negative.
    const categoryTotals = data.categories.map((_, catIdx) => {
      let total = 0;
      for (const series of data.barSeries) {
        const v = series.values[catIdx];
        if (v !== null && v !== undefined) total += Math.abs(v);
      }
      return total;
    });

    // Y-axis fixed to 0–100%
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    this.renderGrid(g, y, width, height);
    this.renderStacked100Axes(g, x, y, width, height, data.categoryLabelsByKey);

    // Pre-compute per-series formatting
    const barSeriesFormats = data.barSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    data.categories.forEach((cat, catIdx) => {
      let cumulative = 0;
      const barW = Math.max(MIN_BAR_WIDTH, x.bandwidth());
      const total = categoryTotals[catIdx];

      data.barSeries.forEach((series, serIdx) => {
        const rawVal = series.values[catIdx];
        if (rawVal === null || rawVal === undefined || total === 0) return;
        // In 100% stacked mode, negative values contribute their absolute value
        // to the total since stacking negative percentages is not meaningful.
        const pct = (Math.abs(rawVal) / total) * 100;
        const barX = x(cat) ?? 0;
        const barY = y(cumulative + pct);
        const barH = y(cumulative) - y(cumulative + pct);

        // Only round the top segment — all values are absolute in 100% mode
        const isTopSegment = serIdx === data.barSeries.length - 1 ||
          data.barSeries.slice(serIdx + 1).every((ser) => {
            const sv = ser.values[catIdx];
            return sv === null || sv === undefined;
          });

        const rx = isTopSegment ? Math.min(cornerRadius, barW / 2) : 0;
        const ry = isTopSegment ? Math.min(cornerRadius, barW / 2) : 0;

        const sf = barSeriesFormats[serIdx];
        const conditionalFill = this.getConditionalBarColor(rawVal);
        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', Math.max(0, barH))
          .attr('rx', rx)
          .attr('ry', ry)
          .attr('fill', conditionalFill ?? this.getBarFill(defs, sf.color, 'vertical', this.getOthersColor(data, catIdx)))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

        this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
        this.attachStacked100Tooltip(rect, this.getCategoryLabel(cat, data), series.name, rawVal, pct);
        this.animateBar(rect, barH, catIdx, 'vertical');

        cumulative += pct;
      });

      // Data label on top of the full stack showing 100%
      if (this.getDataLabelMode() !== 'none' && cumulative > 0) {
        this.renderPercentDataLabel(g, (x(cat) ?? 0) + barW / 2, y(cumulative), height - y(cumulative), cumulative, height);
      }
    });

    // Trend line on stacked totals (raw values, not percentages)
    const rawTotals = data.categories.map((_, catIdx) => categoryTotals[catIdx]);
    const percentY = d3.scaleLinear().domain([0, (d3.max(rawTotals) ?? 0) * 1.1]).nice().range([height, 0]);
    this.renderTrendLineOverlay(g, rawTotals, (i) => (x(data.categories[i]) ?? 0) + x.bandwidth() / 2, percentY);

    // Target line, reference line, and benchmark band use raw values which are
    // meaningless on the 0-100% scale. Skip them in stacked100 mode.
    // TODO: Scale raw values to percentages if these overlays are needed here.
    this.renderAnnotationOverlay(g, data, x, y);
  }

  /**
   * Renders X and Y axes for 100% stacked mode.
   * Y-axis tick labels are formatted as percentages (e.g. "50%").
   */
  private renderStacked100Axes(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number,
    categoryLabelsByKey: Record<string, string>,
  ): void {
    const s = this.settings;

    if (s.axisFormattingCard.showXAxis.value) {
      const xAxis = g.append('g')
        .attr('class', 'bar-chart-axis bar-chart-axis-x')
        .attr('transform', `translate(0,${height})`)
        .call(
          d3.axisBottom(xScale)
            .tickSize(0)
            .tickFormat((d) => categoryLabelsByKey[String(d)] ?? String(d)),
        );

      const rotation = s.axisFormattingCard.axisLabelRotation.value;
      if (rotation !== 0) {
        xAxis.selectAll('text')
          .attr('transform', `rotate(${rotation})`)
          .style('text-anchor', rotation > 0 ? 'start' : 'end')
          .attr('dx', rotation > 0 ? '0.5em' : '-0.5em')
          .attr('dy', '0.25em');
      }

      xAxis.select('.domain').remove();
    }

    if (s.axisFormattingCard.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat((d) => `${d}%`),
        )
        .select('.domain').remove();
    }

    // Axis titles
    const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const xTitle = s.axisFormattingCard.xAxisTitle.value;
    if (xTitle && s.axisFormattingCard.showXAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('x', width / 2)
        .attr('y', height + 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(xTitle);
    }
    const yTitle = s.axisFormattingCard.yAxisTitle.value;
    if (yTitle && s.axisFormattingCard.showYAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(yTitle);
    }
  }

  /**
   * Tooltip for 100% stacked bars showing both percentage and raw value.
   */
  private attachStacked100Tooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    rawValue: number,
    pct: number,
  ): void {
    const host = this.host;
    const numberSettings = this.settings.numberFormattingCard;

    rect.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatWithSettings(rawValue, numberSettings) },
        { displayName: '% of Total', value: `${pct.toFixed(1)}%` },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  /**
   * Data label formatted as a percentage (e.g. "85%").
   */
  private renderPercentDataLabel(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    cx: number,
    barY: number,
    barH: number,
    pct: number,
    chartHeight: number,
  ): void {
    const labelMode = this.getDataLabelMode();
    if (labelMode === 'none') return;

    const text = `${Math.round(pct)}%`;
    const isInside = labelMode === 'inside';
    const yPos = isInside ? barY + Math.min(barH / 2 + 4, barH - 2) : barY - 6;

    // Skip if the label would be outside the chart
    if (yPos < 0 || yPos > chartHeight) return;

    g.append('text')
      .attr('class', isInside ? 'bar-chart-label bar-chart-label-inside' : 'bar-chart-label')
      .attr('x', cx)
      .attr('y', yPos)
      .text(text);
  }

  // ── Combo Mode (Bars + Lines) ───────────────────────────────────

  private renderCombo(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    hasSecondaryY: boolean,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // X scale
    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(Math.max(0, Math.min(0.9, 0.15 + spacing * 0.02)))
      .paddingOuter(0.05);

    // Y scale (bars)
    const barValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yBarMax = d3.max(barValues) ?? 0;
    const yBar = d3.scaleLinear()
      .domain(this.applyYAxisOverrides([0, yBarMax * 1.1]))
      .nice()
      .range([height, 0]);

    // Y scale (lines — uses secondary axis if enabled)
    const lineValues = data.lineSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yLineMax = d3.max(lineValues) ?? yBarMax;
    const yLine = hasSecondaryY
      ? d3.scaleLinear().domain(this.applyYAxisOverrides([0, yLineMax * 1.1])).nice().range([height, 0])
      : yBar;

    this.renderGrid(g, yBar, width, height);
    this.renderAxes(g, x, yBar, width, height, hasSecondaryY ? yLine : null, data.categoryLabelsByKey);

    // Bars (grouped within combo)
    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const x1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, x.bandwidth()])
      .padding(0.05);

    // Pre-compute per-series formatting
    const barSeriesFormats = data.barSeries.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null) return;

        const sf = barSeriesFormats[serIdx];
        const barX = (x(cat) ?? 0) + (x1(String(serIdx)) ?? 0);
        const barW = Math.max(MIN_BAR_WIDTH, x1.bandwidth());
        const barY = yBar(val);
        const barH = height - barY;

        const conditionalFill = this.getConditionalBarColor(val);
        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barW / 2))
          .attr('ry', Math.min(cornerRadius, barW / 2))
          .attr('fill', conditionalFill ?? this.getBarFill(defs, sf.color, 'vertical', this.getOthersColor(data, catIdx)))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

        this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');
        // Use the global data label dropdown as the primary control;
        // per-series showLabels is a secondary override
        if (this.getDataLabelMode() !== 'none' || sf.showLabels) {
          this.renderDataLabel(g, barX + barW / 2, barY, barH, val, height);
        }
      });
    });

    // Lines — per-series formatting index continues after bar series
    const showDots = s.lineSettings.showDots.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const barSeriesCount = data.barSeries.length;
    const lineSeriesFormats = data.lineSeries.map((ls, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, barSeriesCount + i, ls.color));
    const lineGradientFill = s.lineSettings.lineGradientFill.value;
    const lineGradientOpacity = Math.max(0, Math.min(100, s.lineSettings.lineGradientOpacity.value)) / 100;

    // Ensure defs exist for line gradients
    const svgNode = g.node()?.ownerSVGElement;
    const lineGradientDefs = lineGradientFill && svgNode
      ? (defs ?? d3.select(svgNode).append('defs'))
      : null;

    data.lineSeries.forEach((series, lineIdx) => {
      const sf = lineSeriesFormats[lineIdx];
      const lineData: Array<{ x: number; y: number; val: number; cat: string; catIdx: number }> = [];

      data.categories.forEach((cat, i) => {
        const val = series.values[i];
        if (val !== null) {
          lineData.push({
            x: (x(cat) ?? 0) + x.bandwidth() / 2,
            y: yLine(val),
            val,
              cat: this.getCategoryLabel(cat, data),
              catIdx: i,
          });
        }
      });

      if (lineData.length < 2) return;

      const strokeDash = lineStyleToDashArray(sf.lineStyle);

      const lineFn = d3.line<{ x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(d3.curveMonotoneX);

      // Gradient fill area under the line
      if (lineGradientFill && lineGradientDefs) {
        const gradId = `line-grad-${this.gradientIdCounter++}`;
        const gradient = lineGradientDefs.append('linearGradient')
          .attr('id', gradId)
          .attr('x1', '0')
          .attr('y1', '0')
          .attr('x2', '0')
          .attr('y2', '1');
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', lineGradientOpacity);
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', 0);

        const areaFn = d3.area<{ x: number; y: number }>()
          .x((d) => d.x)
          .y0(height)
          .y1((d) => d.y)
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(lineData)
          .attr('class', 'bar-chart-line-gradient-area')
          .attr('d', areaFn)
          .attr('fill', `url(#${gradId})`)
          .attr('stroke', 'none');
      }

      const pathEl = g.append('path')
        .datum(lineData)
        .attr('class', 'bar-chart-line')
        .attr('d', lineFn)
        .attr('stroke', sf.color)
        .attr('stroke-width', sf.lineWidth)
        .attr('stroke-dasharray', strokeDash)
        .attr('opacity', sf.opacity / 100);

      if (animEnabled) {
        const node = pathEl.node();
        if (node) {
          const cancel = drawPath(node, animDuration, 200);
          this.cancelAnimations.push(cancel);
        }
      }

      if (showDots) {
        lineData.forEach((d) => {
          const dot = g.append('circle')
            .attr('class', 'bar-chart-line-dot')
            .attr('cx', d.x)
            .attr('cy', d.y)
            .attr('r', LINE_DOT_RADIUS)
            .attr('fill', sf.color)
            .attr('opacity', sf.opacity / 100);

          this.attachSelection(dot, data.categorySelectionIds[d.catIdx], d.cat);
          this.attachDotTooltip(dot, d.cat, series.name, d.val);
        });
      }

      // Line data labels
      if (s.lineSettings.showLineDataLabels.value) {
        lineData.forEach((d) => {
          g.append('text')
            .attr('class', 'bar-chart-label')
            .attr('x', d.x)
            .attr('y', d.y - 10)
            .attr('text-anchor', 'middle')
            .text(formatWithSettings(d.val, this.settings.numberFormattingCard));
        });
      }
    });

    const comboValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    this.renderTargetLine(g, data.targetValue, yBar, width, hasSecondaryY ? yLine : undefined);
    this.renderReferenceLine(g, yBar, width, comboValues, hasSecondaryY ? yLine : undefined);
    this.renderBenchmarkBand(g, yBar, width);
    this.renderTrendLineOverlay(g, comboValues, (i) => (x(data.categories[i]) ?? 0) + x.bandwidth() / 2, yBar, hasSecondaryY ? yLine : undefined);
    this.renderAnnotationOverlay(g, data, x, yBar);

    // Variance indicators (first bar series against target)
    if (data.barSeries.length > 0) {
      const firstVals = data.barSeries[0].values.filter((v): v is number => v !== null);
      const comboXPositions = data.categories.map((cat) => (x(cat) ?? 0) + x.bandwidth() / 2);
      this.renderVarianceIndicators(g, firstVals, data.targetValue, comboXPositions, yBar);
    }
  }

  // ── Horizontal Mode ─────────────────────────────────────────────

  private renderHorizontal(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Y scale (categories on Y axis for horizontal)
    const y = d3.scaleBand()
      .domain(data.categories)
      .range([0, height])
      .paddingInner(Math.max(0, Math.min(0.9, 0.1 + spacing * 0.02)))
      .paddingOuter(0.05);

    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const y1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, y.bandwidth()])
      .padding(0.05);

    const allValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const xMax = d3.max(allValues) ?? 0;
    const x = d3.scaleLinear()
      .domain(this.applyYAxisOverrides([0, xMax * 1.1]))
      .nice()
      .range([0, width]);

    // Axes
    if (s.axisFormattingCard.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(
          d3.axisLeft(y)
            .tickSize(0)
            .tickFormat((d) => this.getCategoryLabel(String(d), data)),
        )
        .select('.domain').remove();
    }

    if (s.axisFormattingCard.showXAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)))
        .select('.domain').remove();
    }

    // Axis titles (in horizontal mode, x-axis shows values, y-axis shows categories)
    const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const xTitle = s.axisFormattingCard.xAxisTitle.value;
    if (xTitle && s.axisFormattingCard.showXAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('x', width / 2)
        .attr('y', height + 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(xTitle);
    }
    const yTitle = s.axisFormattingCard.yAxisTitle.value;
    if (yTitle && s.axisFormattingCard.showYAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(yTitle);
    }

    // Horizontal grid
    g.append('g')
      .attr('class', 'bar-chart-grid')
      .call(
        d3.axisBottom(x)
          .ticks(5)
          .tickSize(height)
          .tickFormat(() => ''),
      )
      .attr('transform', 'translate(0,0)');

    // Pre-compute per-series formatting
    const barSeriesFormats = data.barSeries.map((s2, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s2.color));

    // Bars
    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined) return;

        const barY = (y(cat) ?? 0) + (y1(String(serIdx)) ?? 0);
        const barH = Math.max(MIN_BAR_WIDTH, y1.bandwidth());
        const barW = x(val);

        const sf = barSeriesFormats[serIdx];
        const conditionalFill = this.getConditionalBarColor(val);
        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', 0)
          .attr('y', barY)
          .attr('width', Math.max(0, barW))
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barH / 2))
          .attr('ry', Math.min(cornerRadius, barH / 2))
          .attr('fill', conditionalFill ?? this.getBarFill(defs, sf.color, 'horizontal', this.getOthersColor(data, catIdx)))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

        this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barW, catIdx, 'horizontal');
        if (this.getDataLabelMode() !== 'none' || sf.showLabels) {
          this.renderHorizontalDataLabel(g, barW, barY + barH / 2, val, width);
        }
      });
    });

    // Target line (vertical for horizontal mode)
    if (data.targetValue !== null && s.targetLine.show.value) {
      const tVal = data.targetValue;
      const tx = x(tVal);
      const targetColor = s.targetLine.color.value?.value ?? '#F87171';
      const tStyle = this.getTargetStyle();

      g.append('line')
        .attr('class', 'bar-chart-target')
        .attr('x1', tx)
        .attr('x2', tx)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', targetColor)
        .attr('stroke-dasharray', lineStyleToDashArray(tStyle));

      const labelText = s.targetLine.label.value || formatWithSettings(tVal, this.settings.numberFormattingCard);
      g.append('text')
        .attr('class', 'bar-chart-target-label')
        .attr('x', tx + 4)
        .attr('y', 12)
        .attr('fill', targetColor)
        .text(labelText);
    }

    // Reference line (vertical in horizontal mode, using value axis = x)
    const horzValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    this.renderReferenceLineHorizontal(g, x, height, horzValues);

    // Benchmark band (vertical band in horizontal mode)
    this.renderBenchmarkBandHorizontal(g, x, height);

    // Variance indicators (horizontal — text to right of bar end)
    if (data.barSeries.length > 0) {
      const firstVals = data.barSeries[0].values.filter((v): v is number => v !== null);
      const yPositions = data.categories.map((cat) => (y(cat) ?? 0) + y.bandwidth() / 2);
      this.renderVarianceIndicatorsHorizontal(g, firstVals, data.targetValue, yPositions, x);
    }
  }

  // ── Diverging Mode ──────────────────────────────────────────────

  private renderDiverging(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Diverging mode is inherently single-series by design: each bar represents
    // the positive/negative value of one measure. Additional series are intentionally
    // ignored. If multiple measures are provided, only the first is used.
    const series = data.barSeries[0];
    if (!series) return;

    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(Math.max(0, Math.min(0.9, 0.1 + spacing * 0.02)))
      .paddingOuter(0.05);

    const validValues = series.values.filter((v): v is number => v !== null);
    const absMax = d3.max(validValues.map(Math.abs)) ?? 0;
    const y = d3.scaleLinear()
      .domain(this.applyYAxisOverrides([-absMax * 1.1, absMax * 1.1]))
      .nice()
      .range([height, 0]);

    this.renderGrid(g, y, width, height);

    // X-axis at zero line
    const zeroY = y(0);
    if (s.axisFormattingCard.showXAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(0,${zeroY})`)
        .call(
          d3.axisBottom(x)
            .tickSize(0)
            .tickFormat((d) => this.getCategoryLabel(String(d), data)),
        )
        .call((gSel) => {
          const rotation = s.axisFormattingCard.axisLabelRotation.value;
          if (rotation !== 0) {
            gSel.selectAll('text')
              .attr('transform', `rotate(${rotation})`)
              .style('text-anchor', rotation > 0 ? 'start' : 'end');
          }
        });
    }

    if (s.axisFormattingCard.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(d3.axisLeft(y).ticks(6).tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)));
    }

    // Axis titles
    const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const xTitle = s.axisFormattingCard.xAxisTitle.value;
    if (xTitle && s.axisFormattingCard.showXAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('x', width / 2)
        .attr('y', height + 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(xTitle);
    }
    const yTitle = s.axisFormattingCard.yAxisTitle.value;
    if (yTitle && s.axisFormattingCard.showYAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(yTitle);
    }

    const theme = getTheme('light');
    const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, 0, series.color);

    data.categories.forEach((cat, catIdx) => {
      const val = series.values[catIdx];
      if (val === null || val === undefined) return;

      const barX = x(cat) ?? 0;
      const barW = Math.max(MIN_BAR_WIDTH, x.bandwidth());
      const isPositive = val >= 0;
      const barY = isPositive ? y(val) : zeroY;
      const barH = Math.abs(y(val) - zeroY);
      const defaultColor = isPositive ? theme.semantic.positive : theme.semantic.negative;
      const conditionalFill = this.getConditionalBarColor(val);

      const rect = g.append('rect')
        .attr('class', 'bar-chart-bar')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', barW)
        .attr('height', Math.max(0, barH))
        .attr('rx', Math.min(cornerRadius, barW / 2))
        .attr('ry', Math.min(cornerRadius, barW / 2))
        .attr('fill', conditionalFill ?? this.getBarFill(defs, defaultColor, 'vertical', this.getOthersColor(data, catIdx)))
        .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
        .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
        .attr('opacity', (this.settings.barSettings.barOpacity.value / 100) * (sf.opacity / 100));

      this.attachSelection(rect, data.categorySelectionIds[catIdx], this.getCategoryLabel(cat, data));
      this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
      this.animateBar(rect, barH, catIdx, 'vertical');

      // Data label — position above positive bars and below negative bars
      if (this.getDataLabelMode() !== 'none' || sf.showLabels) {
        this.renderDataLabel(g, barX + barW / 2, isPositive ? barY : barY + barH, barH, val, height);
      }
    });

    const lollipopValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    this.renderTargetLine(g, data.targetValue, y, width);
    this.renderReferenceLine(g, y, width, lollipopValues);
    this.renderBenchmarkBand(g, y, width);
    this.renderTrendLineOverlay(g, lollipopValues, (i) => (x(data.categories[i]) ?? 0) + x.bandwidth() / 2, y);
    this.renderAnnotationOverlay(g, data, x, y);

    // Variance indicators (first series values against target)
    const divergingVals = series.values.filter((v): v is number => v !== null);
    const divergingXPositions = data.categories.map((cat) => (x(cat) ?? 0) + x.bandwidth() / 2);
    this.renderVarianceIndicators(g, divergingVals, data.targetValue, divergingXPositions, y);
  }

  // ── Shared Rendering Helpers ────────────────────────────────────

  private renderGrid(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    _height: number,
  ): void {
    g.append('g')
      .attr('class', 'bar-chart-grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(-width)
          .tickFormat(() => ''),
      );
  }

  private renderAxes(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number,
    secondaryYScale: d3.ScaleLinear<number, number> | null,
    categoryLabelsByKey: Record<string, string>,
  ): void {
    const s = this.settings;

    if (s.axisFormattingCard.showXAxis.value) {
      const xAxis = g.append('g')
        .attr('class', 'bar-chart-axis bar-chart-axis-x')
        .attr('transform', `translate(0,${height})`)
        .call(
          d3.axisBottom(xScale)
            .tickSize(0)
            .tickFormat((d) => categoryLabelsByKey[String(d)] ?? String(d)),
        );

      const rotation = s.axisFormattingCard.axisLabelRotation.value;
      if (rotation !== 0) {
        xAxis.selectAll('text')
          .attr('transform', `rotate(${rotation})`)
          .style('text-anchor', rotation > 0 ? 'start' : 'end')
          .attr('dx', rotation > 0 ? '0.5em' : '-0.5em')
          .attr('dy', '0.25em');
      }

      xAxis.select('.domain').remove();
    }

    if (s.axisFormattingCard.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    if (secondaryYScale && s.secondaryAxisSettings.showSecondaryYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(${width},0)`)
        .call(
          d3.axisRight(secondaryYScale)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    // Axis titles
    const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const xTitle = s.axisFormattingCard.xAxisTitle.value;
    if (xTitle && s.axisFormattingCard.showXAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('x', width / 2)
        .attr('y', height + 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(xTitle);
    }
    const yTitle = s.axisFormattingCard.yAxisTitle.value;
    if (yTitle && s.axisFormattingCard.showYAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(yTitle);
    }
    // Secondary Y-axis title (combo mode)
    const secYTitle = s.secondaryAxisSettings.secondaryYAxisTitle.value;
    if (secYTitle && secondaryYScale && s.secondaryAxisSettings.showSecondaryYAxis.value) {
      g.append('text')
        .attr('class', 'bar-chart-axis-title')
        .attr('transform', 'rotate(90)')
        .attr('x', height / 2)
        .attr('y', -(width + 40))
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(secYTitle);
    }
  }

  /**
   * Renders a user-configured reference line (and optional band) on the chart.
   * Uses shared renderHorizontalReferenceLine from @pbi/core.
   */
  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    allValues?: number[],
    secondaryYScale?: d3.ScaleLinear<number, number>,
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    // Axis selector — use secondary scale when available and selected
    const axisChoice = resolveDropdown(ref.referenceLineAxis) ?? 'primary';
    const effectiveScale = axisChoice === 'secondary' && secondaryYScale ? secondaryYScale : yScale;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    // Compute statistical value if needed
    if (refType !== 'custom' && allValues && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);

    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale: effectiveScale,
      chartWidth: width,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as LineStyleType,
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue * (1 + ref.referenceBandWidth.value / 100),
      bandLowerValue: refValue * (1 - ref.referenceBandWidth.value / 100),
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  /**
   * Renders a reference line as a vertical line in horizontal bar mode.
   * Uses shared renderVerticalReferenceLine from @pbi/core.
   */
  private renderReferenceLineHorizontal(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    height: number,
    allValues?: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    if (refType !== 'custom' && allValues && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);

    renderVerticalReferenceLine(g, {
      xPosition: xScale(refValue),
      yStart: 0,
      yEnd: height,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as LineStyleType,
      showLabel: ref.showReferenceLabel.value,
      labelText,
    });
  }

  /**
   * Renders a trend line overlay on the chart.
   */
  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xScale: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
    secondaryYScale?: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;

    // Axis selector — use secondary scale when available and selected
    const axisChoice = resolveDropdown(tl.trendLineAxis) ?? 'primary';
    const effectiveScale = axisChoice === 'secondary' && secondaryYScale ? secondaryYScale : yScale;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

    renderTrendLine(g, {
      predicted: result.predicted,
      xScale,
      yScale: effectiveScale,
      lineColor: trendColor,
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  /**
   * Renders a benchmark band (shaded performance zone).
   */
  private renderBenchmarkBand(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
  ): void {
    const bb = this.settings.benchmarkBandSettings;
    if (!bb.show.value) return;

    const y1 = yScale(bb.upperBound.value);
    const y2 = yScale(bb.lowerBound.value);
    const yTop = Math.min(y1, y2);
    const h = Math.abs(y2 - y1);
    const color = bb.bandColor.value?.value ?? '#3B82F6';
    const opacity = Math.max(0, Math.min(100, bb.bandOpacity.value)) / 100;

    g.append('rect')
      .attr('class', 'benchmark-band')
      .attr('x', 0)
      .attr('y', yTop)
      .attr('width', width)
      .attr('height', h)
      .attr('fill', color)
      .attr('opacity', opacity)
      .style('pointer-events', 'none');

    if (bb.label.value) {
      g.append('text')
        .attr('class', 'benchmark-label')
        .attr('x', 4)
        .attr('y', yTop + 12)
        .attr('font-size', '9px')
        .attr('fill', color)
        .attr('opacity', Math.min(1, opacity * 5))
        .text(bb.label.value);
    }
  }

  private renderBenchmarkBandHorizontal(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    height: number,
  ): void {
    const bb = this.settings.benchmarkBandSettings;
    if (!bb.show.value) return;

    const x1 = xScale(bb.lowerBound.value);
    const x2 = xScale(bb.upperBound.value);
    const xLeft = Math.min(x1, x2);
    const w = Math.abs(x2 - x1);
    const color = bb.bandColor.value?.value ?? '#3B82F6';
    const opacity = Math.max(0, Math.min(100, bb.bandOpacity.value)) / 100;

    g.append('rect')
      .attr('class', 'benchmark-band')
      .attr('x', xLeft)
      .attr('y', 0)
      .attr('width', w)
      .attr('height', height)
      .attr('fill', color)
      .attr('opacity', opacity)
      .style('pointer-events', 'none');

    if (bb.label.value) {
      g.append('text')
        .attr('class', 'benchmark-label')
        .attr('x', xLeft + 4)
        .attr('y', 12)
        .attr('font-size', '9px')
        .attr('fill', color)
        .attr('opacity', Math.min(1, opacity * 5))
        .text(bb.label.value);
    }
  }

  /**
   * Renders annotation callouts anchored to specific categories.
   */
  private renderAnnotationOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;
    const slots = [
      { category: ann.annotation1Category.value, text: ann.annotation1Text.value, position: resolveDropdown(ann.annotation1Position) ?? 'above' },
      { category: ann.annotation2Category.value, text: ann.annotation2Text.value, position: resolveDropdown(ann.annotation2Position) ?? 'above' },
      { category: ann.annotation3Category.value, text: ann.annotation3Text.value, position: resolveDropdown(ann.annotation3Position) ?? 'above' },
    ];
    // Build label → key lookup (user enters labels like "Week 5", scale uses keys like "4::Week 5")
    const labelToKey: Record<string, string> = {};
    for (const key of data.categories) {
      const label = data.categoryLabelsByKey[key] ?? key;
      if (!labelToKey[label]) labelToKey[label] = key;
    }

    const config = buildAnnotationConfig(
      true, slots,
      ann.annotationFontSize.value,
      ann.annotationFontColor.value?.value || '#475569',
      ann.annotationConnectorColor.value?.value || '#94A3B8',
      (category) => {
        // Resolve user-entered label to composite key
        const key = labelToKey[category] ?? category;
        const x = xScale(key);
        if (x == null) return null;
        const catIdx = data.categories.indexOf(key);
        if (catIdx < 0) return null;
        const val = data.barSeries[0]?.values[catIdx] ?? 0;
        return { x: x + xScale.bandwidth() / 2, y: yScale(val ?? 0) };
      },
    );
    if (config) renderAnnotations(g, config);
  }

  /**
   * Renders variance indicators (delta arrows vs target).
   */
  private renderVarianceIndicators(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    targetValue: number | null,
    xPositions: number[],
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const vs = this.settings.varianceSettings;
    if (!vs.show.value || targetValue === null) return;

    const posColor = vs.positiveColor.value?.value ?? '#22C55E';
    const negColor = vs.negativeColor.value?.value ?? '#EF4444';

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val == null) continue;
      const delta = val - targetValue;
      const color = delta >= 0 ? posColor : negColor;
      const x = xPositions[i];
      const y = yScale(val);

      if (vs.showArrow.value) {
        const arrowDir = delta >= 0 ? '▲' : '▼';
        g.append('text')
          .attr('class', 'variance-arrow')
          .attr('x', x)
          .attr('y', y - 16)
          .attr('text-anchor', 'middle')
          .attr('fill', color)
          .attr('font-size', '10px')
          .text(arrowDir);
      }

      if (vs.showDelta.value) {
        const deltaText = formatWithSettings(Math.abs(delta), this.settings.numberFormattingCard);
        g.append('text')
          .attr('class', 'variance-delta')
          .attr('x', x)
          .attr('y', y - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', color)
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .text(`${delta >= 0 ? '+' : '-'}${deltaText}`);
      }
    }
  }

  private renderVarianceIndicatorsHorizontal(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    targetValue: number | null,
    yPositions: number[],
    xScale: d3.ScaleLinear<number, number>,
  ): void {
    const vs = this.settings.varianceSettings;
    if (!vs.show.value || targetValue === null) return;

    const posColor = vs.positiveColor.value?.value ?? '#22C55E';
    const negColor = vs.negativeColor.value?.value ?? '#EF4444';

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val == null) continue;
      const delta = val - targetValue;
      const color = delta >= 0 ? posColor : negColor;
      const xPos = xScale(val);
      const yPos = yPositions[i];

      if (vs.showArrow.value) {
        const arrowDir = delta >= 0 ? '▶' : '◀';
        g.append('text')
          .attr('class', 'variance-arrow')
          .attr('x', xPos + 6)
          .attr('y', yPos + 4)
          .attr('text-anchor', 'start')
          .attr('fill', color)
          .attr('font-size', '10px')
          .text(arrowDir);
      }

      if (vs.showDelta.value) {
        const deltaText = formatWithSettings(Math.abs(delta), this.settings.numberFormattingCard);
        const arrowOffset = vs.showArrow.value ? 18 : 6;
        g.append('text')
          .attr('class', 'variance-delta')
          .attr('x', xPos + arrowOffset)
          .attr('y', yPos + 4)
          .attr('text-anchor', 'start')
          .attr('fill', color)
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .text(`${delta >= 0 ? '+' : '-'}${deltaText}`);
      }
    }
  }

  /**
   * Resolves conditional color for a bar value, or returns undefined if not enabled.
   */
  private getConditionalBarColor(value: number): string | undefined {
    const cc = this.settings.conditionalFormattingCard;
    if (!cc.enableConditional.value) return undefined;

    const config = buildConditionalConfig(
      true,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );
    return resolveConditionalColor(value, config);
  }

  /**
   * Applies pattern fill SVG defs if pattern fill is enabled.
   */
  private applyPatternFillDefs(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): void {
    const pf = this.settings.patternFillSettings;
    if (!pf.enabled.value) return;

    const patternType = resolveDropdown(pf.pattern) ?? 'diagonal';
    const opacity = Math.max(0, Math.min(100, pf.patternOpacity.value)) / 100;

    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
    }

    // Create one pattern per bar color so the pattern inherits that bar's color
    const bars = svg.selectAll<SVGRectElement, unknown>('.bar-chart-bar');
    const colorSet = new Set<string>();
    bars.each(function () {
      const fill = this.getAttribute('fill');
      if (fill && !fill.startsWith('url(')) {
        colorSet.add(fill);
      }
    });

    // Create pattern defs for each unique bar color
    for (const color of colorSet) {
      const patternId = `bar-pattern-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
      defs.select(`#${patternId}`).remove();

      const pattern = defs.append('pattern')
        .attr('id', patternId)
        .attr('width', 8)
        .attr('height', 8)
        .attr('patternUnits', 'userSpaceOnUse');

      // Background rect with the bar's color
      pattern.append('rect')
        .attr('width', 8)
        .attr('height', 8)
        .attr('fill', color);

      // Pattern overlay in darker shade
      const patternColor = '#000';
      switch (patternType) {
        case 'diagonal':
          pattern.append('path')
            .attr('d', 'M0,8 L8,0')
            .attr('stroke', patternColor)
            .attr('stroke-width', 1.5)
            .attr('opacity', opacity);
          break;
        case 'crosshatch':
          pattern.append('path')
            .attr('d', 'M0,8 L8,0 M0,0 L8,8')
            .attr('stroke', patternColor)
            .attr('stroke-width', 1)
            .attr('opacity', opacity);
          break;
        case 'dots':
          pattern.append('circle')
            .attr('cx', 4).attr('cy', 4).attr('r', 1.5)
            .attr('fill', patternColor)
            .attr('opacity', opacity);
          break;
        case 'horizontal':
          pattern.append('line')
            .attr('x1', 0).attr('y1', 4).attr('x2', 8).attr('y2', 4)
            .attr('stroke', patternColor)
            .attr('stroke-width', 1)
            .attr('opacity', opacity);
          break;
        case 'vertical':
          pattern.append('line')
            .attr('x1', 4).attr('y1', 0).attr('x2', 4).attr('y2', 8)
            .attr('stroke', patternColor)
            .attr('stroke-width', 1)
            .attr('opacity', opacity);
          break;
      }
    }

    // Apply pattern fills to bars — replace flat color fills with pattern URLs
    bars.each(function () {
      const fill = this.getAttribute('fill');
      if (fill && !fill.startsWith('url(')) {
        const patternId = `bar-pattern-${fill.replace(/[^a-zA-Z0-9]/g, '')}`;
        this.setAttribute('fill', `url(#${patternId})`);
      }
    });

    // For gradient-filled bars, overlay the pattern by cloning each bar with pattern fill
    bars.each(function () {
      const fill = this.getAttribute('fill');
      if (fill && fill.startsWith('url(') && !fill.includes('bar-pattern-')) {
        const clone = this.cloneNode(false) as SVGRectElement;
        // Use a generic dark pattern overlay on top of gradient
        const genericId = 'bar-pattern-overlay';
        clone.setAttribute('fill', `url(#${genericId})`);
        clone.setAttribute('class', 'bar-chart-bar-pattern-overlay');
        clone.style.pointerEvents = 'none';
        this.parentNode?.insertBefore(clone, this.nextSibling);
      }
    });

    // Create generic overlay pattern for gradient bars
    const overlayId = 'bar-pattern-overlay';
    defs.select(`#${overlayId}`).remove();
    const overlayPattern = defs.append('pattern')
      .attr('id', overlayId)
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse');

    switch (patternType) {
      case 'diagonal':
        overlayPattern.append('path')
          .attr('d', 'M0,8 L8,0')
          .attr('stroke', '#000')
          .attr('stroke-width', 1.5)
          .attr('opacity', opacity);
        break;
      case 'crosshatch':
        overlayPattern.append('path')
          .attr('d', 'M0,8 L8,0 M0,0 L8,8')
          .attr('stroke', '#000')
          .attr('stroke-width', 1)
          .attr('opacity', opacity);
        break;
      case 'dots':
        overlayPattern.append('circle')
          .attr('cx', 4).attr('cy', 4).attr('r', 1.5)
          .attr('fill', '#000')
          .attr('opacity', opacity);
        break;
      case 'horizontal':
        overlayPattern.append('line')
          .attr('x1', 0).attr('y1', 4).attr('x2', 8).attr('y2', 4)
          .attr('stroke', '#000')
          .attr('stroke-width', 1)
          .attr('opacity', opacity);
        break;
      case 'vertical':
        overlayPattern.append('line')
          .attr('x1', 4).attr('y1', 0).attr('x2', 4).attr('y2', 8)
          .attr('stroke', '#000')
          .attr('stroke-width', 1)
          .attr('opacity', opacity);
        break;
    }
  }

  /**
   * Applies accessibility features to the chart.
   */
  private applyAccessibility(data: ChartData): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'bar chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.categories.length,
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.bar-chart-bar',
      onActivate: (el) => {
        // Trigger selection via click
        (el as HTMLElement).click?.();
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  private renderTargetLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    targetValue: number | null,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    secondaryYScale?: d3.ScaleLinear<number, number>,
  ): void {
    const s = this.settings;
    if (targetValue === null || !s.targetLine.show.value) return;

    const ty = yScale(targetValue);
    const targetColor = s.targetLine.color.value?.value ?? '#F87171';
    const tStyle = this.getTargetStyle();

    g.append('line')
      .attr('class', 'bar-chart-target')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', ty)
      .attr('y2', ty)
      .attr('stroke', targetColor)
      .attr('stroke-dasharray', lineStyleToDashArray(tStyle));

    const labelText = s.targetLine.label.value || formatWithSettings(targetValue, this.settings.numberFormattingCard);
    g.append('text')
      .attr('class', 'bar-chart-target-label')
      .attr('x', width - 4)
      .attr('y', ty - 6)
      .attr('text-anchor', 'end')
      .attr('fill', targetColor)
      .text(labelText);
  }

  private renderDataLabel(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    cx: number,
    barY: number,
    barH: number,
    value: number,
    chartHeight: number,
  ): void {
    const labelMode = this.getDataLabelMode();
    if (labelMode === 'none') return;

    const text = formatWithSettings(value, this.settings.numberFormattingCard);
    const isInside = labelMode === 'inside';
    const yPos = isInside ? barY + Math.min(barH / 2 + 4, barH - 2) : barY - 6;

    // Skip if the label would be outside the chart
    if (yPos < 0 || yPos > chartHeight) return;

    g.append('text')
      .attr('class', isInside ? 'bar-chart-label bar-chart-label-inside' : 'bar-chart-label')
      .attr('x', cx)
      .attr('y', yPos)
      .text(text);
  }

  private renderHorizontalDataLabel(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    barW: number,
    cy: number,
    value: number,
    chartWidth: number,
  ): void {
    const labelMode = this.getDataLabelMode();
    if (labelMode === 'none') return;

    const text = formatWithSettings(value, this.settings.numberFormattingCard);
    const isInside = labelMode === 'inside';
    const xPos = isInside ? Math.max(4, barW - 4) : barW + 6;

    // Skip if the label would be outside the chart
    if (xPos < 0 || xPos > chartWidth) return;

    g.append('text')
      .attr('class', isInside ? 'bar-chart-label bar-chart-label-inside' : 'bar-chart-label')
      .attr('x', xPos)
      .attr('y', cy)
      .attr('text-anchor', isInside ? 'end' : 'start')
      .attr('dominant-baseline', 'central')
      .text(text);
  }

  private getCategoryLabel(categoryKey: string, data: ChartData): string {
    return data.categoryLabelsByKey[categoryKey] ?? categoryKey;
  }

  private renderLegend(data: ChartData): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendPos = resolveDropdown(legendFmtCard.legendPosition) ?? 'bottom';

    const items: LegendItem[] = [
      ...data.barSeries.map((s, i) => {
        const sf = this.cachedSeriesFormats[i];
        return { label: s.name, color: sf?.color ?? s.color };
      }),
      ...data.lineSeries.map((s, i) => {
        const sf = this.cachedSeriesFormats[data.barSeries.length + i];
        return { label: s.name, color: sf?.color ?? s.color };
      }),
    ];

    const rawFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;
    renderLegend(this.container, {
      items,
      position: legendPos as 'top' | 'bottom' | 'left' | 'right',
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
      fontFamily: rawFontFamily,
    });
  }

  // ── Animation ───────────────────────────────────────────────────

  private animateBar(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    _size: number,
    index: number,
    direction: 'vertical' | 'horizontal',
  ): void {
    const s = this.settings;
    if (!s.animationSettings.enabled.value) return;

    const node = rect.node();
    if (!node) return;

    const delay = index * s.animationSettings.staggerDelay.value;
    const duration = s.animationSettings.duration.value;

    const cancel = growBar(node, delay, duration, direction);
    this.cancelAnimations.push(cancel);
  }

  // ── Tooltips ────────────────────────────────────────────────────

  private attachBarTooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;
    const numberSettings = this.settings.numberFormattingCard;

    rect.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatWithSettings(value, numberSettings) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private attachDotTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;
    const numberSettings = this.settings.numberFormattingCard;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatWithSettings(value, numberSettings) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private attachSelection<
    E extends SVGRectElement | SVGCircleElement
  >(
    node: d3.Selection<E, unknown, null, undefined>,
    selectionId: ISelectionId,
    drillCategoryLabel?: string,
  ): void {
    node.style('cursor', 'pointer');
    node.on('click.selection', (event: MouseEvent) => {
      event.stopPropagation();

      // Drill-down: if enabled and this category has sub-categories, drill into it
      if (
        drillCategoryLabel !== undefined &&
        this.settings.drillDownSettings.enabled.value &&
        this.currentData &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        // Check if the current resolved data has sub-categories for this label
        const resolved = this.resolveDrillData(this.currentData);
        if (resolved.subCategoryMap.has(drillCategoryLabel)) {
          this.drillPath.push(drillCategoryLabel);
          this.reRenderWithDrill();
          return;
        }
      }

      void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
    });
    node.on('contextmenu.selection', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Gradient Helpers ────────────────────────────────────────────

  /**
   * Creates an SVG linearGradient in the given `<defs>` container and returns
   * a `url(#id)` string suitable for the `fill` attribute.
   *
   * The gradient goes from a lighter tint of `color` to the full `color`.
   * - vertical mode: top (light) -> bottom (full)
   * - horizontal mode: left (light) -> right (full)
   */
  private createBarGradient(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    color: string,
    direction: 'vertical' | 'horizontal',
  ): string {
    const id = `bar-grad-${this.gradientIdCounter++}`;

    // Lighten the color by blending with white
    const parsed = d3.color(color);
    const lighterColor = parsed
      ? d3.interpolateRgb(color, '#ffffff')(0.45)
      : color;

    const grad = defs.append('linearGradient').attr('id', id);

    if (direction === 'vertical') {
      grad.attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    } else {
      grad.attr('x1', '0').attr('y1', '0').attr('x2', '1').attr('y2', '0');
    }

    grad.append('stop').attr('offset', '0%').attr('stop-color', lighterColor);
    grad.append('stop').attr('offset', '100%').attr('stop-color', color);

    return `url(#${id})`;
  }

  /**
   * Returns the fill value for a bar: either a gradient URL or the flat color.
   * If this is the "Others" category from Top N, uses the othersColor override.
   */
  private getBarFill(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null,
    color: string,
    direction: 'vertical' | 'horizontal',
    othersColor?: string,
  ): string {
    const effectiveColor = othersColor ?? color;
    if (defs) {
      return this.createBarGradient(defs, effectiveColor, direction);
    }
    return effectiveColor;
  }

  /** Returns the othersColor if this category index is the "Others" slot. */
  private getOthersColor(data: ChartData, catIdx: number): string | undefined {
    if (data.othersColor && catIdx === data.categories.length - 1) {
      return data.othersColor;
    }
    return undefined;
  }

  // ── Setting Accessors ───────────────────────────────────────────

  private getChartMode(): ChartMode {
    const val = this.settings.chartMode.mode.value?.value;
    const validModes: ChartMode[] = ['grouped', 'stacked', 'stacked100', 'combo', 'horizontal', 'diverging'];
    if (typeof val === 'string' && validModes.includes(val as ChartMode)) {
      return val as ChartMode;
    }
    return 'grouped';
  }

  /** Applies user yAxisMin/yAxisMax overrides to a [min, max] domain. */
  private applyYAxisOverrides(domain: [number, number]): [number, number] {
    const ax = this.settings.axisFormattingCard;
    const userMin = ax.yAxisMin.value;
    const userMax = ax.yAxisMax.value;
    return [
      userMin != null ? userMin : domain[0],
      userMax != null ? userMax : domain[1],
    ];
  }

  private getDataLabelMode(): DataLabelMode {
    const val = this.settings.barSettings.showDataLabels.value?.value;
    const validModes: DataLabelMode[] = ['none', 'above', 'inside'];
    if (typeof val === 'string' && validModes.includes(val as DataLabelMode)) {
      return val as DataLabelMode;
    }
    return 'none';
  }

  private getLegendPosition(): LegendPosition {
    const val = resolveDropdown(this.settings.legendFormattingCard.legendPosition);
    const validPositions: LegendPosition[] = ['bottom', 'top', 'left', 'right'];
    if (typeof val === 'string' && validPositions.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'bottom';
  }

  private getTargetStyle(): LineStyle {
    const val = this.settings.targetLine.style.value?.value;
    if (val === 'solid' || val === 'dashed') return val;
    return 'dashed';
  }

  // ── Formatting Model ────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
