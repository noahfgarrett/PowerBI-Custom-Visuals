/**
 * Chord Diagram — Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with D3 chord layout rendering.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { ChordDiagramSettings } from './settings';
import {
  formatNumber,
  formatPercent,
  animate,
  cubicOut,
  sweepArc,
  fadeSlideIn,
  DURATION,
  getChartColor,
  getHostChartColor,
  withOpacity,
  getGlassStyle,
  renderChartTitle,
  applyDataLabelFormatting,
  applySortOrder,
  renderLegend,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  type LegendItem,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

/** A single source-target-value triple from the data. */
interface ChordTriple {
  source: string;
  target: string;
  value: number;
  selectionId: ISelectionId;
}

/** Extracted and processed chord data. */
interface ChordData {
  names: string[];
  matrix: number[][];
  groupSelectionIds: Map<string, ISelectionId>;
  chordSelectionIds: Map<string, ISelectionId>;
}

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 24, bottom: 24, left: 24 };
const LABEL_OFFSET = 8;
const EMPTY_STATE_TEXT = 'Add Source, Target, and Measure fields to build the Chord diagram.';

// ── Visual ───────────────────────────────────────────────────────

export class ChordDiagramVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: ChordDiagramSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private filteredGroupIndex: number | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new ChordDiagramSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('chord-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        ChordDiagramSettings,
        dataView
      );
    }

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Extract data and apply user-configured sort order to entities
    const data = this.sortChordData(this.extractData(dataView));

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ChordData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 2 || !values || values.length < 1) return null;

    // Find the source, target, and measure columns by role
    let sourceColumn: powerbi.DataViewCategoryColumn | undefined;
    let targetColumn: powerbi.DataViewCategoryColumn | undefined;
    let measureColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['source']) sourceColumn = cat;
      if (roles['target']) targetColumn = cat;
    }

    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['measure']) measureColumn = val;
    }

    if (!sourceColumn || !targetColumn || !measureColumn) return null;

    const rowCount = sourceColumn.values.length;
    if (rowCount === 0) return null;

    // Build triples
    const triples: ChordTriple[] = [];
    const nameSet = new Set<string>();
    const groupSelectionIds = new Map<string, ISelectionId>();

    for (let i = 0; i < rowCount; i++) {
      const sourceVal = sourceColumn.values[i];
      const targetVal = targetColumn.values[i];
      const measureVal = measureColumn.values[i];

      if (sourceVal == null || targetVal == null || measureVal == null) continue;
      const weight = typeof measureVal === 'number' ? measureVal : Number(measureVal);
      if (!Number.isFinite(weight) || weight <= 0) continue;

      const sourceName = String(sourceVal);
      const targetName = String(targetVal);

      nameSet.add(sourceName);
      nameSet.add(targetName);
      if (!groupSelectionIds.has(sourceName)) {
        groupSelectionIds.set(
          sourceName,
          this.host.createSelectionIdBuilder()
            .withCategory(sourceColumn, i)
            .createSelectionId(),
        );
      }
      if (!groupSelectionIds.has(targetName)) {
        groupSelectionIds.set(
          targetName,
          this.host.createSelectionIdBuilder()
            .withCategory(targetColumn, i)
            .createSelectionId(),
        );
      }
      triples.push({
        source: sourceName,
        target: targetName,
        value: weight,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(sourceColumn, i)
          .withCategory(targetColumn, i)
          .createSelectionId(),
      });
    }

    if (nameSet.size === 0 || triples.length === 0) return null;

    // Build square matrix
    const names = Array.from(nameSet);
    const nameIndex = new Map<string, number>();
    names.forEach((name, idx) => nameIndex.set(name, idx));

    const n = names.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
    const chordSelectionIds = new Map<string, ISelectionId>();

    for (const triple of triples) {
      const si = nameIndex.get(triple.source);
      const ti = nameIndex.get(triple.target);
      if (si !== undefined && ti !== undefined) {
        matrix[si][ti] += triple.value;
        const key = `${si}|${ti}`;
        if (!chordSelectionIds.has(key)) {
          chordSelectionIds.set(key, triple.selectionId);
        }
      }
    }

    return { names, matrix, groupSelectionIds, chordSelectionIds };
  }

  // ── Sort Entities ────────────────────────────────────────────

  /** Sort chord entities by total flow and reorder the adjacency matrix. */
  private sortChordData(data: ChordData | null): ChordData | null {
    if (!data) return null;

    const n = data.names.length;
    if (n <= 1) return data;

    // Compute total flow per entity (sum of row + column in the matrix)
    const totalFlow = data.names.map((name, i) => {
      let flow = 0;
      for (let j = 0; j < n; j++) {
        flow += data.matrix[i][j] + data.matrix[j][i];
      }
      return { name, value: flow, originalIndex: i };
    });

    // Apply sort order
    const sorted = applySortOrder(totalFlow, this.settings.sortFormattingCard);

    // Build index mapping: newIndex -> originalIndex
    const indexMap = sorted.map((item) => item.originalIndex);

    // Reorder names
    const sortedNames = indexMap.map((oi) => data.names[oi]);

    // Reorder matrix rows and columns
    const sortedMatrix: number[][] = indexMap.map((oi) =>
      indexMap.map((oj) => data.matrix[oi][oj]),
    );

    // Rebuild selectionId maps with new names
    const sortedGroupSelectionIds = new Map<string, ISelectionId>();
    for (const name of sortedNames) {
      const id = data.groupSelectionIds.get(name);
      if (id) sortedGroupSelectionIds.set(name, id);
    }

    // Remap chord selection IDs: old indices -> new indices
    const reverseMap = new Map<number, number>();
    indexMap.forEach((oldIdx, newIdx) => reverseMap.set(oldIdx, newIdx));

    const sortedChordSelectionIds = new Map<string, ISelectionId>();
    for (const [key, id] of data.chordSelectionIds) {
      const [oldSi, oldTi] = key.split('|').map(Number);
      const newSi = reverseMap.get(oldSi);
      const newTi = reverseMap.get(oldTi);
      if (newSi !== undefined && newTi !== undefined) {
        sortedChordSelectionIds.set(`${newSi}|${newTi}`, id);
      }
    }

    return {
      names: sortedNames,
      matrix: sortedMatrix,
      groupSelectionIds: sortedGroupSelectionIds,
      chordSelectionIds: sortedChordSelectionIds,
    };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: ChordData | null, viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear existing DOM (no innerHTML)
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

    // Apply glass card style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      this.container.style.background = glass.background;
      this.container.style.backdropFilter = glass.backdropFilter;
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = glass.WebkitBackdropFilter;
      this.container.style.border = glass.border;
      this.container.style.boxShadow = glass.boxShadow;
      this.container.style.borderRadius = glass.borderRadius;
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    const width = viewport.width;
    const height = viewport.height;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const innerRadius = radius * 0.85;
    const outerRadius = radius;

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Build chord layout
    const minArcAngleDeg = s.chordRibbonSettings.minArcAngle.value;
    const minArcAngleRad = (minArcAngleDeg * Math.PI) / 180;
    const isDirectional = s.chordRibbonSettings.directional.value;

    const padAngle = Math.max(s.chordSettings.padding.value / 100, minArcAngleRad);

    const chordLayout = isDirectional
      ? (d3 as unknown as Record<string, unknown>).chordDirected
        ? ((d3 as unknown as Record<string, unknown>).chordDirected as () => d3.ChordLayout)()
            .sortSubgroups(d3.descending)
        : d3.chord().padAngle(padAngle).sortSubgroups(d3.descending)
      : d3.chord().padAngle(padAngle).sortSubgroups(d3.descending);

    if ('padAngle' in chordLayout) {
      (chordLayout as d3.ChordLayout).padAngle(padAngle);
    }

    const chords = chordLayout(data.matrix);

    // Arc generator for outer groups
    const arcGen = d3.arc<d3.ChordGroup>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    // Ribbon generator for connecting chords
    // When directional, use ribbonArrow if available (d3-chord v3+) for arrow indicators
    const ribbonArrowFactory = (d3 as unknown as Record<string, unknown>).ribbonArrow as
      (() => d3.RibbonGenerator<unknown, d3.Chord, d3.ChordSubgroup>) | undefined;
    const ribbonGen = (isDirectional && ribbonArrowFactory)
      ? ribbonArrowFactory().radius(innerRadius)
      : d3.ribbon<d3.Chord, d3.ChordSubgroup>().radius(innerRadius);

    // Gradient ribbon defs
    const useGradientRibbons = s.chordRibbonSettings.gradientRibbons.value;
    if (useGradientRibbons) {
      const defs = svg.append('defs');
      chords.forEach((chord, ci) => {
        const srcColor = resolveColor(chord.source.index);
        const tgtColor = resolveColor(chord.target.index);
        const grad = defs.append('linearGradient')
          .attr('id', `chord-grad-${ci}`)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', Math.cos((chord.source.startAngle + chord.source.endAngle) / 2 - Math.PI / 2) * innerRadius)
          .attr('y1', Math.sin((chord.source.startAngle + chord.source.endAngle) / 2 - Math.PI / 2) * innerRadius)
          .attr('x2', Math.cos((chord.target.startAngle + chord.target.endAngle) / 2 - Math.PI / 2) * innerRadius)
          .attr('y2', Math.sin((chord.target.startAngle + chord.target.endAngle) / 2 - Math.PI / 2) * innerRadius);
        grad.append('stop').attr('offset', '0%').attr('stop-color', srcColor);
        grad.append('stop').attr('offset', '100%').attr('stop-color', tgtColor);
      });
    }

    const ribbonOpacity = s.chordSettings.ribbonOpacity.value / 100;
    const hoverOpacity = s.chordSettings.hoverOpacity.value / 100;
    const dimOpacity = s.chordSettings.dimOpacity.value / 100;

    // Color resolver: host palette when useChartPalette is on, built-in palette otherwise
    const useChartPalette = s.colorSettings.useChartPalette.value;
    const resolveColor = (index: number): string =>
      useChartPalette
        ? getHostChartColor(this.host.colorPalette, index, themeName)
        : getChartColor(index, themeName);

    // Render outer group arcs
    const groupGroup = g.append('g').attr('class', 'chord-groups');

    const groupArcs = groupGroup
      .selectAll<SVGPathElement, d3.ChordGroup>('.chord-group-arc')
      .data(chords.groups)
      .join('path')
      .attr('class', 'chord-group-arc')
      .attr('d', arcGen)
      .attr('fill', (_d, i) => resolveColor(i))
      .attr('stroke', (_d, i) => s.chordSettings.arcStrokeColor.value?.value || withOpacity(resolveColor(i), 0.8))
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        // Chord filtering: click arc to isolate flows
        if (s.chordInteractionSettings.enableFiltering.value) {
          if (this.filteredGroupIndex === d.index) {
            this.filteredGroupIndex = null;
          } else {
            this.filteredGroupIndex = d.index;
          }
          this.render(data, viewport);
          return;
        }
        const groupName = data.names[d.index];
        const selectionId = groupName ? data.groupSelectionIds.get(groupName) : undefined;
        if (selectionId) {
          void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        const groupName = data.names[d.index];
        const selectionId = groupName ? data.groupSelectionIds.get(groupName) : undefined;
        if (selectionId) {
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    // Group arc tooltips
    groupArcs.each(function (_d, i) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const name = data.names[i] ?? '';
      const total = _d.value;
      title.textContent = `${name}: ${formatNumber(total, { abbreviate: true })}`;
      this.appendChild(title);
    });

    // Render labels on outer arcs
    const labelGroup = g.append('g').attr('class', 'chord-labels');

    labelGroup
      .selectAll<SVGTextElement, d3.ChordGroup>('.chord-label')
      .data(chords.groups)
      .join('text')
      .attr('class', 'chord-label')
      .each(function (d, i) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = outerRadius + LABEL_OFFSET;
        const x = Math.sin(angle) * labelRadius;
        const y = -Math.cos(angle) * labelRadius;

        d3.select(this)
          .attr('x', x)
          .attr('y', y)
          .attr('dy', '0.35em')
          .attr('text-anchor', angle > Math.PI ? 'end' : 'start')
          .text(data.names[i] ?? '');
      });

    // Entity value labels on arcs
    if (s.chordLabelSettings.showEntityValues.value) {
      labelGroup
        .selectAll<SVGTextElement, d3.ChordGroup>('.chord-entity-value')
        .data(chords.groups)
        .join('text')
        .attr('class', 'chord-entity-value')
        .each(function (d, i) {
          const angle = (d.startAngle + d.endAngle) / 2;
          const labelR = outerRadius + LABEL_OFFSET + 14;
          const x = Math.sin(angle) * labelR;
          const y = -Math.cos(angle) * labelR;

          d3.select(this)
            .attr('x', x)
            .attr('y', y)
            .attr('dy', '0.35em')
            .attr('text-anchor', angle > Math.PI ? 'end' : 'start')
            .attr('font-size', 10)
            .attr('fill', '#64748B')
            .text(formatNumber(d.value, { abbreviate: true }));
        });
    }

    // Render ribbons
    const ribbonGroup = g.append('g').attr('class', 'chord-ribbons');

    // Filter ribbons when filtering is active
    const visibleChords = this.filteredGroupIndex != null
      ? chords.filter((c) => c.source.index === this.filteredGroupIndex || c.target.index === this.filteredGroupIndex)
      : chords;

    const ribbonPaths = ribbonGroup
      .selectAll<SVGPathElement, d3.Chord>('.chord-ribbon')
      .data(visibleChords)
      .join('path')
      .attr('class', 'chord-ribbon')
      .attr('d', ribbonGen as unknown as d3.ValueFn<SVGPathElement, d3.Chord, string | null>)
      .attr('fill', (d, i) => {
        if (useGradientRibbons) {
          // Find the original chord index for gradient lookup
          const origIdx = chords.indexOf(d);
          return origIdx >= 0 ? `url(#chord-grad-${origIdx})` : withOpacity(resolveColor(d.source.index), ribbonOpacity);
        }
        return withOpacity(resolveColor(d.source.index), ribbonOpacity);
      })
      .attr('fill-opacity', useGradientRibbons ? ribbonOpacity : 1)
      .attr('stroke', (d) => withOpacity(resolveColor(d.source.index), 0.3))
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        const key = `${d.source.index}|${d.target.index}`;
        const reverseKey = `${d.target.index}|${d.source.index}`;
        const selectionId = data.chordSelectionIds.get(key) ?? data.chordSelectionIds.get(reverseKey);
        if (selectionId) {
          void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        const key = `${d.source.index}|${d.target.index}`;
        const reverseKey = `${d.target.index}|${d.source.index}`;
        const selectionId = data.chordSelectionIds.get(key) ?? data.chordSelectionIds.get(reverseKey);
        if (selectionId) {
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    // Apply conditional formatting to ribbons
    ribbonPaths.each((d, i, elements) => {
      const condColor = this.getConditionalColor(d.source.value);
      if (condColor) {
        d3.select(elements[i]).attr('fill', condColor).attr('fill-opacity', ribbonOpacity);
      }
    });

    // Ribbon tooltips (rich: source, target, value, percentages)
    const totalChordValue = chords.groups.reduce((sum, grp) => sum + grp.value, 0);
    ribbonPaths.each(function (d) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const srcName = data.names[d.source.index] ?? '';
      const tgtName = data.names[d.target.index] ?? '';
      const val = formatNumber(d.source.value, { abbreviate: true });
      const pct = totalChordValue > 0 ? formatPercent(d.source.value / totalChordValue) : '';
      const srcTotal = chords.groups[d.source.index]?.value ?? 0;
      const srcPct = srcTotal > 0 ? formatPercent(d.source.value / srcTotal) : '';
      title.textContent = `${srcName} \u2192 ${tgtName}: ${val}${pct ? ` (${pct} of total)` : ''}${srcPct ? ` | ${srcPct} of ${srcName}` : ''}`;
      this.appendChild(title);
    });

    // Flow labels on hover (show value at ribbon midpoint)
    if (s.chordInteractionSettings.showFlowLabels.value) {
      const flowLabelGroup = g.append('g').attr('class', 'chord-flow-labels');
      ribbonPaths
        .on('mouseenter.flowlabel', (_event: MouseEvent, d: d3.Chord) => {
          const srcAngle = (d.source.startAngle + d.source.endAngle) / 2;
          const tgtAngle = (d.target.startAngle + d.target.endAngle) / 2;
          const midAngle = (srcAngle + tgtAngle) / 2;
          const midR = innerRadius * 0.5;
          const midX = Math.sin(midAngle) * midR;
          const midY = -Math.cos(midAngle) * midR;
          flowLabelGroup.selectAll('*').remove();
          flowLabelGroup.append('text')
            .attr('x', midX)
            .attr('y', midY)
            .attr('text-anchor', 'middle')
            .attr('font-size', 11)
            .attr('fill', '#1E293B')
            .attr('pointer-events', 'none')
            .text(formatNumber(d.source.value, { abbreviate: true }));
        })
        .on('mouseleave.flowlabel', () => {
          flowLabelGroup.selectAll('*').remove();
        });
    }

    // Hover interactions
    this.attachHoverBehavior(groupArcs, ribbonPaths, chords, ribbonOpacity, hoverOpacity, dimOpacity, resolveColor, data);

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(groupArcs, ribbonPaths, chords, arcGen, ribbonOpacity, resolveColor, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.chord-label');

    // ── Legend ────────────────────────────────────────────────────
    if (s.legendFormattingCard.showLegend.value) {
      const legendFmtCard = this.settings.legendFormattingCard;
      const rawFontColor = legendFmtCard.legendFontColor.value?.value;
      const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
      const legendFontSize = legendFmtCard.legendFontSize.value;
      const position = this.getLegendPosition();

      const legendItems: LegendItem[] = data.names.map((name, i) => ({
        label: name,
        color: resolveColor(i),
      }));

      const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

      renderLegend(this.container, {
        items: legendItems,
        position: position as 'top' | 'bottom' | 'left' | 'right',
        fontSize: legendFontSize,
        fontColor: legendFontColor,
        fontFamily: rawLegendFontFamily,
      });
    }

    // Accessibility
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      applyChartAria(this.container, {
        chartType: 'chord-diagram',
        dataPointCount: data.names.length,
      });
      const arcEls = this.container.querySelectorAll('.chord-group-arc');
      arcEls.forEach((el, i) => {
        const name = data.names[i];
        const grp = chords.groups[i];
        if (name && grp) {
          applyDataPointAria(
            el,
            name,
            formatNumber(grp.value, { abbreviate: true }),
            i,
            data.names.length,
          );
        }
      });
      attachKeyboardNav({
        container: this.container,
        itemSelector: '.chord-group-arc',
        onActivate: (el) => {
          (el as HTMLElement).click();
        },
      });
    }

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

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

  private getLegendPosition(): string {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions = ['bottom', 'top', 'left', 'right'];
    if (typeof val === 'string' && validPositions.includes(val)) {
      return val;
    }
    return 'bottom';
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'chord-empty';
    empty.textContent = EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Hover Behavior ───────────────────────────────────────────

  private attachHoverBehavior(
    groupArcs: d3.Selection<SVGPathElement, d3.ChordGroup, SVGGElement, unknown>,
    ribbonPaths: d3.Selection<SVGPathElement, d3.Chord, SVGGElement, unknown>,
    chords: d3.Chords,
    baseOpacity: number,
    hoverOpacity: number,
    dimOpacity: number,
    resolveColor: (index: number) => string,
    data: ChordData,
  ): void {
    // Group arc hover: dim all ribbons NOT connected to that group
    groupArcs
      .on('mouseenter', (_event: MouseEvent, hoveredGroup: d3.ChordGroup) => {
        const hoveredIndex = hoveredGroup.index;

        groupArcs.attr('opacity', (d) =>
          d.index === hoveredIndex ? 1 : dimOpacity
        );

        ribbonPaths
          .attr('fill', (d) => {
            const connected = d.source.index === hoveredIndex || d.target.index === hoveredIndex;
            return connected
              ? withOpacity(resolveColor(d.source.index), hoverOpacity)
              : withOpacity(resolveColor(d.source.index), dimOpacity);
          });
      })
      .on('mouseleave', () => {
        groupArcs.attr('opacity', 1);
        ribbonPaths
          .attr('fill', (d) => withOpacity(resolveColor(d.source.index), baseOpacity));
      });

    // Ribbon hover: highlight that ribbon and its source/target arcs
    ribbonPaths
      .on('mouseenter', (_event: MouseEvent, hoveredChord: d3.Chord) => {
        const connectedIndices = new Set([hoveredChord.source.index, hoveredChord.target.index]);

        groupArcs.attr('opacity', (d) =>
          connectedIndices.has(d.index) ? 1 : dimOpacity
        );

        ribbonPaths
          .attr('fill', (d) => {
            const isHovered = d === hoveredChord;
            return isHovered
              ? withOpacity(resolveColor(d.source.index), hoverOpacity)
              : withOpacity(resolveColor(d.source.index), dimOpacity);
          });
      })
      .on('mouseleave', () => {
        groupArcs.attr('opacity', 1);
        ribbonPaths
          .attr('fill', (d) => withOpacity(resolveColor(d.source.index), baseOpacity));
      });
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    groupArcs: d3.Selection<SVGPathElement, d3.ChordGroup, SVGGElement, unknown>,
    ribbonPaths: d3.Selection<SVGPathElement, d3.Chord, SVGGElement, unknown>,
    chords: d3.Chords,
    arcGen: d3.Arc<unknown, d3.ChordGroup>,
    ribbonOpacity: number,
    resolveColor: (index: number) => string,
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    // Animate outer arcs with sweepArc, staggered per group
    groupArcs.each((d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      // Start with invisible arc
      el.setAttribute('d', '');
      const delay = i * stagger;

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let animCancel: (() => void) | null = null;

      timeoutId = setTimeout(() => {
        animCancel = sweepArc(
          d.startAngle,
          d.endAngle,
          duration,
          (currentAngle) => {
            const partialGroup: d3.ChordGroup = {
              startAngle: d.startAngle,
              endAngle: currentAngle,
              value: d.value,
              index: d.index,
            };
            const pathD = arcGen(partialGroup);
            if (pathD) {
              el.setAttribute('d', pathD);
            }
          },
          () => {
            // Ensure final state is set
            const finalD = arcGen(d);
            if (finalD) {
              el.setAttribute('d', finalD);
            }
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        animCancel?.();
        const finalD = arcGen(d);
        if (finalD) {
          el.setAttribute('d', finalD);
        }
      });
    });

    // Ribbons fade in with stagger after arcs finish
    const ribbonBaseDelay = (chords.groups.length * stagger) + (duration / 3);

    ribbonPaths.each((d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      // Start with transparent fill
      const targetColor = withOpacity(resolveColor(d.source.index), ribbonOpacity);
      el.setAttribute('fill', withOpacity(resolveColor(d.source.index), 0));
      el.style.opacity = '0';

      const delay = ribbonBaseDelay + i * (stagger / 2);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let animCancel: (() => void) | null = null;

      timeoutId = setTimeout(() => {
        animCancel = animate(
          duration,
          cubicOut,
          (progress) => {
            el.style.opacity = `${progress}`;
            el.setAttribute('fill', withOpacity(resolveColor(d.source.index), ribbonOpacity * progress));
          },
          () => {
            el.style.opacity = '1';
            el.setAttribute('fill', targetColor);
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        animCancel?.();
        el.style.opacity = '1';
        el.setAttribute('fill', targetColor);
      });
    });
  }

  // ── Formatting Pane ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    if (this.filteredGroupIndex != null) {
      this.filteredGroupIndex = null;
    }
    void this.selectionManager.clear();
  };

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
