import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard } from '../../core/src';
class CalendarSettings extends formattingSettings.SimpleCard {
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

  cellCornerRadius = new formattingSettings.NumUpDown({

    name: 'cellCornerRadius',

    displayName: 'Cell Corner Radius',

    value: 2,

  });

  labelColor = new formattingSettings.ColorPicker({

    name: 'labelColor',

    displayName: 'Label Color',

    value: { value: '' },

  });


  name = 'calendarSettings';
  displayName = 'Calendar';
  slices = [this.cellSize, this.cellGap, this.showMonthLabels, this.showDayLabels, this.cellStrokeColor, this.cellStrokeWidth, this.cellCornerRadius, this.labelColor];
}

class ColorSettings extends formattingSettings.SimpleCard {
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

  emptyColor = new formattingSettings.ColorPicker({
    name: 'emptyColor',
    displayName: 'Empty Cell Color',
    value: { value: '#F1F5F9' },
  });

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

  name = 'colorSettings';
  displayName = 'Colors';
  slices = [
    this.lowColor,
    this.highColor,
    this.showMidColor,
    this.midColor,
    this.midPoint,
    this.emptyColor,
    this.showLegend,
    this.legendPosition,
  ];
}

class CardStyleSettings extends formattingSettings.SimpleCard {
  enableGlass = new formattingSettings.ToggleSwitch({
    name: 'enableGlass',
    displayName: 'Glass Effect',
    value: true,
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
  slices = [this.backgroundOpacity, this.borderRadius];
}

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

export class HeatmapCalendarSettings extends formattingSettings.Model {
  calendarSettings = new CalendarSettings();
  colorSettings = new ColorSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();

  dataLabelFormattingCard = new DataLabelFormattingCard();

  titleFormattingCard = new TitleFormattingCard();

  axisFormattingCard = new AxisFormattingCard();

  cards = [
    this.calendarSettings,
    this.colorSettings,
    this.cardSettings,
    this.animationSettings,
    this.dataLabelFormattingCard,
    this.titleFormattingCard,
    this.axisFormattingCard,
  ];
}
