import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class RadarSettings extends formattingSettings.SimpleCard {
  showGrid = new formattingSettings.ToggleSwitch({ name: 'showGrid', displayName: 'Show Grid', value: true });
  gridLevels = new formattingSettings.NumUpDown({ name: 'gridLevels', displayName: 'Grid Levels', value: 5 });
  fillOpacity = new formattingSettings.NumUpDown({ name: 'fillOpacity', displayName: 'Fill Opacity (%)', value: 25 });
  showDots = new formattingSettings.ToggleSwitch({ name: 'showDots', displayName: 'Show Dots', value: true });
  dotRadius = new formattingSettings.NumUpDown({ name: 'dotRadius', displayName: 'Dot Radius', value: 4 });

  gridShape = new formattingSettings.ItemDropdown({
    name: 'gridShape',
    displayName: 'Grid Shape',
    items: [
      { value: 'polygon', displayName: 'Polygon' },
      { value: 'circle', displayName: 'Circle' },
    ],
    value: { value: 'polygon', displayName: 'Polygon' },
  });

  webStrokeColor = new formattingSettings.ColorPicker({
    name: 'webStrokeColor',
    displayName: 'Web Stroke Color',
    value: { value: '' },
  });
  webStrokeWidth = new formattingSettings.NumUpDown({
    name: 'webStrokeWidth',
    displayName: 'Web Stroke Width',
    value: 1,
  });
  webFillOpacity = new formattingSettings.NumUpDown({
    name: 'webFillOpacity',
    displayName: 'Web Fill Opacity (%)',
    value: 15,
  });
  areaOpacity = new formattingSettings.NumUpDown({
    name: 'areaOpacity',
    displayName: 'Area Opacity (%)',
    value: 30,
  });

  name = 'radarSettings';
  displayName = 'Radar';
  slices = [this.showGrid, this.gridLevels, this.gridShape, this.fillOpacity, this.showDots, this.dotRadius, this.webStrokeColor, this.webStrokeWidth, this.webFillOpacity, this.areaOpacity];
}

class LegendSettings extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({ name: 'show', displayName: 'Show Legend', value: true });
  name = 'legendSettings';
  displayName = 'Legend';
  slices = [this.show];
}

class ColorSettings extends formattingSettings.SimpleCard {
  useChartPalette = new formattingSettings.ToggleSwitch({ name: 'useChartPalette', displayName: 'Use Chart Palette', value: true });
  name = 'colorSettings';
  displayName = 'Colors';
  slices = [this.useChartPalette];
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

export class RadarChartSettings extends formattingSettings.Model {
  radarSettings = new RadarSettings();
  legendSettings = new LegendSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  axisFormattingCard = new AxisFormattingCard();
  legendFormattingCard = new LegendFormattingCard();
  dataLabelFormattingCard = new DataLabelFormattingCard();
  titleFormattingCard = new TitleFormattingCard();

  cards = [this.radarSettings, this.legendSettings, this.colorSettings,
 this.cardSettings,
    this.animationSettings, this.axisFormattingCard, this.legendFormattingCard, this.dataLabelFormattingCard, this.titleFormattingCard];
}
