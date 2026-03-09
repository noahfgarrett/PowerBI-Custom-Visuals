import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard } from '../../core/src';
class TimelineSettings extends formattingSettings.SimpleCard {
  orientation = new formattingSettings.ItemDropdown({
    name: 'orientation', displayName: 'Orientation',
    items: [{ value: 'horizontal', displayName: 'Horizontal' }, { value: 'vertical', displayName: 'Vertical' }],
    value: { value: 'horizontal', displayName: 'Horizontal' },
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
  markerStrokeColor = new formattingSettings.ColorPicker({
    name: 'markerStrokeColor',
    displayName: 'Marker Stroke Color',
    value: { value: '' },
  });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'timelineSettings';
  displayName = 'Timeline';
  slices = [this.orientation, this.showDates, this.dateFormat, this.lineColor, this.lineWidth, this.markerStrokeColor, this.labelColor];
}

class MarkerSettings extends formattingSettings.SimpleCard {
  shape = new formattingSettings.ItemDropdown({
    name: 'shape', displayName: 'Shape',
    items: [{ value: 'circle', displayName: 'Circle' }, { value: 'diamond', displayName: 'Diamond' }, { value: 'square', displayName: 'Square' }],
    value: { value: 'circle', displayName: 'Circle' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 12 });
  colorByCategory = new formattingSettings.ToggleSwitch({ name: 'colorByCategory', displayName: 'Color by Category', value: true });
  name = 'markerSettings';
  displayName = 'Markers';
  slices = [this.shape, this.size, this.colorByCategory];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({ name: 'enableGlass', displayName: 'Glass Effect', value: true });
  backgroundColor = new formattingSettings.ColorPicker({ name: 'backgroundColor', displayName: 'Background Color', value: { value: '' } });
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.enableGlass, this.backgroundColor, this.backgroundOpacity, this.borderRadius];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({ name: 'enabled', displayName: 'Enable Animations', value: true });
  duration = new formattingSettings.NumUpDown({ name: 'duration', displayName: 'Duration (ms)', value: 600 });
  name = 'animationSettings';
  displayName = 'Animation';
  slices = [this.enabled, this.duration];
}

// -- Timeline Layout Settings -------------------------------------------------

class TimelineLayoutSettings extends formattingSettings.SimpleCard {
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

  showSwimlanes = new formattingSettings.ToggleSwitch({
    name: 'showSwimlanes',
    displayName: 'Show Swimlanes',
    value: false,
  });

  showDurationBars = new formattingSettings.ToggleSwitch({
    name: 'showDurationBars',
    displayName: 'Show Duration Bars',
    value: false,
  });

  showConnectors = new formattingSettings.ToggleSwitch({
    name: 'showConnectors',
    displayName: 'Show Connectors',
    value: false,
  });

  name = 'timelineLayoutSettings';
  displayName = 'Timeline Layout';
  slices = [this.layout, this.showSwimlanes, this.showDurationBars, this.showConnectors];
}

// -- Timeline Marker Settings -------------------------------------------------

class TimelineMarkerSettings extends formattingSettings.SimpleCard {
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
  displayName = 'Timeline Markers';
  slices = [this.showTodayLine, this.todayLineColor, this.clusterNearby, this.clusterThresholdDays];
}

export class TimelineMilestoneSettings extends formattingSettings.Model {
  timelineSettings = new TimelineSettings();
  markerSettings = new MarkerSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  timelineLayoutSettings = new TimelineLayoutSettings();
  timelineMarkerSettings = new TimelineMarkerSettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();
  conditionalFormattingCard = new ConditionalFormattingCard();
  accessibilityFormattingCard = new AccessibilityFormattingCard();

  colorThemeFormattingCard = new ColorThemeFormattingCard();
  cards = [
    this.timelineSettings,
    this.markerSettings,
    this.cardSettings,
    this.animationSettings,
    this.timelineLayoutSettings,
    this.timelineMarkerSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
    this.conditionalFormattingCard,
    this.accessibilityFormattingCard,
    this.colorThemeFormattingCard,
  ];
}
