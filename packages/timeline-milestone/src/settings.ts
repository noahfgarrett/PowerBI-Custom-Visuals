import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
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
  backgroundOpacity = new formattingSettings.NumUpDown({ name: 'backgroundOpacity', displayName: 'Background Opacity (%)', value: 35 });
  borderRadius = new formattingSettings.NumUpDown({ name: 'borderRadius', displayName: 'Border Radius', value: 12 });
  name = 'cardSettings';
  displayName = 'Card Style';
  slices = [this.backgroundOpacity, this.borderRadius];
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
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();
  axisFormattingCard = new AxisFormattingCard();

  cards = [this.timelineSettings, this.markerSettings,
 this.cardSettings,
    this.animationSettings, this.dataLabelFormattingCard, this.titleFormattingCard, this.axisFormattingCard];
}
