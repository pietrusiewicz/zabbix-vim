import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ZBX_URL = process.env.ZBX_URL;
const ZBX_USER = process.env.ZBX_USER || 'Admin';
const ZBX_PASSWORD = process.env.ZBX_PASSWORD || 'zabbix';

const EXTENSION = fileURLToPath(new URL('../../dist/chromium', import.meta.url));
const skip = ZBX_URL ? false : 'set ZBX_URL to run the end-to-end suite';

let context;
let profile;
let server;
let plainUrl;

before(async () => {
  if (!ZBX_URL) return;

  profile = mkdtempSync(join(tmpdir(), 'zbxvim-e2e-'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      '--no-sandbox',
    ],
  });

  // A plain page served from localhost: the content script matches http://*/*
  // but must stay inert because the page does not look like Zabbix.
  server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>not zabbix</title><a href="/about">about</a>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  plainUrl = `http://127.0.0.1:${server.address().port}/`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (context) await context.close();
  if (profile) rmSync(profile, { recursive: true, force: true });
});

async function signIn(page) {
  await page.goto(ZBX_URL, { waitUntil: 'domcontentloaded' });
  // The profile keeps the session cookie, so only the first page needs a login.
  if (!/zabbix\.php\?action=/.test(page.url())) {
    await page.locator('input[name="name"], #name').fill(ZBX_USER);
    await page.locator('input[name="password"], #password').fill(ZBX_PASSWORD);
    await page.locator('button[name="enter"], button[type="submit"]').first().click();
    await page.waitForURL(/zabbix\.php\?action=/, { timeout: 30_000 });
  }
  await page.waitForLoadState('domcontentloaded');
}

async function openHosts() {
  const page = await context.newPage();
  await signIn(page);
  await page.goto(new URL('zabbix.php?action=host.list', ZBX_URL).href);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  return page;
}

function shadow(page) {
  return page.locator('#zbxvim-root');
}

test('content script is injected on a Zabbix page', { skip }, async () => {
  const page = await openHosts();
  await page.waitForFunction(() => Boolean(document.getElementById('zbxvim-root')), null, {
    timeout: 15_000,
  });
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('zbxvim-root'))), true);
  await page.close();
});

test('stays inert on a page that is not Zabbix', { skip }, async () => {
  const page = await context.newPage();
  await page.goto(plainUrl);
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('zbxvim-root'))), false);
  await page.close();
});

test('hint mode labels interactive elements', { skip }, async () => {
  const page = await openHosts();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('f');
  await page.waitForTimeout(500);

  const hints = shadow(page).locator('.zbxvim-hint');
  assert.ok((await hints.count()) > 5, 'expected hint labels on the hosts page');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.equal(await hints.count(), 0);
  await page.close();
});

test('hint mode follows a label and navigates', { skip }, async () => {
  const page = await openHosts();
  await page.keyboard.press('f');
  await page.waitForTimeout(400);

  const firstLabel = await shadow(page).locator('.zbxvim-hint').first().textContent();
  await page.keyboard.type(firstLabel);
  await page.waitForTimeout(1200);

  // Activating a target either navigates or leaves the hint mode; in both
  // cases the overlay must be gone.
  assert.equal(await shadow(page).locator('.zbxvim-hint').count(), 0);
  await page.close();
});

test('palette opens, filters and closes', { skip }, async () => {
  const page = await openHosts();
  await page.keyboard.press(':');
  await page.waitForTimeout(400);

  const items = shadow(page).locator('.zbxvim-palette__item');
  assert.ok((await items.count()) > 3, 'expected navigation entries in the palette');

  const input = shadow(page).locator('.zbxvim-palette__input');
  await input.fill('prob');
  await page.waitForTimeout(200);
  assert.ok((await items.count()) >= 1);
  assert.match(await items.first().textContent(), /prob/i);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.equal(await input.isVisible(), false);
  await page.close();
});

test('focusing a form field switches to insert mode', { skip }, async () => {
  const page = await openHosts();
  const field = page.locator('input[type="text"], input[name="filter_name"]').first();
  await field.click();
  await page.waitForTimeout(300);

  const hud = shadow(page).locator('.zbxvim-hud');
  assert.match(await hud.textContent(), /insert/);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.doesNotMatch(await hud.textContent(), /insert/);
  await page.close();
});
