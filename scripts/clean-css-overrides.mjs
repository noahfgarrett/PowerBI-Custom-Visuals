/**
 * clean-css-overrides.mjs
 *
 * Strips CSS properties from visual.less files that override inline styles
 * set by shared formatting helpers (style.setProperty). Keeps layout and
 * interaction properties intact.
 *
 * Properties REMOVED (they override formatting settings):
 *   font-size, font-weight, fill, color, stroke, stroke-width,
 *   stroke-dasharray, stroke-opacity, opacity
 *
 * Properties KEPT (layout/interaction):
 *   cursor, transition, display, text-anchor, font-variant-numeric,
 *   pointer-events, position, width, height, margin, padding, overflow,
 *   font-family, box-sizing, text-overflow, white-space, border-radius,
 *   dominant-baseline, letter-spacing, text-transform, flex, gap, align-items,
 *   justify-content, z-index, box-shadow, user-select, border, background,
 *   min-width, max-width, text-align, stroke-linecap, stroke-linejoin,
 *   fill: none (keep this specific value), transform-origin, line-height
 */
import fs from 'fs';
import path from 'path';

const PACKAGES_DIR = path.resolve('packages');

// Properties to strip (when they contain styling values)
const STYLING_PROPS = new Set([
  'font-size',
  'font-weight',
  'color',
  'opacity',
  'stroke-dasharray',
  'stroke-opacity',
]);

// These need conditional removal — only remove if they have color values
// (keep fill: none, stroke-linecap, etc.)
function shouldRemoveProp(prop, value) {
  prop = prop.trim();
  value = value.trim();

  // Always remove these
  if (STYLING_PROPS.has(prop)) return true;

  // fill: remove unless it's 'none' or 'currentColor'
  if (prop === 'fill') {
    return value !== 'none' && value !== 'currentColor';
  }

  // stroke: remove color values, keep 'none'
  if (prop === 'stroke') {
    return value !== 'none';
  }

  // stroke-width: remove numeric values (styling)
  if (prop === 'stroke-width') {
    return true;
  }

  // background: remove color values but keep layout backgrounds
  // Keep if it looks like a layout property (contains gradient, image, etc.)
  if (prop === 'background') {
    // Only remove simple color backgrounds like #CBD5E1
    return /^#[0-9a-fA-F]+$/.test(value) || /^rgba?\(/.test(value);
  }

  return false;
}

// Skip animated-waterfall (already cleaned)
const SKIP = new Set(['animated-waterfall']);

let modified = 0;
let skipped = 0;

const dirs = fs.readdirSync(PACKAGES_DIR).filter((d) => {
  if (SKIP.has(d)) return false;
  const lessPath = path.join(PACKAGES_DIR, d, 'style', 'visual.less');
  return fs.existsSync(lessPath);
});

for (const dir of dirs) {
  const lessPath = path.join(PACKAGES_DIR, dir, 'style', 'visual.less');
  const original = fs.readFileSync(lessPath, 'utf-8');
  let content = original;

  // Parse and clean each rule
  // Strategy: process line by line, track whether we're inside a rule
  const lines = content.split('\n');
  const result = [];
  let inRule = false;
  let ruleLines = [];
  let selectorLine = '';
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track brace depth
    const openCount = (trimmed.match(/{/g) || []).length;
    const closeCount = (trimmed.match(/}/g) || []).length;

    if (braceDepth === 0 && openCount > 0) {
      // Starting a new rule
      inRule = true;
      selectorLine = line;
      ruleLines = [];
      braceDepth += openCount - closeCount;

      // Handle single-line rules like `.foo { color: red; }`
      if (braceDepth === 0) {
        // Single line rule — check if it has properties to keep
        const propsMatch = trimmed.match(/\{(.+)\}/);
        if (propsMatch) {
          const props = propsMatch[1].split(';').filter((p) => p.trim());
          const kept = props.filter((p) => {
            const parts = p.split(':');
            if (parts.length < 2) return true;
            return !shouldRemoveProp(parts[0].trim(), parts.slice(1).join(':').trim().replace(/;$/, ''));
          });
          if (kept.length > 0) {
            const selector = trimmed.split('{')[0].trim();
            result.push(`${selector} { ${kept.map((p) => p.trim()).join('; ')}; }`);
          }
          // else: skip entire rule
        } else {
          result.push(line);
        }
        inRule = false;
      }
      continue;
    }

    if (inRule) {
      braceDepth += openCount - closeCount;

      if (braceDepth <= 0) {
        // End of rule — process collected lines
        const keptLines = ruleLines.filter((rl) => {
          const t = rl.trim();
          // Keep blank lines, comments, nested selectors
          if (!t || t.startsWith('/*') || t.startsWith('//') || t.startsWith('&') || t.startsWith('.') || t.endsWith('{')) {
            return true;
          }
          // Check if it's a property line
          const colonIdx = t.indexOf(':');
          if (colonIdx === -1) return true; // not a property
          const prop = t.substring(0, colonIdx).trim();
          const value = t.substring(colonIdx + 1).trim().replace(/;$/, '');
          return !shouldRemoveProp(prop, value);
        });

        // Check if the rule has any meaningful content left
        const hasContent = keptLines.some((rl) => {
          const t = rl.trim();
          return t && !t.startsWith('/*') && !t.startsWith('//') && t.indexOf(':') !== -1;
        });

        if (hasContent) {
          result.push(selectorLine);
          for (const rl of keptLines) {
            result.push(rl);
          }
          result.push(line); // closing brace
        }
        // else: skip entire rule (no properties left)

        inRule = false;
        braceDepth = 0;
      } else {
        ruleLines.push(line);
      }
      continue;
    }

    // Outside any rule — keep the line
    result.push(line);
  }

  const cleaned = result.join('\n');

  // Clean up multiple consecutive blank lines
  const final = cleaned.replace(/\n{3,}/g, '\n\n');

  if (final !== original) {
    fs.writeFileSync(lessPath, final);
    const removedLines = original.split('\n').length - final.split('\n').length;
    console.log(`[cleaned] ${dir}: removed ~${removedLines} lines`);
    modified++;
  } else {
    console.log(`[no-change] ${dir}`);
    skipped++;
  }
}

console.log(`\nDone: ${modified} cleaned, ${skipped} unchanged`);
