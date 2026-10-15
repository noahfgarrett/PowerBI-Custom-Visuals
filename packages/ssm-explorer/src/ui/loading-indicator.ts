import type { LoadingState } from '../loading';

type Phase = 'Loading' | 'Paused' | 'More available' | 'Stopped' | 'Interrupted' | 'Loaded' | 'Choose project';

/** Stable, indeterminate loading UI. The host's received count is the only quantity shown. */
export class LoadingIndicator {
  private readonly indicator: HTMLDivElement;
  private readonly ring: HTMLSpanElement;
  private readonly phase: HTMLSpanElement;
  private readonly count: HTMLSpanElement;
  private readonly action: HTMLButtonElement;
  private readonly description: HTMLSpanElement;
  private lastPhase: Phase | null = null;

  constructor(private readonly container: HTMLElement, uid: string) {
    const document = container.ownerDocument;
    const hintId = `${uid}-loading-hint`;
    this.indicator = document.createElement('div');
    this.indicator.className = 'ssm-loading-indicator';
    this.indicator.setAttribute('role', 'group');
    this.indicator.setAttribute('aria-label', 'Data loading');
    this.indicator.setAttribute('aria-describedby', hintId);
    this.indicator.tabIndex = 0;
    this.ring = document.createElement('span');
    this.ring.className = 'ssm-loading-ring';
    this.ring.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div'); text.className = 'ssm-loading-text';
    this.phase = document.createElement('span');
    this.phase.className = 'ssm-loading-phase';
    this.phase.setAttribute('role', 'status');
    this.phase.setAttribute('aria-live', 'polite');
    this.phase.setAttribute('aria-atomic', 'true');
    this.count = document.createElement('span'); this.count.className = 'ssm-loading-count';
    text.append(this.phase, this.count);
    this.action = document.createElement('button');
    this.action.type = 'button'; this.action.className = 'ssm-loading-action'; this.action.disabled = true; this.action.hidden = true;
    this.action.setAttribute('aria-describedby', hintId);
    this.description = document.createElement('span');
    this.description.id = hintId; this.description.className = 'ssm-loading-description';
    this.description.setAttribute('data-tooltip-description', '');
    this.indicator.append(this.ring, text, this.action, this.description);
    container.append(this.indicator);
    container.hidden = true;
  }

  update(state: LoadingState, available: boolean, allowInteractions: boolean, scopeActive = true): void {
    this.container.hidden = !available;
    if (!available) {
      this.lastPhase = null; this.action.disabled = true;
      return;
    }
    const phase: Phase = !scopeActive ? 'Choose project' : !state.partial ? 'Loaded' : state.paused ? 'Paused' : state.failed ? 'Interrupted' : state.stopped ? 'Stopped' : state.pending ? 'Loading' : 'More available';
    // This is the only live-region mutation. Received rows remain readable without chatter.
    if (phase !== this.lastPhase) { this.phase.textContent = phase; this.lastPhase = phase; }
    const rows = Number.isFinite(state.rows) && state.rows >= 0 ? state.rows.toLocaleString() : '—';
    const count = `${rows} ${state.rows === 1 ? 'row' : 'rows'}`;
    if (this.count.textContent !== count) this.count.textContent = count;
    this.count.setAttribute('aria-label', `${count} loaded`);
    this.indicator.dataset.phase = phase.toLowerCase().replace(' ', '-');
    this.indicator.classList.toggle('is-active', scopeActive ? state.partial && state.pending && !state.paused && !state.stopped && !state.failed : state.pending);
    this.indicator.classList.toggle('is-complete', scopeActive && !state.partial);
    this.ring.textContent = !scopeActive ? '' : !state.partial ? '✓' : state.paused ? 'Ⅱ' : '';
    this.action.hidden = scopeActive && !state.partial;
    this.action.disabled = (scopeActive && !state.partial) || !allowInteractions;
    let description: string;
    if (!scopeActive) {
      this.action.dataset.action = 'projects'; this.action.textContent = 'Choose';
      this.action.setAttribute('aria-label', 'Choose projects');
      description = `Choose a project or All to explore the received rows.${state.pending ? ' An existing request may still complete.' : ''}`;
    } else if (!state.partial) {
      this.action.removeAttribute('data-action'); this.action.textContent = '';
      description = 'All rows supplied by Power BI have been received.';
    } else if (state.paused) {
      this.action.dataset.action = 'resume-loading'; this.action.textContent = 'Resume';
      this.action.setAttribute('aria-label', 'Resume loading');
      description = 'Further loading is paused. An existing request may still complete. Resume to request more rows.';
    } else if (state.stopped || state.failed) {
      this.action.dataset.action = 'load-more'; this.action.textContent = 'Retry';
      this.action.setAttribute('aria-label', 'Retry loading');
      description = state.failed ? 'Loading was interrupted. Retry to request more rows from Power BI.' : 'Power BI did not accept the last request. Retry to request more rows.';
    } else if (state.pending) {
      this.action.dataset.action = 'pause-loading'; this.action.textContent = 'Pause';
      this.action.setAttribute('aria-label', 'Pause further loading');
      description = 'Waiting for more rows from Power BI. Pause to stop further requests; an existing request may still complete.';
    } else {
      this.action.dataset.action = 'load-more'; this.action.textContent = 'Load';
      this.action.setAttribute('aria-label', 'Load more rows');
      description = 'More rows are available. Request more rows from Power BI.';
    }
    this.description.textContent = allowInteractions || (scopeActive && !state.partial) ? description : `${description} Loading controls are unavailable in this view.`;
  }
}
