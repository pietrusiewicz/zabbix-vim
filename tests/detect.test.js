import test from 'node:test';
import assert from 'node:assert/strict';

import { detectZabbix, isZabbixHref } from '../src/zabbix/detect.js';

function fakeDoc(hrefs) {
  return {
    querySelectorAll: () => hrefs.map((href) => ({ getAttribute: () => href })),
  };
}

test('recognises modern and legacy Zabbix links', () => {
  assert.equal(isZabbixHref('/zabbix.php?action=host.view'), true);
  assert.equal(isZabbixHref('https://monitor.example/hosts.php'), true);
  assert.equal(isZabbixHref('https://example.com/about'), false);
  assert.equal(isZabbixHref(''), false);
  assert.equal(isZabbixHref(null), false);
});

test('requires more than one signal to treat a page as Zabbix', () => {
  assert.equal(detectZabbix(fakeDoc(['/zabbix.php?action=host.view'])).isZabbix, false);
  assert.equal(
    detectZabbix(fakeDoc(['/zabbix.php?action=host.view', '/zabbix.php?action=problem.view']))
      .isZabbix,
    true,
  );
});

test('counts every matching anchor', () => {
  const result = detectZabbix(
    fakeDoc(['/zabbix.php?action=a.view', '/hosts.php', 'https://example.com/']),
  );
  assert.equal(result.matches, 2);
});

test('tolerates missing documents', () => {
  assert.deepEqual(detectZabbix(null), { isZabbix: false, matches: 0 });
  assert.deepEqual(detectZabbix({}), { isZabbix: false, matches: 0 });
});
