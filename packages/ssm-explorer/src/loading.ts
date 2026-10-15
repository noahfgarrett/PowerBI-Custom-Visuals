/** One-at-a-time segmented loading, with a browser task between host requests. */
export interface LoadingState {
  partial: boolean;
  rows: number;
  pending: boolean;
  paused: boolean;
  stopped: boolean;
  failed: boolean;
}

export class SegmentLoader {
  readonly state: LoadingState = { partial: false, rows: 0, pending: false, paused: false, stopped: false, failed: false };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private requestedRows = -1;
  private automatic = true;
  private disposed = false;

  constructor(private readonly fetch: () => boolean | Promise<boolean>, private readonly changed: () => void, private readonly delay = 40) {}

  update(partial: boolean, rows: number, reset: boolean, automatic: boolean, received: boolean): void {
    if (this.disposed) return;
    if (reset) {
      this.cancel(); this.requestedRows = -1;
      Object.assign(this.state, { pending: false, paused: false, stopped: false, failed: false });
    }
    this.automatic = automatic;
    this.state.partial = partial; this.state.rows = rows;
    if (received) this.state.pending = false;
    if (!partial) { this.cancel(); this.state.pending = false; }
    if (!automatic && this.timer !== undefined) { this.cancel(); this.state.pending = false; }
    this.changed();
    if (automatic && !this.state.paused) this.schedule(false);
  }

  pause(): void {
    this.state.paused = true;
    // Already accepted host queries may finish; only queued/subsequent requests stop.
    if (this.timer !== undefined) { this.cancel(); this.state.pending = false; }
    this.changed();
  }

  resume(): void { this.state.paused = false; this.request(); }
  request(): void { this.state.stopped = false; this.state.failed = false; this.schedule(true); }

  private schedule(explicit: boolean): void {
    if (this.disposed || !this.state.partial || this.state.pending || this.timer !== undefined || this.state.stopped) return;
    if (!explicit && (this.state.paused || this.requestedRows === this.state.rows)) return;
    const generation = this.generation;
    this.state.pending = true;
    this.changed();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.disposed || generation !== this.generation) return;
      this.requestedRows = this.state.rows;
      const stop = (failed: boolean): void => {
        if (this.disposed || generation !== this.generation) return;
        Object.assign(this.state, { pending: false, stopped: true, failed }); this.changed();
      };
      try {
        Promise.resolve(this.fetch()).then(accepted => { if (!accepted) stop(false); }).catch(() => stop(true));
      } catch { stop(true); }
    }, this.delay);
  }

  private cancel(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.generation++; }
  dispose(): void { this.disposed = true; this.cancel(); }
}
