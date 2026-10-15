import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

const TAB_ITEMS = [
  { value: 'basic', displayName: 'Basic', displayNameKey: 'FilterPaneProSettings_DisplayName_0008' },
  { value: 'advanced', displayName: 'Advanced', displayNameKey: 'FilterPaneProSettings_DisplayName_0009' },
];

class IconSettings extends formattingSettings.SimpleCard {
  position = new formattingSettings.ItemDropdown({
    name: 'position',
    displayName: 'Button Position', displayNameKey: 'FilterPaneProSettings_DisplayName_0010',
    items: [
      { value: 'topLeft', displayName: 'Top Left', displayNameKey: 'FilterPaneProSettings_DisplayName_0011' },
      { value: 'topRight', displayName: 'Top Right', displayNameKey: 'FilterPaneProSettings_DisplayName_0012' },
      { value: 'bottomLeft', displayName: 'Bottom Left', displayNameKey: 'FilterPaneProSettings_DisplayName_0013' },
      { value: 'bottomRight', displayName: 'Bottom Right', displayNameKey: 'FilterPaneProSettings_DisplayName_0014' },
      { value: 'center', displayName: 'Center', displayNameKey: 'FilterPaneProSettings_DisplayName_0015' },
    ],
    value: { value: 'topRight', displayName: 'Top Right', displayNameKey: 'FilterPaneProSettings_DisplayName_0016' },
  });

  style = new formattingSettings.ItemDropdown({
    name: 'style',
    displayName: 'Button Style', displayNameKey: 'FilterPaneProSettings_DisplayName_0017',
    items: [
      { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'FilterPaneProSettings_DisplayName_0018' },
      { value: 'solid', displayName: 'Solid', displayNameKey: 'FilterPaneProSettings_DisplayName_0019' },
      { value: 'outline', displayName: 'Outline', displayNameKey: 'FilterPaneProSettings_DisplayName_0020' },
      { value: 'minimal', displayName: 'Minimal', displayNameKey: 'FilterPaneProSettings_DisplayName_0021' },
    ],
    value: { value: 'glass', displayName: 'Frosted Glass', displayNameKey: 'FilterPaneProSettings_DisplayName_0022' },
  });

  size = new formattingSettings.NumUpDown({
    name: 'size',
    displayName: 'Button Size (px)', displayNameKey: 'FilterPaneProSettings_DisplayName_0023',
    value: 42,
  });

  iconColor = new formattingSettings.ColorPicker({
    name: 'iconColor',
    displayName: 'Icon Color', displayNameKey: 'FilterPaneProSettings_DisplayName_0024',
    value: { value: '#172033' },
  });

  glassColor = new formattingSettings.ColorPicker({
    name: 'glassColor',
    displayName: 'Button Background', displayNameKey: 'FilterPaneProSettings_DisplayName_0025',
    value: { value: '#FFFFFF' },
  });

  glassOpacity = new formattingSettings.NumUpDown({
    name: 'glassOpacity',
    displayName: 'Glass Opacity (%)', displayNameKey: 'FilterPaneProSettings_DisplayName_0026',
    value: 76,
  });

  name = 'iconSettings';
  displayName = 'Filter Button';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0001';
  slices = [this.position, this.style, this.size, this.iconColor, this.glassColor, this.glassOpacity];
}

class PaneSettings extends formattingSettings.SimpleCard {
  side = new formattingSettings.ItemDropdown({
    name: 'side',
    displayName: 'Opening Position', displayNameKey: 'FilterPaneProSettings_DisplayName_0027',
    items: [
      { value: 'right', displayName: 'Right', displayNameKey: 'FilterPaneProSettings_DisplayName_0028' },
      { value: 'left', displayName: 'Left', displayNameKey: 'FilterPaneProSettings_DisplayName_0029' },
      { value: 'top', displayName: 'Top', displayNameKey: 'FilterPaneProSettings_DisplayName_0030' },
      { value: 'bottom', displayName: 'Bottom', displayNameKey: 'FilterPaneProSettings_DisplayName_0031' },
      { value: 'modal', displayName: 'Centered Modal', displayNameKey: 'FilterPaneProSettings_DisplayName_0032' },
    ],
    value: { value: 'right', displayName: 'Right', displayNameKey: 'FilterPaneProSettings_DisplayName_0033' },
  });

  defaultOpen = new formattingSettings.ToggleSwitch({
    name: 'defaultOpen',
    displayName: 'Open by Default', displayNameKey: 'FilterPaneProSettings_DisplayName_0034',
    value: false,
  });

