import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

/**
 * Regenerates the screenshots of the website and tutorial (docs/public/img) and of the
 * user-study instructions from the current app, in English (study/img) and Catalan (study/ca/img)
 * of the article repository (MECHAND_STUDY_DIR, default ../Article_MecHand/study next to this
 * repository; skipped if it is not there). Skipped unless asked for:
 *
 *   MECHAND_SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=chromium
 *
 * The SN2 ink is synthetic handwriting (e2e/fixtures/sn2-ink.json, written by
 * src/recognition/ink.export.test.ts), drawn with the mouse.
 */

const DOCS = join(import.meta.dirname, '..', '..', 'docs', 'public', 'img');
const STUDY = process.env.MECHAND_STUDY_DIR ?? join(import.meta.dirname, '..', '..', '..', 'Article_MecHand', 'study');
const STUDY_SHOTS = [
  { lang: 'en', dir: join(STUDY, 'img'), start: 'study-start.png', task: 'study-task.png' },
  { lang: 'ca', dir: join(STUDY, 'ca', 'img'), start: 'estudi-inici.png', task: 'estudi-tasca.png' },
];
const INK = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'sn2-ink.json'), 'utf8')) as { strokes: number[][][] };

test.skip(!process.env.MECHAND_SCREENSHOTS, 'set MECHAND_SCREENSHOTS=1 to regenerate the screenshots');
test.use({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 2 });

async function ready(page: Page, url = '/') {
  // No first-visit tips or tour offer in the pictures.
  await page.addInitScript(() => {
    localStorage.setItem('mechand.tips.v1', JSON.stringify(['welcome', 'firstFreehand', 'ignored', 'trackpad']));
    localStorage.setItem('mechand.tour.v1', 'done');
  });
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as unknown as { mechand?: unknown }).mechand), null, { timeout: 60_000 });
}

async function drawFixture(page: Page) {
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  const xs = INK.strokes.flat().map((p) => p[0]), ys = INK.strokes.flat().map((p) => p[1]);
  const dx = box.x + 200 - Math.min(...xs), dy = box.y + 150 - Math.min(...ys);
  for (const s of INK.strokes) {
    await page.mouse.move(s[0][0] + dx, s[0][1] + dy);
    await page.mouse.down();
    for (const [x, y] of s.slice(1)) await page.mouse.move(x + dx, y + dy);
    await page.mouse.up();
  }
  await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40);
}

test('website and tutorial screenshots', async ({ page }) => {
  await ready(page);
  await page.click('[data-testid="mechand-library-btn"]');
  await page.fill('[data-testid="mechand-library-search"]', 'SN2');
  await page.locator('[data-testid="mechand-library-item"][data-id="mech-sn2"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toContain('Br');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DOCS, 'app-template.png') });

  await page.evaluate(() => (window as any).ketcher.setMolecule(''));
  await page.click('[data-testid="mechand-freehand"]');
  await drawFixture(page);
  await page.screenshot({ path: join(DOCS, 'freehand-ink.png') });
  await page.screenshot({ path: join(DOCS, 'pen-bar.png'), clip: { x: 0, y: 0, width: 1360, height: 96 } });

  await page.click('[data-testid="mechand-recognize"]');
  await page.locator('[data-testid="mechand-consolidate"]').waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DOCS, 'recognize-dialog.png') });
  await page.click('[data-testid="mechand-confirm"]');
  await page.click('[data-testid="mechand-freehand"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DOCS, 'inserted.png') });

  await page.click('[data-testid="mechand-export-btn"]');
  await expect(page.locator('[data-testid="mechand-export-text"]')).toHaveValue(/tikzpicture/);
  await page.screenshot({ path: join(DOCS, 'export-dialog.png') });
  await page.keyboard.press('Escape');

  await page.click('[data-testid="mechand-teach-btn"]');
  const teach = page.locator('[data-testid="mechand-teach-box"]');
  await teach.waitFor();
  const tb = (await teach.boundingBox())!;
  await page.mouse.move(tb.x + 110, tb.y + 50);
  await page.mouse.down();
  for (let k = 1; k <= 24; k++) {
    const t = Math.PI / 2 + (k / 24) * 2 * Math.PI;
    await page.mouse.move(tb.x + 110 + 40 * Math.cos(t), tb.y + 110 - 60 * Math.sin(t));
  }
  await page.mouse.up();
  await page.locator('[data-testid="mechand-teach-reading"]').waitFor();
  await page.screenshot({ path: join(DOCS, 'teach-panel.png') });
  await page.keyboard.press('Escape');

  await page.keyboard.press('F1');
  await page.locator('[data-testid="mechand-help-center"]').waitFor();
  await page.screenshot({ path: join(DOCS, 'help-center.png') });
  await page.keyboard.press('Escape');

  await page.click('[data-testid="mechand-about-btn"]');
  await page.locator('[data-testid="mechand-about"]').waitFor();
  await page.screenshot({ path: join(DOCS, 'about-panel.png') });
  await page.keyboard.press('Escape');

  const library = page.locator('[data-testid="mechand-library-btn"]');
  if (await library.count()) {
    await page.evaluate(() => (window as any).ketcher.setMolecule(''));
    await library.click();
    await page.locator('[data-testid="mechand-library"]').waitFor();
    await page.screenshot({ path: join(DOCS, 'library.png') });
    await page.fill('[data-testid="mechand-library-search"]', 'amide');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(DOCS, 'library-search.png') });
    await page.keyboard.press('Escape');
  }
});

for (const shot of STUDY_SHOTS) test(`user-study screenshots (${shot.lang})`, async ({ page }) => {
  test.skip(!existsSync(STUDY), `no article repository at ${STUDY} (set MECHAND_STUDY_DIR)`);
  mkdirSync(shot.dir, { recursive: true });
  page.on('dialog', (d) => d.accept());
  await ready(page, `/?study=1&group=A1&lang=${shot.lang}`);
  const panel = page.locator('[data-testid="mechand-study"]');
  await panel.waitFor();
  await page.selectOption('[data-testid="study-role"]', 'estudiant');
  await page.selectOption('[data-testid="study-course"]', '2');
  await page.selectOption('[data-testid="study-device"]', 'tauleta-llapis');
  await page.selectOption('[data-testid="study-country"]', 'ES');
  await page.selectOption('[data-testid="study-experience"]', 'poca');
  await page.check('[data-testid="study-consent"]');
  await panel.screenshot({ path: join(shot.dir, shot.start) });
  await page.click('[data-testid="study-begin"]');
  await page.click('[data-testid="study-teach-done"]');
  await page.click('[data-testid="study-start-task"]');
  await page.click('[data-testid="mechand-freehand"]');
  await drawFixture(page);
  await page.screenshot({ path: join(shot.dir, shot.task) });
});
