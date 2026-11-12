import { buildCustomDashboard, buildDashboard } from './dashboards.js';

export async function collectGroups(client, wanted = []) {
  const groups = await client.call('hostgroup.get', {
    output: ['groupid', 'name'],
    sortfield: 'name',
  });
  if (wanted.length === 0) return groups;

  const selected = groups.filter(
    (group) => wanted.includes(group.groupid) || wanted.includes(group.name),
  );
  const missing = wanted.filter(
    (wantedName) =>
      !groups.some((group) => group.groupid === wantedName || group.name === wantedName),
  );
  if (missing.length > 0) throw new Error(`unknown host group(s): ${missing.join(', ')}`);
  return selected;
}

async function loadHostGraphs(client, hosts) {
  const graphs = [];
  for (const host of hosts) {
    const hostGraphs = await client.call('graph.get', {
      output: ['graphid', 'name'],
      hostids: [host.hostid],
      sortfield: 'name',
    });
    graphs.push({ hostid: host.hostid, hostName: host.name, graphs: hostGraphs });
  }
  return graphs;
}

async function upsertDashboard(client, dashboard, apply) {
  if (!apply) return { action: 'would create', payload: dashboard };

  const existing = (
    await client.call('dashboard.get', {
      output: ['dashboardid'],
      filter: { name: dashboard.name },
    })
  )[0];

  if (existing) {
    await client.call('dashboard.update', { dashboardid: existing.dashboardid, ...dashboard });
    return { action: 'updated', dashboardid: existing.dashboardid };
  }

  const created = await client.call('dashboard.create', dashboard);
  return { action: 'created', dashboardid: created.dashboardids[0] };
}

export async function provisionDashboards(client, options = {}) {
  const {
    groups: wantedGroups = [],
    nameTemplate = 'Auto: {group}',
    perHost = 2,
    maxTotal = 8,
    skipEmpty = true,
    apply = false,
    onProgress = () => {},
  } = options;

  const groups = await collectGroups(client, wantedGroups);
  const report = [];

  for (const group of groups) {
    const hosts = await client.call('host.get', {
      output: ['hostid', 'name'],
      groupids: [group.groupid],
      sortfield: 'name',
    });

    if (hosts.length === 0 && skipEmpty) {
      const skipped = { group: group.name, name: '', hostCount: 0, widgetCount: 0, action: 'skipped' };
      onProgress(skipped);
      report.push(skipped);
      continue;
    }

    const graphs = await loadHostGraphs(client, hosts);
    const dashboard = buildDashboard({ group, graphs, nameTemplate, options: { perHost, maxTotal } });
    const result = await upsertDashboard(client, dashboard, apply);

    const entry = {
      group: group.name,
      name: dashboard.name,
      hostCount: hosts.length,
      widgetCount: dashboard.pages[0].widgets.length,
      ...result,
    };
    onProgress(entry);
    report.push(entry);
  }

  return report;
}

export async function provisionCustomDashboard(client, options = {}) {
  const {
    name,
    groupids = [],
    widgets = {},
    perHost = 2,
    maxTotal = 8,
    apply = false,
    onProgress = () => {},
  } = options;

  const hosts = await client.call('host.get', {
    output: ['hostid', 'name'],
    groupids,
    sortfield: 'name',
  });
  const graphs = await loadHostGraphs(client, hosts);
  const dashboard = buildCustomDashboard({
    name,
    groupids,
    graphs,
    widgets,
    options: { perHost, maxTotal },
  });
  const result = await upsertDashboard(client, dashboard, apply);

  const entry = {
    group: '(custom)',
    name,
    hostCount: hosts.length,
    widgetCount: dashboard.pages[0].widgets.length,
    ...result,
  };
  onProgress(entry);
  return [entry];
}