  columnCount = new formattingSettings.ItemDropdown({
    name: 'columnCount',
    displayName: 'Filter Columns', displayNameKey: 'FilterPaneProSettings_DisplayName_0035',
    items: [
      { value: 'auto', displayName: 'Auto', displayNameKey: 'FilterPaneProSettings_DisplayName_0036' },
      { value: '1', displayName: '1 Column', displayNameKey: 'FilterPaneProSettings_DisplayName_0037' },
      { value: '2', displayName: '2 Columns', displayNameKey: 'FilterPaneProSettings_DisplayName_0038' },
      { value: '3', displayName: '3 Columns', displayNameKey: 'FilterPaneProSettings_DisplayName_0039' },
    ],
    value: { value: 'auto', displayName: 'Auto', displayNameKey: 'FilterPaneProSettings_DisplayName_0040' },
  });

  width = new formattingSettings.NumUpDown({
    name: 'width',
    displayName: 'Pane Width (px)', displayNameKey: 'FilterPaneProSettings_DisplayName_0041',
    value: 360,
  });

  maxHeight = new formattingSettings.NumUpDown({
    name: 'maxHeight',
    displayName: 'Maximum Height (px)', displayNameKey: 'FilterPaneProSettings_DisplayName_0042',
    value: 520,
  });

  accentColor = new formattingSettings.ColorPicker({
    name: 'accentColor',
    displayName: 'Accent Color', displayNameKey: 'FilterPaneProSettings_DisplayName_0043',
    value: { value: '#2F6FED' },
  });

  textColor = new formattingSettings.ColorPicker({
    name: 'textColor',
    displayName: 'Text Color', displayNameKey: 'FilterPaneProSettings_DisplayName_0044',
    value: { value: '#172033' },
  });

  fontSize = new formattingSettings.NumUpDown({
    name: 'fontSize',
    displayName: 'Font Size', displayNameKey: 'FilterPaneProSettings_DisplayName_0045',
    value: 12,
  });

  name = 'paneSettings';
  displayName = 'Filter Pane';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0002';
  slices = [
    this.side,
    this.defaultOpen,
    this.columnCount,
    this.width,
    this.maxHeight,
    this.accentColor,
    this.textColor,
    this.fontSize,
  ];
}

class OverlaySettings extends formattingSettings.SimpleCard {
  overlayColor = new formattingSettings.ColorPicker({
    name: 'overlayColor',
    displayName: 'Overlay Color', displayNameKey: 'FilterPaneProSettings_DisplayName_0046',
    value: { value: '#111827' },
  });

  overlayOpacity = new formattingSettings.NumUpDown({
    name: 'overlayOpacity',
    displayName: 'Overlay Opacity (%)', displayNameKey: 'FilterPaneProSettings_DisplayName_0047',
    value: 36,
  });

  blurRadius = new formattingSettings.NumUpDown({
    name: 'blurRadius',
    displayName: 'Blur Radius (px)', displayNameKey: 'FilterPaneProSettings_DisplayName_0048',
    value: 7,
  });

  name = 'overlaySettings';
  displayName = 'Backdrop';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0003';
  slices = [this.overlayColor, this.overlayOpacity, this.blurRadius];
}

class PanelAppearanceSettings extends formattingSettings.SimpleCard {
  backgroundColor = new formattingSettings.ColorPicker({
    name: 'backgroundColor',
    displayName: 'Panel Background', displayNameKey: 'FilterPaneProSettings_DisplayName_0049',
    value: { value: '#FFFFFF' },
  });

  backgroundOpacity = new formattingSettings.NumUpDown({
    name: 'backgroundOpacity',
    displayName: 'Panel Opacity (%)', displayNameKey: 'FilterPaneProSettings_DisplayName_0050',
    value: 88,
  });

  borderRadius = new formattingSettings.NumUpDown({
    name: 'borderRadius',
    displayName: 'Corner Radius', displayNameKey: 'FilterPaneProSettings_DisplayName_0051',
    value: 8,
  });

  contentPadding = new formattingSettings.NumUpDown({
    name: 'contentPadding',
    displayName: 'Panel Padding', displayNameKey: 'FilterPaneProSettings_DisplayName_0052',
    value: 12,
  });

  name = 'cardSettings';
  displayName = 'Panel Appearance';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0005';
  slices = [this.backgroundColor, this.backgroundOpacity, this.borderRadius, this.contentPadding];
}

class AnimationSettings extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enable Animation', displayNameKey: 'FilterPaneProSettings_DisplayName_0053',
    value: true,
  });

  duration = new formattingSettings.NumUpDown({
    name: 'duration',
    displayName: 'Duration (ms)', displayNameKey: 'FilterPaneProSettings_DisplayName_0054',
    value: 160,
  });

  name = 'animationSettings';
  displayName = 'Animation';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0006';
  slices = [this.enabled, this.duration];
}

