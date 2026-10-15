import { afterEach, describe, expect, it } from 'vitest';
import { LoadingIndicator } from '../ui/loading-indicator';
import type { LoadingState } from '../loading';

const roots: HTMLElement[] = [];
afterEach(() => { roots.splice(0).forEach(root => root.remove()); });
const state = (overrides: Partial<LoadingState> = {}): LoadingState => ({ rows: 0, partial: false, pending: false, paused: false, stopped: false, failed: false, ...overrides });
function fixture(uid = 'loading-test') {
  const container = document.createElement('div'); document.body.append(container); roots.push(container);
  const indicator = new LoadingIndicator(container, uid);
  const phase = container.querySelector<HTMLElement>('.ssm-loading-phase')!;
  const count = container.querySelector<HTMLElement>('.ssm-loading-count')!;
  const button = container.querySelector<HTMLButtonElement>('button')!;
  const hint = container.querySelector<HTMLElement>('[data-tooltip-description]')!;
  const group = container.querySelector<HTMLElement>('.ssm-loading-indicator')!;
  return { container, indicator, phase, count, button, hint, group };
}

describe('received-row loading indicator', () => {
  it('stays hidden without required fields and shows a real zero count once fields are available', () => {
    const { container, indicator, phase, count, button, group } = fixture();
    expect(container.hidden).toBe(true);
    indicator.update(state({ rows: 2000 }), false, true); expect(container.hidden).toBe(true);
    indicator.update(state(), true, true);
    expect(container.hidden).toBe(false); expect(phase.textContent).toBe('Loaded'); expect(count.textContent).toBe('0 rows');
    expect(button.hidden).toBe(true); expect(group.classList.contains('is-active')).toBe(false); expect(count.getAttribute('aria-label')).toBe('0 rows loaded');
    expect(container.querySelector('[role=progressbar]')).toBeNull();
    expect(container.querySelector('[aria-valuenow],[aria-valuemax]')).toBeNull();
  });

  it('reports loader phases and truthful request actions without a total, percent, batch or ETA', () => {
    const { indicator, phase, count, button, group, hint, container } = fixture();
    indicator.update(state({ partial: true, pending: true, rows: 2000 }), true, true);
    expect(phase.textContent).toBe('Loading'); expect(count.textContent).toBe(`${(2000).toLocaleString()} rows`);
    expect(button.dataset.action).toBe('pause-loading'); expect(group.classList.contains('is-active')).toBe(true);
    indicator.update(state({ partial: true, pending: true, paused: true, rows: 4000 }), true, true);
    expect(phase.textContent).toBe('Paused'); expect(button.dataset.action).toBe('resume-loading'); expect(group.classList.contains('is-active')).toBe(false);
    expect(hint.textContent).toContain('existing request may still complete');
    indicator.update(state({ partial: true, rows: 4000 }), true, true);
    expect(phase.textContent).toBe('More available'); expect(group.classList.contains('is-active')).toBe(false); expect(button.dataset.action).toBe('load-more'); expect(button.getAttribute('aria-label')).toBe('Load more rows');
    indicator.update(state({ partial: true, stopped: true, rows: 4000 }), true, true);
    expect(phase.textContent).toBe('Stopped'); expect(button.textContent).toBe('Retry'); expect(group.classList.contains('is-active')).toBe(false);
    expect(hint.textContent).toContain('Power BI did not accept');
    indicator.update(state({ partial: true, stopped: true, failed: true, rows: 4000 }), true, true);
    expect(phase.textContent).toBe('Interrupted'); expect(button.dataset.action).toBe('load-more');
    indicator.update(state({ stopped: true, failed: true, rows: 4321 }), true, true);
    expect(phase.textContent).toBe('Loaded'); expect(count.textContent).toBe(`${(4321).toLocaleString()} rows`);
    expect(button.hidden).toBe(true); expect(button.hasAttribute('data-action')).toBe(false);
    expect(container.textContent).not.toMatch(/\d\s*%|\bETA\b|\bbatch\b|\btotal\b/i);
  });

  it('preserves the actual focused action element as rows and phases change', () => {
    const { indicator, phase, count, button, container } = fixture();
    indicator.update(state({ partial: true, pending: true, rows: 1 }), true, true); button.focus();
    indicator.update(state({ partial: true, pending: true, rows: 2001 }), true, true);
    expect(document.activeElement).toBe(button); expect(container.querySelector('button')).toBe(button);
    expect(container.querySelector('.ssm-loading-phase')).toBe(phase); expect(container.querySelector('.ssm-loading-count')).toBe(count);
    indicator.update(state({ partial: true, paused: true, rows: 2001 }), true, true);
    expect(document.activeElement).toBe(button); expect(button.dataset.action).toBe('resume-loading');
    expect(button.textContent).toBe('Resume');
  });

  it('mutates its polite live region only when the phase changes, not on each received row update', async () => {
    const { indicator, phase, count } = fixture();
    indicator.update(state({ partial: true, pending: true, rows: 2000 }), true, true);
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(phase, { subtree: true, childList: true, characterData: true });
    indicator.update(state({ partial: true, pending: true, rows: 4000 }), true, true);
    indicator.update(state({ partial: true, pending: true, rows: 6000 }), true, true);
    await Promise.resolve(); expect(mutations).toHaveLength(0); expect(count.textContent).toContain((6000).toLocaleString());
    indicator.update(state({ partial: true, paused: true, rows: 6000 }), true, true);
    await Promise.resolve(); expect(mutations.length).toBeGreaterThan(0); observer.disconnect();
    expect(phase.getAttribute('aria-live')).toBe('polite'); expect(count.hasAttribute('aria-live')).toBe(false);
  });

  it('disables actions when interactions are unavailable and gives a per-instance accessible explanation', () => {
    const a = fixture('first'), b = fixture('second');
    a.indicator.update(state({ partial: true, paused: true, rows: 1 }), true, false);
    b.indicator.update(state({ partial: true, rows: 2 }), true, true);
    expect(a.button.disabled).toBe(true); expect(a.count.textContent).toBe('1 row');
    expect(a.hint.textContent).toContain('controls are unavailable');
    expect(a.hint.id).not.toBe(b.hint.id);
    expect(a.button.getAttribute('aria-describedby')).toBe(a.hint.id);
    expect(a.group.getAttribute('aria-describedby')).toBe(a.hint.id);
    a.indicator.update(state({ partial: true, rows: 1 }), false, true);
    expect(a.container.hidden).toBe(true); expect(a.button.disabled).toBe(true);
  });

  it('waits for explicit project scope while retaining received counts and accepted request truth', () => {
    const { indicator, phase, count, button, hint, group } = fixture();
    indicator.update(state({ partial: true, rows: 2000 }), true, true, false);
    expect(phase.textContent).toBe('Choose project'); expect(count.textContent).toBe(`${(2000).toLocaleString()} rows`);
    expect(button.textContent).toBe('Choose'); expect(button.dataset.action).toBe('projects'); expect(group.classList.contains('is-active')).toBe(false);
    indicator.update(state({ partial: true, pending: true, rows: 2000 }), true, true, false);
    expect(phase.textContent).toBe('Choose project'); expect(hint.textContent).toContain('existing request may still complete');
    expect(group.classList.contains('is-active')).toBe(true);
    indicator.update(state({ rows: 2500 }), true, true, false);
    expect(phase.textContent).toBe('Choose project'); expect(button.hidden).toBe(false);
    indicator.update(state({ rows: 2500 }), true, true, true);
    expect(phase.textContent).toBe('Loaded'); expect(button.hidden).toBe(true);
  });
});
