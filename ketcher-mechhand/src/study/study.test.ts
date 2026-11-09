import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './environment';
import { STIMULI, shuffled, tasksFor } from './tasks';

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
  it('counterbalances sets and conditions across the four groups', { timeout: 30_000 }, () => {
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

  it('puts the four tasks of each block in a random order', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const orders = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const tasks = tasksFor('A1', rng);
      expect(tasks.map((t) => t.id)).toEqual(['B1T0', 'B1T1', 'B1T2', 'B1T3', 'B1T4', 'B2T0', 'B2T1', 'B2T2', 'B2T3', 'B2T4']);
      // Block 1 of group A1 is set A with MecHand, whatever the order.
      const b1 = tasks.filter((t) => t.block === 1 && !t.practice);
      expect(b1.every((t) => t.stimulus.startsWith('A') && t.condition === 'freehand')).toBe(true);
      orders.add(b1.map((t) => t.stimulus).join());
    }
    expect(orders.size).toBeGreaterThan(5);
    expect(shuffled([1, 2, 3], () => 0.999).sort()).toEqual([1, 2, 3]);
  });

  it('has matched sets: same kinds and the same number of curved arrows', () => {
    const sig = (set: string) => STIMULI.filter((s) => s.set === set).map((s) => `${s.kind}:${s.reference.curvedArrows}`);
    expect(sig('A')).toEqual(sig('B'));
  });
});
