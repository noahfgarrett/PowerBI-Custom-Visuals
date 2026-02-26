/**
 * Bullet Chart Pro — Power BI IVisual implementation.
 * Horizontal bullet charts with qualitative ranges (poor / satisfactory / good),
 * an actual-value bar, a target marker, and entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BulletChartProSettings } from './settings';
import {
  formatNumber,
  DURATION,
  growBar,
  fadeSlideIn,
  withOpacity,
  getGlassStyle,
  renderChartTitle,
  applyDataLabelFormatting,
  createScrollableChart,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

interface BulletItem {
  label: string;
  value: number;
  target: number | null;
  poor: number;
  satisfactory: number;
  good: number;
  selectionId: ISelectionId;
}

interface BulletData {
  items: BulletItem[];
  isEmpty: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

/** Padding inside the container (matches CSS) */
const CONTAINER_PADDING = 12;
/** Minimum width reserved for category labels on the left */
const MIN_LABEL_WIDTH = 60;
/** Maximum width reserved for category labels on the left */
const MAX_LABEL_WIDTH = 120;
/** Padding to the right for value labels */
const VALUE_LABEL_WIDTH = 50;
/** Vertical gap between bullet rows */
const ROW_GAP = 8;

// ── Visual ──────────────────────────────────────────────────────────

