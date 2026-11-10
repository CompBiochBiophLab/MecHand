import { type Page, expect, test } from '@playwright/test';

/**
 * The pen bar: tools, colours, kinds of line and widths, the eraser and the ink
 * history, the trackpad (click – move – click) input mode, palm rejection and the
 * pen's eraser end (synthetic pen/touch Pointer Events).
 */

type P = [number, number];

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { mechand?: unknown }).mechand), null, { timeout: 60_000 });
  await page.click('[data-testid="mechand-freehand"]');
  const ink = page.locator('[data-testid="mechand-ink"]');
  await ink.waitFor({ state: 'visible' });
  const box = (await ink.boundingBox())!;
  return [box.x + box.width / 2 - 100, box.y + box.height / 2] as P;
}

async function draw(page: Page, o: P, pts: P[]) {
  await page.mouse.move(o[0] + pts[0][0], o[1] + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(o[0] + x, o[1] + y, { steps: 4 });
  await page.mouse.up();
}

/** A stroke made of synthetic Pointer Events of the given kind (pen, touch). */
async function pointerStroke(page: Page, o: P, pts: P[], init: { pointerType: string; button?: number; buttons?: number; width?: number }) {
  await page.evaluate(({ o, pts, init }) => {
    const svg = document.querySelector('[data-testid="mechand-ink"]')!;
    const base = { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, pressure: 0.6, width: init.width ?? 4, height: init.width ?? 4 };
    const at = ([x, y]: number[]) => ({ clientX: o[0] + x, clientY: o[1] + y });
    svg.dispatchEvent(new PointerEvent('pointerdown', { ...base, ...at(pts[0]), pointerType: init.pointerType, button: init.button ?? 0, buttons: init.buttons ?? 1 }));
    for (const p of pts.slice(1)) svg.dispatchEvent(new PointerEvent('pointermove', { ...base, ...at(p), pointerType: init.pointerType, button: -1, buttons: init.buttons ?? 1 }));
    svg.dispatchEvent(new PointerEvent('pointerup', { ...base, ...at(pts[pts.length - 1]), pointerType: init.pointerType, button: init.button ?? 0, buttons: 0 }));
  }, { o, pts, init });
}

const count = (page: Page) => page.evaluate(() => (window as any).mechand.layer.strokes.length as number);

test('pen bar: colour, line, width; eraser with undo and redo', async ({ page }) => {
  const o = await ready(page);
  await expect(page.locator('[data-testid="mechand-inkbar"]')).toBeVisible();
  await page.click('[data-testid="mechand-colour-red"]');
  await page.click('[data-testid="mechand-style-fountain"]');
  await page.click('[data-testid="mechand-width-4"]');
  await draw(page, o, [[0, 0], [60, 10], [120, 0]]);
  const g = page.locator('[data-testid="mechand-ink"] g').first();
  await expect(g).toHaveAttribute('stroke', '#dc2626');
  expect(await g.locator('path').count()).toBeGreaterThan(0);
  await page.click('[data-testid="mechand-style-dashed"]');
  await draw(page, o, [[0, 60], [120, 60]]);
  await expect(page.locator('[data-testid="mechand-ink"] g').nth(1).locator('path')).toHaveAttribute('stroke-dasharray', /\d/);
  expect(await count(page)).toBe(2);

  // The eraser removes the strokes it touches, as one undoable step.
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-testid="mechand-tool-eraser"]')).toHaveAttribute('aria-pressed', 'true');
  await draw(page, o, [[60, -30], [60, 80]]);
  expect(await count(page)).toBe(0);
  await page.keyboard.press('ControlOrMeta+KeyZ');
  expect(await count(page)).toBe(2);
  await page.keyboard.press('ControlOrMeta+Shift+KeyZ');
  expect(await count(page)).toBe(0);
  await page.click('[data-testid="mechand-undo-ink"]');
  await page.click('[data-testid="mechand-clear-ink"]');
  expect(await count(page)).toBe(0);
  await page.click('[data-testid="mechand-undo-ink"]');
  expect(await count(page)).toBe(2);

  // Settings are remembered in this browser.
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  await page.click('[data-testid="mechand-freehand"]');
  await expect(page.locator('[data-testid="mechand-colour-red"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-testid="mechand-style-dashed"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-testid="mechand-width-4"]')).toHaveAttribute('aria-checked', 'true');
});

