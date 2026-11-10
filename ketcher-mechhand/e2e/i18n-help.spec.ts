import { type Page, expect, test } from '@playwright/test';

/** Interface languages (JSON locale files), the help centre, the guided tour and contextual tips. */

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
}

test('the interface follows the chosen language, which is remembered; ?lang= wins', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-testid="mechand-freehand"]')).toContainText('Freehand');
  await page.selectOption('[data-testid="mechand-language"]', 'ca');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toContainText('Mà alçada');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  await expect(page.locator('[data-testid="mechand-freehand"]')).toContainText('Mà alçada');
  expect(await page.evaluate(() => localStorage.getItem('mechand.lang.v1'))).toBe('ca');
  await ready(page, '/?lang=es');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toContainText('A mano alzada');
  // Dialogs are translated too.
  await page.click('[data-testid="mechand-export-btn"]');
  await expect(page.locator('[data-testid="mechand-export"]')).toContainText('Exportar');
});

test('study mode runs in Catalan even if another language was chosen before', async ({ page }) => {
  await ready(page);
  await page.selectOption('[data-testid="mechand-language"]', 'en');
  await ready(page, '/?study=1&group=A1');
  await expect(page.locator('[data-testid="mechand-study"]')).toContainText('Estudi MecHand');
  await ready(page, '/?study=1&group=A1&lang=es');
  await expect(page.locator('[data-testid="mechand-study"]')).toContainText('Estudio MecHand');
});

test('help centre: F1, tips for what you are doing, search, and Esc', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('F1');
  const help = page.locator('[data-testid="mechand-help-center"]');
  await expect(help).toBeVisible();
  await expect(help.locator('[data-tip="off"]')).toBeVisible();
  await expect(help.locator('[data-topic="start"]')).toHaveAttribute('data-open', 'true');
  await page.fill('[data-testid="mechand-help-search"]', 'trackpad');
  await expect(help.locator('[data-topic="penbar"]')).toBeVisible();
  await expect(help.locator('[data-topic="export"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);

  // With freehand on and some ink, the help opens on recognition and suggests pressing Space.
  await page.click('[data-testid="mechand-freehand"]');
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.click('[data-testid="mechand-help-btn"]');
  await expect(help.locator('[data-tip="strokes"]')).toBeVisible();
  await expect(help.locator('[data-topic="recognize"]')).toHaveAttribute('data-open', 'true');
});

test('guided tour: steps through the controls (turning freehand on for the pen bar) and is remembered', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('F1');
  await page.click('[data-testid="mechand-help-tour"]');
  const tour = page.locator('[data-testid="mechand-tour"]');
  await expect(tour).toHaveAttribute('data-step', 'freehand');
  await page.click('[data-testid="mechand-tour-next"]');
  await expect(tour).toHaveAttribute('data-step', 'inkbar');
  await expect(page.locator('[data-testid="mechand-inkbar"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mechand.tour.v1'))).toBe('done');
});

test('contextual tips: a welcome once, and a hint when a finger is ignored', async ({ page }) => {
  await ready(page);
  const tip = page.locator('[data-testid="mechand-tip"]');
  await expect(tip).toHaveAttribute('data-tip', 'welcome');
  await page.click('[data-testid="mechand-tip-close"]');
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  await expect(tip).toHaveCount(0);

  await page.click('[data-testid="mechand-freehand"]');
  await page.click('[data-testid="mechand-tip-close"]').catch(() => {}); // the first-freehand tip, if shown
  const box = (await page.locator('[data-testid="mechand-ink"]').boundingBox())!;
  await page.evaluate(({ x, y }) => {
    const svg = document.querySelector('[data-testid="mechand-ink"]')!;
    const ev = (type: string, pointerType: string, dx: number) => new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 9, pointerType, clientX: x + dx, clientY: y, buttons: type === 'pointerup' ? 0 : 1, width: 4, height: 4,
    });
    for (const t of ['pointerdown', 'pointermove', 'pointerup']) svg.dispatchEvent(ev(t, 'pen', t === 'pointermove' ? 30 : 0));
    for (let k = 0; k < 3; k++) svg.dispatchEvent(ev('pointerdown', 'touch', 0)); // palms
  }, { x: box.x + 200, y: box.y + 200 });
  await expect(tip).toHaveAttribute('data-tip', 'ignored');
  await page.click('[data-testid="mechand-tip-action"]');
  await expect(page.locator('[data-testid="mechand-input-mode"]')).toHaveValue('touch');
});
