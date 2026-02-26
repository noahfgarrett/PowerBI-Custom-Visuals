/**
 * wire-formatting.mjs
 *
 * Adds post-render formatting calls (applyDataLabelFormatting, applyAllAxisFormatting)
 * to each visual's visual.ts file. These calls apply the shared formatting card values
 * to the already-rendered DOM elements.
 *
 * Strategy: For each visual, find the end of the render method (after all elements are
 * drawn) and insert formatting calls BEFORE the background click listener.
 */
import fs from 'fs';
import path from 'path';

const PACKAGES_DIR = path.resolve('packages');

// ── Configuration per visual ─────────────────────────────────────────
// Each visual specifies:
//   dataLabelSelector: CSS selector for data label elements (null = no data labels)
//   axisSelector: CSS selector for axis groups (null = no axes)
//   gridSelector: CSS selector for grid groups (null = no grid)

const VISUAL_CONFIG = {
  'animated-donut-pro': {
    dataLabelSelector: '.donut-label',
    axisSelector: null,
    gridSelector: null,
  },
  'animated-waterfall': {
    dataLabelSelector: '.waterfall-value',
    axisSelector: '.waterfall-axis',
    gridSelector: null,  // grid lines are individual <line> elements, not in a group
  },
  'bar-chart-pro': {
    dataLabelSelector: '.bar-chart-label',
    axisSelector: null,  // already wired via querySelectorAll approach
    gridSelector: null,  // already wired
  },
  'bar-race': {
    dataLabelSelector: '.bar-race-value',
    axisSelector: null,
    gridSelector: null,
  },
  'box-plot': {
    dataLabelSelector: null,  // no data labels
    axisSelector: null,  // already wired
    gridSelector: null,  // already wired
  },
  'bullet-chart-pro': {
    dataLabelSelector: '.bullet-value-label',
    axisSelector: null,
    gridSelector: null,
  },
  'bump-chart': {
    dataLabelSelector: '.bump-rank-label',
    axisSelector: '.bump-axis',
    gridSelector: null,
  },
  'chord-diagram': {
    dataLabelSelector: '.chord-label',
    axisSelector: null,
    gridSelector: null,
  },
  'dumbbell-chart': {
    dataLabelSelector: null,  // no data labels
    axisSelector: null,  // already wired
    gridSelector: null,  // already wired
  },
  'funnel-pro': {
    dataLabelSelector: '.funnel-value-label',
    axisSelector: null,
    gridSelector: null,
  },
  'gantt-chart-pro': {
    dataLabelSelector: null,  // HTML layout, no standard labels
    axisSelector: null,
    gridSelector: null,
  },
  'gauge-cluster': {
    dataLabelSelector: '.gauge-value',
    axisSelector: null,
    gridSelector: null,
  },
  'heatmap-calendar': {
    dataLabelSelector: null,
    axisSelector: null,
    gridSelector: null,
  },
  'kpi-card': {
    dataLabelSelector: null,  // KPI card has custom layout
    axisSelector: null,
    gridSelector: null,
  },
  'morphing-area-chart': {
    dataLabelSelector: null,  // no data labels
    axisSelector: null,  // already wired
    gridSelector: null,  // already wired
  },
  'network-graph': {
    dataLabelSelector: '.network-label',
    axisSelector: null,
    gridSelector: null,
  },
  'polar-chart': {
    dataLabelSelector: '.polar-value-label',
    axisSelector: null,
    gridSelector: null,
  },
  'progress-bar-stack': {
    dataLabelSelector: '.progress-value',
    axisSelector: null,
    gridSelector: null,
  },
  'radar-chart': {
    dataLabelSelector: null,  // no floating labels
    axisSelector: null,
    gridSelector: null,
  },
  'radial-gauge': {
    dataLabelSelector: '.radial-gauge-value-text',
    axisSelector: null,
    gridSelector: null,
  },
  'ring-stack': {
    dataLabelSelector: '.ring-label-pct',
    axisSelector: null,
    gridSelector: null,
  },
  'sankey-diagram': {
    dataLabelSelector: '.sankey-node-label',
    axisSelector: null,
    gridSelector: null,
  },
  'scatter-bubble': {
    dataLabelSelector: null,  // tooltip only
    axisSelector: '.scatter-bubble-axis',
    gridSelector: '.scatter-bubble-grid',
  },
  'slope-chart': {
    dataLabelSelector: '.slope-label',
    axisSelector: null,
    gridSelector: null,
  },
  'status-indicator': {
    dataLabelSelector: null,  // custom layout
    axisSelector: null,
    gridSelector: null,
  },
  'stream-graph': {
    dataLabelSelector: null,  // no labels
    axisSelector: '.stream-axis',
    gridSelector: null,
  },
  'sunburst-chart': {
    dataLabelSelector: '.sunburst-label',
    axisSelector: null,
    gridSelector: null,
  },
  'timeline-milestone': {
    dataLabelSelector: null,  // no class on labels
    axisSelector: null,
    gridSelector: null,
  },
  'treemap-pro': {
    dataLabelSelector: '.treemap-value',
    axisSelector: null,
    gridSelector: null,
  },
  'waffle-chart': {
    dataLabelSelector: '.waffle-value',
    axisSelector: null,
    gridSelector: null,
  },
};

