/**
 * Timeline Milestone — Power BI IVisual implementation.
 * Horizontal or vertical timeline spine with milestone markers,
 * alternating up/down labels, and animated entrance.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { TimelineMilestoneSettings } from './settings';
import * as d3 from 'd3';
import {
  popIn,
  fadeSlideIn,
  getGlassStyle,
  getHostChartColor,
  DURATION,
  renderChartTitle,
  applyDataLabelFormatting,
  applyChartAria,
  ensureFocusRingStyles,
  resolveColorTheme,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  attachKeyboardNav,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Data types ──────────────────────────────────────────────────────

interface Milestone {
  date: Date | null;
  dateStr: string;
  label: string;
  category: string;
  selectionId: ISelectionId;
}

// ── Date formatting helpers ─────────────────────────────────────────

function formatDate(date: Date | null, format: string, locale?: string): string {
  if (!date || isNaN(date.getTime())) return '';
  const resolvedLocale = locale && locale.trim().length > 0 ? locale : undefined;
  if (format === 'short') {
    return new Intl.DateTimeFormat(resolvedLocale, { month: 'numeric', day: 'numeric' }).format(date);
  }
  if (format === 'long') {
    return new Intl.DateTimeFormat(resolvedLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(resolvedLocale, { month: 'short', day: 'numeric' }).format(date);
}

// ── Visual class ────────────────────────────────────────────────────

export class TimelineMilestoneVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: TimelineMilestoneSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new TimelineMilestoneSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('timeline-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        TimelineMilestoneSettings,
        dataView
      );
    }

    // Conditional visibility: hide date format when showDates is off
    this.settings.timelineSettings.dateFormat.visible = this.settings.timelineSettings.showDates.value;

    // Hide today line color when showTodayLine is off
    this.settings.timelineMarkerSettings.todayLineColor.visible = this.settings.timelineMarkerSettings.showTodayLine.value;

    // Hide cluster threshold when clusterNearby is off
    this.settings.timelineMarkerSettings.clusterThresholdDays.visible = this.settings.timelineMarkerSettings.clusterNearby.value;

    // Hide animation duration when animations are disabled
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    // Hide duration bar sub-settings when duration bars are off
    this.settings.timelineLayoutSettings.durationBarOpacity.visible = this.settings.timelineLayoutSettings.showDurationBars.value;
    this.settings.timelineLayoutSettings.durationBarHeight.visible = this.settings.timelineLayoutSettings.showDurationBars.value;

    // Extract data
    const milestones = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(milestones, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): Milestone[] {
    const result: Milestone[] = [];
    if (!dataView?.categorical) return result;

    const categorical = dataView.categorical;
    const allCategories = categorical.categories;
    if (!allCategories || allCategories.length === 0) return result;

    // Find date, label, and category columns from categories
    let dateCol: powerbi.DataViewCategoryColumn | undefined;
    let labelCol: powerbi.DataViewCategoryColumn | undefined;
    let catCol: powerbi.DataViewCategoryColumn | undefined;

    for (const col of allCategories) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['date']) dateCol = col;
      if (role['label']) labelCol = col;
      if (role['category']) catCol = col;
    }

    const categories = dateCol ?? allCategories[0];
    const count = categories.values.length;

    for (let i = 0; i < count; i++) {
      const rawDate = categories.values[i];
      let date: Date | null = null;
      let dateStr = '';

      if (rawDate instanceof Date) {
        date = rawDate;
        dateStr = rawDate.toISOString();
      } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
          dateStr = String(rawDate);
        } else {
          dateStr = String(rawDate);
        }
      }

      const label = labelCol && i < labelCol.values.length
        ? String(labelCol.values[i] ?? '')
        : dateStr;
      const category = catCol && i < catCol.values.length
        ? String(catCol.values[i] ?? '')
        : '';
      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      result.push({ date, dateStr, label, category, selectionId });
    }

    // Sort by date
    result.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.getTime() - b.date.getTime();
    });

    // Cluster nearby events if enabled
    const clusterNearby = this.settings.timelineMarkerSettings.clusterNearby.value;
    const clusterDays = this.settings.timelineMarkerSettings.clusterThresholdDays.value;
    if (clusterNearby && clusterDays > 0 && result.length > 1) {
      const msThreshold = clusterDays * 24 * 60 * 60 * 1000;
      const clustered: Milestone[] = [];
      let i = 0;
      while (i < result.length) {
        const group: Milestone[] = [result[i]];
        let j = i + 1;
        while (j < result.length && result[i].date && result[j].date &&
               (result[j].date!.getTime() - result[i].date!.getTime()) <= msThreshold) {
          group.push(result[j]);
          j++;
        }
        if (group.length > 1) {
          // Merge into a cluster milestone: combine labels, keep earliest date
          const labels = group.map((m) => m.label).join(', ');
          clustered.push({
            date: group[0].date,
            dateStr: group[0].dateStr,
            label: `[${group.length}] ${labels}`,
            category: group[0].category,
            selectionId: group[0].selectionId,
          });
        } else {
          clustered.push(group[0]);
        }
        i = j;
      }
      return clustered;
    }

    return result;
  }

  private render(milestones: Milestone[], viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    this.hideTooltip();

    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const orientation = String(s.timelineSettings.orientation.value?.value ?? 'horizontal');
    const showDates = s.timelineSettings.showDates.value;
    const dateFormatVal = String(s.timelineSettings.dateFormat.value?.value ?? 'medium');
    const markerShape = String(s.markerSettings.shape.value?.value ?? 'circle');
    const markerSize = Math.max(4, s.markerSettings.size.value);
    const colorByCat = s.markerSettings.colorByCategory.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const timelineLineWidth = s.timelineSettings.lineWidth.value;
    const markerStrokeColorValue = s.timelineSettings.markerStrokeColor.value?.value;
    const markerStroke = markerStrokeColorValue && markerStrokeColorValue.length > 0 ? markerStrokeColorValue : '#fff';
    const lineColorValue = s.timelineSettings.lineColor.value?.value;
    const labelColorValue = s.timelineSettings.labelColor.value?.value;
    const isHorizontal = orientation === 'horizontal';

    // Layout setting: alternating, top, bottom, staggered
    const layoutModeRaw = s.timelineLayoutSettings.layout.value;
    const layoutMode: string = (typeof layoutModeRaw === 'string'
      ? layoutModeRaw
      : (layoutModeRaw as { value?: string } | undefined)?.value) ?? 'alternating';

    const showSwimlanes = s.timelineLayoutSettings.showSwimlanes.value;
    const showDurationBars = s.timelineLayoutSettings.showDurationBars.value;
    const showConnectors = s.timelineLayoutSettings.showConnectors.value;

    const locale = this.getHostLocale();
    const highContrast = this.getHighContrastColors();
    const axisLabelColorValue = s.axisFormattingCard.axisLabelColor.value?.value || '';
    const axisLineColorValue = s.axisFormattingCard.axisLineColor.value?.value || '';
    const connectorColor = highContrast.enabled ? highContrast.foreground : (lineColorValue && lineColorValue.length > 0 ? lineColorValue : (axisLineColorValue && axisLineColorValue.length > 0 ? axisLineColorValue : '#CBD5E1'));
    const axisLineWidth = s.axisFormattingCard.axisLineWidth.value;
    const spineWidth = axisLineWidth > 1 ? axisLineWidth : timelineLineWidth;
    const primaryTextColor = highContrast.enabled ? highContrast.foreground : (labelColorValue && labelColorValue.length > 0 ? labelColorValue : (axisLabelColorValue || '#1E293B'));
    const secondaryTextColor = highContrast.enabled ? highContrast.foreground : (labelColorValue && labelColorValue.length > 0 ? labelColorValue : (axisLabelColorValue || '#64748B'));
    const labelFontSize = `${Math.max(6, s.axisFormattingCard.axisLabelSize.value)}px`;
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyleValue = s.axisFormattingCard.gridLineStyle.value;
    const gridLineStyle = typeof gridLineStyleValue === 'string'
      ? gridLineStyleValue
      : (gridLineStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
    const gridDash = gridLineStyle === 'dashed' ? '4 3' : gridLineStyle === 'dotted' ? '2 2' : 'none';
    const labelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || 'inherit';
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Hide axis properties that don't apply to a timeline visual
    s.axisFormattingCard.showXAxis.visible = false;
    s.axisFormattingCard.showYAxis.visible = false;
    s.axisFormattingCard.xAxisTitle.visible = false;
    s.axisFormattingCard.yAxisTitle.visible = false;
    s.axisFormattingCard.axisLabelRotation.visible = false;
    s.axisFormattingCard.yAxisMin.visible = false;
    s.axisFormattingCard.yAxisMax.visible = false;
    s.axisFormattingCard.gridLineWidth.visible = false;
    s.axisFormattingCard.gridLineOpacity.visible = false;

    // Apply glass style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }
    if (highContrast.enabled) {
      this.container.style.backgroundColor = highContrast.background;
      this.container.style.color = highContrast.foreground;
    } else {
      this.container.style.backgroundColor = '';
      this.container.style.color = '';
    }

    // Empty state
    if (milestones.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.textContent = 'Add Date and Label fields';
      this.container.appendChild(empty);
      return;
    }

    // Build category color map
    const uniqueCategories = [...new Set(milestones.map((m) => m.category).filter(Boolean))];
    const catColorMap = new Map<string, string>();
    uniqueCategories.forEach((cat, i) => {
      catColorMap.set(cat, getHostChartColor(this.host.colorPalette, i, themeName));
    });
    const defaultColor = highContrast.enabled ? highContrast.foregroundSelected : '#3B82F6';

    // SVG setup
    const padding = 40;
    const labelSpace = 60;
    const svgWidth = viewport.width;
    const svgHeight = viewport.height;

    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const n = milestones.length;

    if (isHorizontal) {
      const xStart = padding;
      const xEnd = svgWidth - padding;
      const cy = svgHeight / 2;

      // Spine line
      svg.append('line')
        .attr('x1', xStart).attr('y1', cy)
        .attr('x2', xEnd).attr('y2', cy)
        .attr('stroke', connectorColor).attr('stroke-width', spineWidth);

      // Position milestones evenly
      const step = n > 1 ? (xEnd - xStart) / (n - 1) : 0;

      // Grid lines (vertical tick marks at each milestone position)
      if (showGridLines && n > 1) {
        const gridGroup = svg.append('g').attr('class', 'timeline-grid');
        for (let gi = 0; gi < n; gi++) {
          const gx = xStart + gi * step;
          gridGroup.append('line')
            .attr('x1', gx).attr('y1', 0)
            .attr('x2', gx).attr('y2', svgHeight)
            .attr('stroke', gridLineColor)
            .attr('stroke-dasharray', gridDash)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1);
        }
      }

      // Swimlane backgrounds (horizontal)
      if (showSwimlanes && uniqueCategories.length > 1) {
        const laneHeight = svgHeight / uniqueCategories.length;
        uniqueCategories.forEach((cat, idx) => {
          const laneColor = catColorMap.get(cat) ?? defaultColor;
          svg.append('rect')
            .attr('x', xStart)
            .attr('y', idx * laneHeight)
            .attr('width', xEnd - xStart)
            .attr('height', laneHeight)
            .attr('fill', laneColor)
            .attr('fill-opacity', 0.05)
            .attr('stroke', laneColor)
            .attr('stroke-opacity', 0.15)
            .attr('stroke-width', 0.5);
          svg.append('text')
            .attr('x', xStart - 4)
            .attr('y', idx * laneHeight + laneHeight / 2)
            .attr('text-anchor', 'end')
            .attr('font-size', '9px')
            .attr('fill', secondaryTextColor)
            .attr('dominant-baseline', 'middle')
            .text(cat);
        });
      }

      milestones.forEach((ms, i) => {
        const cx = n > 1 ? xStart + i * step : svgWidth / 2;
        // Determine above/below based on layout mode
        let isAbove: boolean;
        let staggerLevel = 0; // 0 = normal offset, 1/2 = progressively further
        if (layoutMode === 'top') {
          isAbove = true;
        } else if (layoutMode === 'bottom') {
          isAbove = false;
        } else if (layoutMode === 'staggered') {
          // 3-level stagger: above-near, below, above-far
          const level = i % 3;
          isAbove = level !== 1; // levels 0 and 2 are above, level 1 is below
          staggerLevel = level;
        } else {
          // 'alternating'
          isAbove = i % 2 === 0;
        }
        const baseColor = colorByCat && ms.category ? (catColorMap.get(ms.category) ?? defaultColor) : getHostChartColor(this.host.colorPalette, i, themeName);
        const conditionalValue = ms.date ? ms.date.getTime() : i;
        const color = this.getConditionalColor(conditionalValue) ?? baseColor;

        // Connector line from spine to label area — staggered uses varying lengths
        const staggerMultiplier = layoutMode === 'staggered' ? (staggerLevel === 2 ? 1.6 : staggerLevel === 1 ? 1.0 : 0.6) : 1.0;
        const connectorLen = (labelSpace - markerSize) * staggerMultiplier;
        const y1 = isAbove ? cy - markerSize / 2 : cy + markerSize / 2;
        const y2 = isAbove ? cy - connectorLen : cy + connectorLen;

        if (showConnectors) {
          svg.append('line')
            .attr('x1', cx).attr('y1', y1)
            .attr('x2', cx).attr('y2', y2)
            .attr('stroke', connectorColor).attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2');
        }

        // Marker
        const marker = this.createSvgMarker(svg, cx, cy, markerSize, markerShape, color, markerStroke);

        // Label text
        const labelY = isAbove ? y2 - 4 : y2 + 12;
        const labelGroup = svg.append('g');

        if (showDataLabels) {
          labelGroup.append('text')
            .attr('class', 'timeline-data-label')
            .attr('x', cx).attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', '600')
            .attr('fill', primaryTextColor)
            .text(ms.label.length > 16 ? ms.label.slice(0, 14) + '...' : ms.label);

          if (showDates && ms.date) {
            const dateY = isAbove ? labelY - 14 : labelY + 14;
            labelGroup.append('text')
              .attr('class', 'timeline-data-label')
              .attr('x', cx).attr('y', dateY)
              .attr('text-anchor', 'middle')
              .attr('font-size', labelFontSize)
              .attr('font-family', labelFontFamily)
              .attr('fill', secondaryTextColor)
              .text(formatDate(ms.date, dateFormatVal, locale));
          }
        }
        this.attachSelection(marker, labelGroup, ms, dateFormatVal, locale);

        // Animations
        if (animEnabled && marker) {
          const markerNode = marker.node();
          if (markerNode) {
            const cancel = popIn(markerNode as unknown as HTMLElement, i * 80, animDuration);
            this.cancelAnimations.push(cancel);
          }
        }

        if (animEnabled && showDataLabels) {
          const labelNode = labelGroup.node();
          if (labelNode) {
            const dir = isAbove ? 'down' as const : 'up' as const;
            const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, dir, animDuration, i * 80 + 100);
            this.cancelAnimations.push(cancel);
          }
        }
      });
    } else {
      // Vertical orientation
      const yStart = padding;
      const yEnd = svgHeight - padding;
      const cx = svgWidth / 2;

      // Spine line
      svg.append('line')
        .attr('x1', cx).attr('y1', yStart)
        .attr('x2', cx).attr('y2', yEnd)
        .attr('stroke', connectorColor).attr('stroke-width', spineWidth);

      const step = n > 1 ? (yEnd - yStart) / (n - 1) : 0;

      // Grid lines (horizontal tick marks at each milestone position)
      if (showGridLines && n > 1) {
        const gridGroup = svg.append('g').attr('class', 'timeline-grid');
        for (let gi = 0; gi < n; gi++) {
          const gy = yStart + gi * step;
          gridGroup.append('line')
            .attr('x1', 0).attr('y1', gy)
            .attr('x2', svgWidth).attr('y2', gy)
            .attr('stroke', gridLineColor)
            .attr('stroke-dasharray', gridDash)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1);
        }
      }

      // Swimlane backgrounds (vertical)
      if (showSwimlanes && uniqueCategories.length > 1) {
        const laneWidth = svgWidth / uniqueCategories.length;
        uniqueCategories.forEach((cat, idx) => {
          const laneColor = catColorMap.get(cat) ?? defaultColor;
          svg.append('rect')
            .attr('x', idx * laneWidth)
            .attr('y', yStart)
            .attr('width', laneWidth)
            .attr('height', yEnd - yStart)
            .attr('fill', laneColor)
            .attr('fill-opacity', 0.05)
            .attr('stroke', laneColor)
            .attr('stroke-opacity', 0.15)
            .attr('stroke-width', 0.5);
        });
      }

      milestones.forEach((ms, i) => {
        const my = n > 1 ? yStart + i * step : svgHeight / 2;
        // Determine left/right based on layout mode
        let isLeft: boolean;
        let staggerLevel = 0;
        if (layoutMode === 'top') {
          isLeft = true;
        } else if (layoutMode === 'bottom') {
          isLeft = false;
        } else if (layoutMode === 'staggered') {
          const level = i % 3;
          isLeft = level !== 1;
          staggerLevel = level;
        } else {
          isLeft = i % 2 === 0;
        }
        const baseColor = colorByCat && ms.category ? (catColorMap.get(ms.category) ?? defaultColor) : getHostChartColor(this.host.colorPalette, i, themeName);
        const conditionalValue = ms.date ? ms.date.getTime() : i;
        const color = this.getConditionalColor(conditionalValue) ?? baseColor;

        // Connector — staggered uses varying lengths
        const staggerMultiplier = layoutMode === 'staggered' ? (staggerLevel === 2 ? 1.6 : staggerLevel === 1 ? 1.0 : 0.6) : 1.0;
        const connectorLen = 60 * staggerMultiplier;
        const x1 = isLeft ? cx - markerSize / 2 : cx + markerSize / 2;
        const x2 = isLeft ? cx - connectorLen : cx + connectorLen;

        if (showConnectors) {
          svg.append('line')
            .attr('x1', x1).attr('y1', my)
            .attr('x2', x2).attr('y2', my)
            .attr('stroke', connectorColor).attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2');
        }

        // Marker
        const marker = this.createSvgMarker(svg, cx, my, markerSize, markerShape, color, markerStroke);

        // Label text
        const labelX = isLeft ? x2 - 4 : x2 + 4;
        const anchor = isLeft ? 'end' : 'start';
        const labelGroup = svg.append('g');

        if (showDataLabels) {
          labelGroup.append('text')
            .attr('class', 'timeline-data-label')
            .attr('x', labelX).attr('y', my + 4)
            .attr('text-anchor', anchor)
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', '600')
            .attr('fill', primaryTextColor)
            .text(ms.label.length > 16 ? ms.label.slice(0, 14) + '...' : ms.label);

          if (showDates && ms.date) {
            labelGroup.append('text')
              .attr('class', 'timeline-data-label')
              .attr('x', labelX).attr('y', my + 18)
              .attr('text-anchor', anchor)
              .attr('font-size', labelFontSize)
              .attr('font-family', labelFontFamily)
              .attr('fill', secondaryTextColor)
              .text(formatDate(ms.date, dateFormatVal, locale));
          }
        }
        this.attachSelection(marker, labelGroup, ms, dateFormatVal, locale);

        // Animations
        if (animEnabled && marker) {
          const markerNode = marker.node();
          if (markerNode) {
            const cancel = popIn(markerNode as unknown as HTMLElement, i * 80, animDuration);
            this.cancelAnimations.push(cancel);
          }
        }

        if (animEnabled && showDataLabels) {
          const labelNode = labelGroup.node();
          if (labelNode) {
            const dir = isLeft ? 'right' as const : 'left' as const;
            const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, dir, animDuration, i * 80 + 100);
            this.cancelAnimations.push(cancel);
          }
        }
      });
    }
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.timeline-data-label');

    // Duration bars between consecutive milestones
    if (showDurationBars && milestones.length > 1) {
      const durationGroup = svg.append('g').attr('class', 'timeline-duration-bars');
      for (let i = 0; i < milestones.length - 1; i++) {
        if (!milestones[i].date || !milestones[i + 1].date) continue;
        const barColor = catColorMap.get(milestones[i].category) ?? defaultColor;
        if (isHorizontal) {
          const xStart2 = n > 1 ? padding + i * ((svgWidth - padding * 2) / (n - 1)) : svgWidth / 2;
          const xEnd2 = n > 1 ? padding + (i + 1) * ((svgWidth - padding * 2) / (n - 1)) : svgWidth / 2;
          const barY = svgHeight / 2 + markerSize + 2;
          const durBarHeight = s.timelineLayoutSettings.durationBarHeight.value;
          const durBarOpacity = s.timelineLayoutSettings.durationBarOpacity.value / 100;
          durationGroup.append('rect')
            .attr('x', xStart2)
            .attr('y', barY)
            .attr('width', Math.max(0, xEnd2 - xStart2))
            .attr('height', durBarHeight)
            .attr('rx', 2)
            .attr('fill', barColor)
            .attr('fill-opacity', durBarOpacity);
        } else {
          const yStart2 = n > 1 ? padding + i * ((svgHeight - padding * 2) / (n - 1)) : svgHeight / 2;
          const yEnd2 = n > 1 ? padding + (i + 1) * ((svgHeight - padding * 2) / (n - 1)) : svgHeight / 2;
          const barX = svgWidth / 2 + markerSize + 2;
          const durBarHeight = s.timelineLayoutSettings.durationBarHeight.value;
          const durBarOpacity = s.timelineLayoutSettings.durationBarOpacity.value / 100;
          durationGroup.append('rect')
            .attr('x', barX)
            .attr('y', yStart2)
            .attr('width', durBarHeight)
            .attr('height', Math.max(0, yEnd2 - yStart2))
            .attr('rx', 2)
            .attr('fill', barColor)
            .attr('fill-opacity', durBarOpacity);
        }
      }
    }

    // Today line
    this.renderTodayLine(svg, milestones, viewport, isHorizontal, padding);

    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  private createSvgMarker(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    cx: number,
    cy: number,
    size: number,
    shape: string,
    color: string,
    strokeColor: string,
  ): d3.Selection<SVGElement, unknown, null, undefined> | null {
    const half = size / 2;

    if (shape === 'circle') {
      return svg.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', half)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', 2) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    if (shape === 'square') {
      return svg.append('rect')
        .attr('x', cx - half).attr('y', cy - half)
        .attr('width', size).attr('height', size)
        .attr('rx', 2)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', 2) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    if (shape === 'diamond') {
      const pts = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
      return svg.append('polygon')
        .attr('points', pts)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', 2) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    return null;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private attachSelection(
    marker: d3.Selection<SVGElement, unknown, null, undefined> | null,
    labelGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    milestone: Milestone,
    dateFormatVal: string,
    locale: string | undefined,
  ): void {
    const onClick = (event: MouseEvent): void => {
      event.stopPropagation();
      void this.selectionManager.select(milestone.selectionId, event.ctrlKey || event.metaKey);
    };
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(milestone.selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    };
    const onMouseEnter = (event: MouseEvent): void => {
      this.showMilestoneTooltip(milestone, dateFormatVal, locale, event);
    };
    const onMouseMove = (event: MouseEvent): void => {
      this.moveTooltip(event);
    };
    const onMouseLeave = (): void => {
      this.hideTooltip();
    };

    if (marker) {
      marker.style('cursor', 'pointer');
      marker.on('click.selection', onClick);
      marker.on('contextmenu.selection', onContextMenu);
      marker.on('mouseenter.tooltip', onMouseEnter);
      marker.on('mousemove.tooltip', onMouseMove);
      marker.on('mouseleave.tooltip', onMouseLeave);
    }

    labelGroup.style('cursor', 'pointer');
    labelGroup.on('click.selection', onClick);
    labelGroup.on('contextmenu.selection', onContextMenu);
    labelGroup.on('mouseenter.tooltip', onMouseEnter);
    labelGroup.on('mousemove.tooltip', onMouseMove);
    labelGroup.on('mouseleave.tooltip', onMouseLeave);
  }

  private showMilestoneTooltip(milestone: Milestone, dateFormatVal: string, locale: string | undefined, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Label', value: milestone.label },
    ];
    if (milestone.date) {
      tooltipData.push({ displayName: 'Date', value: formatDate(milestone.date, dateFormatVal, locale) });
    }
    if (milestone.category) {
      tooltipData.push({ displayName: 'Category', value: milestone.category });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [milestone.selectionId],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private moveTooltip(event: MouseEvent): void {
    this.host.tooltipService.move({
      dataItems: [],
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private hideTooltip(): void {
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
  }

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  private getHighContrastColors(): {
    enabled: boolean;
    foreground: string;
    background: string;
    foregroundSelected: string;
  } {
    const palette = (this.host as unknown as {
      colorPalette?: {
        isHighContrast?: boolean;
        foreground?: unknown;
        background?: unknown;
        foregroundSelected?: unknown;
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
    };
  }

  private notifyRenderStarted(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingStarted?: () => void };
    }).eventService;
    eventService?.renderingStarted?.();
  }

  private notifyRenderFinished(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFinished?: () => void };
    }).eventService;
    eventService?.renderingFinished?.();
  }

  private notifyRenderFailed(error: unknown): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFailed?: (reason: string) => void };
    }).eventService;
    const reason = error instanceof Error ? error.message : 'render failure';
    eventService?.renderingFailed?.(reason);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Today Line Rendering ---------------------------------------------------

  private renderTodayLine(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    milestones: Milestone[],
    viewport: powerbi.IViewport,
    isHorizontal: boolean,
    padding: number,
  ): void {
    const markerSettings = this.settings.timelineMarkerSettings;
    if (!markerSettings.showTodayLine.value) return;

    const datesWithTime = milestones
      .filter((m) => m.date !== null)
      .map((m) => m.date!.getTime());
    if (datesWithTime.length < 2) return;

    const minTime = Math.min(...datesWithTime);
    const maxTime = Math.max(...datesWithTime);
    const now = Date.now();
    if (now < minTime || now > maxTime) return;

    const frac = (now - minTime) / (maxTime - minTime);
    const color = markerSettings.todayLineColor.value?.value ?? '#EF4444';

    if (isHorizontal) {
      const xStart = padding;
      const xEnd = viewport.width - padding;
      const x = xStart + frac * (xEnd - xStart);
      svg.append('line')
        .attr('x1', x).attr('y1', 0)
        .attr('x2', x).attr('y2', viewport.height)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7);
    } else {
      const yStart = padding;
      const yEnd = viewport.height - padding;
      const y = yStart + frac * (yEnd - yStart);
      svg.append('line')
        .attr('x1', 0).attr('y1', y)
        .attr('x2', viewport.width).attr('y2', y)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7);
    }
  }

  // -- Conditional Formatting -------------------------------------------------

  private getConditionalColor(value: number): string | undefined {
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

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      attachKeyboardNav({
        container: this.container,
        itemSelector: 'circle, rect, polygon',
        onActivate: (el: Element) => {
          (el as HTMLElement).click?.();
        },
      });
    }
    applyChartAria(this.container, {
      chartType: 'timeline',
      dataPointCount: this.container.querySelectorAll('circle, rect, polygon').length,
    });
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
