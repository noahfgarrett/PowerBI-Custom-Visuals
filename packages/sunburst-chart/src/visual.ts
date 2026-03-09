/**
 * Sunburst Chart -- Power BI IVisual implementation.
 * Hierarchical ring chart with sweepArc animation per ring layer,
 * springScale hover, and click-to-zoom drill-down.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { SunburstChartSettings } from './settings';
import {
  sweepArc,
  springScale,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  getGlassStyle,
  getHostChartColor,
  getChartColor,
  withOpacity,
  formatNumber,
  renderChartTitle,
  applyDataLabelFormatting,
  renderLegend,
  type LegendItem,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Data Interfaces ───────────────────────────────────────────────

interface SunburstNode {
  name: string;
  value: number;
  children: SunburstNode[];
  depth: number;
  color: string;
  selectionId?: ISelectionId;
}

interface ArcDatum {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}

// ── Visual Class ──────────────────────────────────────────────────

export class SunburstChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: SunburstChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  /** Current zoom target node (null = show full chart). */
  private zoomedNode: d3.HierarchyRectangularNode<SunburstNode> | null = null;

  /** Cached partition root for zoom transitions. */
  private partitionRoot: d3.HierarchyRectangularNode<SunburstNode> | null = null;

  /** Cached layout dimensions for zoom re-renders. */
  private lastViewport: powerbi.IViewport = { width: 0, height: 0 };

  /** Chain of category names the user has drilled into */
  private drillPath: string[] = [];

  /** Cached root data for drill re-renders */
  private lastRootData: SunburstNode | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new SunburstChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('sunburst-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Reset zoom and drill on new data
    this.zoomedNode = null;
    this.drillPath = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        SunburstChartSettings,
        dataView
      );
    }

    // Extract hierarchical data
    const useChartPalette = this.settings.colorSettings.useChartPalette.value;
    const root = this.extractData(dataView, useChartPalette);

    // Store viewport and root data for drill re-renders
    this.lastViewport = options.viewport;
    this.lastRootData = root;

    this.notifyRenderStarted();
    try {
      this.render(root, options.viewport, true);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  // ── Data Extraction ───────────────────────────────────────────

  private extractData(dataView: DataView | undefined, useChartPalette: boolean): SunburstNode {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const root: SunburstNode = { name: 'root', value: 0, children: [], depth: 0, color: '' };

    if (!dataView?.categorical) return root;

    const categories = dataView.categorical.categories;
    const values = dataView.categorical.values;

    if (!categories || categories.length === 0 || !values || values.length === 0) return root;

    const measureColumn = values[0];
    if (!measureColumn) return root;

    // Determine which category columns are present (up to 3 levels)
    const levelColumns = categories.slice(0, 3);
    const rowCount = measureColumn.values.length;

    // Build a nested tree from flat categorical data
    // Map: level1Name -> Map<level2Name, Map<level3Name, value>>
    let colorIndex = 0;

    for (let i = 0; i < rowCount; i++) {
      const measureVal = measureColumn.values[i];
      if (measureVal == null || typeof measureVal !== 'number' || Number.isNaN(measureVal)) {
        continue;
      }
      const value = Math.max(0, measureVal);

      // Gather level names for this row
      const levelNames: string[] = [];
      for (const col of levelColumns) {
        const cellVal = col.values[i];
        if (cellVal == null) break;
        levelNames.push(String(cellVal));
      }

      if (levelNames.length === 0) continue;

      // Walk / create the tree path
      let parent = root;
      for (let lvl = 0; lvl < levelNames.length; lvl++) {
        const name = levelNames[lvl];
        let child = parent.children.find((c) => c.name === name);
        if (!child) {
          const selectionBuilder = this.host.createSelectionIdBuilder();
          for (let selIdx = 0; selIdx <= lvl; selIdx++) {
            if (levelColumns[selIdx]) {
              selectionBuilder.withCategory(levelColumns[selIdx], i);
            }
          }
          child = {
            name,
            value: 0,
            children: [],
            depth: lvl + 1,
            color: lvl === 0
              ? (useChartPalette
                ? getHostChartColor(this.host.colorPalette, colorIndex++, themeName)
                : getChartColor(colorIndex++, themeName))
              : '',
            selectionId: selectionBuilder.createSelectionId(),
          };
          parent.children.push(child);
        }
        parent = child;
      }

      // Leaf node gets the measure value added
      parent.value += value;
    }

    // Propagate colors from level-1 ancestors down to children
    this.propagateColors(root);

    return root;
  }

  /** Inherit color from parent if a node has no explicit color. */
  private propagateColors(node: SunburstNode, parentColor: string = ''): void {
    if (!node.color) {
      node.color = parentColor;
    }
    for (const child of node.children) {
      this.propagateColors(child, node.color);
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  private render(
    rootData: SunburstNode,
    viewport: powerbi.IViewport,
    entrance: boolean
  ): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    this.hideTooltip();

    // Clear container (no innerHTML)
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const drillEnabled = s.drillDownSettings.enabled.value;

    // Resolve drill path to a sub-tree
    let effectiveRoot = rootData;
    if (drillEnabled && this.drillPath.length > 0) {
      let current = rootData;
      let pathValid = true;
      for (const segment of this.drillPath) {
        const found = current.children.find((c) => c.name === segment);
        if (found && found.children.length > 0) {
          current = found;
        } else {
          pathValid = false;
          break;
        }
      }
      if (pathValid && current !== rootData) {
        // Create a virtual root wrapping the drilled-into node's children
        effectiveRoot = {
          name: current.name,
          value: current.value,
          children: current.children,
          depth: 0,
          color: current.color,
        };
      } else {
        this.drillPath = [];
      }
    }

    // Render breadcrumb
    if (drillEnabled && this.drillPath.length > 0 && s.drillDownSettings.showBreadcrumb.value) {
      this.renderBreadcrumb(rootData);
    }

    // Apply glass card background
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

    // Legend config
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos: string = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';
    const legendHeight = showLegend ? 30 : 0;

    // Render legend at top position
    if (showLegend && legendPos === 'top') {
      this.renderSharedLegend(effectiveRoot.children);
    }

    // Empty state: no children means no data
    if (effectiveRoot.children.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sunburst-empty';
      emptyEl.textContent = 'Add hierarchy levels and a measure';
      this.container.appendChild(emptyEl);
      return;
    }

    // ── Layout Dimensions ──────────────────────────────────────
    const width = viewport.width;
    const height = viewport.height - legendHeight;
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const padding = 24;
    const radius = (size / 2) - padding;

    // ── D3 Hierarchy + Partition ────────────────────────────────
    // Sort order from display settings
    const sortOrderRaw = s.sunburstDisplaySettings.sortOrder.value;
    const sortOrder: string = (typeof sortOrderRaw === 'string'
      ? sortOrderRaw
      : (sortOrderRaw as { value?: string } | undefined)?.value) ?? 'descending';

    const hierarchy = d3.hierarchy<SunburstNode>(effectiveRoot)
      .sum((d) => (d.children.length === 0 ? d.value : 0));

    // Apply sort order
    if (sortOrder === 'descending') {
      hierarchy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    } else if (sortOrder === 'ascending') {
      hierarchy.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    }
    // 'none' / data order: no sort applied

    // Inner radius (percentage of outer radius) and start angle offset
    const innerRadiusPx = (s.sunburstDisplaySettings.innerRadius.value / 100) * radius;
    const startAngleRad = (s.sunburstDisplaySettings.startAngle.value / 360) * 2 * Math.PI;

    const partition = d3.partition<SunburstNode>()
      .size([2 * Math.PI, radius]);

    const partitionedRoot = partition(hierarchy);
    this.partitionRoot = partitionedRoot;

    // Determine zoom target
    const zoomTarget = this.zoomedNode ?? partitionedRoot;
    const xScale = d3.scaleLinear()
      .domain([zoomTarget.x0, zoomTarget.x1])
      .range([0 + startAngleRad, 2 * Math.PI + startAngleRad]);
    const yScale = d3.scaleLinear()
      .domain([zoomTarget.y0, radius])
      .range([zoomTarget.y0 === 0 ? innerRadiusPx : Math.max(20, innerRadiusPx), radius]);

    // ── SVG Setup ──────────────────────────────────────────────
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'sunburst-svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // ── Arc Generator ──────────────────────────────────────────
    const arcGen = d3.arc<ArcDatum>()
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .innerRadius((d) => d.innerRadius)
      .outerRadius((d) => d.outerRadius)
      .padAngle(0.01)
      .cornerRadius(2);

    // ── Render Segments ────────────────────────────────────────
    const animEnabled = s.animationSettings.enabled.value && entrance;
    const animDuration = s.animationSettings.duration.value;
    const labelMinAngleRad = (s.sunburstSettings.labelMinAngle.value * Math.PI) / 180;
    const segmentStrokeColor = s.sunburstSettings.segmentStrokeColor.value?.value || '';
    const segmentStrokeWidth = s.sunburstSettings.segmentStrokeWidth.value;
    const labelColor = s.sunburstSettings.labelColor.value?.value || '';

    const descendants = partitionedRoot.descendants().filter((d) => d.depth > 0);

    for (const node of descendants) {
      const startAngle = Math.max(0, Math.min(2 * Math.PI, xScale(node.x0)));
      const endAngle = Math.max(0, Math.min(2 * Math.PI, xScale(node.x1)));
      const innerR = Math.max(0, yScale(node.y0));
      const outerR = Math.max(0, yScale(node.y1));
      const arcAngle = endAngle - startAngle;

      // Skip segments that are too small to see after zoom
      if (arcAngle < 0.001) continue;

      const nodeData = node.data;
      const conditionalColor = this.getConditionalColor(node.value ?? 0);
      const segColor = conditionalColor ?? (nodeData.color || getHostChartColor(this.host.colorPalette, 0, themeName));
      // Slightly lighten deeper rings for visual depth
      const opacity = Math.max(0.6, 1 - (node.depth - 1) * 0.12);

      const segGroup = g.append('g').attr('class', 'sunburst-segment');

      const segPath = segGroup.append('path')
        .attr('fill', segColor)
        .attr('fill-opacity', opacity)
        .attr('stroke', segmentStrokeColor || withOpacity(segColor, 0.4))
        .attr('stroke-width', segmentStrokeWidth);

      if (animEnabled) {
        // Start with zero-angle arc
        segPath.attr('d', arcGen({
          startAngle,
          endAngle: startAngle,
          innerRadius: innerR,
          outerRadius: innerR,
        }));

        // Stagger by depth: outer rings start later
        const delay = (node.depth - 1) * DURATION.stagger * 3;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelAnim: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelAnim = animate(animDuration, cubicOut, (progress) => {
            const currentEnd = startAngle + arcAngle * progress;
            const currentOuter = innerR + (outerR - innerR) * progress;
            segPath.attr('d', arcGen({
              startAngle,
              endAngle: currentEnd,
              innerRadius: innerR,
              outerRadius: currentOuter,
            }));
          }, () => {
            segPath.attr('d', arcGen({
              startAngle,
              endAngle,
              innerRadius: innerR,
              outerRadius: outerR,
            }));
          });
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelAnim?.();
        });
      } else {
        segPath.attr('d', arcGen({
          startAngle,
          endAngle,
          innerRadius: innerR,
          outerRadius: outerR,
        }));
      }

      // ── Click to zoom / drill ──────────────────────────────
      const segNode = segPath.node();
      if (segNode) {
        segNode.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          if ((event.ctrlKey || event.metaKey) && nodeData.selectionId) {
            void this.selectionManager.select(nodeData.selectionId, true);
            return;
          }

          // Drill-down: push node name onto drill path if it has children
          if (drillEnabled && nodeData.children.length > 0) {
            this.drillPath.push(nodeData.name);
            this.zoomedNode = null;

            this.cancelAnimations.forEach((cancel) => cancel());
            this.cancelAnimations = [];

            this.notifyRenderStarted();
            try {
              this.render(rootData, this.lastViewport, false);
              this.notifyRenderFinished();
            } catch (error) {
              this.notifyRenderFailed(error);
              throw error;
            }
            return;
          }

          // If clicking the already-zoomed node, zoom out to parent
          if (this.zoomedNode === node) {
            this.zoomedNode = node.parent !== partitionedRoot ? node.parent : null;
          } else {
            this.zoomedNode = node;
          }

          // Cancel running animations
          this.cancelAnimations.forEach((cancel) => cancel());
          this.cancelAnimations = [];

          // Re-render without entrance animation
          this.notifyRenderStarted();
          try {
            this.render(rootData, this.lastViewport, false);
            this.notifyRenderFinished();
          } catch (error) {
            this.notifyRenderFailed(error);
            throw error;
          }
        });
        segNode.addEventListener('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          if (nodeData.selectionId) {
            void this.selectionManager.showContextMenu(nodeData.selectionId, {
              x: event.clientX,
              y: event.clientY,
            });
          }
        });
      }

      // ── Hover: springScale ─────────────────────────────────
      if (segNode) {
        let hoverCancel: (() => void) | null = null;

        segNode.addEventListener('mouseenter', (event: MouseEvent) => {
          hoverCancel?.();
          hoverCancel = springScale(segNode, 0, 300, 1, 1.05);
          segPath.attr('fill-opacity', Math.min(1, opacity + 0.15));
          this.showSegmentTooltip(nodeData, Math.round(node.value ?? 0), event);
        });

        segNode.addEventListener('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        });

        segNode.addEventListener('mouseleave', () => {
          hoverCancel?.();
          hoverCancel = springScale(segNode, 0, 300, 1.05, 1);
          segPath.attr('fill-opacity', opacity);
          this.hideTooltip();
        });

        this.cancelAnimations.push(() => {
          hoverCancel?.();
        });
      }

      // ── Labels (gated by both sunburst showLabels and shared showDataLabels) ──
      // Consolidate: local showLabels AND shared DataLabelFormattingCard.showDataLabels must both be true
      const effectiveShowLabels = s.sunburstSettings.showLabels.value && s.dataLabelFormattingCard.showDataLabels.value;
      if (effectiveShowLabels && arcAngle >= labelMinAngleRad) {
        const midAngle = (startAngle + endAngle) / 2;
        const labelRadius = (innerR + outerR) / 2;
        const labelX = labelRadius * Math.sin(midAngle);
        const labelY = -labelRadius * Math.cos(midAngle);

        // Only render label if there's enough radial space
        const radialSpace = outerR - innerR;
        if (radialSpace > 18) {
          // Build label text — include percentage if enabled
          const showPct = s.sunburstDisplaySettings.showPercentages.value;
          const percentOfRaw = s.sunburstDisplaySettings.percentOf.value;
          const percentOf: string = (typeof percentOfRaw === 'string'
            ? percentOfRaw
            : (percentOfRaw as { value?: string } | undefined)?.value) ?? 'parent';

          let labelText = nodeData.name;
          if (showPct && (node.value ?? 0) > 0) {
            let baseValue: number;
            if (percentOf === 'parent' && node.parent) {
              baseValue = node.parent.value ?? 1;
            } else {
              // 'total' — use the full root value
              baseValue = partitionedRoot.value ?? 1;
            }
            const pct = baseValue > 0
              ? ((node.value ?? 0) / baseValue) * 100
              : 0;
            labelText = `${nodeData.name} (${pct.toFixed(1)}%)`;
          }

          const labelEl = segGroup.append('text')
            .attr('class', 'sunburst-label')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('dy', '0.35em');
          if (labelColor) {
            labelEl.attr('fill', labelColor);
          }
          labelEl.text(labelText);

          // Rotate label to follow arc
          const angleDeg = (midAngle * 180) / Math.PI;
          const rotate = angleDeg > 180 ? angleDeg - 270 : angleDeg - 90;
          labelEl.attr('transform', `rotate(${rotate}, ${labelX}, ${labelY})`);

          if (animEnabled) {
            labelEl.attr('opacity', 0);
            const labelDelay = (node.depth - 1) * DURATION.stagger * 3 + animDuration * 0.6;
            let labelTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelLabelAnim: (() => void) | null = null;

            labelTimeoutId = setTimeout(() => {
              cancelLabelAnim = animate(DURATION.fast, cubicOut, (progress) => {
                labelEl.attr('opacity', progress * 0.9);
              });
            }, labelDelay);

            this.cancelAnimations.push(() => {
              if (labelTimeoutId !== null) clearTimeout(labelTimeoutId);
              cancelLabelAnim?.();
            });
          }
        }
      }
    }

    // ── Center Content (total/KPI display) ──────────────────────
    const cc = s.centerContentSettings;
    if (cc.show.value && effectiveRoot.children.length > 0) {
      const modeRaw = cc.displayMode.value;
      const mode: string = (typeof modeRaw === 'string' ? modeRaw : (modeRaw as { value?: string })?.value) ?? 'total';

      // Sum of root-level children values
      const total = effectiveRoot.children.reduce((sum, child) => sum + child.value, 0);
      const count = effectiveRoot.children.length;
      const average = count > 0 ? total / count : 0;

      const ccFontColor = cc.fontColor.value?.value || '';

      if (mode === 'custom') {
        // Custom mode: show customText as the main text, no label below
        const centerText = g.append('text')
          .attr('class', 'sunburst-center-value')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(cc.customText.value || '');
        if (ccFontColor) {
          centerText.attr('fill', ccFontColor);
        }
      } else {
        let displayValue: number;
        let labelText: string;
        if (mode === 'count') {
          displayValue = count;
          labelText = 'Count';
        } else if (mode === 'average') {
          displayValue = average;
          labelText = 'Average';
        } else {
          displayValue = total;
          labelText = 'Total';
        }

        const locale = this.getHostLocale();
        const formattedValue = formatNumber(displayValue, { abbreviate: true, locale });

        // Value text (slightly above center when label is shown)
        const valueY = cc.showLabel.value ? -cc.labelFontSize.value * 0.6 : 0;
        const valueText = g.append('text')
          .attr('class', 'sunburst-center-value')
          .attr('x', 0)
          .attr('y', valueY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(formattedValue);
        if (ccFontColor) {
          valueText.attr('fill', ccFontColor);
        }

        // Label text below value
        if (cc.showLabel.value) {
          const labelY = valueY + cc.fontSize.value * 0.6 + cc.labelFontSize.value * 0.6;
          const labelEl = g.append('text')
            .attr('class', 'sunburst-center-label')
            .attr('x', 0)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', `${cc.labelFontSize.value}px`)
            .attr('font-weight', '400')
            .attr('opacity', 0.7)
            .attr('pointer-events', 'none')
            .text(labelText);
          if (ccFontColor) {
            labelEl.attr('fill', ccFontColor);
          }
        }
      }
    }

    // ── Center circle (clickable to zoom out or drill up) ──────
    if (this.zoomedNode !== null || (drillEnabled && this.drillPath.length > 0)) {
      const centerCircle = g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', Math.max(0, yScale(zoomTarget.y0)) || 20)
        .attr('fill', 'rgba(148, 163, 184, 0.08)')
        .attr('stroke', 'rgba(148, 163, 184, 0.2)')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer');

      const centerNode = centerCircle.node();
      if (centerNode) {
        centerNode.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          // If drilled, pop one level; otherwise zoom out
          if (drillEnabled && this.drillPath.length > 0) {
            this.drillPath.pop();
            this.zoomedNode = null;
          } else {
            this.zoomedNode = null;
          }
          this.cancelAnimations.forEach((cancel) => cancel());
          this.cancelAnimations = [];
          this.notifyRenderStarted();
          try {
            this.render(rootData, this.lastViewport, false);
            this.notifyRenderFinished();
          } catch (error) {
            this.notifyRenderFailed(error);
            throw error;
          }
        });
      }
    }

    // ── Entrance Animation (overall fade) ──────────────────────
    if (animEnabled) {
      const svgNode = svg.node();
      if (svgNode instanceof HTMLElement) {
        const cancelFade = fadeSlideIn(svgNode, 'up', DURATION.fast, 50);
        this.cancelAnimations.push(cancelFade);
      }
    }

    // Apply shared data label formatting (font color, size, weight)
    // Consolidated: local showLabels is ANDed with shared showDataLabels
    if (s.sunburstSettings.showLabels.value && s.dataLabelFormattingCard.showDataLabels.value) {
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.sunburst-label');
    }

    // Render legend at bottom (or left/right — fallback to bottom)
    if (showLegend && legendPos !== 'top') {
      this.renderSharedLegend(effectiveRoot.children);
    }

    // Apply accessibility (keyboard nav + ARIA)
    this.applyAccessibility(descendants.length);

    this.container.addEventListener('click', this.handleBackgroundClick);
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

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'sunburst chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.sunburst-segment',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  private renderBreadcrumb(fullRootData: SunburstNode): void {
    const ds = this.settings.drillDownSettings;
    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'sunburst-breadcrumb';
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
      this.zoomedNode = null;
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];
      this.notifyRenderStarted();
      try {
        this.render(fullRootData, this.lastViewport, false);
        this.notifyRenderFinished();
      } catch (_error) {
        this.notifyRenderFailed(_error);
      }
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
          this.zoomedNode = null;
          this.cancelAnimations.forEach((cancel) => cancel());
          this.cancelAnimations = [];
          this.notifyRenderStarted();
          try {
            this.render(fullRootData, this.lastViewport, false);
            this.notifyRenderFinished();
          } catch (_error) {
            this.notifyRenderFailed(_error);
          }
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

  private renderSharedLegend(level1Nodes: SunburstNode[]): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#475569';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const legendPosStr = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';
    const validPositions = ['top', 'bottom', 'left', 'right'] as const;
    const legendPosition: 'top' | 'bottom' | 'left' | 'right' =
      (validPositions as readonly string[]).includes(legendPosStr)
        ? (legendPosStr as 'top' | 'bottom' | 'left' | 'right')
        : 'bottom';

    const items: LegendItem[] = level1Nodes.map((node) => ({
      label: node.name,
      color: node.color,
    }));

    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = animEnabled ? this.settings.animationSettings.duration.value : 0;

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(this.container, {
      items,
      position: legendPosition,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
    });

    if (animEnabled && animDuration > 0) {
      const cancel = fadeSlideIn(legendEl, 'up', animDuration * 0.5, animDuration * 0.5);
      this.cancelAnimations.push(cancel);
    }
  }

  private showSegmentTooltip(node: SunburstNode, value: number, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Node', value: node.name },
      { displayName: 'Value', value: formatNumber(value, { abbreviate: false, locale }) },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: node.selectionId ? [node.selectionId] : [],
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

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
