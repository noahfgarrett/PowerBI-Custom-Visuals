/**
 * Constructor and update option factories for Power BI visual tests.
 */

import { createMockHost } from './mock-host';

interface ConstructorOptions {
  host: Record<string, unknown>;
  element: HTMLElement;
}

interface UpdateOptions {
  dataViews: unknown[];
  viewport: { width: number; height: number };
  type: number;
  operationKind?: number;
}

/**
 * Creates VisualConstructorOptions with a fresh host and DOM element.
 */
export function createConstructorOptions(): ConstructorOptions {
  const element = document.createElement('div');
  element.style.width = '600px';
  element.style.height = '400px';
  document.body.appendChild(element);

  return {
    host: createMockHost(),
    element,
  };
}

/**
 * Creates VisualUpdateOptions with the given DataViews and viewport.
 */
export function createUpdateOptions(
  dataViews: unknown[],
  viewport?: { width: number; height: number },
): UpdateOptions {
  return {
    dataViews,
    viewport: viewport ?? { width: 600, height: 400 },
    type: 2, // VisualUpdateType.Data
    operationKind: 0, // VisualDataChangeOperationKind.Create
  };
}
