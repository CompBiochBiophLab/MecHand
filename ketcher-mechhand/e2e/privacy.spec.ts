import { expect, test } from '@playwright/test';

/**
 * Privacy guarantee, checked on every change: after the page has loaded, using
 * MecHand (templates, freehand drawing, recognition, insertion, Teach, export)
 * makes no network request at all, and only the page's own origin is contacted.
 */
test('uses no network after loading and stores Teach samples only locally', async ({ page, context }) => {
  const requests: { url: string; method: string; body: boolean }[] = [];
  context.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: Boolean(r.postData()) }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  const afterLoad = requests.length;

  await page.selectOption('[data-testid="mechand-templates"]', 'sn2');
  await page.evaluate(() => (window as any).ketcher.setMolecule(''));
  await page.click('[data-testid="mechand-freehand"]');
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  const ox = box.x + box.width / 2 - 100, oy = box.y + box.height / 2;
  await page.mouse.move(ox, oy + 30);
  await page.mouse.down();
  for (const [x, y] of [[52, 0], [92, 23]]) await page.mouse.move(ox + x, oy + y, { steps: 4 });
  await page.mouse.up();
  await page.click('[data-testid="mechand-recognize"]');
  await page.click('[data-testid="mechand-confirm"]');
  await page.click('[data-testid="mechand-freehand"]');

  await page.locator('button', { hasText: 'Teach' }).click();
  const tb = (await page.locator('[data-testid="mechand-teach"] svg').boundingBox())!;
  await page.mouse.move(tb.x + 110, tb.y + 50);
  await page.mouse.down();
  for (let k = 1; k <= 24; k++) {
    const t = Math.PI / 2 + (k / 24) * 2 * Math.PI;
    await page.mouse.move(tb.x + 110 + 40 * Math.cos(t), tb.y + 110 - 60 * Math.sin(t));
  }
  await page.mouse.up();
  await page.getByRole('button', { name: 'Save sample' }).click();
  await page.keyboard.press('Escape');
  await page.click('[data-testid="mechand-export-btn"]');
  await expect(page.locator('[data-testid="mechand-export-text"]')).toHaveValue(/tikzpicture/);

  expect(requests.slice(afterLoad), 'requests made while using MecHand').toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(new Set(requests.map((r) => new URL(r.url).origin))).toEqual(new Set([origin]));
  expect(requests.filter((r) => r.method !== 'GET' || r.body)).toEqual([]);
  expect(await context.cookies()).toEqual([]);

  const sample = await page.evaluate(() => JSON.parse(localStorage.getItem('mechand.symbols.user.v1')!).samples[0]);
  expect(Object.keys(sample).sort()).toEqual(['strokes', 'symbol']);
  expect(Object.keys(sample.strokes[0][0]).sort()).toEqual(['x', 'y']);
});
