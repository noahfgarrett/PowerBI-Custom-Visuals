/**
 * Shared formatting settings cards used across multiple Power BI custom visuals.
 * Import these into each visual's settings.ts and add to the Model's cards array.
 *
 * Card names use the 'Formatting' suffix (e.g. 'axisFormatting') to avoid
 * collisions with existing serialized card names (e.g. 'axisSettings').
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

// ── Axis Formatting ──────────────────────────────────────────────────

export class AxisFormattingCard extends formattingSettings.SimpleCard {
  axisLabelColor = new formattingSettings.ColorPicker({
    name: 'axisLabelColor',
    displayName: 'Label Color',
    value: { value: '' },
  });

  axisLabelSize = new formattingSettings.NumUpDown({
    name: 'axisLabelSize',
    displayName: 'Label Font Size',
    value: 11,
  });

  axisLineColor = new formattingSettings.ColorPicker({
    name: 'axisLineColor',
    displayName: 'Axis Line Color',
    value: { value: '' },
  });

  axisLineWidth = new formattingSettings.NumUpDown({
    name: 'axisLineWidth',
    displayName: 'Axis Line Width',
    value: 1,
  });

  showGridLines = new formattingSettings.ToggleSwitch({
    name: 'showGridLines',
    displayName: 'Show Grid Lines',
    value: true,
  });

  gridLineColor = new formattingSettings.ColorPicker({
    name: 'gridLineColor',
    displayName: 'Grid Line Color',
    value: { value: '' },
  });

  gridLineStyle = new formattingSettings.ItemDropdown({
    name: 'gridLineStyle',
    displayName: 'Grid Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
    ],
    value: { value: 'dashed', displayName: 'Dashed' },
  });

  name = 'axisFormatting';
  displayName = 'Axis Formatting';
  slices = [
    this.axisLabelColor,
    this.axisLabelSize,
    this.axisLineColor,
    this.axisLineWidth,
    this.showGridLines,
    this.gridLineColor,
    this.gridLineStyle,
  ];
}

// ── Legend Formatting ─────────────────────────────────────────────────

export class LegendFormattingCard extends formattingSettings.SimpleCard {
  showLegend = new formattingSettings.ToggleSwitch({
    name: 'showLegend',
    displayName: 'Show Legend',
    value: true,
  });

  legendPosition = new formattingSettings.ItemDropdown({
    name: 'legendPosition',
    displayName: 'Position',
    items: [
      { value: 'bottom', displayName: 'Bottom' },
      { value: 'top', displayName: 'Top' },
      { value: 'left', displayName: 'Left' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'bottom', displayName: 'Bottom' },
  });

  legendFontSize = new formattingSettings.NumUpDown({
    name: 'legendFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  legendFontColor = new formattingSettings.ColorPicker({
    name: 'legendFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  name = 'legendFormatting';
  displayName = 'Legend';
  slices = [
    this.showLegend,
    this.legendPosition,
    this.legendFontSize,
    this.legendFontColor,
  ];
}

// ── Data Label Formatting ────────────────────────────────────────────

export class DataLabelFormattingCard extends formattingSettings.SimpleCard {
  showDataLabels = new formattingSettings.ToggleSwitch({
    name: 'showDataLabels',
    displayName: 'Show Data Labels',
    value: false,
  });

  dataLabelFontSize = new formattingSettings.NumUpDown({
    name: 'dataLabelFontSize',
    displayName: 'Font Size',
    value: 11,
  });

  dataLabelFontColor = new formattingSettings.ColorPicker({
    name: 'dataLabelFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  dataLabelFontWeight = new formattingSettings.ItemDropdown({
    name: 'dataLabelFontWeight',
    displayName: 'Font Weight',
    items: [
      { value: 'normal', displayName: 'Normal' },
      { value: 'bold', displayName: 'Bold' },
    ],
    value: { value: 'normal', displayName: 'Normal' },
  });

  name = 'dataLabelFormatting';
  displayName = 'Data Labels';
  slices = [
    this.showDataLabels,
    this.dataLabelFontSize,
    this.dataLabelFontColor,
    this.dataLabelFontWeight,
  ];
}

// ── Title Formatting ─────────────────────────────────────────────────

export class TitleFormattingCard extends formattingSettings.SimpleCard {
  showTitle = new formattingSettings.ToggleSwitch({
    name: 'showTitle',
    displayName: 'Show Title',
    value: true,
  });

  titleText = new formattingSettings.TextInput({
    name: 'titleText',
    displayName: 'Title Text',
    value: '',
    placeholder: 'Chart Title',
  });

  titleFontSize = new formattingSettings.NumUpDown({
    name: 'titleFontSize',
    displayName: 'Font Size',
    value: 14,
  });

  titleFontColor = new formattingSettings.ColorPicker({
    name: 'titleFontColor',
    displayName: 'Font Color',
    value: { value: '' },
  });

  titleAlignment = new formattingSettings.ItemDropdown({
    name: 'titleAlignment',
    displayName: 'Alignment',
    items: [
      { value: 'left', displayName: 'Left' },
      { value: 'center', displayName: 'Center' },
      { value: 'right', displayName: 'Right' },
    ],
    value: { value: 'center', displayName: 'Center' },
  });

  name = 'titleFormatting';
  displayName = 'Chart Title';
  slices = [
    this.showTitle,
    this.titleText,
    this.titleFontSize,
    this.titleFontColor,
    this.titleAlignment,
  ];
}

// ── Line Stroke Formatting ───────────────────────────────────────────

export class LineStrokeFormattingCard extends formattingSettings.SimpleCard {
  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line Width',
    value: 2,
  });

  lineStyle = new formattingSettings.ItemDropdown({
    name: 'lineStyle',
    displayName: 'Line Style',
    items: [
      { value: 'solid', displayName: 'Solid' },
      { value: 'dashed', displayName: 'Dashed' },
      { value: 'dotted', displayName: 'Dotted' },
    ],
    value: { value: 'solid', displayName: 'Solid' },
  });

  name = 'lineStrokeFormatting';
  displayName = 'Line Stroke';
  slices = [this.lineWidth, this.lineStyle];
}

// ── Capabilities JSON Templates ──────────────────────────────────────

/** Merge these into a visual's capabilities.json `objects` block. */
export const CAPABILITIES_TEMPLATES: Record<string, Record<string, unknown>> = {
  axisFormatting: {
    displayName: 'Axis Formatting',
    properties: {
      axisLabelColor: { displayName: 'Label Color', type: { fill: { solid: { color: true } } } },
      axisLabelSize: { displayName: 'Label Font Size', type: { numeric: true } },
      axisLineColor: { displayName: 'Axis Line Color', type: { fill: { solid: { color: true } } } },
      axisLineWidth: { displayName: 'Axis Line Width', type: { numeric: true } },
      showGridLines: { displayName: 'Show Grid Lines', type: { bool: true } },
      gridLineColor: { displayName: 'Grid Line Color', type: { fill: { solid: { color: true } } } },
      gridLineStyle: { displayName: 'Grid Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }] } },
    },
  },
  legendFormatting: {
    displayName: 'Legend',
    properties: {
      showLegend: { displayName: 'Show Legend', type: { bool: true } },
      legendPosition: { displayName: 'Position', type: { enumeration: [{ value: 'bottom', displayName: 'Bottom' }, { value: 'top', displayName: 'Top' }, { value: 'left', displayName: 'Left' }, { value: 'right', displayName: 'Right' }] } },
      legendFontSize: { displayName: 'Font Size', type: { numeric: true } },
      legendFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
    },
  },
  dataLabelFormatting: {
    displayName: 'Data Labels',
    properties: {
      showDataLabels: { displayName: 'Show Data Labels', type: { bool: true } },
      dataLabelFontSize: { displayName: 'Font Size', type: { numeric: true } },
      dataLabelFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      dataLabelFontWeight: { displayName: 'Font Weight', type: { enumeration: [{ value: 'normal', displayName: 'Normal' }, { value: 'bold', displayName: 'Bold' }] } },
    },
  },
  titleFormatting: {
    displayName: 'Chart Title',
    properties: {
      showTitle: { displayName: 'Show Title', type: { bool: true } },
      titleText: { displayName: 'Title Text', type: { text: true } },
      titleFontSize: { displayName: 'Font Size', type: { numeric: true } },
      titleFontColor: { displayName: 'Font Color', type: { fill: { solid: { color: true } } } },
      titleAlignment: { displayName: 'Alignment', type: { enumeration: [{ value: 'left', displayName: 'Left' }, { value: 'center', displayName: 'Center' }, { value: 'right', displayName: 'Right' }] } },
    },
  },
  lineStrokeFormatting: {
    displayName: 'Line Stroke',
    properties: {
      lineWidth: { displayName: 'Line Width', type: { numeric: true } },
      lineStyle: { displayName: 'Line Style', type: { enumeration: [{ value: 'solid', displayName: 'Solid' }, { value: 'dashed', displayName: 'Dashed' }, { value: 'dotted', displayName: 'Dotted' }] } },
    },
  },
};
