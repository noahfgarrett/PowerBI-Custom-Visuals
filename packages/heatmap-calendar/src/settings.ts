import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard,
  ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

// ── Calendar Layout Settings ──────────────────────────────────────────────────
// Merged: CalendarSettings (layout portion), CalendarGranularitySettings, weekStart from CalendarScaleSettings

class CalendarLayoutSettings extends formattingSettings.SimpleCard {
  cellSize = new formattingSettings.NumUpDown({
    name: 'cellSize',
    displayName: 'Cell Size', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0009',
    value: 14,
  });

  cellGap = new formattingSettings.NumUpDown({
    name: 'cellGap',
    displayName: 'Cell Gap', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0010',
    value: 2,
  });

  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0011',
    value: 8,
  });

  granularity = new formattingSettings.ItemDropdown({
    name: 'granularity',
    displayName: 'Granularity', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0012',
    items: [
      { value: 'day', displayName: 'Day', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0013' },
      { value: 'week', displayName: 'Week', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0014' },
      { value: 'month', displayName: 'Month', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0015' },
    ],
    value: { value: 'day', displayName: 'Day', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0016' },
  });

  weekStart = new formattingSettings.ItemDropdown({
    name: 'weekStart',
    displayName: 'Week Start Day', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0017',
    items: [
      { value: 'sunday', displayName: 'Sunday', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0018' },
      { value: 'monday', displayName: 'Monday', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0019' },
    ],
    value: { value: 'monday', displayName: 'Monday', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0020' },
  });

  showMonthLabels = new formattingSettings.ToggleSwitch({
    name: 'showMonthLabels',
    displayName: 'Show Month Labels', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0021',
    value: true,
  });

  showDayLabels = new formattingSettings.ToggleSwitch({
    name: 'showDayLabels',
    displayName: 'Show Day Labels', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0022',
    value: true,
  });

  enableScrolling = new formattingSettings.ToggleSwitch({
    name: 'enableScrolling',
    displayName: 'Enable Scrolling', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0023',
    value: false,
  });

  labelFontFamily = new formattingSettings.ItemDropdown({
    name: 'labelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0024',
    items: [
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0025' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0026' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0027' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0028' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0029' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0030' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0031' },
    ],
    value: { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0032' },
  });

  labelFontWeight = new formattingSettings.ItemDropdown({
    name: 'labelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0033',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0034' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0035' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0036' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0037' },
  });

  name = 'calendarLayoutSettings';
  displayName = 'Calendar Layout';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0001';
  slices = [this.cellSize, this.cellGap, this.chartPadding, this.granularity, this.weekStart, this.showMonthLabels, this.showDayLabels, this.enableScrolling, this.labelFontFamily, this.labelFontWeight];
}

// ── Cell Style Settings ───────────────────────────────────────────────────────
// Extracted from CalendarSettings: cell stroke and corner radius

class CellStyleSettings extends formattingSettings.SimpleCard {
  cellCornerRadius = new formattingSettings.NumUpDown({
    name: 'cellCornerRadius',
    displayName: 'Cell Corner Radius', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0038',
    value: 2,
  });

  cellStrokeColor = new formattingSettings.ColorPicker({
    name: 'cellStrokeColor',
    displayName: 'Cell Stroke Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0039',
    value: { value: '' },
  });

  cellStrokeWidth = new formattingSettings.NumUpDown({
    name: 'cellStrokeWidth',
    displayName: 'Cell Stroke Width', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0040',
    value: 1,
  });

  name = 'cellStyleSettings';
  displayName = 'Cell Style';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0002';
  slices = [this.cellCornerRadius, this.cellStrokeColor, this.cellStrokeWidth];
}

// ── Color Scale Settings ──────────────────────────────────────────────────────
// Merged: ColorSettings (colors) + CalendarScaleSettings (colorMode, bins)
// weekStart moved to CalendarLayoutSettings

class ColorScaleSettings extends formattingSettings.SimpleCard {
  lowColor = new formattingSettings.ColorPicker({
    name: 'lowColor',
    displayName: 'Low Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0041',
    value: { value: '#E2E8F0' },
  });

  highColor = new formattingSettings.ColorPicker({
    name: 'highColor',
    displayName: 'High Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0042',
    value: { value: '#3B82F6' },
  });

  showMidColor = new formattingSettings.ToggleSwitch({
    name: 'showMidColor',
    displayName: 'Use 3-Stop Gradient', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0043',
    value: false,
  });

  midColor = new formattingSettings.ColorPicker({
    name: 'midColor',
    displayName: 'Mid Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0044',
    value: { value: '#FBBF24' },
  });

  midPoint = new formattingSettings.NumUpDown({
    name: 'midPoint',
    displayName: 'Mid Point (%)', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0045',
    value: 50,
  });

  colorMode = new formattingSettings.ItemDropdown({
    name: 'colorMode',
    displayName: 'Color Mode', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0046',
    items: [
      { value: 'continuous', displayName: 'Continuous', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0047' },
      { value: 'discrete', displayName: 'Discrete', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0048' },
    ],
    value: { value: 'continuous', displayName: 'Continuous', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0049' },
  });

  bins = new formattingSettings.NumUpDown({
    name: 'bins',
    displayName: 'Discrete Bins', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0050',
    value: 5,
  });

  emptyColor = new formattingSettings.ColorPicker({
    name: 'emptyColor',
    displayName: 'Empty Cell Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0051',
    value: { value: '#F1F5F9' },
  });

  name = 'colorScaleSettings';
  displayName = 'Color Scale';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0003';
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
    displayName: 'Show Color Legend', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0052',
    value: true,
  });

  legendPosition = new formattingSettings.ItemDropdown({
    name: 'legendPosition',
    displayName: 'Legend Position', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0053',
    items: [
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0054' },
      { value: 'top', displayName: 'Top', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0055' },
      { value: 'right', displayName: 'Right', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0056' },
    ],
    value: { value: 'bottom', displayName: 'Bottom', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0057' },
  });

  barThickness = new formattingSettings.NumUpDown({
    name: 'barThickness',
    displayName: 'Bar Thickness', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0058',
    value: 12,
  });

  legendPadding = new formattingSettings.NumUpDown({
    name: 'legendPadding',
    displayName: 'Legend Padding', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0059',
    value: 8,
  });

  labelGap = new formattingSettings.NumUpDown({
    name: 'labelGap',
    displayName: 'Label Gap', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0060',
    value: 4,
  });

  legendLength = new formattingSettings.NumUpDown({
    name: 'legendLength',
    displayName: 'Legend Length', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0076',
    value: 200,
  });

  legendLabelColor = new formattingSettings.ColorPicker({
    name: 'legendLabelColor',
    displayName: 'Label Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0077',
    value: { value: '' },
  });

  legendLabelFontSize = new formattingSettings.NumUpDown({
    name: 'legendLabelFontSize',
    displayName: 'Label Font Size', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0078',
    value: 11,
  });

  legendLabelFontFamily = new formattingSettings.ItemDropdown({
    name: 'legendLabelFontFamily',
    displayName: 'Label Font Family', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0079',
    items: [
      { value: '', displayName: 'Default', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0080' },
      { value: 'Segoe UI', displayName: 'Segoe UI', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0081' },
      { value: 'Arial', displayName: 'Arial', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0082' },
      { value: 'Calibri', displayName: 'Calibri', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0083' },
      { value: 'Helvetica', displayName: 'Helvetica', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0084' },
      { value: 'Times New Roman', displayName: 'Times New Roman', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0085' },
      { value: 'Verdana', displayName: 'Verdana', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0086' },
      { value: 'Georgia', displayName: 'Georgia', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0087' },
    ],
    value: { value: '', displayName: 'Default', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0088' },
  });

  legendLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'legendLabelFontWeight',
    displayName: 'Label Font Weight', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0089',
    items: [
      { value: 'normal', displayName: 'Normal', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0090' },
      { value: 'bold', displayName: 'Bold', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0091' },
      { value: '600', displayName: 'Semi-Bold', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0092' },
    ],
    value: { value: 'normal', displayName: 'Normal', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0093' },
  });

  name = 'legendSettings';
  displayName = 'Legend';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0004';
  slices = [
    this.showLegend,
    this.legendPosition,
    this.barThickness,
    this.legendLength,
    this.legendPadding,
    this.labelGap,
    this.legendLabelColor,
    this.legendLabelFontSize,
    this.legendLabelFontFamily,
    this.legendLabelFontWeight,
  ];
}

// ── Card Style Settings ──────────────────────────────────────────────────────

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0061',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0066' },
  });

  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Background Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0067',
    value: { value: '' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Background Opacity (%)', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0068',
    value: 35,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Border Radius', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0069',
    value: 12,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0094',
    value: 8,
  });

  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

// ── Animation Settings ──────────────────────────────────────────────────────

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animations', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0070',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0071',
    value: 600,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0006';
  slices = [this.enabled, this.duration];
}

// ── Calendar Streak Settings ────────────────────────────────────────────────

class CalendarStreakSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show Streaks', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0072',
    value: false,
  });

  threshold = new formattingSettings.NumUpDown({
    name: 'threshold',
    displayName: 'Streak Threshold', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0073',
    value: 0,
  });

  streakOutlineColor = new formattingSettings.ColorPicker({
    name: 'streakOutlineColor',
    displayName: 'Streak Outline Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0074',
    value: { value: '#F59E0B' },
  });

  name = 'calendarStreakSettings';
  displayName = 'Streak Highlighting';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0007';
  slices = [this.show, this.threshold, this.streakOutlineColor];
}

// ── Kept for backwards-compat (labelColor hidden at runtime) ────────────────

/** @deprecated Hidden — use axisFormattingCard.axisLabelColor instead */
class _LegacyCalendarSettings extends formattingSettings.SimpleCard {
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color', displayNameKey: 'HeatmapCalendarSettings_DisplayName_0075',
    value: { value: '' },
  });

  name = 'calendarSettings';
  displayName = 'Calendar (Legacy)';
  displayNameKey = 'HeatmapCalendarSettings_DisplayName_0008';
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
