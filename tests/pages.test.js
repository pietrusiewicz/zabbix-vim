import test from 'node:test';
import assert from 'node:assert/strict';

import { findActionTarget, parseTarget } from '../src/core/pages.js';

test('parses modern zabbix.php actions', () => {
  const target = parseTarget('/zabbix.php?action=host.view');
  assert.equal(target.kind, 'action');
  assert.equal(target.name, 'host.view');
  assert.equal(target.href, 'https://zabbix.invalid/zabbix.php?action=host.view');
});

test('parses legacy php pages', () => {
  const target = parseTarget('https://monitor.example/hosts.php?form=update');
  assert.equal(target.kind, 'page');
  assert.equal(target.name, 'hosts.php');
});

test('rejects ordinary links and non-http schemes', () => {
  assert.equal(parseTarget('/index.html'), null);
  assert.equal(parseTarget('javascript:void(0)'), null);
  assert.equal(parseTarget(''), null);
  assert.equal(parseTarget(null), null);
});

test('finds an anchor by exact action name', () => {
  const anchors = [
    { href: '/zabbix.php?action=dashboard.view', label: 'Dashboards' },
    { href: '/zabbix.php?action=host.view', label: 'Hosts' },
  ];
  assert.equal(findActionTarget(anchors, 'host.view').label, 'Hosts');
});

test('falls back to a partial match', () => {
  const anchors = [{ href: '/zabbix.php?action=problem.view&filter_set=1', label: 'Problems' }];
  assert.equal(findActionTarget(anchors, 'problem.view').label, 'Problems');
});

test('returns null when nothing matches', () => {
  assert.equal(findActionTarget([], 'host.view'), null);
  assert.equal(findActionTarget([{ href: '/index.html' }], 'host.view'), null);
});