class BehaviorSettings extends formattingSettings.SimpleCard {
  defaultTab = new formattingSettings.ItemDropdown({
    name: 'defaultTab',
    displayName: 'Starting Tab', displayNameKey: 'FilterPaneProSettings_DisplayName_0055',
    items: TAB_ITEMS,
    value: { value: 'basic', displayName: 'Basic', displayNameKey: 'FilterPaneProSettings_DisplayName_0056' },
  });

  applyMode = new formattingSettings.ItemDropdown({
    name: 'applyMode',
    displayName: 'Apply Changes', displayNameKey: 'FilterPaneProSettings_DisplayName_0057',
    items: [
      { value: 'manual', displayName: 'With Apply Button', displayNameKey: 'FilterPaneProSettings_DisplayName_0058' },
      { value: 'immediate', displayName: 'Immediately', displayNameKey: 'FilterPaneProSettings_DisplayName_0059' },
    ],
    value: { value: 'manual', displayName: 'With Apply Button', displayNameKey: 'FilterPaneProSettings_DisplayName_0060' },
  });

  persistenceMode = new formattingSettings.ItemDropdown({
    name: 'persistenceMode',
    displayName: 'Filter State', displayNameKey: 'FilterPaneProSettings_DisplayName_0061',
    items: [
      { value: 'bookmark', displayName: 'Follow Report Filters', displayNameKey: 'FilterPaneProSettings_DisplayName_0062' },
      { value: 'manual', displayName: 'Keep Current Session', displayNameKey: 'FilterPaneProSettings_DisplayName_0063' },
    ],
    value: { value: 'bookmark', displayName: 'Follow Report Filters', displayNameKey: 'FilterPaneProSettings_DisplayName_0064' },
  });

  bookmarkOverlayMode = new formattingSettings.ToggleSwitch({
    name: 'bookmarkOverlayMode',
    displayName: 'Always-Open Bookmark Layout', displayNameKey: 'FilterPaneProSettings_DisplayName_0065',
    value: false,
  });

  activeTab = new formattingSettings.TextInput({
    name: 'activeTab',
    displayName: 'Saved Active Tab', displayNameKey: 'FilterPaneProSettings_DisplayName_0066',
    value: '',
    placeholder: '', placeholderKey: 'FilterPaneProSettings_Placeholder_0001',
    visible: false,
  });

  name = 'behaviorSettings';
  displayName = 'Behavior';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0004';
  slices = [this.defaultTab, this.applyMode, this.persistenceMode, this.bookmarkOverlayMode, this.activeTab];
}

class AccessibilitySettings extends formattingSettings.SimpleCard {
  focusPaneOnOpen = new formattingSettings.ToggleSwitch({
    name: 'focusPaneOnOpen',
    displayName: 'Focus Pane on Open', displayNameKey: 'FilterPaneProSettings_DisplayName_0067',
    value: true,
  });

  announceFilterChanges = new formattingSettings.ToggleSwitch({
    name: 'announceFilterChanges',
    displayName: 'Announce Filter Changes', displayNameKey: 'FilterPaneProSettings_DisplayName_0068',
    value: true,
  });

  paneAriaLabel = new formattingSettings.TextInput({
    name: 'paneAriaLabel',
    displayName: 'Screen Reader Label', displayNameKey: 'FilterPaneProSettings_DisplayName_0069',
    value: 'Filter Pane Pro',
    placeholder: 'Filter Pane Pro', placeholderKey: 'FilterPaneProSettings_Placeholder_0002',
  });

  name = 'accessibilitySettings';
  displayName = 'Accessibility';
  displayNameKey = 'FilterPaneProSettings_DisplayName_0007';
  slices = [this.focusPaneOnOpen, this.announceFilterChanges, this.paneAriaLabel];
}

export class FilterPaneProSettings extends formattingSettings.Model {
  iconSettings = new IconSettings();
  paneSettings = new PaneSettings();
  overlaySettings = new OverlaySettings();
  cardSettings = new PanelAppearanceSettings();
  animationSettings = new AnimationSettings();
  behaviorSettings = new BehaviorSettings();
  accessibilitySettings = new AccessibilitySettings();

  cards = [
    this.iconSettings,
    this.paneSettings,
    this.behaviorSettings,
    this.overlaySettings,
    this.cardSettings,
    this.animationSettings,
    this.accessibilitySettings,
  ];
}
