/**
 * @pbi/core — Shared library for Power BI custom visuals.
 */

// Colors & palette
export {
  BRAND,
  SEMANTIC,
  CHART_PALETTE,
  CHART_PALETTE_EXTENDED,
  getHostChartColor,
  getChartColor,
  getChartColors,
  getDeltaColor,
  withOpacity,
  type ColorMode,
} from './colors';

// Glassmorphic styling
export {
  getGlassStyle,
  applyGlassStyle,
  getGlassCss,
  type GlassStyleOptions,
  type GlassStyles,
} from './glass';

// Animations
export {
  cubicOut,
  springEase,
  smoothStep,
  bounceOut,
  animate,
  countUp,
  growBar,
  drawPath,
  sweepArc,
  fadeSlideIn,
  popIn,
  rippleFill,
  springScale,
  pulseGlow,
  fallIn,
  morphPath,
  prefersReducedMotion,
  DURATION,
} from './animation';

// Number formatting
export {
  formatNumber,
  formatPercent,
  formatCurrency,
  type FormatOptions,
  type DisplayUnits,
} from './format';

// Responsive breakpoints
export {
  getBreakpoint,
  isAtLeast,
  responsiveFontSize,
  responsivePadding,
  type Breakpoint,
  type Dimensions,
} from './responsive';

// Theme engine
export {
  getTheme,
  createTheme,
  LIGHT_THEME,
  DARK_THEME,
  type ThemeConfig,
} from './theme';

// Shared formatting settings cards
export {
  AxisFormattingCard,
  LegendFormattingCard,
  DataLabelFormattingCard,
  TitleFormattingCard,
  LineStrokeFormattingCard,
  ScrollFormattingCard,
  NumberFormattingCard,
  SortFormattingCard,
  CAPABILITIES_TEMPLATES,
} from './shared-settings';

// Shared formatting helpers
export {
  renderChartTitle,
  applyDataLabelFormatting,
  applyAxisFormatting,
  applyGridFormatting,
  applyAllAxisFormatting,
  applySortOrder,
  formatWithSettings,
  createScrollableChart,
  resolveDropdown,
  type SortableItem,
  type ScrollableChartOptions,
  type ScrollableChartResult,
} from './shared-helpers';
