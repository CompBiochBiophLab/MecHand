import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './environment';
import { STIMULI, tasksFor } from './tasks';

describe('study environment', () => {
  it('derives coarse browser, OS and architecture fields from a user-agent string', () => {
    const safariIpad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15';
    expect(parseUserAgent(safariIpad, 5)).toMatchObject({ browser: { name: 'Safari', major: 19 }, os: { name: 'iPadOS' }, architecture: 'arm', architectureSource: 'inferred' });
    // The same string on a Mac: "Intel" is reported on Apple silicon too, so the architecture is unknown.
    expect(parseUserAgent(safariIpad, 0)).toMatchObject({ os: { name: 'macOS' }, architecture: null, architectureSource: 'unknown' });
    const firefoxWin = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0';
    expect(parseUserAgent(firefoxWin)).toMatchObject({ browser: { name: 'Firefox', major: 149 }, os: { name: 'Windows' }, architecture: 'x86 64' });
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0';
    expect(parseUserAgent(edge).browser).toEqual({ name: 'Edge', major: 150 });
    const android = 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
    expect(parseUserAgent(android)).toMatchObject({ browser: { name: 'Chrome', major: 150 }, os: { name: 'Android', major: 15 }, mobile: true });
  });
});

describe('study design', () => {
  it('counterbalances sets and conditions across the four groups', () => {
    const seen = new Map<string, number>();
    for (const g of ['A1', 'A2', 'B1', 'B2'] as const) {
      const tasks = tasksFor(g);
      expect(tasks).toHaveLength(10);
      expect(tasks.filter((t) => t.practice)).toHaveLength(2);
      // Every analysed stimulus once per participant, each in one condition.
      const real = tasks.filter((t) => !t.practice);
      expect(new Set(real.map((t) => t.stimulus)).size).toBe(8);
      real.forEach((t) => seen.set(`${t.stimulus}:${t.condition}`, (seen.get(`${t.stimulus}:${t.condition}`) ?? 0) + 1));
    }
    // Over the four groups each stimulus is drawn twice in each condition.
    expect([...seen.values()].every((n) => n === 2)).toBe(true);
    expect(seen.size).toBe(16);
  });

  it('has matched sets: same kinds and the same number of curved arrows', () => {
    const sig = (set: string) => STIMULI.filter((s) => s.set === set).map((s) => `${s.kind}:${s.reference.curvedArrows}`);
    expect(sig('A')).toEqual(sig('B'));
  });
});
