import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboard,
  dashboardName,
  selectGraphs,
} from '../scripts/lib/dashboards.mjs';

function graph(graphid, name) {
  return { graphid, name };
}

test('substitutes the group name into the dashboard name', () => {
  assert.equal(dashboardName('Auto: {group}', 'Linux servers'), 'Auto: Linux servers');
  assert.equal(dashboardName('Dashboards / {group} / {group}', 'DB'), 'Dashboards / DB / DB');
});

test('prefers CPU and memory graphs over arbitrary ones', () => {
  const picked = selectGraphs([
    {
      hostid: '1',
      hostName: 'web-01',
      graphs: [graph('10', 'Zabbix agent ping'), graph('11', 'Free disk space'), graph('12', 'CPU utilization')],
    },
  ]);
  assert.equal(picked[0].name, 'CPU utilization');
  assert.equal(picked[1].name, 'Free disk space');
});

test('takes graphs round-robin across hosts', () => {
  const picked = selectGraphs(
    [
      { hostid: '1', hostName: 'a', graphs: [graph('10', 'CPU utilization'), graph('11', 'Memory usage')] },
      { hostid: '2', hostName: 'b', graphs: [graph('20', 'CPU utilization'), graph('21', 'Memory usage')] },
    ],
    { perHost: 2, maxTotal: 3 },
  );
  assert.deepEqual(
    picked.map((entry) => `${entry.hostName}:${entry.graphid}`),
    ['a:10', 'b:20', 'a:11'],
  );
});

test('respects per-host and total caps', () => {
  const hosts = Array.from({ length: 5 }, (_, index) => ({
    hostid: String(index),
    hostName: `host-${index}`,
    graphs: [graph('1', 'CPU utilization'), graph('2', 'Memory usage'), graph('3', 'Disk')],
  }));
  assert.equal(selectGraphs(hosts, { perHost: 1, maxTotal: 10 }).length, 5);
  assert.equal(selectGraphs(hosts, { perHost: 3, maxTotal: 4 }).length, 4);
});

test('ignores hosts without graphs', () => {
  assert.deepEqual(selectGraphs([{ hostid: '1', hostName: 'empty', graphs: [] }]), []);
});

test('builds a dashboard with problems, summaries and graphs', () => {
  const dashboard = buildDashboard({
    group: { groupid: '2', name: 'Linux servers' },
    graphs: [
      {
        hostid: '10084',
        hostName: 'web-01',
        graphs: [graph('11', 'CPU utilization'), graph('12', 'Memory usage')],
      },
    ],
  });

  assert.equal(dashboard.name, 'Auto: Linux servers');
  const widgets = dashboard.pages[0].widgets;
  assert.deepEqual(
    widgets.map((w) => w.type),
    ['problems', 'problemsbysv', 'hostavail', 'graph', 'graph'],
  );

  const [problems, severity, availability, first, second] = widgets;
  assert.deepEqual([problems.x, problems.y, problems.width, problems.height], [0, 0, 72, 5]);
  assert.deepEqual([severity.x, severity.y, severity.width, severity.height], [0, 5, 36, 4]);
  assert.deepEqual([availability.x, availability.y, availability.width, availability.height], [36, 5, 36, 4]);
  assert.deepEqual([first.x, first.y, first.width, first.height], [0, 9, 36, 5]);
  assert.deepEqual([second.x, second.y, second.width, second.height], [36, 9, 36, 5]);
});

test('stringifies widget field values for the API', () => {
  const dashboard = buildDashboard({
    group: { groupid: '2', name: 'Linux servers' },
    graphs: [],
  });
  const [problems] = dashboard.pages[0].widgets;
  assert.deepEqual(problems.fields, [
    { type: 0, name: 'groupids', value: '2' },
    { type: 0, name: 'show', value: '1' },
    { type: 0, name: 'show_tags', value: '3' },
  ]);
});

test('wraps graph widgets after two columns', () => {
  const graphs = [
    {
      hostid: '1',
      hostName: 'host',
      graphs: [graph('1', 'CPU utilization'), graph('2', 'Memory usage'), graph('3', 'Disk')],
    },
  ];
  const list = buildDashboard({
    group: { groupid: '2', name: 'G' },
    graphs,
    options: { perHost: 3, maxTotal: 3 },
  }).pages[0].widgets.filter((widget) => widget.type === 'graph');

  assert.deepEqual(list.map((widget) => [widget.x, widget.y]), [
    [0, 9],
    [36, 9],
    [0, 14],
  ]);
});
