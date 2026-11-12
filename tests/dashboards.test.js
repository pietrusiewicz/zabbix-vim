import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCustomDashboard,
  buildDashboard,
  dashboardName,
  selectGraphs,
} from '../src/core/dashboards.js';

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

test('custom dashboard repeats the group field for every selected group', () => {
  const dashboard = buildCustomDashboard({
    name: 'Ops overview',
    groupids: ['2', '4'],
    widgets: { graphs: false },
  });
  const fields = dashboard.pages[0].widgets[0].fields.filter((field) => field.name === 'groupids');
  assert.deepEqual(fields.map((field) => field.value), ['2', '4']);
});

test('custom dashboard can drop widgets', () => {
  const dashboard = buildCustomDashboard({
    name: 'Empty',
    groupids: ['2'],
    widgets: { problems: false, severity: false, availability: false, graphs: false },
  });
  assert.equal(dashboard.pages[0].widgets.length, 0);
});

test('a single summary widget takes the full width', () => {
  const dashboard = buildCustomDashboard({
    name: 'Severity only',
    groupids: ['2'],
    widgets: { problems: false, severity: true, availability: false, graphs: false },
  });
  const [widget] = dashboard.pages[0].widgets;
  assert.equal(widget.type, 'problemsbysv');
  assert.equal(widget.x, 0);
  assert.equal(widget.width, 72);
});

test('custom dashboard validates its input', () => {
  assert.throws(() => buildCustomDashboard({ name: '', groupids: ['2'] }), /name is required/);
  assert.throws(() => buildCustomDashboard({ name: 'X', groupids: [] }), /at least one host group/);
});
