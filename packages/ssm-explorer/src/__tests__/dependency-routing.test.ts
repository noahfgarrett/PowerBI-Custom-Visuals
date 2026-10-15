import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SsmExplorerVisual } from '../visual';
import { createHarnessHost } from '../../dev/host';
import { tableFixture, type SyntheticRow } from './fixtures';

type Point = { x: number; y: number };
let element: HTMLDivElement;
let visual: SsmExplorerVisual;
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;

beforeEach(() => {
  frames = new Map();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  element = document.createElement('div'); document.body.append(element);
  visual = new SsmExplorerVisual({ element, host: createHarnessHost().host } as never);
  // These cases exercise a deliberately chosen all-project scope.
  element.querySelector<HTMLButtonElement>('[data-action="projects-all"]')!.click();
  const viewport = element.querySelector<HTMLElement>('[data-viewport]')!;
  Object.defineProperties(viewport, { clientWidth: { value: 1280 }, clientHeight: { value: 1800 } });
});
afterEach(() => { visual.destroy(); element.remove(); vi.restoreAllMocks(); });

function flush() {
  for (let step = 0; step < 12 && frames.size; step++) {
    const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(performance.now()));
  }
}
function setup() {
  const common = { project: 'Routing Project', nodeType: 'equipment', parentMilestone: 'Root', milestone: 'A Main' };
  const rows: SyntheticRow[] = [
    { ...common, equipmentId: 'A-SOURCE', dependencies: 'P-SUPPORT' },
    { ...common, equipmentId: 'B-SIBLING' },
    { ...common, equipmentId: 'C-SIBLING' },
    { ...common, equipmentId: 'P-SUPPORT', milestone: 'Z Support' },
  ];
  visual.update({ dataViews: [tableFixture(rows, { navigation: { initialExpanded: true }, appearance: { animate: false } })], viewport: { width: 1280, height: 2000 }, type: 2, operationKind: 0 } as never);
  flush();
}
function card(id: string, role?: string): HTMLElement {
  const key = JSON.stringify(['equipment', 'Routing Project', id]);
  const result = [...element.querySelectorAll<HTMLElement>('[data-node]')].find(node => node.dataset.node === key && (!role || node.dataset.role === role));
  expect(result, `${id}/${role ?? 'any'} is mounted`).toBeTruthy(); return result!;
}
function open(id: string) {
  const source = card(id, 'member');
  const action = [...element.querySelectorAll<HTMLButtonElement>('[data-action=quick-dependencies]')].find(button => button.dataset.source === source.dataset.occurrence);
  expect(action).toBeTruthy(); action!.click(); flush(); return source;
}
function box(node: HTMLElement) { return { x: parseFloat(node.style.left), y: parseFloat(node.style.top), width: parseFloat(node.style.width), height: 64 }; }

/** Sample the actual SVG geometry, including the old cubic route that crossed siblings. */
function samplePath(data: string): Point[] {
  const chunks = [...data.matchAll(/([MHVC])([^MHVC]*)/g)];
  let current: Point = { x: 0, y: 0 };
  const points: Point[] = [];
  for (const [, command, argumentsText] of chunks) {
    const n = (argumentsText.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (command === 'M') { current = { x: n[0], y: n[1] }; points.push(current); continue; }
    const start = current;
    const end = command === 'H' ? { x: n[0], y: start.y } : command === 'V' ? { x: start.x, y: n[0] } : { x: n[4], y: n[5] };
    for (let step = 1; step <= 120; step++) {
      const t = step / 120, u = 1 - t;
      points.push(command === 'C' ? { x: u ** 3 * start.x + 3 * u ** 2 * t * n[0] + 3 * u * t ** 2 * n[2] + t ** 3 * end.x, y: u ** 3 * start.y + 3 * u ** 2 * t * n[1] + 3 * u * t ** 2 * n[3] + t ** 3 * end.y } : { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
    }
    current = end;
  }
  return points;
}
function pathBetween(from: HTMLElement, to: HTMLElement): SVGPathElement {
  const path = [...element.querySelectorAll<SVGPathElement>('path.dependency')].find(candidate => candidate.dataset.fromOccurrence === from.dataset.occurrence && candidate.dataset.toOccurrence === to.dataset.occurrence);
  expect(path).toBeTruthy(); expect(path!.getAttribute('marker-end')).toContain('-dependency)'); return path!;
}
function avoidsCards(points: Point[], cards: HTMLElement[]) {
  for (const node of cards) {
    const b = box(node);
    expect(points.some(point => point.x > b.x + .5 && point.x < b.x + b.width - .5 && point.y > b.y + .5 && point.y < b.y + b.height - .5), `route must not enter ${node.dataset.node}`).toBe(false);
  }
}

describe('dependency side-lane routing', () => {
  it('keeps closest-parent rails local to their compact sibling group', () => {
    const common = { project: 'Routing Project', nodeType: 'equipment', parentMilestone: 'Root', milestone: 'A Main' };
    const rows: SyntheticRow[] = ['A', 'B', 'C'].flatMap(id => [
      { ...common, equipmentId: id },
      { ...common, equipmentId: `${id}-0`, closestParent: id },
      { ...common, equipmentId: `${id}-1`, closestParent: id },
    ]);
    visual.update({ dataViews: [tableFixture(rows, { navigation: { initialExpanded: true }, appearance: { animate: false } })], viewport: { width: 1280, height: 2000 }, type: 2, operationKind: 0 } as never);
    flush();
    expect(new Set(['A', 'B', 'C'].map(id => card(id).style.top)).size).toBe(1);
    const paths = [...element.querySelectorAll<SVGPathElement>('path.parent')]; expect(paths).toHaveLength(6);
    for (const path of paths) {
      expect(path.getAttribute('marker-end')).toContain('-parent)');
      avoidsCards(samplePath(path.getAttribute('d')!), [...element.querySelectorAll<HTMLElement>('[data-node]')]);
    }
  });

  it('routes a prerequisite around sibling cards and enters the target facing edge', () => {
    setup(); const source = open('A-SOURCE'), target = card('P-SUPPORT', 'dependency');
    const siblings = [card('B-SIBLING'), card('C-SIBLING')], s = box(source), t = box(target);
    expect(siblings[0].style.top).toBe(source.style.top); expect(siblings[1].style.top).toBe(source.style.top);
    const points = samplePath(pathBetween(source, target).getAttribute('d')!);
    expect(points[0]).toEqual({ x: s.x + s.width, y: s.y + 32 });
    expect(points[points.length - 1]).toEqual({ x: t.x, y: t.y + 32 });
    avoidsCards(points, [source, target, ...siblings]);
  });

  it('reverses Required by direction while retaining source-specific occurrences and near-edge endpoints', () => {
    setup(); const source = open('P-SUPPORT'), consumer = card('A-SOURCE', 'dependency'), s = box(source), c = box(consumer);
    const points = samplePath(pathBetween(consumer, source).getAttribute('d')!);
    expect(points[0]).toEqual({ x: c.x, y: c.y + 32 });
    expect(points[points.length - 1]).toEqual({ x: s.x + s.width, y: s.y + 32 });
    avoidsCards(points, [...element.querySelectorAll<HTMLElement>('[data-node]')]);
    expect(consumer.dataset.sourceOccurrence).toBe(source.dataset.occurrence);
  });
});
