import { describe, expect, it } from 'vitest';
import { focusHighlightedData } from '../interactivity';

describe('interactivity helpers', () => {
  it('returns all items when no highlights are active', () => {
    const items = [
      { label: 'A', highlighted: false },
      { label: 'B', highlighted: true },
    ];

    expect(focusHighlightedData(items, false)).toEqual(items);
  });

  it('filters to highlighted items when highlights are active', () => {
    const items = [
      { label: 'A', highlighted: false },
      { label: 'B', highlighted: true },
      { label: 'C', highlighted: false },
    ];

    expect(focusHighlightedData(items, true)).toEqual([
      { label: 'B', highlighted: true },
    ]);
  });

  it('falls back to the original items when highlight metadata is inconsistent', () => {
    const items = [
      { label: 'A', highlighted: false },
      { label: 'B', highlighted: false },
    ];

    expect(focusHighlightedData(items, true)).toEqual(items);
  });
});
