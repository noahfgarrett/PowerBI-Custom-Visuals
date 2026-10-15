import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard,
  DateFilterFormattingCard,
  CARD_STYLE_MODE_ITEMS
} from '../../core/src';

class TimelineGuideFormattingCard extends AxisFormattingCard {
  displayName = 'Swimlanes & Grid';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_SwimlanesGrid';
}

// ── Timeline (merged: Timeline + Timeline Layout orientation/layout) ──
class TimelineSettings extends formattingSettings.SimpleCard {
  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation', displayName: 'Orientation', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0007',
    items: [{ value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0008' }, { value: 'vertical', displayName: 'Vertical', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0009' }],
    value: { value: 'horizontal', displayName: 'Horizontal', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0010' },
  });

  layout = new formattingSettings.ItemDropdown({
    name: 'layout',
    displayName: 'Layout', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0011',
    items: [
      { value: 'alternating', displayName: 'Alternating', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0012' },
      { value: 'top', displayName: 'Above / Left', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0013' },
      { value: 'bottom', displayName: 'Below / Right', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0014' },
      { value: 'staggered', displayName: 'Staggered', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0015' },
    ],
    value: { value: 'alternating', displayName: 'Alternating', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0016' },
  });

  showDates = new formattingSettings.ToggleSwitch({ name: 'showDates', displayName: 'Show Dates', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0017', value: true });
  dateFormat = new formattingSettings.ItemDropdown({
    name: 'dateFormat', displayName: 'Date Format', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0018',
    items: [
      { value: 'short', displayName: 'Short (MM/DD)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0019' },
      { value: 'medium', displayName: 'Medium (Mon DD)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0020' },
      { value: 'long', displayName: 'Long (Month DD, YYYY)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0021' },
    ],
    value: { value: 'medium', displayName: 'Medium (Mon DD)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0022' },
  });
  chartPadding = new formattingSettings.NumUpDown({
    name: 'chartPadding',
    displayName: 'Chart Padding', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0023',
    value: 40,
  });
  labelSpacing = new formattingSettings.NumUpDown({
    name: 'labelSpacing',
    displayName: 'Label Spacing', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0024',
    value: 60,
  });

  maxVisible = new formattingSettings.NumUpDown({
    name: 'maxVisible',
    displayName: 'Maximum Visible (0 = All)',
    displayNameKey: 'TimelineMilestoneSettings_DisplayName_MaxVisible',
    value: 0,
  });

  windowOffset = new formattingSettings.NumUpDown({
    name: 'windowOffset',
    displayName: 'Window Start Index',
    displayNameKey: 'TimelineMilestoneSettings_DisplayName_WindowOffset',
    value: 0,
  });

  labelDensity = new formattingSettings.ItemDropdown({
    name: 'labelDensity',
    displayName: 'Label Density',
    displayNameKey: 'TimelineMilestoneSettings_DisplayName_LabelDensity',
    items: [
      { value: 'full', displayName: 'Show All', displayNameKey: 'TimelineMilestoneSettings_DisplayName_LabelDensityAll' },
      { value: 'compact', displayName: 'Reduce Labels', displayNameKey: 'TimelineMilestoneSettings_DisplayName_LabelDensityReduced' },
      { value: 'minimal', displayName: 'First and Last', displayNameKey: 'TimelineMilestoneSettings_DisplayName_LabelDensityEnds' },
    ],
    value: { value: 'full', displayName: 'Show All', displayNameKey: 'TimelineMilestoneSettings_DisplayName_LabelDensityAll' },
  });

  name = 'timelineSettings';
  displayName = 'Timeline';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0001';
  slices = [
    this.orientation,
    this.layout,
    this.showDates,
    this.dateFormat,
    this.chartPadding,
    this.labelSpacing,
    this.maxVisible,
    this.windowOffset,
    this.labelDensity,
  ];
}

// ── Markers ──
class MarkerSettings extends formattingSettings.SimpleCard {
  shape = new formattingSettings.ItemDropdown({
    name: 'shape', displayName: 'Shape', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0025',
    items: [{ value: 'circle', displayName: 'Circle', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0026' }, { value: 'diamond', displayName: 'Diamond', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0027' }, { value: 'square', displayName: 'Square', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0028' }],
    value: { value: 'circle', displayName: 'Circle', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0029' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0030', value: 12 });
  colorByCategory = new formattingSettings.ToggleSwitch({ name: 'colorByCategory', displayName: 'Color by Category', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0031', value: true });
  markerStrokeColor = new formattingSettings.ColorPicker({
    name: 'markerStrokeColor',
    displayName: 'Marker Stroke Color', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0032',
    value: { value: '' },
  });
  markerStrokeWidth = new formattingSettings.NumUpDown({
    name: 'markerStrokeWidth',
    displayName: 'Marker Stroke Width', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0033',
    value: 1,
  });

  name = 'markerSettings';
  displayName = 'Markers';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0002';
  slices = [this.shape, this.size, this.colorByCategory, this.markerStrokeColor, this.markerStrokeWidth];
}

// ── Spine & Connectors (extracted from Timeline + Timeline Layout) ──
class SpineAndConnectorsSettings extends formattingSettings.SimpleCard {
  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line Color', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0034',
    value: { value: '' },
  });
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0035',
    value: 2,
  });
  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0036',
    value: false,
  });
  showDurationBars = new formattingSettings.ToggleSwitch({
    name: 'showDurationBars',
    displayName: 'Show Interval Bars', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0037',
    value: false,
  });
  durationBarOpacity = new formattingSettings.NumUpDown({
    name: 'durationBarOpacity',
    displayName: 'Interval Bar Opacity (%)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0038',
    value: 30,
  });
  durationBarHeight = new formattingSettings.NumUpDown({
    name: 'durationBarHeight',
    displayName: 'Interval Bar Thickness', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0039',
    value: 4,
  });
  showSwimlanes = new formattingSettings.ToggleSwitch({
    name: 'showSwimlanes',
    displayName: 'Show Swimlanes', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0040',
    value: false,
  });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Swimlane Label Color', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0041',
    value: { value: '' },
  });

  name = 'spineAndConnectorsSettings';
  displayName = 'Spine, Connectors & Intervals';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0003';
  slices = [this.lineColor, this.lineWidth, this.showConnectors, this.showDurationBars, this.durationBarOpacity, this.durationBarHeight, this.showSwimlanes, this.labelColor];
}

// ── Today Line & Clustering (renamed from Timeline Markers) ──
class TodayLineAndClusteringSettings extends formattingSettings.SimpleCard {
  showTodayLine = new formattingSettings.ToggleSwitch({
    name: 'showTodayLine',
    displayName: 'Show Today Line', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0042',
    value: false,
  });
  todayLineColor = new formattingSettings.ColorPicker({
    name: 'todayLineColor',
    displayName: 'Today Line Color', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0043',
    value: { value: '#EF4444' },
  });
  todayLineWidth = new formattingSettings.NumUpDown({
    name: 'todayLineWidth',
    displayName: 'Today Line Width', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0044',
    value: 2,
  });
  todayLineOpacity = new formattingSettings.NumUpDown({
    name: 'todayLineOpacity',
    displayName: 'Today Line Opacity (%)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0045',
    value: 80,
  });
  clusterNearby = new formattingSettings.ToggleSwitch({
    name: 'clusterNearby',
    displayName: 'Cluster Nearby', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0046',
    value: false,
  });
  clusterThresholdDays = new formattingSettings.NumUpDown({
    name: 'clusterThresholdDays',
    displayName: 'Cluster Threshold (days)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0047',
    value: 7,
  });

  name = 'timelineMarkerSettings';
  displayName = 'Today Line & Clustering';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0004';
  slices = [this.showTodayLine, this.todayLineColor, this.todayLineWidth, this.todayLineOpacity, this.clusterNearby, this.clusterThresholdDays];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  cardStyleMode = new formattingSettings.ItemDropdown({
    name: 'cardStyleMode',
    displayName: 'Card Style', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0048',
    items: CARD_STYLE_MODE_ITEMS,
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0053' },
  });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0054', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0055', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0056', value: 12 });
  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Content Padding',
    displayNameKey: 'TimelineMilestoneSettings_DisplayName_ContentPadding',
    value: 8,
  });
  name = 'cardSettings';
  displayName = 'Card Style';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0005';
  slices = [this.cardStyleMode, this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0057', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', displayNameKey: 'TimelineMilestoneSettings_DisplayName_0058', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'TimelineMilestoneSettings_DisplayName_0006';
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
  axisFormattingCard = new TimelineGuideFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dateFilterFormattingCard = new DateFilterFormattingCard();
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
  ];
}
