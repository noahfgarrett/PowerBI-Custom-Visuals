import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlTooltip } from '../ui/control-tooltip';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); });

function fixture(describeNode?: (element: HTMLElement) => string) {
  const root = document.createElement('div');
  const label = document.createElement('label');
  const control = document.createElement('input');
  control.type = 'checkbox'; control.setAttribute('aria-describedby', 'relationship-explanation');
  label.title = 'Native explanation'; label.append(control);
  const description = document.createElement('span');
  description.id = 'relationship-explanation'; description.dataset.tooltipDescription = '';
  description.textContent = 'Include linked equipment <without changing its assignment>.';
  root.append(label, description); document.body.append(root);
  Object.defineProperties(root, { clientWidth: { value: 320 }, clientHeight: { value: 240 } });
  const tooltip = new ControlTooltip(root, describeNode);
  const bubble = root.querySelector<HTMLDivElement>('[role="tooltip"]')!;
  root.getBoundingClientRect = () => ({ left: 10, top: 20, width: 320, height: 240 }) as DOMRect;
  control.getBoundingClientRect = () => ({ left: 300, top: 200, bottom: 220 }) as DOMRect;
  bubble.getBoundingClientRect = () => ({ width: 260, height: 50 }) as DOMRect;
  cleanups.push(() => { tooltip.dispose(); root.remove(); });
  return { root, label, control, tooltip, bubble };
}

describe('relationship control tooltips', () => {
  it('shows the same literal description on label hover and keyboard focus, within visual bounds', () => {
    const { label, control, bubble } = fixture();
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe('Include linked equipment <without changing its assignment>.');
    expect(bubble.children).toHaveLength(0);
    expect(bubble.style.left).toBe('52px');
    expect(bubble.style.top).toBe('122px');
    expect(bubble.style.pointerEvents).toBe('none');
    label.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(bubble.hidden).toBe(true);
    control.focus();
    expect(bubble.hidden).toBe(false);
    control.blur();
    expect(bubble.hidden).toBe(true);
  });

  it('suppresses duplicate native tooltips and restores them after dismissal or disposal', () => {
    const { root, label, control, tooltip, bubble } = fixture();
    control.focus();
    expect(label.hasAttribute('title')).toBe(false);
    control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(bubble.hidden).toBe(true);
    expect(label.title).toBe('Native explanation');
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    tooltip.dispose();
    expect(label.title).toBe('Native explanation');
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('dismisses on pointer actions and camera resets and ignores undescribed controls', () => {
    const { root, label, control, tooltip, bubble } = fixture();
    control.focus();
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(bubble.hidden).toBe(true);
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    tooltip.hide();
    expect(bubble.hidden).toBe(true);
    const ordinary = document.createElement('button'); root.append(ordinary); ordinary.focus();
    expect(bubble.hidden).toBe(true);
  });
});


function nodeFixture() {
  const data = fixture(element => `${element.dataset.node} <tag>\nMechanical · Project A`);
  const node = document.createElement('button'); node.dataset.node = 'EQ-001'; node.title = 'Old native node tooltip';
  const label = document.createElement('span'), tag = document.createElement('span');
  label.textContent = 'Equipment'; tag.textContent = 'EQ-001'; node.append(label, tag); data.root.append(node);
  node.getBoundingClientRect = () => ({ left: 60, top: 90, bottom: 154 }) as DOMRect;
  return { ...data, node, label, tag };
}

describe('local node tooltips', () => {
  it('delays node hover, keeps span transitions on the same timer, and shows literal bounded multiline text', () => {
    vi.useFakeTimers();
    const { node, label, tag, bubble } = nodeFixture();
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(bubble.hidden).toBe(true);
    label.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: tag }));
    tag.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: label }));
    vi.advanceTimersByTime(49); expect(bubble.hidden).toBe(true);
    vi.advanceTimersByTime(1); expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe('EQ-001 <tag>\nMechanical · Project A');
    expect(bubble.children).toHaveLength(0);
    expect(bubble.style.whiteSpace).toBe('pre-line');
    expect(bubble.style.maxHeight).toBe('224px');
    expect(node.hasAttribute('title')).toBe(false);
    tag.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(bubble.hidden).toBe(true); expect(node.title).toBe('Old native node tooltip');
  });

  it('does not repeat geometry reads when moving between spans of an active node', () => {
    vi.useFakeTimers();
    const { root, node, label, tag, bubble } = nodeFixture();
    const rootRect = vi.spyOn(root, 'getBoundingClientRect'), nodeRect = vi.spyOn(node, 'getBoundingClientRect'), bubbleRect = vi.spyOn(bubble, 'getBoundingClientRect');
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); vi.advanceTimersByTime(250);
    label.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: tag }));
    tag.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: label }));
    node.focus();
    expect(rootRect).toHaveBeenCalledTimes(1); expect(nodeRect).toHaveBeenCalledTimes(1); expect(bubbleRect).toHaveBeenCalledTimes(1);
  });

  it('cancels pending hover on leave, pointerdown, wheel, Escape, hide and disposal', () => {
    vi.useFakeTimers();
    const { root, node, bubble, tooltip } = nodeFixture();
    const dismissals = [
      () => node.dispatchEvent(new MouseEvent('pointerout', { bubbles: true })),
      () => root.dispatchEvent(new Event('pointerdown', { bubbles: true })),
      () => root.dispatchEvent(new Event('wheel', { bubbles: true })),
      () => root.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })),
      () => tooltip.hide(),
      () => tooltip.dispose(),
    ];
    for (const dismiss of dismissals) {
      node.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); vi.advanceTimersByTime(100); dismiss(); vi.advanceTimersByTime(500);
      expect(bubble.hidden).toBe(true);
    }
    expect(root.querySelector('[role=tooltip]')).toBeNull();
  });

  it('shows a focused node immediately and prioritizes described controls without a node delay', () => {
    vi.useFakeTimers();
    const { node, control, label, bubble } = nodeFixture();
    node.focus(); expect(bubble.hidden).toBe(false);
    node.blur(); expect(bubble.hidden).toBe(true);
    node.append(control);
    control.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe('Include linked equipment <without changing its assignment>.');
    control.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: label }));
    expect(bubble.hidden).toBe(true);
  });

  it('does not pin a tooltip through the focus caused by clicking a node', () => {
    vi.useFakeTimers();
    const { node, label, bubble } = nodeFixture();
    node.dispatchEvent(new Event('pointerdown', { bubbles: true })); node.focus();
    expect(bubble.hidden).toBe(true);
    label.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); vi.advanceTimersByTime(250);
    expect(bubble.hidden).toBe(false);
    label.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(bubble.hidden).toBe(true);
  });

  it('does not show delayed summaries for detached nodes or without an optional node callback', () => {
    vi.useFakeTimers();
    const { node, bubble } = nodeFixture();
    node.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); node.remove(); vi.advanceTimersByTime(250);
    expect(bubble.hidden).toBe(true);
    const plain = fixture(), unsupported = document.createElement('button'); unsupported.dataset.node = 'EQ'; plain.root.append(unsupported);
    unsupported.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); vi.advanceTimersByTime(500);
    expect(plain.bubble.hidden).toBe(true);
  });
});
