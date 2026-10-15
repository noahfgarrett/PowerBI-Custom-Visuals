import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SegmentLoader } from '../loading';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Segmented loading', () => {
  it('yields before fetching and waits for received data before another request', async () => {
    const fetch = vi.fn(() => true), loader = new SegmentLoader(fetch, () => {});
    loader.update(true, 2000, true, true, true);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.update(true, 2000, false, true, false); // Resize during an in-flight request.
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.update(true, 4000, false, true, true);
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.dispose();
  });

  it('pauses queued requests, accepts an in-flight response, and resumes explicitly', async () => {
    const fetch = vi.fn(() => true), loader = new SegmentLoader(fetch, () => {});
    loader.update(true, 2000, true, true, true);
    loader.pause();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).not.toHaveBeenCalled();
    loader.resume();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.pause();
    loader.update(true, 4000, false, true, true);
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loader.state.paused).toBe(true);
    loader.resume();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.dispose();
  });

  it('stops at a host refusal, permits retry, and resets on a new query', async () => {
    const fetch = vi.fn(() => false), loader = new SegmentLoader(fetch, () => {});
    loader.update(true, 2000, true, true, true);
    await vi.advanceTimersByTimeAsync(40);
    expect(loader.state.stopped).toBe(true);
    loader.update(true, 2000, false, true, false);
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.request();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.update(true, 2000, true, true, true);
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(3);
    loader.dispose();
  });

  it('supports manual loading and never fetches after completion or destroy', async () => {
    const fetch = vi.fn(() => true), loader = new SegmentLoader(fetch, () => {});
    loader.update(true, 2000, true, false, true);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).not.toHaveBeenCalled();
    loader.request();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.update(false, 2500, false, false, true);
    loader.request();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
    loader.update(true, 2000, true, true, true);
    loader.dispose();
    await vi.advanceTimersByTimeAsync(40);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores stale refusals after a query changes and handles synchronous host failures', async () => {
    let rejectOld: (accepted: boolean) => void = () => {};
    const fetch = vi.fn<() => boolean | Promise<boolean>>().mockImplementationOnce(() => new Promise(resolve => { rejectOld = resolve; })).mockImplementation(() => { throw new Error('host unavailable'); });
    const loader = new SegmentLoader(fetch, () => {});
    loader.update(true, 2000, true, true, true);
    await vi.advanceTimersByTimeAsync(40);
    loader.update(true, 2000, true, true, true);
    rejectOld(false);
    await Promise.resolve();
    expect(loader.state.stopped).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(loader.state).toMatchObject({ stopped: true, failed: true, pending: false });
    loader.dispose();
  });
});
