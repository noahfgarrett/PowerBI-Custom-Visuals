/**
 * @pbi/core — Shared library for Power BI custom visuals.
 */

import './localization-augmentations';

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
  generateColorVariations,
  type ColorMode,
  type ColorThemeName,
  COLOR_THEMES,
} from './colors';

// Glassmorphic styling
export {
  getGlassStyle,
  applyGlassStyle,
  getGlassCss,
  type GlassStyleOptions,
  type GlassStyles,
} from './glass';

// Unified card styling (glass / elevated / neumorphic / outlined / floating)
export {
  applyCardStyle,
  type CardStyleMode,
  type CardStyleOptions,
} from './card-style';

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
  responsiveTypography,
  shouldShowLabels,
  truncateText,
  type Breakpoint,
  type Dimensions,
  type TypographyRole,
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
  ReferenceLineFormattingCard,
  TrendLineFormattingCard,
  TargetFormattingCard,
  ConditionalFormattingCard,
  CrosshairFormattingCard,
  AccessibilityFormattingCard,
  ColorThemeFormattingCard,
  AnnotationFormattingCard,
  DateFilterFormattingCard,
  SeriesFormattingGroup,
  SeriesFormattingCard,
  CARD_STYLE_MODE_ITEMS,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
  type SeriesFormatting,
  type LineStyleType,
  CAPABILITIES_TEMPLATES,
} from './shared-settings';

// Shared formatting helpers
export {
  createLocalizationManager,
  createLocalizedFormattingSettingsService,
  getLocalizedString,
} from './localization';

export {
  renderChartTitle,
  hideInlineLegendFormatting,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  applyDataLabelFormatting,
  applyAxisFormatting,
  applyGridFormatting,
  applyAllAxisFormatting,
  applySortOrder,
  attachEmptySpaceContextMenu,
  allowInteractions,
  getHostHighContrastColors,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  getVisualEmptyStateMode,
  type EmptyVisualStateMode,
  applyBasicHighContrastStyles,
  formatWithSettings,
  createScrollableChart,
  ensureScrollStyles,
  resolveDropdown,
  resolveColorTheme,
  renderLegend,
  createHoverDim,
  renderSparkline,
  type SortableItem,
  type ScrollableChartOptions,
  type ScrollableChartResult,
  type LegendItem,
  type LegendConfig,
  type HostHighContrastColors,
  type LandingPageConfig,
  type HighContrastStyleConfig,
  type HoverDimConfig,
  type SparklineConfig,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  renderInlineLabels,
  type InlineLabelItem,
  type InlineLabelConfig,
} from './shared-helpers';

// Reference lines, trend lines, targets
export {
  computeStatValue,
  computeRegression,
  renderHorizontalReferenceLine,
  renderVerticalReferenceLine,
  renderTrendLine,
  renderTargetLine,
  type StatType,
  type TrendType,
  type RegressionResult,
  type ReferenceLineConfig,
  type VerticalReferenceLineConfig,
  type TrendLineConfig,
  type TargetLineConfig,
} from './reference-lines';

// Conditional formatting
export {
  resolveConditionalColor,
  buildConditionalConfig,
  applyConditionalColors,
  type ConditionalConfig,
  type ConditionalDirection,
} from './conditional-formatting';

// Crosshair interaction
export {
  attachCrosshair,
  buildCrosshairConfig,
  type CrosshairConfig,
} from './crosshair';

// Selection and linked-state helpers
export {
  buildHighlightedCategoryKeys,
  focusHighlightedData,
  applyLinkedState,
  buildCategoryBands,
  type HighlightSeriesLike,
  type HighlightedDatumLike,
  type ApplyLinkedStateOptions,
  type CategoryBand,
} from './interactivity';

// Accessibility
export {
  detectContrastMode,
  getAccessiblePalette,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  type ContrastMode,
  type ChartAriaConfig,
  type KeyboardNavConfig,
} from './accessibility';

// Annotations
export {
  renderAnnotations,
  buildAnnotationConfig,
  type AnnotationItem,
  type AnnotationConfig,
} from './annotation';
