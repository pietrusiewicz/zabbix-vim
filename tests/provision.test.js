import test from 'node:test';
import assert from 'node:assert/strict';

import { provisionDashboards } from '../src/core/provision.js';

function fakeClient(routes) {
  const calls = [];
  return {
    calls,
    async call(method, params) {
      calls.push({ method, params });
      const route = routes[method];
      if (!route) throw new Error(`unexpected call: ${method}`);
      return route(params);
    },
  };
}

test('provisions one dashboard per group with hosts', async () => {
  const client = fakeClient({
    'hostgroup.get': () => [
      { groupid: '1', name: 'Empty' },
      { groupid: '2', name: 'Full' },
    ],
    'host.get': (params) =>
      params.groupids[0] === '2' ? [{ hostid: '100', name: 'web-01' }] : [],
    'graph.get': () => [{ graphid: '55', name: 'CPU utilization' }],
    'dashboard.get': () => [],
    'dashboard.create': () => ({ dashboardids: ['900'] }),
  });

  const report = await provisionDashboards(client, { apply: true });

  assert.deepEqual(
    report.map((row) => [row.group, row.action]),
    [
      ['Empty', 'skipped'],
      ['Full', 'created'],
    ],
  );
  assert.equal(report[1].dashboardid, '900');
  assert.equal(report[1].widgetCount, 4);
  assert.equal(report[1].hostCount, 1);

  const create = client.calls.find((call) => call.method === 'dashboard.create');
  assert.equal(create.params.name, 'Auto: Full');
  assert.equal(create.params.pages[0].widgets[3].fields[1].value, '55');
});

test('updates an existing dashboard instead of creating one', async () => {
  const client = fakeClient({
    'hostgroup.get': () => [{ groupid: '2', name: 'Full' }],
    'host.get': () => [{ hostid: '100', name: 'web-01' }],
    'graph.get': () => [],
    'dashboard.get': () => [{ dashboardid: '777' }],
    'dashboard.update': () => ({ dashboardids: ['777'] }),
  });

  const report = await provisionDashboards(client, { apply: true });

  assert.equal(report[0].action, 'updated');
  assert.equal(report[0].dashboardid, '777');
  assert.equal(client.calls.some((call) => call.method === 'dashboard.create'), false);
  const update = client.calls.find((call) => call.method === 'dashboard.update');
  assert.equal(update.params.dashboardid, '777');
});

test('dry run reports payloads without writing', async () => {
  const client = fakeClient({
    'hostgroup.get': () => [{ groupid: '2', name: 'Full' }],
    'host.get': () => [{ hostid: '100', name: 'web-01' }],
    'graph.get': () => [],
    'dashboard.get': () => [],
  });

  const report = await provisionDashboards(client, { apply: false });

  assert.equal(report[0].action, 'would create');
  assert.equal(report[0].payload.name, 'Auto: Full');
  const writes = client.calls.filter((call) => ['dashboard.create', 'dashboard.update'].includes(call.method));
  assert.deepEqual(writes, []);
});

test('includes empty groups when skipEmpty is disabled', async () => {
  const client = fakeClient({
    'hostgroup.get': () => [{ groupid: '1', name: 'Empty' }],
    'host.get': () => [],
    'graph.get': () => [],
    'dashboard.get': () => [],
    'dashboard.create': () => ({ dashboardids: ['901'] }),
  });

  const report = await provisionDashboards(client, { apply: true, skipEmpty: false });

  assert.equal(report[0].action, 'created');
  assert.equal(report[0].hostCount, 0);
});

test('rejects unknown group names', async () => {
  const client = fakeClient({
    'hostgroup.get': () => [{ groupid: '2', name: 'Full' }],
  });

  await assert.rejects(
    () => provisionDashboards(client, { groups: ['Nope'], apply: true }),
    /unknown host group\(s\): Nope/,
  );
});
