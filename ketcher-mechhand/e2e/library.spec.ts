import { type Page, expect, test } from '@playwright/test';

/**
 * The template library (Ctrl/⌘+K): search, insertion, favourites, SMILES/InChI and CAS numbers
 * read offline, and the online look-up of names, which only happens when asked for (PubChem is
 * mocked here: the test never leaves the machine).
 */

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as any).mechand), null, { timeout: 60_000 });
}

const smiles = (page: Page) => page.evaluate(() => (window as any).ketcher.getSmiles() as Promise<string>);

async function openLibrary(page: Page) {
  await page.keyboard.press('ControlOrMeta+KeyK');
  await page.locator('[data-testid="mechand-library"]').waitFor();
  await expect(page.locator('[data-testid="mechand-library-search"]')).toBeFocused();
}

test('search by name in any language, abbreviation or CAS number, and insert', async ({ page }) => {
  await ready(page);
  await openLibrary(page);
  await page.keyboard.type('benzè');
  await expect(page.locator('[data-testid="mechand-library-item"]').first()).toHaveAttribute('data-id', 'benzene');
  await page.keyboard.press('Enter');
  await expect.poll(() => smiles(page)).toMatch(/c1ccccc1|C1=CC=CC=C1/i);

  await openLibrary(page);
  await page.keyboard.type('64-17-5'); // ethanol, offline
  await expect(page.locator('[data-testid="mechand-library-item"]').first()).toHaveAttribute('data-id', 'ethanol');
  await expect(page.locator('[data-testid="mechand-library-details"]')).toContainText('CAS 64-17-5');
  await page.keyboard.press('Enter');
  await expect.poll(() => smiles(page)).toContain('.'); // added next to the benzene, not replacing it

  await openLibrary(page);
  await page.keyboard.type('SN2');
  await expect(page.locator('[data-testid="mechand-library-item"]').first()).toHaveAttribute('data-id', 'mech-sn2');
  await page.keyboard.press('Enter'); // mechanisms replace the canvas
  await expect.poll(() => smiles(page)).toContain('Br');
});

test('SMILES and InChI are read offline, with a preview; names are not misread as SMILES', async ({ page }) => {
  await ready(page);
  await openLibrary(page);
  await page.keyboard.type('CC(=O)Oc1ccccc1C(=O)O');
  const first = page.locator('[data-testid="mechand-library-item"]').first();
  await expect(first).toHaveAttribute('data-id', /^smiles:/);
  await page.keyboard.press('Enter');
  await expect.poll(() => smiles(page)).toMatch(/O=C\(O\)|C\(O\)=O|C\(=O\)O/);

  await openLibrary(page);
  await page.keyboard.type('InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3');
  await expect(first).toHaveAttribute('data-id', /^inchi:/);

  await page.fill('[data-testid="mechand-library-search"]', 'paracetamolx');
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="mechand-library-item"][data-id^="smiles:"]')).toHaveCount(0);
});

test('names are looked up online only when asked for', async ({ page }) => {
  const calls: string[] = [];
  await page.route(/pubchem\.ncbi\.nlm\.nih\.gov|ebi\.ac\.uk/, (route) => {
    calls.push(route.request().url());
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ PropertyTable: { Properties: [{ CID: 1983, SMILES: 'CC(=O)NC1=CC=C(C=C1)O', Title: 'Acetaminophen' }] } }),
    });
  });
  await ready(page);
  await openLibrary(page);
  await page.keyboard.type('tylenol');
  await page.locator('[data-testid="mechand-lookup-btn"]').waitFor();
  await page.waitForTimeout(500);
  expect(calls).toEqual([]); // typing sends nothing
  await page.click('[data-testid="mechand-lookup-btn"]');
  const first = page.locator('[data-testid="mechand-library-item"]').first();
  await expect(first).toHaveAttribute('data-id', 'pubchem:1983');
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/compound/name/tylenol/');
  await first.click();
  await expect.poll(() => smiles(page)).toContain('N');
});

test('favourites are kept (ids only) and the library is off in study mode', async ({ page }) => {
  await ready(page);
  await openLibrary(page);
  await page.keyboard.type('pyridine');
  await page.keyboard.press('ControlOrMeta+KeyD');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mechand.library.favourites') ?? '[]'))).toEqual(['pyridine']);
  await openLibrary(page);
  await page.click('[data-filter="favourites"]');
  await expect(page.locator('[data-testid="mechand-library-item"]')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await ready(page, '/?study=1&group=A1');
  await expect(page.locator('[data-testid="mechand-library-btn"]')).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+KeyK');
  await expect(page.locator('[data-testid="mechand-library"]')).toHaveCount(0);
});
