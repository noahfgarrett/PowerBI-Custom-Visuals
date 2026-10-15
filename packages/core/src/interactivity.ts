import powerbi from 'powerbi-visuals-api';

import ISelectionId = powerbi.visuals.ISelectionId;

export interface HighlightSeriesLike {
  highlights: Array<number | null | undefined>;
}

export interface HighlightedDatumLike {
  highlighted?: boolean;
}

export interface ApplyLinkedStateOptions {
  root: ParentNode;
  selector: string;
  selectedKeys?: Set<string>;
  highlightedKeys?: Set<string>;
  dimOpacity?: string;
  activeOpacity?: string;
  clearOpacity?: string;
  keyAttribute?: string;
}

export interface CategoryBand {
  index: number;
  center: number;
  x: number;
  width: number;
}

export function buildHighlightedCategoryKeys(
  categorySelectionIds: ISelectionId[],
  series: HighlightSeriesLike[],
): Set<string> {
  const highlightedKeys = new Set<string>();
  const highlightedIndices = new Set<number>();

  for (const entry of series) {
    entry.highlights.forEach((value, index) => {
      if (value !== null && value !== undefined) {
        highlightedIndices.add(index);
      }
    });
  }

  for (const index of highlightedIndices) {
    const selectionId = categorySelectionIds[index];
    if (selectionId) {
      highlightedKeys.add(selectionId.getKey());
    }
  }

  return highlightedKeys;
}

export function focusHighlightedData<T extends HighlightedDatumLike>(
  items: T[],
  hasHighlights: boolean,
): T[] {
  if (!hasHighlights) return items;

  const focused = items.filter((item) => item.highlighted === true);
  return focused.length > 0 ? focused : items;
}

export function applyLinkedState({
  root,
  selector,
  selectedKeys = new Set<string>(),
  highlightedKeys = new Set<string>(),
  dimOpacity = '0.3',
  activeOpacity = '',
  clearOpacity = '',
  keyAttribute = 'data-selection-key',
}: ApplyLinkedStateOptions): void {
  const hasSelection = selectedKeys.size > 0;
  const hasHighlights = highlightedKeys.size > 0;
  const shouldDim = hasSelection || hasHighlights;

  root.querySelectorAll<SVGElement>(selector).forEach((element) => {
    if (!shouldDim) {
      element.style.opacity = clearOpacity;
      return;
    }

    const key = element.getAttribute(keyAttribute);
    const isSelected = hasSelection && key !== null && selectedKeys.has(key);
    const isHighlighted = hasHighlights && key !== null && highlightedKeys.has(key);
    element.style.opacity = isSelected || isHighlighted ? activeOpacity : dimOpacity;
  });
}

export function buildCategoryBands(xPositions: number[], chartWidth: number): CategoryBand[] {
  if (xPositions.length === 0) return [];

  if (xPositions.length === 1) {
    return [{
      index: 0,
      center: xPositions[0],
      x: 0,
      width: chartWidth,
    }];
  }

  const bands: CategoryBand[] = [];
  for (let index = 0; index < xPositions.length; index++) {
    const center = xPositions[index];
    const leftBoundary = index === 0
      ? 0
      : (xPositions[index - 1] + center) / 2;
    const rightBoundary = index === xPositions.length - 1
      ? chartWidth
      : (center + xPositions[index + 1]) / 2;
    bands.push({
      index,
      center,
      x: leftBoundary,
      width: Math.max(0, rightBoundary - leftBoundary),
    });
  }

  return bands;
}