test('ink appearance does not change recognition', async ({ page }) => {
  const o = await ready(page);
  await page.click('[data-testid="mechand-colour-purple"]');
  await page.click('[data-testid="mechand-style-marker"]');
  await draw(page, o, [[0, 30], [52, 0], [92, 23]]);
  const circle: P[] = Array.from({ length: 25 }, (_, k) => {
    const t = Math.PI / 2 + (k / 24) * 2 * Math.PI;
    return [118 + 11 * Math.cos(t), 38 - 14 * Math.sin(t)];
  });
  await draw(page, o, circle);
  await page.click('[data-testid="mechand-recognize"]');
  await page.click('[data-testid="mechand-confirm"]');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toMatch(/^(CCO|OCC)$/);
});

test('trackpad mode: click, move without pressing, click', async ({ page }) => {
  const o = await ready(page);
  await page.selectOption('[data-testid="mechand-input-mode"]', 'trackpad');
  await page.mouse.move(o[0], o[1]);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('[data-testid="mechand-open-stroke"]')).toBeVisible();
  for (const [x, y] of [[30, 10], [60, 0], [90, 12]]) await page.mouse.move(o[0] + x, o[1] + y, { steps: 3 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('[data-testid="mechand-open-stroke"]')).toBeHidden();
  expect(await count(page)).toBe(1);
  const pts = await page.evaluate(() => (window as any).mechand.layer.strokes[0].points.length as number);
  expect(pts).toBeGreaterThan(5);
  // A drag still draws; Escape drops an open stroke.
  await draw(page, o, [[0, 60], [100, 60]]);
  expect(await count(page)).toBe(2);
  await page.mouse.move(o[0], o[1] + 100);
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(o[0] + 50, o[1] + 100, { steps: 3 });
  await page.keyboard.press('Escape');
  await page.mouse.move(o[0] + 80, o[1] + 100, { steps: 3 });
  expect(await count(page)).toBe(2);
});

test('palm rejection, input modes and the pen eraser end', async ({ page }) => {
  const o = await ready(page);
  // Auto: a finger draws until a pen has been used.
  await pointerStroke(page, o, [[0, 0], [40, 0], [80, 0]], { pointerType: 'touch' });
  expect(await count(page)).toBe(1);
  await pointerStroke(page, o, [[0, 40], [40, 40], [80, 40]], { pointerType: 'pen' });
  expect(await count(page)).toBe(2);
  await expect(page.locator('[data-testid="mechand-input-device"]')).toHaveAttribute('data-type', 'pen');
  await pointerStroke(page, o, [[0, 80], [40, 80], [80, 80]], { pointerType: 'touch' });
  expect(await count(page)).toBe(2);
  await expect(page.locator('[data-testid="mechand-input-device"]')).toHaveAttribute('data-accepted', 'false');
  // A palm-sized contact is ignored even when fingers may draw.
  await page.selectOption('[data-testid="mechand-input-mode"]', 'touch');
  await pointerStroke(page, o, [[0, 120], [40, 120]], { pointerType: 'touch', width: 80 });
  expect(await count(page)).toBe(2);
  await pointerStroke(page, o, [[0, 120], [40, 120], [80, 120]], { pointerType: 'touch' });
  expect(await count(page)).toBe(3);
  // Pen only: fingers never draw.
  await page.selectOption('[data-testid="mechand-input-mode"]', 'pen');
  await pointerStroke(page, o, [[0, 160], [80, 160]], { pointerType: 'touch' });
  expect(await count(page)).toBe(3);
  // The eraser end of the pen erases whatever tool is selected.
  await pointerStroke(page, o, [[40, -20], [40, 20]], { pointerType: 'pen', button: 5, buttons: 32 });
  expect(await count(page)).toBe(2);
  await expect(page.locator('[data-testid="mechand-tool-pen"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the pen bar keeps its height while drawing (no canvas shift under the pen)', async ({ page }) => {
  for (const width of [1400, 1040, 820]) {
    await page.setViewportSize({ width, height: 900 });
    const o = await ready(page);
    const bar = page.locator('[data-testid="mechand-inkbar"]');
    const before = (await bar.boundingBox())!.height;
    const ink = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
    await page.selectOption('[data-testid="mechand-input-mode"]', 'trackpad');
    await page.mouse.move(o[0], o[1]);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-testid="mechand-open-stroke"]')).toBeVisible();
    expect((await bar.boundingBox())!.height).toBe(before);
    expect((await page.locator('[data-testid="mechand-ink"]').boundingBox())!.y).toBe(ink.y);
    await page.keyboard.press('Escape');
  }
});

test('shortcuts work while Ketcher keeps the focus in its clipboard area', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-cliparea'))).toBe(true);
  await page.keyboard.press('Alt+KeyF');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toHaveAttribute('aria-pressed', 'true');
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  await draw(page, [box.x + 300, box.y + 300], [[0, 0], [60, 0]]);
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-testid="mechand-tool-eraser"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('KeyP');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-testid="mechand-consolidate"]')).toBeVisible();
});
