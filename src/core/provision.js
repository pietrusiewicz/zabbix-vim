import { buildDashboard } from './dashboards.js';

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

async function collectGraphs(client, host) {
  const graphs = await client.call('graph.get', {
    output: ['graphid', 'name'],
    hostids: [host.hostid],
    sortfield: 'name',
  });
  return { hostid: host.hostid, hostName: host.name, graphs };
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

    const graphs = [];
    for (const host of hosts) graphs.push(await collectGraphs(client, host));

    const dashboard = buildDashboard({ group, graphs, nameTemplate, options: { perHost, maxTotal } });
    const existing = (
      await client.call('dashboard.get', {
        output: ['dashboardid'],
        filter: { name: dashboard.name },
      })
    )[0];

    const base = {
      group: group.name,
      name: dashboard.name,
      hostCount: hosts.length,
      widgetCount: dashboard.pages[0].widgets.length,
    };

    if (!apply) {
      onProgress({ ...base, action: 'would create' });
      report.push({ ...base, action: 'would create', payload: dashboard });
      continue;
    }

    if (existing) {
      await client.call('dashboard.update', { dashboardid: existing.dashboardid, ...dashboard });
      onProgress({ ...base, action: 'updated' });
      report.push({ ...base, action: 'updated', dashboardid: existing.dashboardid });
    } else {
      const created = await client.call('dashboard.create', dashboard);
      const dashboardid = created.dashboardids[0];
      onProgress({ ...base, action: 'created' });
      report.push({ ...base, action: 'created', dashboardid });
    }
  }

  return report;
}
