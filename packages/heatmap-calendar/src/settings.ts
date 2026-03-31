import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
} from '../../core/src';

// ── Calendar Layout Settings ──────────────────────────────────────────────────
// Merged: CalendarSettings (layout portion), CalendarGranularitySettings, weekStart from CalendarScaleSettings

class CalendarLayoutSettings extends formattingSettings.SimpleCard {
  cellSize = new formattingSettings.NumUpDown({
    name: 'cellSize',
    displayName: 'Cell Size',
    value: 14,
  });

  cellGap = new formattingSettings.NumUpDown({
    name: 'cellGap',
    displayName: 'Cell Gap',
    value: 2,
  });

  granularity = new formattingSettings.ItemDropdown({
    name: 'granularity',
    displayName: 'Granularity',
    items: [
      { value: 'day', displayName: 'Day' },
      { value: 'week', displayName: 'Week' },
      { value: 'month', displayName: 'Month' },
    ],
    value: { value: 'day', displayName: 'Day' },
  });

  weekStart = new formattingSettings.ItemDropdown({
    name: 'weekStart',
    displayName: 'Week Start Day',
    items: [
      { value: 'sunday', displayName: 'Sunday' },
      { value: 'monday', displayName: 'Monday' },
    ],
    value: { value: 'monday', displayName: 'Monday' },
  });

  showMonthLabels = new formattingSettings.ToggleSwitch({
    name: 'showMonthLabels',
    displayName: 'Show Month Labels',
    value: true,
  });

  showDayLabels = new formattingSettings.ToggleSwitch({
    name: 'showDayLabels',
    displayName: 'Show Day Labels',
    value: true,
  });

  enableScrolling = new formattingSettings.ToggleSwitch({
    name: 'enableScrolling',
    displayName: 'Enable Scrolling',
    value: false,
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI' },
      { value: 'Arial', displayName: 'Arial' },
      { value: 'Calibri', displayName: 'Calibri' },
      { value: 'Helvetica', displayName: 'Helvetica' },
      { value: 'Times New Roman', displayName: 'Times New Roman' },
      { value: 'Verdana', displayName: 'Verdana' },
      { value: 'Georgia', displayName: 'Georgia' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
      { value: '600', displayName: 'Semi-Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'calendarLayoutSettings';
  displayName = 'Calendar Layout';
  slices = [this.cellSize, this.cellGap, this.granularity, this.weekStart, this.showMonthLabels, this.showDayLabels, this.enableScrolling, this.labelFontFamily, this.labelFontWeight];
}

// ── Cell Style Settings ───────────────────────────────────────────────────────
// Extracted from CalendarSettings: cell stroke and corner radius

class CellStyleSettings extends formattingSettings.SimpleCard {
  cellCornerRadius = new formattingSettings.NumUpDown({
    name: 'cellCornerRadius',
    displayName: 'Cell Corner Radius',
    value: 2,
  });

  cellStrokeColor = new formattingSettings.ColorPicker({
    name: 'cellStrokeColor',
    displayName: 'Cell Stroke Color',
    value: { value: '' },
  });

  cellStrokeWidth = new formattingSettings.NumUpDown({
    name: 'cellStrokeWidth',
    displayName: 'Cell Stroke Width',
    value: 1,
  });

  name = 'cellStyleSettings';
  displayName = 'Cell Style';
  slices = [this.cellCornerRadius, this.cellStrokeColor, this.cellStrokeWidth];
}

// ── Color Scale Settings ──────────────────────────────────────────────────────
// Merged: ColorSettings (colors) + CalendarScaleSettings (colorMode, bins)
// weekStart moved to CalendarLayoutSettings

class ColorScaleSettings extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color',
    value: { value: '#E2E8F0' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color',
    value: { value: '#3B82F6' },
  });

  showMidColor = new formattingSettings.ToggleSwitch({
    name: 'showMidColor',
    displayName: 'Use 3-Stop Gradient',
    value: false,
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color',
    value: { value: '#FBBF24' },
  });

  midPoint = new formattingSettings.NumUpDown({
    name: 'midPoint',
    displayName: 'Mid Point (%)',
    value: 50,
  });

  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode',
    items: [
      { value: 'continuous', displayName: 'Continuous' },
      { value: 'discrete', displayName: 'Discrete' },
    ],
    value: { value: 'continuous', displayName: 'Continuous' },
  });

  bins = new formattingSettings.NumUpDown({
    name: 'bins',
    displayName: 'Discrete Bins',
    value: 5,
  });

  emptyColor = new formattingSettings.ColorPicker({
    name: 'emptyColor',
    displayName: 'Empty Cell Color',
    value: { value: '#F1F5F9' },
  });

  name = 'colorScaleSettings';
  displayName = 'Color Scale';
  slices = [
    this.lowColor,
    this.highColor,
    this.showMidColor,
    this.midColor,
    this.midPoint,
    this.colorMode,
    this.bins,
    this.emptyColor,
  ];
}

// ── Legend Settings ────────────────────────────────────────────────────────────
// Extracted from ColorSettings: legend toggles

class LegendSettings extends formattingSettings.SimpleCard {
  showLegend = new formattingSettings.ToggleSwitch({
    name: 'showLegend',
    displayName: 'Show Color Legend',
    value: true,
  });

  legendPosition = new formattingSettings.ItemDropdown({
    name: 'legendPosition',
    displayName: 'Legend Position',
    items: [
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'top', displayName: 'Top' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'bottom', displayName: 'Bottom' },
  });

  name = 'legendSettings';
  displayName = 'Legend';
  slices = [this.showLegend, this.legendPosition];
}

// ── Card Style Settings ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style',
    items: [
      { value: 'none', displayName: 'None' },
      { value: 'glass', displayName: 'Glass' },
      { value: 'elevated', displayName: 'Elevated' },
      { value: 'neumorphic', displayName: 'Neumorphic' },
    ],
    value: { value: 'glass', displayName: 'Glass' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

// ── Animation Settings ──────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// ── Calendar Streak Settings ────────────────────────────────────────────────

class CalendarStreakSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Streaks',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Streak Threshold',
    value: 0,
  });

  streakOutlineColor = new formattingSettings.ColorPicker({
    name: 'streakOutlineColor',
    displayName: 'Streak Outline Color',
    value: { value: '#F59E0B' },
  });

  name = 'calendarStreakSettings';
  displayName = 'Streak Highlighting';
  slices = [this.show, this.threshold, this.streakOutlineColor];
}

// ── Kept for backwards-compat (labelColor hidden at runtime) ────────────────

/** @deprecated Hidden — use axisFormattingCard.axisLabelColor instead */
class _LegacyCalendarSettings extends formattingSettings.SimpleCard {
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'calendarSettings';
  displayName = 'Calendar (Legacy)';
  slices: formattingSettings.Slice[] = [];
}

export class HeatmapCalendarSettings extends formattingSettings.Model {
  calendarLayoutSettings = new CalendarLayoutSettings();
  cellStyleSettings = new CellStyleSettings();
  colorScaleSettings = new ColorScaleSettings();
  legendSettings = new LegendSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  calendarStreakSettings = new CalendarStreakSettings();

  // Legacy card — kept for backward compat of labelColor property in capabilities.json
  _legacyCalendarSettings = new _LegacyCalendarSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  colorThemeFormattingCard = new ColorThemeFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();

  cards = [
    this.calendarLayoutSettings,
    this.cellStyleSettings,
    this.colorScaleSettings,
    this.legendSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.calendarStreakSettings,
    this.axisFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.numberFormattingCard,
    this.colorThemeFormattingCard,
    this.dateFilterFormattingCard,
  ];
}
