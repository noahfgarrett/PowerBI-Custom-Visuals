/**
 * Treemap Pro — Power BI IVisual implementation.
 * Hierarchical treemap with 2 grouping levels, drill-down click,
 * glassmorphic styling, and staggered scale entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { TreemapProSettings } from './settings';
import {
  animate,
  cubicOut,
  springScale,
  fadeSlideIn,
  DURATION,
  formatNumber,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// -- Types --------------------------------------------------------------------

type TilingMode = 'squarify' | 'binary' | 'slice' | 'dice';

interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
  /** Color index for palette lookups */
  colorIndex?: number;
  selectionId?: ISelectionId;
}

interface TreemapData {
  root: TreeNode;
  isEmpty: boolean;
  hasLevel2: boolean;
}

// -- Constants ----------------------------------------------------------------

const LABEL_MIN_WIDTH = 40;
const LABEL_MIN_HEIGHT = 24;
const VALUE_MIN_HEIGHT = 36;
const STAGGER_DELAY = 40;

// -- Tiling map ---------------------------------------------------------------

/** Tiling function signature used by d3.treemap().tile() */
type TilingFn = (
  node: d3.HierarchyRectangularNode<TreeNode>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => void;

const TILING_MAP: Record<TilingMode, TilingFn> = {
  squarify: d3.treemapSquarify,
  binary: d3.treemapBinary,
  slice: d3.treemapSlice,
  dice: d3.treemapDice,
};

// -- Visual -------------------------------------------------------------------

export class TreemapProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: TreemapProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  /** Chain of category values the user has drilled into */
  private drillPath: string[] = [];
  /** Full extracted data, kept for drill-down without re-parsing */
  private currentData: TreemapData | null = null;
  /** Last known viewport for re-renders on drill navigation */
  private currentViewport: powerbi.IViewport = { width: 300, height: 300 };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new TreemapProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('treemap-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        TreemapProSettings,
        dataView,
      );
    }

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;
    this.currentViewport = options.viewport;

    // Apply glass card style
    this.applyCardStyle();

    // Reset drill if data changed structurally
    if (data.isEmpty || !data.hasLevel2) {
      this.drillPath = [];
    }

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.renderTreemap(data, options.viewport);
    }
  }

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): TreemapData {
    const empty: TreemapData = {
      root: { name: 'root', children: [] },
      isEmpty: true,
      hasLevel2: false,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const valuesColumn = categorical.values?.[0];

    if (!categories || categories.length === 0 || !valuesColumn) return empty;

    const level1Column = categories[0];
    const level2Column = categories.length > 1 ? categories[1] : null;
    const hasLevel2 = level2Column !== null;

    // Build nested map: level1 -> Map(level2 -> summed value + selection)
    const grouped = new Map<string, Map<string, { value: number; selectionId: ISelectionId }>>();
    let colorIndex = 0;
    const colorMap = new Map<string, number>();
    const level1SelectionMap = new Map<string, ISelectionId>();

    for (let i = 0; i < level1Column.values.length; i++) {
      const l1Raw = level1Column.values[i];
      const l1 = l1Raw !== null && l1Raw !== undefined ? String(l1Raw) : '';

      const l2Raw = level2Column?.values[i];
      const l2 = l2Raw !== null && l2Raw !== undefined ? String(l2Raw) : l1;

      const val = valuesColumn.values[i];
      const numVal = typeof val === 'number' && !Number.isNaN(val) ? val : 0;

      if (!grouped.has(l1)) {
        grouped.set(l1, new Map<string, { value: number; selectionId: ISelectionId }>());
      }

      if (!colorMap.has(l1)) {
        colorMap.set(l1, colorIndex++);
      }
      if (!level1SelectionMap.has(l1)) {
        level1SelectionMap.set(
          l1,
          this.host.createSelectionIdBuilder()
            .withCategory(level1Column, i)
            .createSelectionId(),
        );
      }

      const children = grouped.get(l1)!;
      const existing = children.get(l2);
      if (existing) {
        existing.value += numVal;
      } else {
        const builder = this.host.createSelectionIdBuilder().withCategory(level1Column, i);
        if (level2Column) {
          builder.withCategory(level2Column, i);
        }
        children.set(l2, {
          value: numVal,
          selectionId: builder.createSelectionId(),
        });
      }
    }

    if (grouped.size === 0) return empty;

    // Convert to hierarchy-compatible tree
    const rootChildren: TreeNode[] = [];

    for (const [l1Name, childMap] of grouped) {
      const ci = colorMap.get(l1Name) ?? 0;

      if (hasLevel2) {
        const nodeChildren: TreeNode[] = [];
        for (const [l2Name, entry] of childMap) {
          if (entry.value > 0) {
            nodeChildren.push({
              name: l2Name,
              value: entry.value,
              colorIndex: ci,
              selectionId: entry.selectionId,
            });
          }
        }
        if (nodeChildren.length > 0) {
          rootChildren.push({
            name: l1Name,
            children: nodeChildren,
            colorIndex: ci,
            selectionId: level1SelectionMap.get(l1Name),
          });
        }
      } else {
        // Single level: aggregate all values for this l1
        let total = 0;
        for (const entry of childMap.values()) {
          total += entry.value;
        }
        if (total > 0) {
          rootChildren.push({
            name: l1Name,
            value: total,
            colorIndex: ci,
            selectionId: level1SelectionMap.get(l1Name),
          });
        }
      }
    }

    if (rootChildren.length === 0) return empty;

    return {
      root: { name: 'root', children: rootChildren },
      isEmpty: false,
      hasLevel2,
    };
  }

  // -- Card Style -------------------------------------------------------------

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
      // Vendor-prefix cast for WebkitBackdropFilter
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] =
        glass.WebkitBackdropFilter;
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // -- Empty State ------------------------------------------------------------

  private renderEmpty(): void {
    this.clearContainer();
    const emptyEl = document.createElement('div');
    emptyEl.className = 'treemap-empty';
    emptyEl.textContent = 'Add at least one grouping level and a measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // -- Main Treemap Render ----------------------------------------------------

  private renderTreemap(data: TreemapData, viewport: powerbi.IViewport): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const padding = 8;
    const width = Math.max(0, viewport.width - padding * 2);
    const height = Math.max(0, viewport.height - padding * 2);

    if (width <= 0 || height <= 0) {
      this.renderEmpty();
      return;
    }

    // Determine which sub-tree to render (drill-down support)
    const drillEnabled = this.settings.drillDownSettings.enabled.value;
    let renderRoot: TreeNode;

    if (drillEnabled && this.drillPath.length > 0 && data.hasLevel2 && data.root.children) {
      // Walk the drill path to find the target sub-tree
      let current: TreeNode = data.root;
      let pathValid = true;
      for (const segment of this.drillPath) {
        const found = current.children?.find((c) => c.name === segment);
        if (found && found.children && found.children.length > 0) {
          current = found;
        } else {
          pathValid = false;
          break;
        }
      }
      if (pathValid && current !== data.root) {
        renderRoot = { name: current.name, children: current.children ?? [] };
      } else {
        this.drillPath = [];
        renderRoot = data.root;
      }
    } else {
      renderRoot = data.root;
    }

    // Breadcrumb trail for drill-up navigation
    if (drillEnabled && this.drillPath.length > 0 && this.settings.drillDownSettings.showBreadcrumb.value) {
      this.renderBreadcrumb(data, viewport);
    }

    // Build d3 hierarchy
    const hierarchy = d3.hierarchy<TreeNode>(renderRoot)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    // Tiling function
    const tilingMode = this.getTilingMode();
    const tilingFn = TILING_MAP[tilingMode];

    const tilePadding = this.settings.treemapSettings.tilePadding.value;
    const treemapLayout = d3.treemap<TreeNode>()
      .size([width, height])
      .tile(tilingFn)
      .paddingInner(tilePadding)
      .round(true);

    treemapLayout(hierarchy);

    // Create SVG
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'treemap-svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // After treemapLayout(), nodes have x0/y0/x1/y1 from HierarchyRectangularNode
    const leaves = hierarchy.leaves() as d3.HierarchyRectangularNode<TreeNode>[];
    const showLabels = this.settings.treemapSettings.showLabels.value;
    const showValues = this.settings.treemapSettings.showValues.value;
    const showDataLabels = this.settings.dataLabelFormattingCard.showDataLabels.value;
    const tileStrokeColor = this.settings.treemapSettings.tileStrokeColor.value?.value || '';
    const tileStrokeWidth = this.settings.treemapSettings.tileStrokeWidth.value;
    const labelColor = this.settings.treemapSettings.labelColor.value?.value || '';
    const useChartPalette = this.settings.colorSettings.useChartPalette.value;
    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = this.settings.animationSettings.duration.value;

    leaves.forEach((leaf, idx) => {
      const x0 = leaf.x0 ?? 0;
      const y0 = leaf.y0 ?? 0;
      const x1 = leaf.x1 ?? 0;
      const y1 = leaf.y1 ?? 0;
      const cellW = x1 - x0;
      const cellH = y1 - y0;

      if (cellW <= 0 || cellH <= 0) return;

      // Group for the cell
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'treemap-cell');
      g.setAttribute('transform', `translate(${x0},${y0})`);

      // Color
      const colorIdx = leaf.data.colorIndex ?? (leaf.parent?.data.colorIndex ?? idx);
      const fillColor = useChartPalette
        ? getHostChartColor(this.host.colorPalette, colorIdx)
        : getHostChartColor(this.host.colorPalette, idx);

      // Rectangle — slightly translucent for depth perception
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('width', String(cellW));
      rect.setAttribute('height', String(cellH));
      rect.setAttribute('rx', '3');
      rect.setAttribute('ry', '3');
      rect.setAttribute('fill', withOpacity(fillColor, 0.92));
      if (tileStrokeColor) {
        rect.setAttribute('stroke', tileStrokeColor);
        rect.setAttribute('stroke-width', String(tileStrokeWidth));
      }

      g.appendChild(rect);

      // Label (category name)
      if (showLabels && cellW >= LABEL_MIN_WIDTH && cellH >= LABEL_MIN_HEIGHT) {
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('class', 'treemap-label');
        label.setAttribute('x', '6');
        label.setAttribute('y', '16');
        if (labelColor) {
          label.setAttribute('fill', labelColor);
        }
        label.textContent = this.truncateLabel(leaf.data.name, cellW - 12);
        g.appendChild(label);
      }

      // Value
      if (showValues && showDataLabels && cellW >= LABEL_MIN_WIDTH && cellH >= VALUE_MIN_HEIGHT) {
        const valueText = document.createElementNS(svgNS, 'text');
        valueText.setAttribute('class', 'treemap-value');
        valueText.setAttribute('x', '6');
        valueText.setAttribute('y', '30');
        valueText.textContent = formatNumber(leaf.value ?? 0);
        g.appendChild(valueText);
      }

      // Hover tooltip
      const leafName = leaf.data.name;
      const leafValue = leaf.value ?? 0;
      const parentName = leaf.parent?.data.name ?? '';
      this.attachCellTooltip(g, parentName, leafName, leafValue);

      const selectionId = leaf.data.selectionId;
      const canDrill = drillEnabled && data.hasLevel2 && leaf.parent !== null;
      const drillTarget = canDrill ? leaf.parent?.data.name : null;
      // Determine if the drill target has children (i.e., can we drill deeper?)
      const drillTargetHasChildren = canDrill && drillTarget && drillTarget !== 'root' && (() => {
        const parentNode = data.root.children?.find((c) => c.name === drillTarget);
        return parentNode !== undefined && parentNode.children !== undefined && parentNode.children.length > 0;
      })();
      if ((selectionId !== undefined) || drillTargetHasChildren) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();

          if (drillTargetHasChildren && drillTarget && !event.ctrlKey && !event.metaKey) {
            // Only drill if this category isn't already in the path
            if (!this.drillPath.includes(drillTarget)) {
              this.drillPath.push(drillTarget);
            }
            if (this.currentData) {
              for (const cancel of this.cancelAnimations) cancel();
              this.cancelAnimations = [];
              this.renderTreemap(this.currentData, this.currentViewport);
            }
            return;
          }

          if (selectionId) {
            void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
          }
        });
      }
      if (selectionId) {
        g.addEventListener('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });
      }

      svg.appendChild(g);

      // Entrance animation: scale from center
      if (animEnabled) {
        const cx = cellW / 2;
        const cy = cellH / 2;
        g.style.transformOrigin = `${x0 + cx}px ${y0 + cy}px`;

        const cancel = springScale(
          g as unknown as SVGElement,
          idx * STAGGER_DELAY,
          animDuration,
          0,
          1,
        );
        this.cancelAnimations.push(cancel);
      }
    });

    this.container.appendChild(svg);

    // Fade in the entire SVG container for a polished entrance
    if (animEnabled) {
      svg.style.opacity = '0';
      const cancelFade = animate(animDuration, cubicOut, (progress) => {
        svg.style.opacity = String(progress);
      });
      this.cancelAnimations.push(cancelFade);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.treemap-value');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // -- Breadcrumb -------------------------------------------------------------

  private renderBreadcrumb(_data: TreemapData, _viewport: powerbi.IViewport): void {
    const ds = this.settings.drillDownSettings;
    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'treemap-breadcrumb';
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
      if (this.currentData) {
        for (const cancel of this.cancelAnimations) cancel();
        this.cancelAnimations = [];
        this.renderTreemap(this.currentData, this.currentViewport);
      }
    });
    breadcrumb.appendChild(allSpan);

    // Each segment in the drill path
    for (let i = 0; i < this.drillPath.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.color = color;
      breadcrumb.appendChild(sep);

      const segment = document.createElement('span');
      segment.textContent = this.drillPath[i];
      segment.style.color = color;

      // All segments except the last one are clickable to navigate back
      if (i < this.drillPath.length - 1) {
        segment.style.cursor = 'pointer';
        segment.style.textDecoration = 'underline';
        const targetIndex = i;
        segment.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.drillPath = this.drillPath.slice(0, targetIndex + 1);
          if (this.currentData) {
            for (const cancel of this.cancelAnimations) cancel();
            this.cancelAnimations = [];
            this.renderTreemap(this.currentData, this.currentViewport);
          }
        });
      } else {
        segment.style.fontWeight = '600';
      }

      breadcrumb.appendChild(segment);
    }

    this.container.appendChild(breadcrumb);

    // Animate breadcrumb entrance
    if (this.settings.animationSettings.enabled.value) {
      const cancelBtn = fadeSlideIn(breadcrumb, 'left', DURATION.fast);
      this.cancelAnimations.push(cancelBtn);
    }
  }

  // -- Tooltip ----------------------------------------------------------------

  private attachCellTooltip(
    element: SVGGElement,
    parentCategory: string,
    name: string,
    value: number,
  ): void {
    const host = this.host;

    element.addEventListener('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [];
      if (parentCategory && parentCategory !== 'root') {
        tooltipData.push({ displayName: 'Category', value: parentCategory });
      }
      tooltipData.push({ displayName: 'Name', value: name });
      tooltipData.push({
        displayName: 'Value',
        value: formatNumber(value, { abbreviate: false }),
      });

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    element.addEventListener('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    element.addEventListener('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // -- Helpers ----------------------------------------------------------------

  private getTilingMode(): TilingMode {
    const val = this.settings.treemapSettings.tiling.value?.value;
    const valid: TilingMode[] = ['squarify', 'binary', 'slice', 'dice'];
    if (typeof val === 'string' && valid.includes(val as TilingMode)) {
      return val as TilingMode;
    }
    return 'squarify';
  }

  /**
   * Truncates a label string to fit within the given pixel width.
   * Approximation: ~7px per character at 11px font-size.
   */
  private truncateLabel(text: string, maxWidth: number): string {
    const charWidth = 7;
    const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + '\u2026';
  }

  private clearContainer(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Formatting Model -------------------------------------------------------

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // -- Cleanup ----------------------------------------------------------------

  public destroy(): void {
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];
    this.clearContainer();
  }
}
