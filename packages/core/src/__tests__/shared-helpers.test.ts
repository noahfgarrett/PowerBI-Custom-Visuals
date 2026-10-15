import { describe, it, expect } from 'vitest';
import {
  allowInteractions,
  applyBasicHighContrastStyles,
  attachEmptySpaceContextMenu,
  getVisualEmptyStateMode,
  getHostHighContrastColors,
  hideInlineLegendFormatting,
  renderLandingPage,
  renderNoDataState,
  renderChartTitle,
  renderLegend,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
} from '../shared-helpers';
import { DateFilterFormattingCard, LegendFormattingCard, TitleFormattingCard } from '../shared-settings';

describe('shared helpers', () => {
  it('renders subtitle-only title blocks and honors spacing overrides', () => {
    const container = document.createElement('div');
    const settings = new TitleFormattingCard();
    settings.showTitle.value = false;
    settings.subtitleText.value = 'Only subtitle';

    renderChartTitle(container, settings, {
      titlePaddingBottom: 15,
      subtitlePaddingBottom: 9,
    });

    expect(container.querySelector('.chart-title')).toBeNull();
    const subtitle = container.querySelector<HTMLElement>('.chart-subtitle');
    expect(subtitle?.textContent).toBe('Only subtitle');
    expect(subtitle?.style.marginBottom).toBe('9px');
  });

  it('renders title and subtitle spacing independently', () => {
    const container = document.createElement('div');
    const settings = new TitleFormattingCard();
    settings.titleText.value = 'Main title';
    settings.subtitleText.value = 'Sub title';

    renderChartTitle(container, settings, {
      titlePaddingBottom: 18,
      subtitlePaddingBottom: 7,
    });

    const title = container.querySelector<HTMLElement>('.chart-title');
    const subtitle = container.querySelector<HTMLElement>('.chart-subtitle');

    expect(title?.style.marginBottom).toBe('18px');
    expect(subtitle?.style.marginBottom).toBe('7px');
    expect(title?.getAttribute('role')).toBe('heading');
    expect(title?.style.overflowWrap).toBe('anywhere');
    expect(subtitle?.style.overflowWrap).toBe('anywhere');
    expect(container.firstElementChild).toBe(title);
    expect(container.children[1]).toBe(subtitle);
  });

  it('syncs title pane visibility from the title toggle', () => {
    const settings = new TitleFormattingCard();
    settings.showTitle.value = false;

    syncTitleFormattingVisibility(settings);

    expect(settings.titleText.visible).toBe(false);
    expect(settings.titleFontSize.visible).toBe(false);
    expect(settings.titleFontColor.visible).toBe(false);
    expect(settings.titleFontFamily.visible).toBe(false);
    expect(settings.titleFontWeight.visible).toBe(false);
    expect(settings.titleAlignment.visible).toBe(false);
    expect(settings.subtitleText.visible).toBe(false);
    expect(settings.subtitleFontSize.visible).toBe(false);
    expect(settings.subtitleFontColor.visible).toBe(false);
    expect(settings.subtitleFontFamily.visible).toBe(false);
    expect(settings.subtitleFontWeight.visible).toBe(false);

    settings.showTitle.value = true;
    syncTitleFormattingVisibility(settings);

    expect(settings.titleText.visible).toBe(true);
    expect(settings.subtitleText.visible).toBe(true);
  });

  it('syncs legend pane visibility from legend toggles', () => {
    const settings = new LegendFormattingCard();
    settings.showLegend.value = false;
    settings.showInlineLabels.value = true;

    syncLegendFormattingVisibility(settings);

    expect(settings.legendPosition.visible).toBe(false);
    expect(settings.legendFontSize.visible).toBe(false);
    expect(settings.legendAliases.visible).toBe(false);
    expect(settings.showInlineLabels.visible).toBe(false);
    expect(settings.inlineLabelFontSize.visible).toBe(false);
    expect(settings.inlineLabelOffset.visible).toBe(false);

    settings.showLegend.value = true;
    settings.showInlineLabels.value = true;
    syncLegendFormattingVisibility(settings);

    expect(settings.legendPosition.visible).toBe(true);
    expect(settings.legendFontSize.visible).toBe(true);
    expect(settings.legendAliases.visible).toBe(true);
    expect(settings.showInlineLabels.visible).toBe(true);
    expect(settings.inlineLabelFontSize.visible).toBe(true);
    expect(settings.inlineLabelOffset.visible).toBe(true);
  });

  it('hides inline legend controls for visuals that do not support them', () => {
    const settings = new LegendFormattingCard();
    settings.showLegend.value = true;
    settings.showInlineLabels.value = true;

    syncLegendFormattingVisibility(settings);
    hideInlineLegendFormatting(settings);

    expect(settings.showInlineLabels.visible).toBe(false);
    expect(settings.inlineLabelFontSize.visible).toBe(false);
    expect(settings.inlineLabelOffset.visible).toBe(false);
  });

  it('syncs date filter pane visibility from date filter toggles', () => {
    const settings = new DateFilterFormattingCard();
    settings.enableDateFilter.value = false;
    settings.endAtCurrentDate.value = true;

    syncDateFilterFormattingVisibility(settings);

    expect(settings.startDate.visible).toBe(false);
    expect(settings.endAtCurrentDate.visible).toBe(false);
    expect(settings.endDate.visible).toBe(false);

    settings.enableDateFilter.value = true;
    settings.endAtCurrentDate.value = false;
    syncDateFilterFormattingVisibility(settings);

    expect(settings.startDate.visible).toBe(true);
    expect(settings.endAtCurrentDate.visible).toBe(true);
    expect(settings.endDate.visible).toBe(true);
  });

  it('syncs card style pane visibility from the card style mode', () => {
    const settings = {
      cardStyleMode: { value: { value: 'none', displayName: 'None' } },
      backgroundOpacity: { visible: true },
      backgroundColor: { visible: true },
      borderRadius: { visible: true },
    };

    syncCardStyleVisibility(settings);
    expect(settings.backgroundOpacity.visible).toBe(false);
    expect(settings.backgroundColor.visible).toBe(false);
    expect(settings.borderRadius.visible).toBe(false);

    settings.cardStyleMode.value = { value: 'glass', displayName: 'Frosted Glass' };
    syncCardStyleVisibility(settings);
    expect(settings.backgroundOpacity.visible).toBe(true);
    expect(settings.backgroundColor.visible).toBe(true);
    expect(settings.borderRadius.visible).toBe(true);
  });

  it('opens the empty-space context menu on right click', () => {
    const container = document.createElement('div');
    const calls: Array<{ key: string; x: number; y: number }> = [];
    const cleanup = attachEmptySpaceContextMenu(
      container,
      {
        showContextMenu: (selectionId: { getKey: () => string }, position: { x: number; y: number }) => {
          calls.push({ key: selectionId.getKey(), x: position.x, y: position.y });
          return Promise.resolve({});
        },
      } as never,
      () => ({
        getKey: () => 'empty-selection',
      }) as never,
    );

    container.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 42,
      clientY: 24,
    }));

    expect(calls).toEqual([{ key: 'empty-selection', x: 42, y: 24 }]);
    cleanup();
  });

  it('skips the empty-space context menu when disabled', () => {
    const container = document.createElement('div');
    const calls: Array<{ key: string; x: number; y: number }> = [];
    const cleanup = attachEmptySpaceContextMenu(
      container,
      {
        showContextMenu: (selectionId: { getKey: () => string }, position: { x: number; y: number }) => {
          calls.push({ key: selectionId.getKey(), x: position.x, y: position.y });
          return Promise.resolve({});
        },
      } as never,
      () => ({
        getKey: () => 'empty-selection',
      }) as never,
      () => false,
    );

    container.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 42,
      clientY: 24,
    }));

    expect(calls).toEqual([]);
    cleanup();
  });

  it('respects host allowInteractions when present', () => {
    expect(allowInteractions({} as never)).toBe(true);
    expect(allowInteractions({
      hostCapabilities: { allowInteractions: true },
    } as never)).toBe(true);
    expect(allowInteractions({
      hostCapabilities: { allowInteractions: false },
    } as never)).toBe(false);
  });

  it('reads high-contrast colors from the host palette', () => {
    const colors = getHostHighContrastColors({
      colorPalette: {
        isHighContrast: true,
        foreground: { value: '#111111' },
        background: '#F8F8F8',
        foregroundSelected: '#222222',
        hyperlink: '#3333FF',
      },
    } as never);

    expect(colors).toEqual({
      enabled: true,
      foreground: '#111111',
      background: '#F8F8F8',
      foregroundSelected: '#222222',
      hyperlink: '#3333FF',
    });
  });

  it('renders a landing page shell with steps and hint text', () => {
    const container = document.createElement('div');

    const shell = renderLandingPage(container, {
      title: 'Build your chart',
      description: 'Add the required fields to start rendering.',
      steps: ['Add a category', 'Add a value'],
      hint: 'Formatting options appear after data is bound.',
    });

    expect(container.querySelector('.pbi-landing-page')).toBe(shell);
    expect(shell.querySelector('.pbi-landing-page-title')?.textContent).toBe('Build your chart');
    expect(shell.querySelectorAll('.pbi-landing-page-steps li')).toHaveLength(2);
    expect(shell.querySelector('.pbi-landing-page-hint')?.textContent).toContain('Formatting options');
    expect(shell.getAttribute('role')).toBe('region');
    expect(shell.getAttribute('aria-label')).toBe('Build your chart');
    expect(shell.style.width).toBe('calc(100% - 24px)');
    expect(shell.style.overflowY).toBe('auto');
  });

  it('classifies empty state mode from bound fields', () => {
    expect(getVisualEmptyStateMode(undefined as never)).toBe('unconfigured');
    expect(getVisualEmptyStateMode({
      metadata: { columns: [] },
    } as never)).toBe('unconfigured');
    expect(getVisualEmptyStateMode({
      metadata: {
        columns: [{ roles: { category: true } }],
      },
    } as never)).toBe('noData');
  });

  it('renders a no-data shell', () => {
    const container = document.createElement('div');
    const shell = renderNoDataState(container, 'No data for the current selection.');

    expect(shell.className).toBe('pbi-no-data-state');
    expect(shell.textContent).toBe('No data for the current selection.');
    expect(shell.getAttribute('role')).toBe('status');
    expect(shell.getAttribute('aria-live')).toBe('polite');
    expect(shell.style.width).toBe('calc(100% - 24px)');
  });

  it('applies shared high-contrast text, line, and fill styling', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <svg>
        <text class="label">Hello</text>
        <line class="axis"></line>
        <rect class="bar"></rect>
      </svg>
      <div class="legend-text">Legend</div>
    `;

    applyBasicHighContrastStyles(container, {
      enabled: true,
      foreground: '#101010',
      background: '#FAFAFA',
      foregroundSelected: '#202020',
      hyperlink: '#0000FF',
    }, {
      textSelectors: ['.label', '.legend-text'],
      lineSelectors: ['.axis'],
      fillSelectors: ['.bar'],
    });

    const text = container.querySelector('.label');
    const line = container.querySelector('.axis');
    const fill = container.querySelector('.bar');
    const legend = container.querySelector<HTMLElement>('.legend-text');

    expect(container.style.backgroundColor).toBe('rgb(250, 250, 250)');
    expect(text?.getAttribute('fill')).toBe('#101010');
    expect(line?.getAttribute('stroke')).toBe('#101010');
    expect(fill?.getAttribute('fill')).toBe('#FAFAFA');
    expect(fill?.getAttribute('stroke')).toBe('#101010');
    expect(legend?.style.color).toBe('rgb(16, 16, 16)');

    applyBasicHighContrastStyles(container, {
      enabled: false,
      foreground: '#000000',
      background: '#FFFFFF',
      foregroundSelected: '#000000',
      hyperlink: '#0000FF',
    });

    expect(container.style.backgroundColor).toBe('');
    expect(text?.getAttribute('fill')).toBeNull();
    expect(line?.getAttribute('stroke')).toBeNull();
    expect(fill?.getAttribute('fill')).toBeNull();
    expect(fill?.getAttribute('stroke')).toBeNull();
    expect(legend?.style.color).toBe('');
  });

  it('applies configurable legend padding and spacing', () => {
    const container = document.createElement('div');
    const legend = renderLegend(container, {
      items: [
        { label: 'Sales', color: '#2563EB' },
        { label: 'Profit', color: '#16A34A' },
      ],
      position: 'top',
      fontSize: 12,
      fontColor: '#0F172A',
      fontFamily: 'Georgia',
      fontWeight: 'bold',
      paddingX: 14,
      paddingY: 6,
      itemGap: 10,
      entryGap: 5,
      swatchSize: 14,
    });

    const item = legend.querySelector<HTMLElement>('.pbi-legend-item');
    const swatch = legend.querySelector<HTMLElement>('.pbi-legend-item span');

    expect(legend.style.padding).toBe('6px 14px');
    expect(legend.style.gap).toBe('10px');
    expect(item?.style.gap).toBe('5px');
    expect(swatch?.style.width).toBe('14px');
    expect(swatch?.style.height).toBe('14px');
    expect(legend.style.fontFamily).toContain('Georgia');
    expect(legend.getAttribute('role')).toBe('list');
    expect(legend.style.maxWidth).toBe('100%');
    const label = item?.querySelector<HTMLElement>('span:last-child');
    expect(label?.style.textOverflow).toBe('ellipsis');
    expect(label?.title).toBe('Sales');
  });

  it('makes interactive legend entries keyboard operable', () => {
    const container = document.createElement('div');
    let clicks = 0;
    const legend = renderLegend(container, {
      items: [{ label: 'Sales', color: '#2563EB', filtered: false }],
      position: 'bottom',
      fontSize: 12,
      fontColor: '#0F172A',
      aliases: 'Revenue',
      onItemClick: () => { clicks += 1; },
    });

    const item = legend.querySelector<HTMLElement>('.pbi-legend-item');
    expect(legend.getAttribute('role')).toBe('group');
    expect(item?.getAttribute('role')).toBe('button');
    expect(item?.getAttribute('aria-label')).toBe('Revenue');
    expect(item?.getAttribute('aria-pressed')).toBe('true');
    expect(item?.tabIndex).toBe(0);

    item?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    item?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(clicks).toBe(2);
  });
});
