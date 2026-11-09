import { type Page, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * A whole session of the user study (?study=1): questionnaire, training, two
 * blocks of tasks (freehand, then Ketcher only), SUS, final questions, download
 * of the session file and clearing of the browser. Checks what the file holds —
 * and what it must not hold — and that nothing is sent over the network.
 */

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

async function sus(page: Page) {
  const form = page.locator('[data-testid="study-sus"]');
  await form.waitFor();
  for (let i = 0; i < 10; i++) await form.locator(`input[name="sus-${i}"]`).nth(2).check();
  await page.click('[data-testid="study-sus-done"]');
}

test('runs a study session locally and produces a minimal session file', async ({ page, context }) => {
  const requests: string[] = [];
  context.on('request', (r) => requests.push(r.url()));
  page.on('dialog', (d) => d.accept());
  await page.goto('/?study=1&group=A1');
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
  await page.locator('[data-testid="mechand-study"]').waitFor();
  const afterLoad = requests.length;

  // Questionnaire.
  await expect(page.locator('[data-testid="study-group"]')).toHaveValue('A1');
  await page.selectOption('[data-testid="study-role"]', 'estudiant');
  await page.selectOption('[data-testid="study-course"]', '2');
  await page.selectOption('[data-testid="study-device"]', 'ordinador-ratoli');
  await page.selectOption('[data-testid="study-country"]', 'MA');
  await page.selectOption('[data-testid="study-experience"]', 'poca');
  await expect(page.locator('[data-testid="study-begin"]')).toBeDisabled();
  await page.check('[data-testid="study-consent"]');
  await page.click('[data-testid="study-begin"]');

  // Training, then block 1 (freehand): practice task with a handwritten ethanol.
  await page.click('[data-testid="study-teach-done"]');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toBeDisabled(); // not before the task starts
  await page.click('[data-testid="study-start-task"]');
  await expect(page.locator('[data-testid="study-condition"]')).toContainText('MecHand');
  await page.click('[data-testid="mechand-freehand"]');
  const ink = page.locator('[data-testid="mechand-ink"]');
  await ink.waitFor({ state: 'visible' });
  const box = (await ink.boundingBox())!;
  const o: P = [box.x + box.width / 2 - 100, box.y + box.height / 2];
  await draw(page, o, [[0, 30], [52, 0], [92, 23]]);
  await draw(page, o, circle(118, 38, 11, 14));
  await page.click('[data-testid="mechand-recognize"]');
  await page.click('[data-testid="mechand-confirm"]');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toMatch(/^(CCO|OCC)$/);
  await page.click('[data-testid="study-finish-task"]');
  await expect.poll(() => page.evaluate(() => (window as any).ketcher.getSmiles())).toBe(''); // canvas cleared
  for (let k = 0; k < 4; k++) {
    await page.click('[data-testid="study-start-task"]');
    await page.click('[data-testid="study-finish-task"]');
  }
  await sus(page);

  // Block 2: Ketcher only — freehand stays off.
  await page.click('[data-testid="study-start-task"]');
  await expect(page.locator('[data-testid="study-condition"]')).toContainText('Ketcher');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toBeDisabled();
  await page.keyboard.press('Alt+KeyF');
  await expect(page.locator('[data-testid="mechand-freehand"]')).toHaveAttribute('aria-pressed', 'false');
  await page.click('[data-testid="study-finish-task"]');
  for (let k = 0; k < 4; k++) {
    await page.click('[data-testid="study-start-task"]');
    await page.click('[data-testid="study-finish-task"]');
  }
  await sus(page);
  await page.click('[data-testid="study-final-done"]');

  // Download and inspect the session file.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="study-download"]')]);
  expect(download.suggestedFilename()).toMatch(/^mechand-estudi-MH-[A-Z2-9]{5}\.json$/);
  const text = readFileSync((await download.path())!, 'utf8');
  const s = JSON.parse(text);
  expect(s.schema).toBe('mechand-study-session/2');
  expect(s.code).toMatch(/^MH-[A-Z2-9]{5}$/);
  expect(s.group).toBe('A1');
  expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(s.participant).toEqual({ role: 'estudiant', course: 2, device: 'ordinador-ratoli', literacyCountry: 'MA', handedness: null, experience: 'poca' });
  expect(Object.keys(s.environment).sort()).toEqual(
    ['architecture', 'architectureSource', 'browser', 'maxTouchPoints', 'mobile', 'os', 'pointerTypes', 'screen'].sort());
  expect(s.environment.browser.name).not.toBe('');
  expect(s.environment.pointerTypes).toContain('mouse');
  expect(s.tasks).toHaveLength(10);
  expect(Object.keys(s.sus).sort()).toEqual(['freehand', 'ketcher']);
  expect(s.sus.freehand).toEqual(Array(10).fill(3));
  const recog = s.events.find((e: any) => e.type === 'recognize');
  expect(recog.task).toBe('B1T0');
  expect(recog.data.ink[0].points[0]).toHaveLength(2);
  expect(typeof recog.data.ink[0].t0).toBe('number');
  expect(recog.data.result.scene.atoms).toHaveLength(3);
  expect(s.events.filter((e: any) => e.type === 'task-end')).toHaveLength(10);
  expect(s.events.find((e: any) => e.type === 'task-end').data.ket).toContain('"root"');
  expect(s.teachSamples).toBeUndefined(); // not shared unless the participant opts in
  // Nothing that identifies the browser or the person.
  const ua = await page.evaluate(() => navigator.userAgent);
  expect(text).not.toContain(ua);
  expect(text).not.toMatch(/userAgent|Mozilla\/|"ip"|e-?mail/i);

  // Nothing sent anywhere; clearing leaves nothing behind.
  expect(requests.slice(afterLoad).filter((u) => !u.includes('/study/'))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(new Set(requests.map((u) => new URL(u).origin))).toEqual(new Set([origin]));
  expect(await context.cookies()).toEqual([]);
  await page.click('[data-testid="study-clear"]');
  await page.locator('[data-testid="study-begin"]').waitFor();
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mechand.')));
  expect(keys.filter((k) => k.includes('study'))).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mechand.symbols.user.v1') ?? '{"samples":[]}').samples)).toEqual([]);
});
