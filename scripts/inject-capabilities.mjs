#!/usr/bin/env node
/**
 * Injects shared formatting objects into each visual's capabilities.json.
 * Also injects per-visual element settings objects.
 *
 * Run: node scripts/inject-capabilities.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesRoot = path.resolve(__dirname, '..', 'packages');

// ── Shared capabilities templates ────────────────────────────────────

const SHARED_TEMPLATES = {
  axisFormatting: {
    displayName: 'Axis Formatting',
    properties: {
      axisLabelColor: { displayName: 'Label Color', type: { fill: { solid: { color: true } } } },
      axisLabelSize: { displayName: 'Label Font Size', type: { numeric: true } },
      axisLineColor: { displayName: 'Axis Line Color', type: { fill: { solid: { color: true } } } },
      axisLineWidth: { displayName: 'Axis Line Width', type: { numeric: true } },
      showGridLines: { displayName: 'Show Grid Lines', type: { bool: true } },
      gridLineColor: { displayName: 'Grid Line Color', type: { fill: { solid: { color: true } } } },
      gridLineStyle: { displayName: 'Grid Line Style', type: { enumeration: [] } },
    },
  },
  legendFormatting: {
    displayName: 'Legend',
    properties: {
      showLegend: { displayName: 'Show Legend', type: { bool: true } },
      legendPosition: { displayName: 'Position', type: { enumeration: [] } },
      legendFontSize: { displayName: 'Font Size', type: { numeric: true } },
      legendFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
    },
  },
  dataLabelFormatting: {
    displayName: 'Data Labels',
    properties: {
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      dataLabelFontSize: { displayName: 'Font Size', type: { numeric: true } },
      dataLabelFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      dataLabelFontWeight: { displayName: 'Font Weight', type: { enumeration: [] } },
    },
  },
  titleFormatting: {
    displayName: 'Chart Title',
    properties: {
      showTitle: { displayName: 'Show Title', type: { bool: true } },
      titleText: { displayName: 'Title Text', type: { text: true } },
      titleFontSize: { displayName: 'Font Size', type: { numeric: true } },
      titleFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      titleAlignment: { displayName: 'Alignment', type: { enumeration: [] } },
    },
  },
  lineStrokeFormatting: {
    displayName: 'Line Stroke',
    properties: {
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [] } },
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
    networkSettings: {
      properties: {
        nodeRadius: numProp('Node Radius'),
        nodeBorderColor: colorProp('Node Border Color'),
        nodeBorderWidth: numProp('Node Border Width'),
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
    heatmapSettings: {
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
    waffleSettings: {
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

// ── Shared card assignment per visual ────────────────────────────────

const SHARED_ASSIGNMENT = {
  'bar-chart-pro':       ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'animated-waterfall':  ['axisFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'scatter-bubble':      ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'box-plot':            ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'dumbbell-chart':      ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'morphing-area-chart': ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting'],
  'bump-chart':          ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting'],
  'stream-graph':        ['axisFormatting', 'legendFormatting', 'dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting'],
  'slope-chart':         ['dataLabelFormatting', 'titleFormatting', 'lineStrokeFormatting'],
  'bar-race':            ['dataLabelFormatting', 'titleFormatting'],
  'bullet-chart-pro':    ['axisFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'funnel-pro':          ['dataLabelFormatting', 'titleFormatting'],
  'heatmap-calendar':    ['dataLabelFormatting', 'titleFormatting'],
  'polar-chart':         ['dataLabelFormatting', 'titleFormatting'],
  'animated-donut-pro':  ['legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'ring-stack':          ['legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'sunburst-chart':      ['legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'radar-chart':         ['legendFormatting', 'dataLabelFormatting', 'titleFormatting'],
  'sankey-diagram':      ['dataLabelFormatting', 'titleFormatting'],
  'chord-diagram':       ['dataLabelFormatting', 'titleFormatting'],
  'network-graph':       ['dataLabelFormatting', 'titleFormatting'],
  'treemap-pro':         ['dataLabelFormatting', 'titleFormatting'],
  'gantt-chart-pro':     ['dataLabelFormatting', 'titleFormatting'],
  'timeline-milestone':  ['dataLabelFormatting', 'titleFormatting'],
  'kpi-card':            ['titleFormatting'],
  'radial-gauge':        ['dataLabelFormatting', 'titleFormatting'],
  'gauge-cluster':       ['dataLabelFormatting', 'titleFormatting'],
  'status-indicator':    ['titleFormatting'],
  'waffle-chart':        ['dataLabelFormatting', 'titleFormatting'],
  'progress-bar-stack':  ['dataLabelFormatting', 'titleFormatting'],
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
            existing[key] = val;
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
              existing[key] = val;
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
