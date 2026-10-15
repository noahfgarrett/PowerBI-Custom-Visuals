/** FLIP motion is limited to mounted viewport nodes, never the loaded registry. */
export class SceneMotion {
  private previous = new Map<string, DOMRect>();
  private animations: Animation[] = [];
  private armed = false;

  capture(elements: Iterable<HTMLButtonElement>, enabled: boolean): void {
    const positions = enabled ? [...elements].map(element => [element.dataset.occurrence!, element.getBoundingClientRect()] as const) : [];
    this.finish();
    this.armed = enabled;
    this.previous.clear();
    for (const [key, bounds] of positions) this.previous.set(key, bounds);
  }

  play(elements: Iterable<HTMLButtonElement>, scale: number, links?: SVGSVGElement | null): void {
    if (!this.armed) return;
    this.armed = false;
    if (links && typeof links.animate === 'function') this.animations.push(links.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
    for (const element of elements) {
      if (typeof element.animate !== 'function') continue;
      const before = this.previous.get(element.dataset.occurrence!), after = element.getBoundingClientRect();
      const frames = before ? [
        { transform: `translate(${(before.left - after.left) / scale}px,${(before.top - after.top) / scale}px)` },
        { transform: 'translate(0,0)' },
      ] : [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: Number(getComputedStyle(element).opacity), transform: 'translateY(0)' }];
      const animation = element.animate(frames, { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' });
      this.animations.push(animation);
    }
    this.previous.clear();
  }

  finish(): void { this.animations.forEach(animation => animation.cancel()); this.animations = []; this.armed = false; this.previous.clear(); }
  dispose(): void { this.finish(); this.previous.clear(); this.armed = false; }
}