export class BulletChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BulletChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BulletChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('bullet-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BulletChartProSettings,
        dataView,
      );
    }

    // Extract data
    const data = this.extractData(dataView);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): BulletData {
    const empty: BulletData = { items: [], isEmpty: true };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    const categories = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );

    if (categories.length === 0) return empty;

    // Find columns by role
    let measureCol: powerbi.DataViewValueColumn | undefined;
    let targetCol: powerbi.DataViewValueColumn | undefined;
    let poorCol: powerbi.DataViewValueColumn | undefined;
    let satisfactoryCol: powerbi.DataViewValueColumn | undefined;
    let goodCol: powerbi.DataViewValueColumn | undefined;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureCol = col;
      if (role['target']) targetCol = col;
      if (role['poor']) poorCol = col;
      if (role['satisfactory']) satisfactoryCol = col;
      if (role['good']) goodCol = col;
    }

    if (!measureCol) return empty;

    const items: BulletItem[] = [];

    for (let i = 0; i < categories.length; i++) {
      const value = typeof measureCol.values[i] === 'number'
        ? (measureCol.values[i] as number)
        : 0;

      const target = targetCol && typeof targetCol.values[i] === 'number'
        ? (targetCol.values[i] as number)
        : null;

      const poor = poorCol && typeof poorCol.values[i] === 'number'
        ? (poorCol.values[i] as number)
        : value * 0.5;

      const satisfactory = satisfactoryCol && typeof satisfactoryCol.values[i] === 'number'
        ? (satisfactoryCol.values[i] as number)
        : value * 0.75;

      const good = goodCol && typeof goodCol.values[i] === 'number'
        ? (goodCol.values[i] as number)
        : value * 1.2;

      items.push({
        label: categories[i],
        value,
        target,
        poor,
        satisfactory,
        good,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    return { items, isEmpty: items.length === 0 };
  }

  // ── Card Style ────────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ───────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'bullet-empty';
    emptyEl.textContent = 'Add a Category and Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ───────────────────────────────────────────────────

  private render(data: BulletData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const barHeight = Math.max(8, s.bulletSettings.barHeight.value);
    const showTarget = s.bulletSettings.showTarget.value;
    const showLabels = s.bulletSettings.showLabels.value;

    // Colors
    const poorColor = s.rangeSettings.poorColor.value?.value ?? '#FCA5A5';
    const satColor = s.rangeSettings.satisfactoryColor.value?.value ?? '#FDE68A';
    const goodColor = s.rangeSettings.goodColor.value?.value ?? '#BBF7D0';
    const barColor = s.rangeSettings.barColor.value?.value ?? '#1E293B';

    // Bullet settings
    const rangeOpacity = s.bulletSettings.rangeOpacity.value / 100;
    const barCornerRadius = s.bulletSettings.barCornerRadius.value;

    // Animation
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Layout calculations
    const svgWidth = viewport.width - CONTAINER_PADDING * 2;
    const totalRows = data.items.length;
    const rowHeight = barHeight + ROW_GAP;
    const baseSvgHeight = Math.max(totalRows * rowHeight, barHeight);

    // Compute label width: measure text or use default
    const labelWidth = showLabels
      ? Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, svgWidth * 0.2))
      : 0;
    const valueLabelSpace = showLabels ? VALUE_LABEL_WIDTH : 0;
    const chartLeft = labelWidth + 4;
    const chartRight = svgWidth - valueLabelSpace;
    const chartWidth = Math.max(0, chartRight - chartLeft);

    if (chartWidth <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support (vertical — stacked bullet rows)
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: svgWidth,
      viewportHeight: viewport.height - CONTAINER_PADDING * 2,
      categoryCount: totalRows,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: chartWidth,
      availableChartHeight: viewport.height - CONTAINER_PADDING * 2,
      direction: 'vertical',
    });
    const svgHeight = scroll.isScrolling
      ? Math.max(totalRows * rowHeight, barHeight)
      : baseSvgHeight;

    // Find the global max across all "good" values for consistent scale
    const globalMax = d3.max(data.items, (d) =>
      Math.max(d.good, d.value, d.target ?? 0),
    ) ?? 100;

    // xScale: maps data values to chart pixel coordinates
    const xScale = d3.scaleLinear()
      .domain([0, globalMax])
      .range([chartLeft, chartRight])
      .nice();

    // Create SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'bullet-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Render each bullet row
    data.items.forEach((item, rowIdx) => {
      const rowY = rowIdx * rowHeight;
      const rowGroup = svg.append('g')
        .attr('transform', `translate(0,${rowY})`);

      // ── Category label (left) ───────────────────────────────────
      if (showLabels) {
        rowGroup.append('text')
          .attr('class', 'bullet-label')
          .attr('x', labelWidth - 4)
          .attr('y', barHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .text(this.truncateLabel(item.label, labelWidth - 8));
      }

      // ── Qualitative range rectangles ────────────────────────────
      // Poor range: 0 → poor
      const poorX = xScale(0);
      const poorW = Math.max(0, xScale(item.poor) - poorX);
      rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-poor')
        .attr('x', poorX)
        .attr('y', 0)
        .attr('width', poorW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(poorColor, rangeOpacity))
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Satisfactory range: poor → satisfactory
      const satX = xScale(item.poor);
      const satW = Math.max(0, xScale(item.satisfactory) - satX);
      rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-satisfactory')
        .attr('x', satX)
        .attr('y', 0)
        .attr('width', satW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(satColor, rangeOpacity))
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Good range: satisfactory → good
      const goodX = xScale(item.satisfactory);
      const goodW = Math.max(0, xScale(item.good) - goodX);
      const goodRect = rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-good')
        .attr('x', goodX)
        .attr('y', 0)
        .attr('width', goodW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(goodColor, rangeOpacity));

      // Round right corners on the last range rect
      goodRect.attr('rx', barCornerRadius).attr('ry', barCornerRadius);

      // ── Actual value bar ────────────────────────────────────────
      const valueBarHeight = barHeight * 0.4;
      const valueBarY = (barHeight - valueBarHeight) / 2;
      const valueBarX = xScale(0);
      const valueBarW = Math.max(0, xScale(item.value) - valueBarX);

      const valueRect = rowGroup.append('rect')
        .attr('class', 'bullet-value-bar')
        .attr('x', valueBarX)
        .attr('y', valueBarY)
        .attr('width', valueBarW)
        .attr('height', valueBarHeight)
        .attr('fill', barColor)
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Tooltip on value bar
      this.attachTooltip(valueRect, item);
      valueRect
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(item.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Animate value bar with growBar (horizontal slide-in)
      if (animEnabled) {
        const valueNode = valueRect.node();
        if (valueNode) {
          const delay = rowIdx * DURATION.stagger;
          const cancel = growBar(valueNode, delay, animDuration, 'horizontal');
          this.cancelAnimations.push(cancel);
        }
      }

      // ── Target marker ───────────────────────────────────────────
      if (showTarget && item.target !== null) {
        const targetX = xScale(item.target);
        const markerGroup = rowGroup.append('g')
          .attr('class', 'bullet-target-group');

        markerGroup.append('line')
          .attr('class', 'bullet-target')
          .attr('x1', targetX)
          .attr('x2', targetX)
          .attr('y1', 0)
          .attr('y2', barHeight)
          .attr('stroke', barColor)
          .attr('stroke-width', 2);

        // Animate target marker with fadeSlideIn
        if (animEnabled) {
          const markerNode = markerGroup.node();
          if (markerNode) {
            // Cast to HTMLElement since fadeSlideIn expects HTMLElement
            // but SVGGElement has the same style property interface
            const delay = rowIdx * DURATION.stagger + 200;
            const cancel = fadeSlideIn(
              markerNode as unknown as HTMLElement,
              'left',
              300,
              delay,
            );
            this.cancelAnimations.push(cancel);
          }
        }
      }

      // ── Value label (right) ─────────────────────────────────────
      if (showLabels) {
        rowGroup.append('text')
          .attr('class', 'bullet-value-label')
          .attr('x', chartRight + 6)
          .attr('y', barHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'start')
          .text(formatNumber(item.value, { abbreviate: true }));
      }
    });

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bullet-value-label');

    // Apply axis formatting to category labels
    const axisSettings = this.settings.axisFormattingCard;
    const axisLabelColor = axisSettings.axisLabelColor.value?.value || '#64748B';
    const axisLabelSize = axisSettings.axisLabelSize.value;
    const labelEls = this.container.querySelectorAll<SVGTextElement>('.bullet-label');
    for (const el of labelEls) {
      el.style.setProperty('fill', axisLabelColor);
      el.style.setProperty('font-size', `${axisLabelSize}px`);
    }

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Tooltip ───────────────────────────────────────────────────────

  private attachTooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    item: BulletItem,
  ): void {
    const host = this.host;

    rect.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: item.label },
        { displayName: 'Value', value: formatNumber(item.value, { abbreviate: false }) },
      ];

      if (item.target !== null) {
        tooltipData.push({
          displayName: 'Target',
          value: formatNumber(item.target, { abbreviate: false }),
        });
      }

      tooltipData.push(
        { displayName: 'Poor', value: formatNumber(item.poor, { abbreviate: false }) },
        { displayName: 'Satisfactory', value: formatNumber(item.satisfactory, { abbreviate: false }) },
        { displayName: 'Good', value: formatNumber(item.good, { abbreviate: false }) },
      );

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

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Truncates a label to fit within the specified pixel width.
   * Approximates at ~6.5px per character for 11px Segoe UI.
   */
  private truncateLabel(text: string, maxWidth: number): string {
    const charWidth = 6.5;
    const maxChars = Math.max(2, Math.floor(maxWidth / charWidth));
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 1) + '\u2026';
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
