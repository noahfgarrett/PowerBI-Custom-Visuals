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

    // Extract data
    const data = this.extractData(dataView);

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

  // ── Rendering ────────────────────────────────────────────────

  private render(data: ChordData | null, viewport: powerbi.IViewport): void {
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
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
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
    const chordLayout = d3.chord()
      .padAngle(s.chordSettings.padding.value / 100)
      .sortSubgroups(d3.descending);

    const chords = chordLayout(data.matrix);

    // Arc generator for outer groups
    const arcGen = d3.arc<d3.ChordGroup>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    // Ribbon generator for connecting chords
    const ribbonGen = d3.ribbon<d3.Chord, d3.ChordSubgroup>()
      .radius(innerRadius);

    const ribbonOpacity = s.chordSettings.ribbonOpacity.value / 100;
    const hoverOpacity = s.chordSettings.hoverOpacity.value / 100;
    const dimOpacity = s.chordSettings.dimOpacity.value / 100;

    // Color resolver: host palette when useChartPalette is on, built-in palette otherwise
    const useChartPalette = s.colorSettings.useChartPalette.value;
    const resolveColor = (index: number): string =>
      useChartPalette
        ? getHostChartColor(this.host.colorPalette, index)
        : getChartColor(index);

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

    // Render ribbons
    const ribbonGroup = g.append('g').attr('class', 'chord-ribbons');

    const ribbonPaths = ribbonGroup
      .selectAll<SVGPathElement, d3.Chord>('.chord-ribbon')
      .data(chords)
      .join('path')
      .attr('class', 'chord-ribbon')
      .attr('d', ribbonGen as unknown as d3.ValueFn<SVGPathElement, d3.Chord, string | null>)
      .attr('fill', (d) => withOpacity(resolveColor(d.source.index), ribbonOpacity))
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

    // Ribbon tooltips
    ribbonPaths.each(function (d) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const srcName = data.names[d.source.index] ?? '';
      const tgtName = data.names[d.target.index] ?? '';
      const val = formatNumber(d.source.value, { abbreviate: true });
      title.textContent = `${srcName} \u2192 ${tgtName}: ${val}`;
      this.appendChild(title);
    });

    // Hover interactions
    this.attachHoverBehavior(groupArcs, ribbonPaths, chords, ribbonOpacity, hoverOpacity, dimOpacity, resolveColor, data);

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(groupArcs, ribbonPaths, chords, arcGen, ribbonOpacity, resolveColor, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.chord-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
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
