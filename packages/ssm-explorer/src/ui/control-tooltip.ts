/** One bounded, text-only tooltip for controls and optional node summaries. */
export class ControlTooltip {
  private readonly element: HTMLDivElement;
  private readonly abort = new AbortController();
  private hovered: HTMLElement | null = null;
  private focused: HTMLElement | null = null;
  private active: HTMLElement | null = null;
  private activeText = '';
  private pending: HTMLElement | null = null;
  private pendingText = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nativeTitle: { element: HTMLElement; text: string } | null = null;
  private disposed = false;
  private pointerFocus = false;

  constructor(private readonly root: HTMLElement, private readonly describeNode?: (element: HTMLElement) => string) {
    this.element = root.ownerDocument.createElement('div');
    this.element.className = 'ssm-control-tooltip';
    this.element.setAttribute('role', 'tooltip');
    // Controls retain aria-describedby; nodes already have their full semantic name.
    this.element.setAttribute('aria-hidden', 'true');
    this.element.hidden = true;
    Object.assign(this.element.style, {
      position: 'absolute', zIndex: '100', pointerEvents: 'none', boxSizing: 'border-box',
      padding: '9px 11px', borderRadius: '7px', border: '1px solid var(--ssm-border)',
      background: 'var(--ssm-panel)', color: 'var(--ssm-fg)', fontSize: '12px',
      lineHeight: '1.4', boxShadow: '0 4px 16px #0002', overflowWrap: 'anywhere',
      whiteSpace: 'pre-line', overflow: 'hidden',
    });
    root.appendChild(this.element);
    const signal = this.abort.signal;
    root.addEventListener('pointerover', event => {
      const anchor = this.anchor(event.target);
      if (anchor === this.hovered) return;
      this.hovered = anchor; this.request(this.hovered ?? this.focused, !this.hovered);
    }, { signal });
    root.addEventListener('pointerout', event => {
      if (event.relatedTarget instanceof Node && this.hovered?.contains(event.relatedTarget)) return;
      this.hovered = this.anchor(event.relatedTarget); this.request(this.hovered ?? this.focused, !this.hovered);
    }, { signal });
    root.addEventListener('focusin', event => {
      const anchor = this.anchor(event.target);
      this.focused = this.pointerFocus && anchor?.hasAttribute('data-node') && !this.controlDescription(anchor) ? null : anchor;
      this.pointerFocus = false; this.request(this.focused ?? this.hovered, !!this.focused);
    }, { signal });
    root.addEventListener('focusout', event => {
      this.focused = this.anchor(event.relatedTarget); this.request(this.focused ?? this.hovered, !!this.focused);
    }, { signal });
    root.addEventListener('pointerdown', () => { this.pointerFocus = true; this.hide(); }, { signal });
    root.addEventListener('wheel', () => this.hide(), { signal, passive: true });
    root.addEventListener('keydown', event => { this.pointerFocus = false; if (event.key === 'Escape') this.hide(); }, { signal });
  }

  private anchor(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const described = target.closest<HTMLElement>('[aria-describedby]')
      ?? target.closest('label')?.querySelector<HTMLElement>('[aria-describedby]') ?? null;
    if (described && this.root.contains(described) && this.controlDescription(described)) return described;
    const node = this.describeNode ? target.closest<HTMLElement>('[data-node]') : null;
    return node && this.root.contains(node) ? node : null;
  }

  private controlDescription(anchor: HTMLElement): string {
    return (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).map(id => {
      const description = this.root.ownerDocument.getElementById(id);
      return description && this.root.contains(description) && description.hasAttribute('data-tooltip-description')
        ? description.textContent?.trim() ?? '' : '';
    }).filter(Boolean).join(' ');
  }

  private description(anchor: HTMLElement): string {
    return this.controlDescription(anchor) || (anchor.hasAttribute('data-node') ? this.describeNode?.(anchor).trim() ?? '' : '');
  }

  private restoreTitle(): void {
    if (this.nativeTitle) this.nativeTitle.element.setAttribute('title', this.nativeTitle.text);
    this.nativeTitle = null;
  }

  private cancelPending(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.pending = null; this.pendingText = '';
  }

  private dismiss(): void {
    this.element.hidden = true; this.active = null; this.activeText = '';
    this.restoreTitle();
  }

  private request(anchor: HTMLElement | null, immediate = false): void {
    if (this.disposed || !anchor?.isConnected || !this.root.contains(anchor)) { this.hide(); return; }
    const text = this.description(anchor);
    if (!text) { this.hide(); return; }
    if (this.active === anchor && this.activeText === text && !this.element.hidden) return;
    if (!immediate && this.pending === anchor && this.pendingText === text) return;
    this.cancelPending(); this.dismiss();
    if (anchor.hasAttribute('data-node') && !this.controlDescription(anchor) && !immediate) {
      this.pending = anchor; this.pendingText = text;
      this.timer = setTimeout(() => {
        this.timer = null; this.pending = null; this.pendingText = '';
        if (!this.disposed && this.hovered === anchor && anchor.isConnected && this.root.contains(anchor)) this.show(anchor, text);
      }, 250);
    } else this.show(anchor, text);
  }

  private show(anchor: HTMLElement, text: string): void {
    if (this.disposed || !anchor.isConnected || !this.root.contains(anchor)) return;
    if (this.active === anchor && this.activeText === text && !this.element.hidden) return;
    this.restoreTitle();
    const titled = anchor.closest<HTMLElement>('[title]');
    if (titled && this.root.contains(titled)) {
      this.nativeTitle = { element: titled, text: titled.getAttribute('title')! };
      titled.removeAttribute('title');
    }
    this.active = anchor; this.activeText = text;
    this.element.textContent = text;
    const rootRect = this.root.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const width = this.root.clientWidth || rootRect.width;
    const height = this.root.clientHeight || rootRect.height;
    this.element.style.width = `${Math.max(0, Math.min(260, width - 16))}px`;
    this.element.style.maxHeight = `${Math.max(0, height - 16)}px`;
    this.element.hidden = false;
    const tooltipRect = this.element.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchorRect.left - rootRect.left, width - tooltipRect.width - 8));
    let top = anchorRect.bottom - rootRect.top + 8;
    if (top + tooltipRect.height > height - 8) top = anchorRect.top - rootRect.top - tooltipRect.height - 8;
    this.element.style.left = `${left}px`;
    this.element.style.top = `${Math.max(8, Math.min(top, height - tooltipRect.height - 8))}px`;
  }

  hide(): void {
    this.cancelPending(); this.dismiss(); this.hovered = null; this.focused = null;
  }

  dispose(): void { this.disposed = true; this.hide(); this.abort.abort(); this.element.remove(); }
}
