import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard, NumberFormattingCard,
} from '../../core/src';

// ── Timeline (merged: Timeline + Timeline Layout orientation/layout) ──
class TimelineSettings extends formattingSettings.SimpleCard {
  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation', displayName: 'Orientation',
    items: [{ value: 'horizontal', displayName: 'Horizontal' }, { value: 'vertical', displayName: 'Vertical' }],
    value: { value: 'horizontal', displayName: 'Horizontal' },
  });

  layout = new formattingSettings.ItemDropdown({
    name: 'layout',
    displayName: 'Layout',
    items: [
      { value: 'alternating', displayName: 'Alternating' },
      { value: 'top', displayName: 'Top' },
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'staggered', displayName: 'Staggered' },
    ],
    value: { value: 'alternating', displayName: 'Alternating' },
  });

  showDates = new formattingSettings.ToggleSwitch({ name: 'showDates', displayName: 'Show Dates', value: true });
  dateFormat = new formattingSettings.ItemDropdown({
    name: 'dateFormat', displayName: 'Date Format',
    items: [
      { value: 'short', displayName: 'Short (MM/DD)' },
      { value: 'medium', displayName: 'Medium (Mon DD)' },
      { value: 'long', displayName: 'Long (Month DD, YYYY)' },
    ],
    value: { value: 'medium', displayName: 'Medium (Mon DD)' },
  });

  name = 'timelineSettings';
  displayName = 'Timeline';
  slices = [this.orientation, this.layout, this.showDates, this.dateFormat];
}

// ── Markers ──
class MarkerSettings extends formattingSettings.SimpleCard {
  shape = new formattingSettings.ItemDropdown({
    name: 'shape', displayName: 'Shape',
    items: [{ value: 'circle', displayName: 'Circle' }, { value: 'diamond', displayName: 'Diamond' }, { value: 'square', displayName: 'Square' }],
    value: { value: 'circle', displayName: 'Circle' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 12 });
  colorByCategory = new formattingSettings.ToggleSwitch({ name: 'colorByCategory', displayName: 'Color by Category', value: true });
  markerStrokeColor = new formattingSettings.ColorPicker({
    name: 'markerStrokeColor',
    displayName: 'Marker Stroke Color',
    value: { value: '' },
  });
  markerStrokeWidth = new formattingSettings.NumUpDown({
    name: 'markerStrokeWidth',
    displayName: 'Marker Stroke Width',
    value: 1,
  });

  name = 'markerSettings';
  displayName = 'Markers';
  slices = [this.shape, this.size, this.colorByCategory, this.markerStrokeColor, this.markerStrokeWidth];
}

// ── Spine & Connectors (extracted from Timeline + Timeline Layout) ──
class SpineAndConnectorsSettings extends formattingSettings.SimpleCard {
  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color',
    value: { value: '' },
  });
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });
  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors',
    value: false,
  });
  showDurationBars = new formattingSettings.ToggleSwitch({
    name: 'showDurationBars',
    displayName: 'Show Duration Bars',
    value: false,
  });
  durationBarOpacity = new formattingSettings.NumUpDown({
    name: 'durationBarOpacity',
    displayName: 'Duration Bar Opacity (%)',
    value: 30,
  });
  durationBarHeight = new formattingSettings.NumUpDown({
    name: 'durationBarHeight',
    displayName: 'Duration Bar Height (px)',
    value: 4,
  });
  showSwimlanes = new formattingSettings.ToggleSwitch({
    name: 'showSwimlanes',
    displayName: 'Show Swimlanes',
    value: false,
  });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'spineAndConnectorsSettings';
  displayName = 'Spine & Connectors';
  slices = [this.lineColor, this.lineWidth, this.showConnectors, this.showDurationBars, this.durationBarOpacity, this.durationBarHeight, this.showSwimlanes, this.labelColor];
}

// ── Today Line & Clustering (renamed from Timeline Markers) ──
class TodayLineAndClusteringSettings extends formattingSettings.SimpleCard {
  showTodayLine = new formattingSettings.ToggleSwitch({
    name: 'showTodayLine',
    displayName: 'Show Today Line',
    value: false,
  });
  todayLineColor = new formattingSettings.ColorPicker({
    name: 'todayLineColor',
    displayName: 'Today Line Color',
    value: { value: '#EF4444' },
  });
  todayLineWidth = new formattingSettings.NumUpDown({
    name: 'todayLineWidth',
    displayName: 'Today Line Width',
    value: 2,
  });
  todayLineOpacity = new formattingSettings.NumUpDown({
    name: 'todayLineOpacity',
    displayName: 'Today Line Opacity (%)',
    value: 80,
  });
  clusterNearby = new formattingSettings.ToggleSwitch({
    name: 'clusterNearby',
    displayName: 'Cluster Nearby',
    value: false,
  });
  clusterThresholdDays = new formattingSettings.NumUpDown({
    name: 'clusterThresholdDays',
    displayName: 'Cluster Threshold (days)',
    value: 7,
  });

  name = 'timelineMarkerSettings';
  displayName = 'Today Line & Clustering';
  slices = [this.showTodayLine, this.todayLineColor, this.todayLineWidth, this.todayLineOpacity, this.clusterNearby, this.clusterThresholdDays];
}

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
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

export class TimelineMilestoneSettings extends formattingSettings.Model {
  timelineSettings = new TimelineSettings();
  markerSettings = new MarkerSettings();
  spineAndConnectorsSettings = new SpineAndConnectorsSettings();
  timelineMarkerSettings = new TodayLineAndClusteringSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
  numberFormattingCard = new NumberFormattingCard();
  cards = [
    this.timelineSettings,
    this.markerSettings,
    this.spineAndConnectorsSettings,
    this.timelineMarkerSettings,
    this.dateFilterFormattingCard,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.cardSettings,
    this.animationSettings,
    this.axisFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
    this.legendFormattingCard,
    this.numberFormattingCard,
  ];
}
