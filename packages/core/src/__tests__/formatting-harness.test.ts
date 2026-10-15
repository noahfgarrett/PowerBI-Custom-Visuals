import { describe, expect, it } from 'vitest';

import { runSingleSettingCoverage } from '../__test-utils__/formatting-harness';

function createHarnessVisual() {
  const detailSlice = {
    name: 'detailColor',
    displayName: 'Detail Color',
    value: { value: '#123456' },
    visible: false,
  };
  const showSlice = {
    name: 'showDetails',
    displayName: 'Show Details',
    value: false,
    visible: true,
  };
  const settings = {
    detailSettings: {
      name: 'detailSettings',
      displayName: 'Detail Settings',
      slices: [showSlice, detailSlice],
      showDetails: showSlice,
      detailColor: detailSlice,
    },
    cards: [
      {
        name: 'detailSettings',
        displayName: 'Detail Settings',
        slices: [showSlice, detailSlice],
      },
    ],
  };
  const element = document.createElement('div');

  return {
    visual: {
      update: () => {
        detailSlice.visible = Boolean(showSlice.value);
        element.innerHTML = '<div class="static-visual"></div>';
      },
      getFormattingModel: () => ({ cards: settings.cards }),
    },
    settings,
    element,
  };
}

describe('formatting harness', () => {
  it('treats visibility-only changes as live formatting behavior', () => {
    const result = runSingleSettingCoverage(
      {
        createVisual: createHarnessVisual,
        dataView: {},
      },
      'detailSettings',
      'showDetails',
    );

    expect(result).not.toBeNull();
    expect(result?.domChanged).toBe(true);
    expect(result?.isPhantom).toBe(false);
  });
});
