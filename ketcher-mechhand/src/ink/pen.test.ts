import { describe, expect, it } from 'vitest';
import { DEFAULT_PEN, cleanPenSettings, eraserTouches, fountainFactors, segmentDistance } from './pen';

const pt = (x: number, y: number, t = 0, pressure = 0.5) => ({ x, y, t, pressure });

describe('pen settings', () => {
  it('keeps only known values', () => {
    expect(cleanPenSettings(null)).toEqual(DEFAULT_PEN);
    expect(cleanPenSettings({ colour: '#dc2626', style: 'marker', width: 4, input: 'trackpad' }))
      .toEqual({ colour: '#dc2626', style: 'marker', width: 4, input: 'trackpad' });
    expect(cleanPenSettings({ colour: 'javascript:alert(1)', style: 'x' as never, width: 999, input: 'y' as never })).toEqual(DEFAULT_PEN);
  });
});

describe('fountain pen', () => {
  it('follows pressure when the device reports it', () => {
    const f = fountainFactors([pt(0, 0, 0, 0.1), pt(10, 0, 10, 0.1), pt(20, 0, 20, 0.9), pt(30, 0, 30, 0.9)]);
    expect(f).toHaveLength(3);
    expect(f[0]).toBeLessThan(f[2]);
  });
  it('is thinner when faster without pressure (mouse, trackpad)', () => {
    const slow = fountainFactors([pt(0, 0, 0), pt(2, 0, 20), pt(4, 0, 40)]);
    const fast = fountainFactors([pt(0, 0, 0), pt(40, 0, 10), pt(80, 0, 20)]);
    expect(fast[1]).toBeLessThan(slow[1]);
    for (const f of [...slow, ...fast]) expect(f).toBeGreaterThanOrEqual(0.45);
  });
});

describe('stroke eraser', () => {
  it('measures segment distances', () => {
    expect(segmentDistance({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(0);
    expect(segmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBeCloseTo(5);
  });
  it('touches a stroke the eraser crosses between two samples', () => {
    const stroke = [{ x: 0, y: 50 }, { x: 100, y: 50 }];
    // The eraser jumps from above to below the line in one move: still a hit.
    expect(eraserTouches({ x: 50, y: 0 }, { x: 50, y: 100 }, 5, stroke)).toBe(true);
    expect(eraserTouches({ x: 150, y: 0 }, { x: 150, y: 100 }, 5, stroke)).toBe(false);
    // Near but not touching, unless the line is broad.
    expect(eraserTouches({ x: 50, y: 40 }, { x: 50, y: 40 }, 8, stroke)).toBe(false);
    expect(eraserTouches({ x: 50, y: 40 }, { x: 50, y: 40 }, 8, stroke, 3)).toBe(true);
  });
  it('touches a dot', () => {
    expect(eraserTouches({ x: 0, y: 0 }, { x: 10, y: 0 }, 4, [{ x: 5, y: 2 }])).toBe(true);
  });
});

describe('ink rendering', () => {
  it('smooths strokes with quadratic curves through the segment midpoints', async () => {
    const { pathOf } = await import('./pen');
    expect(pathOf([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M0.0 0.0 L10.0 0.0');
    expect(pathOf([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe('M0.0 0.0 Q10.0 0.0 10.0 5.0 L10.0 10.0');
  });
});
