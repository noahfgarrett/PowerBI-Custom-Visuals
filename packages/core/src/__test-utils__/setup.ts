/**
 * Global test setup — stubs browser APIs not available in JSDOM.
 */

// Synchronous requestAnimationFrame / cancelAnimationFrame
// We advance time by a large amount on each call so animations complete immediately.
// A recursion guard prevents stack overflow from libraries like d3-force/d3-timer
// that use rAF internally.
let rafId = 0;
let fakeTime = 10_000;
let rafDepth = 0;
const MAX_RAF_DEPTH = 50;
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  const id = ++rafId;
  if (rafDepth >= MAX_RAF_DEPTH) return id; // silently drop to prevent stack overflow
  rafDepth++;
  fakeTime += 100_000; // advance 100s so any duration check completes
  try {
    cb(fakeTime);
  } finally {
    rafDepth--;
  }
  return id;
};
globalThis.cancelAnimationFrame = (_id: number): void => {};

// matchMedia stub (used by prefersReducedMotion)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// SVGElement.prototype.getBBox
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as unknown as Record<string, unknown>).getBBox = () => ({
    x: 0,
    y: 0,
    width: 100,
    height: 20,
  });
}

// SVGTextElement.prototype.getComputedTextLength
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as unknown as Record<string, unknown>).getComputedTextLength = () => 50;
}

// SVGPathElement.prototype.getTotalLength (used by drawPath animation)
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as unknown as Record<string, unknown>).getTotalLength = () => 200;
}

// SVGGeometryElement.prototype.getPointAtLength (used by some path animations)
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as unknown as Record<string, unknown>).getPointAtLength = () => ({ x: 0, y: 0 });
}

// SVGAnimatedLength stub (used by some SVG attribute access)
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as unknown as Record<string, unknown>).createSVGPoint = function () {
    return { x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) };
  };
}

// HTMLCanvasElement.prototype.getContext
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
