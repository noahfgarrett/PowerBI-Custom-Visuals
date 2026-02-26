import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

import { TitleFormattingCard } from '../../core/src';
class IndicatorSettings extends formattingSettings.SimpleCard {
  shape = new formattingSettings.ItemDropdown({
    name: 'shape', displayName: 'Shape',
    items: [{ value: 'circle', displayName: 'Circle' }, { value: 'square', displayName: 'Square' }, { value: 'diamond', displayName: 'Diamond' }],
    value: { value: 'circle', displayName: 'Circle' },
  });
  size = new formattingSettings.NumUpDown({ name: 'size', displayName: 'Size', value: 16 });
  layout = new formattingSettings.ItemDropdown({
    name: 'layout', displayName: 'Layout',
    items: [{ value: 'vertical', displayName: 'Vertical' }, { value: 'horizontal', displayName: 'Horizontal' }, { value: 'grid', displayName: 'Grid' }],
    value: { value: 'vertical', displayName: 'Vertical' },
  });

  iconSize = new formattingSettings.NumUpDown({
    name: 'iconSize',
    displayName: 'Icon Size',
    value: 24,
  });
  labelColor = new formattingSettings.ColorPicker({
    name: 'labelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  name = 'indicatorSettings';
  displayName = 'Indicator';
  slices = [this.shape, this.size, this.layout, this.iconSize, this.labelColor];
}

class ThresholdSettings extends formattingSettings.SimpleCard {
  goodColor = new formattingSettings.ColorPicker({ name: 'goodColor', displayName: 'Good Color', value: { value: '#34D399' } });
  warningColor = new formattingSettings.ColorPicker({ name: 'warningColor', displayName: 'Warning Color', value: { value: '#FBBF24' } });
  criticalColor = new formattingSettings.ColorPicker({ name: 'criticalColor', displayName: 'Critical Color', value: { value: '#EF4444' } });
  direction = new formattingSettings.ItemDropdown({
    name: 'direction', displayName: 'Direction',
    items: [{ value: 'higherIsBetter', displayName: 'Higher is Better' }, { value: 'lowerIsBetter', displayName: 'Lower is Better' }],
    value: { value: 'higherIsBetter', displayName: 'Higher is Better' },
  });
  name = 'thresholdSettings';
  displayName = 'Thresholds';
  slices = [this.goodColor, this.warningColor, this.criticalColor, this.direction];
}

class PulseSettings extends formattingSettings.SimpleCard {
  enablePulse = new formattingSettings.ToggleSwitch({ name: 'enablePulse', displayName: 'Pulse Critical', value: true });
  name = 'pulseSettings';
  displayName = 'Pulse';
  slices = [this.enablePulse];
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

export class StatusIndicatorSettings extends formattingSettings.Model {
  indicatorSettings = new IndicatorSettings();
  thresholdSettings = new ThresholdSettings();
  pulseSettings = new PulseSettings();
  cardSettings = new CardStyleSettings();
  animationSettings = new AnimationSettings();
  titleFormattingCard = new TitleFormattingCard();

  cards = [this.indicatorSettings, this.thresholdSettings, this.pulseSettings,
 this.cardSettings,
    this.animationSettings, this.titleFormattingCard];
}
