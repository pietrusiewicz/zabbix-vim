import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

// Chromium derives the id of an unpacked extension from the absolute path.
function extensionId(path) {
  const hex = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return [...hex].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join('');
}

test('popup generates dashboards in dry-run mode', { skip }, async () => {
  const profile = mkdtempSync(join(tmpdir(), 'zbxvim-popup-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      '--no-sandbox',
    ],
  });

  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);

    await page.fill('#url', ZBX_URL);
    await page.fill('#user', ZBX_USER);
    await page.fill('#password', ZBX_PASSWORD);
    await page.click('#generate');

    await page.waitForFunction(
      () => /Dry run|error/i.test(document.getElementById('status').textContent),
      null,
      { timeout: 60_000 },
    );

    const status = await page.locator('#status').textContent();
    assert.doesNotMatch(status, /error/i);
    assert.match(status, /Dry run/);
    assert.match(status, /Auto: /);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test('popup builds a custom dashboard in dry-run mode', { skip }, async () => {
  const profile = mkdtempSync(join(tmpdir(), 'zbxvim-popup-custom-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      '--no-sandbox',
    ],
  });

  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);

    await page.fill('#url', ZBX_URL);
    await page.fill('#user', ZBX_USER);
    await page.fill('#password', ZBX_PASSWORD);

    await page.click('#tab-custom');
    await page.click('#load-groups');
    await page.waitForFunction(
      () => document.getElementById('custom-groups').options.length > 0,
      null,
      { timeout: 60_000 },
    );

    const option = page.locator('#custom-groups option').first();
    await option.waitFor();
    const groupid = await option.getAttribute('value');
    await page.selectOption('#custom-groups', [groupid]);

    await page.fill('#custom-name', 'Ops overview');
    await page.click('#custom-generate');

    await page.waitForFunction(
      () => /would create|error/i.test(document.getElementById('status').textContent),
      null,
      { timeout: 60_000 },
    );

    const status = await page.locator('#status').textContent();
    assert.doesNotMatch(status, /error/i);
    assert.match(status, /Ops overview/);
    assert.match(status, /Dry run/);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
