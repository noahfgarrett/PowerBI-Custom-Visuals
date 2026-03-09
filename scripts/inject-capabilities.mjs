#!/usr/bin/env node
/**
 * Injects shared formatting objects into each visual's capabilities.json.
 * Also injects per-visual element settings objects.
 *
 * Templates are synced from core/src/shared-settings.ts CAPABILITIES_TEMPLATES.
 * SHARED_ASSIGNMENT is derived from each package's settings.ts imports.
 *
 * Run: node scripts/inject-capabilities.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesRoot = path.resolve(__dirname, '..', 'packages');

// ── Font families (must match FONT_FAMILY_ITEMS in shared-settings.ts) ──

const FONT_FAMILY_ITEMS = [
  { value: '', displayName: 'Default' },
  { value: 'Arial', displayName: 'Arial' },
  { value: 'Calibri', displayName: 'Calibri' },
  { value: 'Cambria', displayName: 'Cambria' },
  { value: 'Courier New', displayName: 'Courier New' },
  { value: 'Georgia', displayName: 'Georgia' },
  { value: 'Helvetica Neue', displayName: 'Helvetica Neue' },
  { value: 'Segoe UI', displayName: 'Segoe UI' },
  { value: 'Tahoma', displayName: 'Tahoma' },
  { value: 'Times New Roman', displayName: 'Times New Roman' },
  { value: 'Trebuchet MS', displayName: 'Trebuchet MS' },
  { value: 'Verdana', displayName: 'Verdana' },
];

// ── Shared capabilities templates (synced from CAPABILITIES_TEMPLATES) ──

const SHARED_TEMPLATES = {
  axisFormatting: {
    displayName: 'Axis Formatting',
    properties: {
      showXAxis: { displayName: 'Show X-Axis', type: { bool: true } },
      showYAxis: { displayName: 'Show Y-Axis', type: { bool: true } },
      xAxisTitle: { displayName: 'X-Axis Title', type: { text: true } },
      yAxisTitle: { displayName: 'Y-Axis Title', type: { text: true } },
      axisLabelColor: { displayName: 'Label Color', type: { fill: { solid: { color: true } } } },
      axisLabelSize: { displayName: 'Label Font Size', type: { numeric: true } },
      axisLabelFontFamily: { displayName: 'Label Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      axisLabelRotation: { displayName: 'X-Label Rotation (°)', type: { numeric: true } },
      yAxisMin: { displayName: 'Y-Axis Min', type: { numeric: true } },
      yAxisMax: { displayName: 'Y-Axis Max', type: { numeric: true } },
      axisLineColor: { displayName: 'Axis Line Color', type: { fill: { solid: { color: true } } } },
      axisLineWidth: { displayName: 'Axis Line Width', type: { numeric: true } },
      showGridLines: { displayName: 'Show Grid Lines', type: { bool: true } },
      gridLineColor: { displayName: 'Grid Line Color', type: { fill: { solid: { color: true } } } },
      gridLineStyle: { displayName: 'Grid Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }] } },
      gridLineWidth: { displayName: 'Grid Line Width', type: { numeric: true } },
      gridLineOpacity: { displayName: 'Grid Line Opacity (%)', type: { numeric: true } },
    },
  },
  legendFormatting: {
    displayName: 'Legend',
    properties: {
      showLegend: { displayName: 'Show Legend', type: { bool: true } },
      legendPosition: { displayName: 'Position', type: { enumeration: [{ value: 'bottom', displayName: 'Bottom' }, { value: 'top', displayName: 'Top' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      legendFontSize: { displayName: 'Font Size', type: { numeric: true } },
      legendFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      legendFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
    },
  },
  dataLabelFormatting: {
    displayName: 'Data Labels',
    properties: {
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      dataLabelFontSize: { displayName: 'Font Size', type: { numeric: true } },
      dataLabelFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      dataLabelFontWeight: { displayName: 'Font Weight', type: { enumeration: [{ value: 'normal', displayName: 'Normal' }, { value: 'bold', displayName: 'Bold' }] } },
      dataLabelFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      dataLabelPosition: { displayName: 'Position', type: { enumeration: [{ value: 'auto', displayName: 'Auto' }, { value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'inside', displayName: 'Inside' }, { value: 'outside', displayName: 'Outside' }] } },
    },
  },
  titleFormatting: {
    displayName: 'Chart Title',
    properties: {
      showTitle: { displayName: 'Show Title', type: { bool: true } },
      titleText: { displayName: 'Title Text', type: { text: true } },
      titleFontSize: { displayName: 'Font Size', type: { numeric: true } },
      titleFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      titleFontFamily: { displayName: 'Font', type: { enumeration: FONT_FAMILY_ITEMS } },
      titleAlignment: { displayName: 'Alignment', type: { enumeration: [{ value: 'left', displayName: 'Left' }, { value: 'center', displayName: 'Center' }, { value: 'right', displayName: 'Right' }] } },
      subtitleText: { displayName: 'Subtitle', type: { text: true } },
      subtitleFontSize: { displayName: 'Subtitle Font Size', type: { numeric: true } },
      subtitleFontColor: { displayName: 'Subtitle Color', type: { fill: { solid: { color: true } } } },
    },
  },
  numberFormatting: {
    displayName: 'Number Format',
    properties: {
      displayUnits: { displayName: 'Display Units', type: { enumeration: [{ value: 'auto', displayName: 'Auto' }, { value: 'none', displayName: 'None' }, { value: 'thousands', displayName: 'Thousands (K)' }, { value: 'millions', displayName: 'Millions (M)' }, { value: 'billions', displayName: 'Billions (B)' }] } },
      decimalPlaces: { displayName: 'Decimal Places', type: { numeric: true } },
      valuePrefix: { displayName: 'Prefix', type: { text: true } },
      valueSuffix: { displayName: 'Suffix', type: { text: true } },
    },
  },
  lineStrokeFormatting: {
    displayName: 'Line Stroke',
    properties: {
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
    },
  },
  scrollFormatting: {
    displayName: 'Scroll',
    properties: {
      enableScroll: { displayName: 'Enable Scroll', type: { bool: true } },
      minCategoryWidth: { displayName: 'Min Category Width (px)', type: { numeric: true } },
    },
  },
  sortFormatting: {
    displayName: 'Sort Order',
    properties: {
      sortBy: { displayName: 'Sort By', type: { enumeration: [{ value: 'dataOrder', displayName: 'Data Order' }, { value: 'valueAsc', displayName: 'Value (Ascending)' }, { value: 'valueDesc', displayName: 'Value (Descending)' }, { value: 'nameAsc', displayName: 'Name (A-Z)' }, { value: 'nameDesc', displayName: 'Name (Z-A)' }] } },
    },
  },
  referenceLineFormatting: {
    displayName: 'Reference Line',
    properties: {
      showReferenceLine: { displayName: 'Show Reference Line', type: { bool: true } },
      referenceLineType: { displayName: 'Type', type: { enumeration: [{ value: 'custom', displayName: 'Custom Value' }, { value: 'mean', displayName: 'Mean' }, { value: 'median', displayName: 'Median' }, { value: 'percentile', displayName: 'Percentile' }, { value: 'min', displayName: 'Min' }, { value: 'max', displayName: 'Max' }] } },
      referenceLineValue: { displayName: 'Value', type: { numeric: true } },
      referenceLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      referenceLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      referenceLineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      showReferenceLabel: { displayName: 'Show Label', type: { bool: true } },
      referenceLabelText: { displayName: 'Label Text', type: { text: true } },
      showReferenceBand: { displayName: 'Show Band', type: { bool: true } },
      referenceBandOpacity: { displayName: 'Band Opacity (%)', type: { numeric: true } },
      referenceLineAxis: { displayName: 'Target Axis', type: { enumeration: [{ value: 'primary', displayName: 'Primary' }, { value: 'secondary', displayName: 'Secondary' }] } },
    },
  },
  trendLineFormatting: {
    displayName: 'Trend Line',
    properties: {
      showTrendLine: { displayName: 'Show Trend Line', type: { bool: true } },
      trendLineType: { displayName: 'Type', type: { enumeration: [{ value: 'linear', displayName: 'Linear' }, { value: 'polynomial', displayName: 'Polynomial' }, { value: 'exponential', displayName: 'Exponential' }, { value: 'logarithmic', displayName: 'Logarithmic' }, { value: 'power', displayName: 'Power' }] } },
      polynomialOrder: { displayName: 'Polynomial Order', type: { numeric: true } },
      trendLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      trendLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      showEquation: { displayName: 'Show Equation', type: { bool: true } },
      showR2: { displayName: 'Show R²', type: { bool: true } },
      trendLineAxis: { displayName: 'Target Axis', type: { enumeration: [{ value: 'primary', displayName: 'Primary' }, { value: 'secondary', displayName: 'Secondary' }] } },
    },
  },
  conditionalFormatting: {
    displayName: 'Conditional Formatting',
    properties: {
      enableConditional: { displayName: 'Enable Conditional Formatting', type: { bool: true } },
      conditionalDirection: { displayName: 'Direction', type: { enumeration: [{ value: 'ascending', displayName: 'Ascending (Low = Bad)' }, { value: 'descending', displayName: 'Descending (Low = Good)' }] } },
      threshold1: { displayName: 'Threshold 1', type: { numeric: true } },
      threshold2: { displayName: 'Threshold 2', type: { numeric: true } },
      conditionalColor1: { displayName: 'Color 1 (Bad)', type: { fill: { solid: { color: true } } } },
      conditionalColor2: { displayName: 'Color 2 (Warning)', type: { fill: { solid: { color: true } } } },
      conditionalColor3: { displayName: 'Color 3 (Good)', type: { fill: { solid: { color: true } } } },
    },
  },
  crosshairFormatting: {
    displayName: 'Crosshair',
    properties: {
      showCrosshair: { displayName: 'Show Crosshair', type: { bool: true } },
      crosshairLineColor: { displayName: 'Line Color', type: { fill: { solid: { color: true } } } },
      crosshairLineWidth: { displayName: 'Line Width', type: { numeric: true } },
      crosshairLineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      showCrosshairValues: { displayName: 'Show Values', type: { bool: true } },
    },
  },
  accessibilityFormatting: {
    displayName: 'Accessibility',
    properties: {
      enableKeyboardNav: { displayName: 'Enable Keyboard Navigation', type: { bool: true } },
    },
  },
  annotationFormatting: {
    displayName: 'Annotations',
    properties: {
      showAnnotations: { displayName: 'Show Annotations', type: { bool: true } },
      annotation1Category: { displayName: 'Annotation 1 — Category', type: { text: true } },
      annotation1Text: { displayName: 'Annotation 1 — Text', type: { text: true } },
      annotation1Position: { displayName: 'Annotation 1 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotation2Category: { displayName: 'Annotation 2 — Category', type: { text: true } },
      annotation2Text: { displayName: 'Annotation 2 — Text', type: { text: true } },
      annotation2Position: { displayName: 'Annotation 2 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotation3Category: { displayName: 'Annotation 3 — Category', type: { text: true } },
      annotation3Text: { displayName: 'Annotation 3 — Text', type: { text: true } },
      annotation3Position: { displayName: 'Annotation 3 — Position', type: { enumeration: [{ value: 'above', displayName: 'Above' }, { value: 'below', displayName: 'Below' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      annotationFontSize: { displayName: 'Font Size', type: { numeric: true } },
      annotationFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      annotationConnectorColor: { displayName: 'Connector Color', type: { fill: { solid: { color: true } } } },
    },
  },
  colorThemeFormatting: {
    displayName: 'Color Theme',
    properties: {
      colorTheme: { displayName: 'Theme', type: { enumeration: [{ value: 'default', displayName: 'Default' }, { value: 'ocean', displayName: 'Ocean' }, { value: 'sunset', displayName: 'Sunset' }, { value: 'forest', displayName: 'Forest' }, { value: 'berry', displayName: 'Berry' }, { value: 'monochrome', displayName: 'Monochrome' }, { value: 'earth', displayName: 'Earth' }] } },
    },
  },
  seriesFormatting: {
    displayName: 'Series Formatting',
    objectCategory: 2,
    properties: {
      seriesColor: { displayName: 'Color', type: { fill: { solid: { color: true } } } },
      seriesOpacity: { displayName: 'Opacity (%)', type: { numeric: true } },
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
    },
  },
};

// ── Per-visual element settings capabilities ─────────────────────────

function colorProp(name) { return { displayName: name, type: { fill: { solid: { color: true } } } }; }
function numProp(name) { return { displayName: name, type: { numeric: true } }; }
function boolProp(name) { return { displayName: name, type: { bool: true } }; }
function enumProp(name) { return { displayName: name, type: { enumeration: [] } }; }

// These get merged into the EXISTING objects (same card name that already exists).
// If the card doesn't exist yet, it's created.
const PER_VISUAL_ADDITIONS = {
  'bar-chart-pro': {
    barSettings: {
      properties: {
        barBorderColor: colorProp('Bar Border Color'),
        barBorderWidth: numProp('Bar Border Width'),
        barOpacity: numProp('Bar Opacity (%)'),
      },
    },
  },
  'animated-waterfall': {
    waterfallSettings: {
      properties: {
        barCornerRadius: numProp('Bar Corner Radius'),
        barBorderColor: colorProp('Bar Border Color'),
        barBorderWidth: numProp('Bar Border Width'),
      },
    },
    connectorFormatting: {
      displayName: 'Connectors',
      properties: {
        connectorColor: colorProp('Connector Color'),
        connectorWidth: numProp('Connector Width'),
        connectorStyle: enumProp('Connector Style'),
      },
    },
  },
  'scatter-bubble': {
    scatterSettings: {
      properties: {
        bubbleStrokeColor: colorProp('Bubble Stroke Color'),
        bubbleStrokeWidth: numProp('Bubble Stroke Width'),
      },
    },
  },
  'morphing-area-chart': {
    lineSettings: {
      properties: {
        dotRadius: numProp('Dot Radius'),
        dotStrokeColor: colorProp('Dot Stroke Color'),
        dotStrokeWidth: numProp('Dot Stroke Width'),
      },
    },
  },
  'animated-donut-pro': {
    donutSettings: {
      properties: {
        segmentStrokeColor: colorProp('Segment Stroke Color'),
        segmentStrokeWidth: numProp('Segment Stroke Width'),
        labelColor: colorProp('Label Color'),
        labelFontSize: numProp('Label Font Size'),
      },
    },
  },
  'ring-stack': {
    ringSettings: {
      properties: {
        trackColor: colorProp('Track Color'),
        trackOpacity: numProp('Track Opacity (%)'),
        ringStrokeColor: colorProp('Ring Stroke Color'),
      },
    },
  },
  'sunburst-chart': {
    sunburstSettings: {
      properties: {
        segmentStrokeColor: colorProp('Segment Stroke Color'),
        segmentStrokeWidth: numProp('Segment Stroke Width'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'sankey-diagram': {
    linkSettings: {
      properties: {
        dimOpacity: numProp('Dim Opacity (%)'),
      },
    },
    nodeSettings: {
      properties: {
        nodeBorderColor: colorProp('Node Border Color'),
        nodeBorderWidth: numProp('Node Border Width'),
      },
    },
  },
  'chord-diagram': {
    chordSettings: {
      properties: {
        arcStrokeColor: colorProp('Arc Stroke Color'),
        ribbonOpacity: numProp('Ribbon Opacity (%)'),
        dimOpacity: numProp('Dim Opacity (%)'),
      },
    },
  },
  'network-graph': {
    nodeSettings: {
      properties: {
        nodeRadius: numProp('Node Radius'),
        nodeBorderColor: colorProp('Node Border Color'),
        nodeBorderWidth: numProp('Node Border Width'),
      },
    },
    linkSettings: {
      properties: {
        linkColor: colorProp('Link Color'),
        linkWidth: numProp('Link Width'),
      },
    },
  },
  'radial-gauge': {
    arcSettings: {
      properties: {
        trackOpacity: numProp('Track Opacity (%)'),
        zoneBorderWidth: numProp('Zone Border Width'),
        zoneBorderOpacity: numProp('Zone Border Opacity (%)'),
      },
    },
  },
  'gauge-cluster': {
    clusterSettings: {
      properties: {
        trackOpacity: numProp('Track Opacity (%)'),
      },
    },
  },
  'gantt-chart-pro': {
    ganttSettings: {
      properties: {
        barOpacity: numProp('Bar Opacity (%)'),
        barCornerRadius: numProp('Bar Corner Radius'),
        rowGap: numProp('Row Gap'),
        labelWidth: numProp('Label Width'),
        todayLineWidth: numProp('Today Line Width'),
        todayLineStyle: enumProp('Today Line Style'),
      },
    },
  },
  'box-plot': {
    boxSettings: {
      properties: {
        boxStrokeColor: colorProp('Box Stroke Color'),
        boxStrokeWidth: numProp('Box Stroke Width'),
        medianColor: colorProp('Median Color'),
        whiskerWidth: numProp('Whisker Width'),
        outlierRadius: numProp('Outlier Radius'),
      },
    },
  },
  'dumbbell-chart': {
    dumbbellSettings: {
      properties: {
        dotRadius: numProp('Dot Radius'),
        dotStrokeColor: colorProp('Dot Stroke Color'),
        dotStrokeWidth: numProp('Dot Stroke Width'),
        lineColor: colorProp('Line Color'),
      },
    },
  },
  'bump-chart': {
    bumpSettings: {
      properties: {
        dotRadius: numProp('Dot Radius'),
        dotStrokeColor: colorProp('Dot Stroke Color'),
      },
    },
  },
  'slope-chart': {
    slopeSettings: {
      properties: {
        dotRadius: numProp('Dot Radius'),
        dotStrokeColor: colorProp('Dot Stroke Color'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'stream-graph': {
    streamSettings: {
      properties: {
        streamOpacity: numProp('Stream Opacity (%)'),
        streamStrokeColor: colorProp('Stream Stroke Color'),
        streamStrokeWidth: numProp('Stream Stroke Width'),
      },
    },
  },
  'polar-chart': {
    polarSettings: {
      properties: {
        segmentStrokeColor: colorProp('Segment Stroke Color'),
        segmentStrokeWidth: numProp('Segment Stroke Width'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'bullet-chart-pro': {
    bulletSettings: {
      properties: {
        barCornerRadius: numProp('Bar Corner Radius'),
        rangeOpacity: numProp('Range Opacity (%)'),
      },
    },
  },
  'funnel-pro': {
    funnelSettings: {
      properties: {
        segmentStrokeColor: colorProp('Segment Stroke Color'),
        segmentStrokeWidth: numProp('Segment Stroke Width'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'bar-race': {
    raceSettings: {
      properties: {
        barCornerRadius: numProp('Bar Corner Radius'),
        barOpacity: numProp('Bar Opacity (%)'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'treemap-pro': {
    treemapSettings: {
      properties: {
        tileStrokeColor: colorProp('Tile Stroke Color'),
        tileStrokeWidth: numProp('Tile Stroke Width'),
        tilePadding: numProp('Tile Padding'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'heatmap-calendar': {
    calendarSettings: {
      properties: {
        cellStrokeColor: colorProp('Cell Stroke Color'),
        cellStrokeWidth: numProp('Cell Stroke Width'),
        cellCornerRadius: numProp('Cell Corner Radius'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'timeline-milestone': {
    timelineSettings: {
      properties: {
        lineColor: colorProp('Line Color'),
        lineWidth: numProp('Line Width'),
        markerStrokeColor: colorProp('Marker Stroke Color'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'waffle-chart': {
    gridSettings: {
      properties: {
        cellStrokeColor: colorProp('Cell Stroke Color'),
        cellCornerRadius: numProp('Cell Corner Radius'),
        emptyColor: colorProp('Empty Cell Color'),
      },
    },
  },
  'progress-bar-stack': {
    barSettings: {
      properties: {
        barCornerRadius: numProp('Bar Corner Radius'),
        trackColor: colorProp('Track Color'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'kpi-card': {
    sparklineSettings: {
      displayName: 'Sparkline',
      properties: {
        sparklineColor: colorProp('Sparkline Color'),
        sparklineWidth: numProp('Sparkline Width'),
        dividerColor: colorProp('Divider Color'),
      },
    },
  },
  'status-indicator': {
    indicatorSettings: {
      properties: {
        iconSize: numProp('Icon Size'),
        labelColor: colorProp('Label Color'),
      },
    },
  },
  'radar-chart': {
    radarSettings: {
      properties: {
        webStrokeColor: colorProp('Web Stroke Color'),
        webStrokeWidth: numProp('Web Stroke Width'),
        webFillOpacity: numProp('Web Fill Opacity (%)'),
        dotRadius: numProp('Dot Radius'),
        areaOpacity: numProp('Area Opacity (%)'),
      },
    },
  },
};

// ── Shared card assignment per visual (derived from settings.ts imports) ──

const SHARED_ASSIGNMENT = {
  'animated-donut-pro':  ['dataLabelFormatting', 'legendFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'animated-waterfall':  ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'numberFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting'],
  'bar-chart-pro':       ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'numberFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'bar-race':            ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'box-plot':            ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'numberFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'bullet-chart-pro':    ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting'],
  'bump-chart':          ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting', 'scrollFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'crosshairFormatting', 'annotationFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'chord-diagram':       ['dataLabelFormatting', 'legendFormatting', 'titleFormatting', 'sortFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'dumbbell-chart':      ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'sortFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'funnel-pro':          ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'gantt-chart-pro':     ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'gauge-cluster':       ['dataLabelFormatting', 'titleFormatting', 'numberFormatting', 'conditionalFormatting', 'accessibilityFormatting'],
  'health-bar':          ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'sortFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting'],
  'heatmap-calendar':    ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting'],
  'kpi-card':            ['titleFormatting', 'numberFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'morphing-area-chart': ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting', 'scrollFormatting', 'numberFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'crosshairFormatting', 'annotationFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'network-graph':       ['dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'polar-chart':         ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'sortFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'progress-bar-stack':  ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'annotationFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'radar-chart':         ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'radial-gauge':        ['dataLabelFormatting', 'titleFormatting', 'numberFormatting', 'conditionalFormatting', 'accessibilityFormatting'],
  'ring-stack':          ['legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'sortFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'sankey-diagram':      ['dataLabelFormatting', 'titleFormatting', 'scrollFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'scatter-bubble':      ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'numberFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'slope-chart':         ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'crosshairFormatting', 'annotationFormatting', 'accessibilityFormatting', 'seriesFormatting'],
  'status-indicator':    ['titleFormatting', 'conditionalFormatting', 'accessibilityFormatting'],
  'stream-graph':        ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting', 'sortFormatting', 'referenceLineFormatting', 'trendLineFormatting', 'conditionalFormatting', 'crosshairFormatting', 'annotationFormatting', 'accessibilityFormatting', 'seriesFormatting', 'colorThemeFormatting'],
  'sunburst-chart':      ['legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'timeline-milestone':  ['axisFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'treemap-pro':         ['dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
  'waffle-chart':        ['legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'conditionalFormatting', 'accessibilityFormatting', 'colorThemeFormatting'],
};

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  let updated = 0;

  for (const dir of dirs) {
    const capPath = path.join(packagesRoot, dir, 'capabilities.json');
    try {
      await fs.access(capPath);
    } catch {
      continue; // not a visual package
    }

    const raw = await fs.readFile(capPath, 'utf-8');
    const cap = JSON.parse(raw);

    if (!cap.objects) cap.objects = {};

    let changed = false;

    // Inject shared templates
    const sharedCards = SHARED_ASSIGNMENT[dir] ?? [];
    for (const cardName of sharedCards) {
      const template = SHARED_TEMPLATES[cardName];
      if (!template) continue;
      if (!cap.objects[cardName]) {
        cap.objects[cardName] = JSON.parse(JSON.stringify(template));
        changed = true;
      } else {
        // Merge properties that don't exist yet
        const existing = cap.objects[cardName].properties ?? {};
        const incoming = template.properties ?? {};
        for (const [key, val] of Object.entries(incoming)) {
          if (!existing[key]) {
            existing[key] = JSON.parse(JSON.stringify(val));
            changed = true;
          }
        }
        cap.objects[cardName].properties = existing;
      }
    }

    // Inject per-visual additions
    const additions = PER_VISUAL_ADDITIONS[dir];
    if (additions) {
      for (const [cardName, cardDef] of Object.entries(additions)) {
        if (!cap.objects[cardName]) {
          cap.objects[cardName] = JSON.parse(JSON.stringify(cardDef));
          changed = true;
        } else {
          // Merge properties
          const existing = cap.objects[cardName].properties ?? {};
          const incoming = cardDef.properties ?? {};
          for (const [key, val] of Object.entries(incoming)) {
            if (!existing[key]) {
              existing[key] = JSON.parse(JSON.stringify(val));
              changed = true;
            }
          }
          cap.objects[cardName].properties = existing;
        }
      }
    }

    if (changed) {
      await fs.writeFile(capPath, JSON.stringify(cap, null, 2) + '\n', 'utf-8');
      updated++;
      console.log(`[inject] Updated: ${dir}/capabilities.json`);
    }
  }

  console.log(`\n[inject] Done. Updated ${updated} capabilities.json files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
