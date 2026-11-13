import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const INK = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'sn2-ink.json'), 'utf8')) as { strokes: number[][][] };

// User levels (src/config/levels.json), the simple periodic table, the chemistry explanations and
// the translated tooltips of Ketcher's own toolbars.

async function ready(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('mechand-bar')).toBeVisible();
  // Ketcher also renders a hidden polymer-editor canvas with the same test id; wait for the visible one.
  await page.locator('[data-testid="ketcher-canvas"]').filter({ visible: true }).first().waitFor();
}

test.describe('first use', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('asks the level, remembers it, and the bar can change it', async ({ page }) => {
    await page.goto('/?lang=ca');
    await ready(page);
    const chooser = page.getByTestId('mechand-level-chooser');
    await expect(chooser).toBeVisible();
    await expect(chooser).toContainText('Estudiant');
    await chooser.locator('[data-level="A"]').click();
    await expect(chooser).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('mechand.level.v1'))).toBe('A');
    await expect(page.getByTestId('mechand-level')).toHaveValue('A');
    await page.reload();
    await ready(page);
    await expect(page.getByTestId('mechand-level-chooser')).toBeHidden();
    await page.getByTestId('mechand-level').selectOption('C');
    expect(await page.evaluate(() => localStorage.getItem('mechand.level.v1'))).toBe('C');
  });
});

test('level A: basic templates in Catalan, the periodic table and the chemistry help', async ({ page }) => {
  await page.goto('/?lang=ca&level=A');
  await ready(page);
  // ?level= fixes the level: no menu, no dialog.
  await expect(page.getByTestId('mechand-level')).toHaveCount(0);
  await expect(page.getByTestId('mechand-level-chooser')).toBeHidden();

  await page.getByTestId('mechand-library-btn').click();
  await expect(page.getByTestId('mechand-library-note')).toContainText('bàsiques');
  const tiles = page.getByTestId('mechand-library-item');
  const n = await tiles.count();
  expect(n).toBeGreaterThan(20);
  expect(n).toBeLessThan(100);
  await expect(page.locator('[data-testid="mechand-library-item"][data-id="benzene"]')).toContainText('Benzè');
  await expect(page.locator('[data-id="lda"]')).toHaveCount(0);
  await page.getByTestId('mechand-library-search').fill('hidròxid');
  await expect(tiles.first()).toHaveAttribute('data-id', /hydroxide|naoh/);
  await page.keyboard.press('Escape');

  await page.getByTestId('mechand-periodic-btn').click();
  const table = page.getByTestId('mechand-periodic');
  await expect(table).toBeVisible();
  await table.locator('[data-symbol="O"]').click();
  await expect(page.getByTestId('mechand-periodic-name')).toHaveText('Oxigen');
  await expect(page.getByTestId('mechand-periodic-lonepairs')).toHaveText('2');
  await expect(page.getByTestId('mechand-periodic-bonds')).toHaveText('2');
  await page.getByTestId('mechand-periodic-use').click();
  await page.getByTestId('mechand-periodic-close').click();
  await expect(table).toBeHidden();

  await page.getByTestId('mechand-help-btn').click();
  const learn = page.getByTestId('mechand-learn');
  await expect(learn).toContainText('Aprèn química');
  // Level A: always on, no switch.
  await expect(page.getByTestId('mechand-learn-switch')).toHaveCount(0);
  await learn.locator('[data-learn-topic="curvedArrows"] button').click();
  await expect(learn.locator('[data-learn-topic="curvedArrows"]')).toContainText('dos electrons');
});

test('level B: whole library, chemistry help can be turned on', async ({ page }) => {
  await page.goto('/?lang=es&level=B');
  await ready(page);
  await page.getByTestId('mechand-library-btn').click();
  await expect(page.getByTestId('mechand-library-note')).toHaveCount(0);
  await expect(page.locator('[data-id="lda"]')).toContainText('LDA');
  await page.keyboard.press('Escape');
  await page.getByTestId('mechand-help-btn').click();
  const sw = page.getByTestId('mechand-learn-switch');
  await expect(sw).not.toBeChecked();
  await sw.check();
  await expect(page.locator('[data-tip^="learn-"]')).toBeVisible();
});

test("Ketcher's tooltips follow the interface language", async ({ page }) => {
  await page.goto('/?lang=ca');
  await ready(page);
  await expect(page.locator('[title="Esborra (Del)"]').first()).toBeAttached();
  await expect(page.locator('[title="Carboni (C)"]').first()).toBeAttached();
  await page.getByTestId('mechand-language').selectOption('es');
  await expect(page.locator('[title="Carbono (C)"]').first()).toBeAttached();
  await page.getByTestId('mechand-language').selectOption('en');
  await expect(page.locator('[title="Carbon (C)"]').first()).toBeAttached();
});

test('level A explains each recognized arrow in words', async ({ page }) => {
  await page.goto('/?lang=ca&level=A');
  await ready(page);
  await page.getByTestId('mechand-freehand').click();
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  const xs = INK.strokes.flat().map((p) => p[0]), ys = INK.strokes.flat().map((p) => p[1]);
  const dx = box.x + 200 - Math.min(...xs), dy = box.y + 150 - Math.min(...ys);
  for (const s of INK.strokes) {
    await page.mouse.move(s[0][0] + dx, s[0][1] + dy);
    await page.mouse.down();
    for (const [x, y] of s.slice(1)) await page.mouse.move(x + dx, y + dy);
    await page.mouse.up();
  }
  await page.getByTestId('mechand-recognize').click();
  const explain = page.getByTestId('mechand-explain');
  await expect(explain).toContainText('Què volen dir les teves fletxes');
  await expect(explain.locator('li').first()).toContainText('Fletxa 1');
  if (process.env.MECHAND_SHOTS) await page.screenshot({ path: join(process.env.MECHAND_SHOTS, 'explain.png') });
});
