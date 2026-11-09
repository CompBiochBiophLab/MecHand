import { type Page, expect, test } from '@playwright/test';

type P = [number, number];

async function draw(page: Page, origin: P, pts: P[]) {
  await page.mouse.move(origin[0] + pts[0][0], origin[1] + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(origin[0] + x, origin[1] + y, { steps: 4 });
  await page.mouse.up();
}

const circle = (cx: number, cy: number, rx: number, ry: number): P[] =>
  Array.from({ length: 25 }, (_, k) => {
    const t = Math.PI / 2 + (k / 24) * 2 * Math.PI;
    return [cx + rx * Math.cos(t), cy - ry * Math.sin(t)];
  });

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { mechand?: unknown }).mechand), null, { timeout: 60_000 });
}

test('opens a mechanism template in Ketcher', async ({ page }) => {
  await ready(page);
  const options = page.locator('[data-testid="mechand-templates"] option');
  expect(await options.count()).toBeGreaterThan(10);
  await page.selectOption('[data-testid="mechand-templates"]', 'sn2');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toContain('Br');
  const ket = JSON.parse(await page.evaluate(() => (window as any).ketcher.getKet()));
  const arcs = ket.root.nodes.filter((n: any) => n.type === 'arrow' && String(n.data.mode).startsWith('elliptical-arc'));
  expect(arcs.length).toBeGreaterThan(0);
});

test('recognizes handwritten ethanol and inserts it into Ketcher', async ({ page }) => {
  await ready(page);
  await page.click('[data-testid="mechand-freehand"]');
  const ink = page.locator('[data-testid="mechand-ink"]');
  await ink.waitFor({ state: 'visible' });
  const box = (await ink.boundingBox())!;
  const o: P = [box.x + box.width / 2 - 100, box.y + box.height / 2];
  // C–C–O zig-zag drawn as one stroke, ending short of the "O" label.
  await draw(page, o, [[0, 30], [52, 0], [92, 23]]);
  await draw(page, o, circle(118, 38, 11, 14)); // "O"
  await expect(page.locator('[data-testid="mechand-recognize"]')).toContainText('(2)');
  await page.click('[data-testid="mechand-recognize"]');
  const dialog = page.locator('[data-testid="mechand-consolidate"]');
  await expect(dialog).toContainText('3 atoms');
  await expect(dialog).toContainText('2 bonds');
  await page.click('[data-testid="mechand-confirm"]');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toMatch(/^(CCO|OCC)$/);
});

test('exports the canvas to TikZ and ChemDraw', async ({ page }) => {
  await ready(page);
  await page.selectOption('[data-testid="mechand-templates"]', 'sn2');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toContain('Br');
  await page.click('[data-testid="mechand-export-btn"]');
  const text = page.locator('[data-testid="mechand-export-text"]');
  await expect(text).toHaveValue(/\\begin\{tikzpicture\}/);
  await expect(text).toHaveValue(/controls/); // curved arrows as Bézier curves
  await page.getByRole('button', { name: 'ChemDraw (CDXML)' }).click();
  await expect(text).toHaveValue(/<CDXML/);
});
