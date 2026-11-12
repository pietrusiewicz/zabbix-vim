import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ZBX_URL = process.env.ZBX_URL;
const ZBX_USER = process.env.ZBX_USER || 'Admin';
const ZBX_PASSWORD = process.env.ZBX_PASSWORD || 'zabbix';

if (!ZBX_URL) {
  console.error('set ZBX_URL (e.g. ZBX_URL=http://127.0.0.1:8080)');
  process.exit(1);
}

const extension = fileURLToPath(new URL('../dist/chromium', import.meta.url));
const outDir = fileURLToPath(new URL('../docs/screenshots', import.meta.url));
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'zbxvim-shots-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    '--no-sandbox',
  ],
});

const page = await context.newPage();

async function open(action) {
  await page.goto(new URL(`zabbix.php?action=${action}`, ZBX_URL).href, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(900);
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function shot(name) {
  await page.screenshot({ path: join(outDir, name) });
  console.log(name);
}

await page.goto(ZBX_URL, { waitUntil: 'domcontentloaded' });
await page.locator('input[name="name"], #name').fill(ZBX_USER);
await page.locator('input[name="password"], #password').fill(ZBX_PASSWORD);
await page.locator('button[name="enter"], button[type="submit"]').first().click();
await page.waitForURL(/zabbix\.php\?action=/, { timeout: 30_000 });

await open('host.list');
await shot('01-hosts.png');

await page.keyboard.press('f');
await page.waitForTimeout(500);
await shot('02-hints.png');

await page.keyboard.press('Escape');
await page.keyboard.press(':');
await page.waitForTimeout(400);
await shot('03-palette.png');

await page.keyboard.press('Escape');
await open('problem.view');
await page.keyboard.press('f');
await page.waitForTimeout(500);
await shot('04-problems-hints.png');

await context.close();
rmSync(profile, { recursive: true, force: true });
console.log('written to docs/screenshots');
