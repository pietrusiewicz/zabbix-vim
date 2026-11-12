#!/usr/bin/env node
import { buildDashboard } from './lib/dashboards.mjs';

const USAGE = `Usage: node scripts/provision-dashboards.mjs [options]

Creates or updates one Zabbix dashboard per host group. Read-only against the
Zabbix configuration unless --apply is passed; the default is a dry run.

Options:
  --url <url>              Zabbix frontend URL (env ZBX_URL)
  --token <token>          API token (env ZBX_TOKEN)
  --user <name>            username for session login (env ZBX_USER, default Admin)
  --password <password>    password for session login (env ZBX_PASSWORD)
  --group <name|id>        host group to process, repeatable (default: all groups)
  --name <template>        dashboard name template, {group} is replaced (default "Auto: {group}")
  --graphs-per-host <n>    graphs taken from each host (default 2)
  --max-graphs <n>         graph widgets per dashboard (default 8)
  --apply                  write changes (without it only prints the payload)
  -h, --help               show this help
`;

function parseArgs(argv) {
  const options = {
    url: process.env.ZBX_URL,
    token: process.env.ZBX_TOKEN,
    user: process.env.ZBX_USER || 'Admin',
    password: process.env.ZBX_PASSWORD,
    groups: [],
    nameTemplate: 'Auto: {group}',
    graphsPerHost: 2,
    maxGraphs: 8,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--url':
        options.url = next();
        break;
      case '--token':
        options.token = next();
        break;
      case '--user':
        options.user = next();
        break;
      case '--password':
        options.password = next();
        break;
      case '--group':
        options.groups.push(next());
        break;
      case '--name':
        options.nameTemplate = next();
        break;
      case '--graphs-per-host':
        options.graphsPerHost = Number(next());
        break;
      case '--max-graphs':
        options.maxGraphs = Number(next());
        break;
      case '--apply':
        options.apply = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function createClient({ url, token, user, password }) {
  const endpoint = new URL('api_jsonrpc.php', url).href;
  let requestId = 0;
  let session;

  async function rpc(method, params = {}) {
    const headers = { 'content-type': 'application/json-rpc' };
    const body = { jsonrpc: '2.0', method, params, id: (requestId += 1) };
    if (token) headers.authorization = `Bearer ${token}`;
    else if (session) body.auth = session;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (payload.error) {
      throw new Error(`${method}: ${payload.error.message} ${payload.error.data || ''}`.trim());
    }
    return payload.result;
  }

  async function login() {
    if (token) return;
    if (!password) throw new Error('provide --token or --password');
    session = await rpc('user.login', { username: user, password });
  }

  return { rpc, login };
}

async function collectGroups(client, wanted) {
  const groups = await client.rpc('hostgroup.get', {
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

async function collectHosts(client, groupid) {
  return client.rpc('host.get', {
    output: ['hostid', 'name'],
    groupids: [groupid],
    sortfield: 'name',
  });
}

async function collectGraphs(client, host) {
  const graphs = await client.rpc('graph.get', {
    output: ['graphid', 'name'],
    hostids: [host.hostid],
    sortfield: 'name',
  });
  return { hostid: host.hostid, hostName: host.name, graphs };
}

async function findDashboard(client, name) {
  const dashboards = await client.rpc('dashboard.get', {
    output: ['dashboardid', 'name'],
    filter: { name },
  });
  return dashboards[0] || null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (!options.url) throw new Error('set --url or ZBX_URL');

  const client = createClient(options);
  await client.login();

  const groups = await collectGroups(client, options.groups);
  const report = [];

  for (const group of groups) {
    const hosts = await collectHosts(client, group.groupid);
    const graphs = await Promise.all(hosts.map((host) => collectGraphs(client, host)));
    const dashboard = buildDashboard({
      group,
      graphs,
      nameTemplate: options.nameTemplate,
      options: { perHost: options.graphsPerHost, maxTotal: options.maxGraphs },
    });

    const existing = await findDashboard(client, dashboard.name);
    const widgetCount = dashboard.pages[0].widgets.length;

    if (!options.apply) {
      report.push({ group: group.name, hostCount: hosts.length, widgetCount, action: 'would create', name: dashboard.name });
      process.stdout.write(`${JSON.stringify(dashboard, null, 2)}\n`);
      continue;
    }

    if (existing) {
      await client.rpc('dashboard.update', { dashboardid: existing.dashboardid, ...dashboard });
      report.push({ group: group.name, hostCount: hosts.length, widgetCount, action: 'updated', name: dashboard.name });
    } else {
      const created = await client.rpc('dashboard.create', dashboard);
      const dashboardid = created.dashboardids[0];
      report.push({ group: group.name, hostCount: hosts.length, widgetCount, action: 'created', name: dashboard.name, dashboardid });
    }
  }

  process.stdout.write('\n');
  for (const row of report) {
    const id = row.dashboardid ? ` (id ${row.dashboardid})` : '';
    process.stdout.write(
      `${row.action.padEnd(12)} ${row.name}${id} — ${row.hostCount} host(s), ${row.widgetCount} widget(s)\n`,
    );
  }
  if (!options.apply) process.stdout.write('\nDry run. Pass --apply to write changes.\n');
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