// ── Main ─────────────────────────────────────────────────────────────

let modified = 0;
let skipped = 0;

for (const [visual, config] of Object.entries(VISUAL_CONFIG)) {
  const filePath = path.join(PACKAGES_DIR, visual, 'src', 'visual.ts');
  if (!fs.existsSync(filePath)) {
    console.log(`[skip] ${visual}: file not found`);
    skipped++;
    continue;
  }

  let code = fs.readFileSync(filePath, 'utf-8');

  // Check if already wired (skip if applyDataLabelFormatting is already called)
  if (code.includes('applyDataLabelFormatting(') || code.includes('applyAllAxisFormatting(')) {
    console.log(`[skip] ${visual}: already wired`);
    skipped++;
    continue;
  }

  const needsDataLabel = !!config.dataLabelSelector;
  const needsAxis = !!config.axisSelector;

  if (!needsDataLabel && !needsAxis) {
    console.log(`[skip] ${visual}: no selectors to wire`);
    skipped++;
    continue;
  }

  // ── Step 1: Add imports ──────────────────────────────────────────
  const newImports = [];
  if (needsDataLabel && !code.includes('applyDataLabelFormatting')) {
    newImports.push('applyDataLabelFormatting');
  }
  if (needsAxis && !code.includes('applyAllAxisFormatting')) {
    newImports.push('applyAllAxisFormatting');
  }

  if (newImports.length > 0) {
    // Find the core import block and add new imports
    const coreImportRegex = /} from '\.\.\/\.\.\/core\/src';/;
    const match = code.match(coreImportRegex);
    if (match) {
      // Insert new imports before the closing brace
      const insertPoint = code.lastIndexOf('}', code.indexOf(match[0]));
      const indent = '  ';
      const importLines = newImports.map(i => `${indent}${i},`).join('\n');
      code = code.slice(0, insertPoint) + importLines + '\n' + code.slice(insertPoint);
    }
  }

  // ── Step 2: Add formatting calls ─────────────────────────────────
  // Strategy: Find a reliable insertion point near the end of rendering.
  // We look for 'this.container.addEventListener' which appears at the end of render.
  // If not found, look for the pattern just before the closing of update/render method.

  let formattingBlock = '\n    // Apply shared formatting settings\n';
  if (needsDataLabel) {
    formattingBlock += `    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '${config.dataLabelSelector}');\n`;
  }
  if (needsAxis) {
    const gridArg = config.gridSelector ? `, '${config.gridSelector}'` : '';
    formattingBlock += `    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '${config.axisSelector}'${gridArg});\n`;
  }

  // Try to insert before 'this.container.addEventListener('click''
  const listenerPattern = "this.container.addEventListener('click'";
  const listenerIdx = code.indexOf(listenerPattern);

  if (listenerIdx !== -1) {
    // Find the start of the line containing the listener
    const lineStart = code.lastIndexOf('\n', listenerIdx);
    code = code.slice(0, lineStart) + formattingBlock + code.slice(lineStart);
  } else {
    // Fallback: insert before the closing brace of the update method
    // Find 'renderChartTitle' and insert after the render call block
    const renderTitleIdx = code.indexOf('renderChartTitle(');
    if (renderTitleIdx !== -1) {
      // Find the end of the render section — look for the last closing brace of update()
      // This is tricky; let's find the closing of the main render call
      // Look for the pattern that ends the visual's main update flow

      // Find the last occurrence of '  }' followed by a blank line in the update method area
      // Actually, let's just append before the last line of the render/update method
      // Find the getFormattingModel method and insert before it
      const getFormattingIdx = code.indexOf('getFormattingModel');
      if (getFormattingIdx !== -1) {
        // Find the closing brace of the method before getFormattingModel
        const closingBrace = code.lastIndexOf('  }', getFormattingIdx);
        if (closingBrace !== -1) {
          code = code.slice(0, closingBrace) + formattingBlock + '\n' + code.slice(closingBrace);
        }
      }
    }
  }

  fs.writeFileSync(filePath, code);
  console.log(`[wired] ${visual}: ${needsDataLabel ? 'dataLabel' : ''}${needsDataLabel && needsAxis ? '+' : ''}${needsAxis ? 'axis' : ''}`);
  modified++;
}

console.log(`\nDone: ${modified} wired, ${skipped} skipped`);
