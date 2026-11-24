import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './with-timeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('passes the real answer through when it comes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 'late', 1000)).resolves.toBe('ok');
  });

  it('answers with the fallback when the promise never settles', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<string>(() => {}), 'timeout', 20_000);
    vi.advanceTimersByTime(20_000);
    await expect(result).resolves.toBe('timeout');
  });

  it('keeps a real error an error', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 'x', 1000)).rejects.toThrow('boom');
  });
});
