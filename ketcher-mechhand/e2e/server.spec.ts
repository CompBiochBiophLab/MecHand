import { expect, test } from '@playwright/test';

// Runs only when a recognition server is available, e.g.:
//   MECHAND_SERVER_URL=http://localhost:8000 npx playwright test e2e/server.spec.ts
const SERVER = process.env.MECHAND_SERVER_URL;

test.skip(!SERVER, 'MECHAND_SERVER_URL not set (optional DECIMER server test)');

test('sends the ink to the DECIMER server and inserts its structure', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?level=C&engine=server&server=${encodeURIComponent(SERVER!)}`);
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  await page.click('[data-testid="mechand-freehand"]');
  const ink = page.locator('[data-testid="mechand-ink"]');
  await ink.waitFor({ state: 'visible' });
  const box = (await ink.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = 55;
  // A cyclohexane ring drawn in one stroke.
  const pts = Array.from({ length: 7 }, (_, k) => [cx + r * Math.cos((Math.PI / 3) * k + Math.PI / 6), cy + r * Math.sin((Math.PI / 3) * k + Math.PI / 6)]);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  await page.click('[data-testid="mechand-recognize"]');
  const dialog = page.locator('[data-testid="mechand-consolidate"]');
  await expect(dialog).toContainText('DECIMER', { timeout: 60_000 });
  await page.click('[data-testid="mechand-confirm"]');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toBe('C1CCCCC1');
});
