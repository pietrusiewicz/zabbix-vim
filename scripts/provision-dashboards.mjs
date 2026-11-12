#!/usr/bin/env node
import { createZabbixClient } from '../src/api/zabbix.js';
import { provisionDashboards } from '../src/core/provision.js';

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
  --include-empty          also create dashboards for groups without hosts
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
    includeEmpty: false,
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
      case '--include-empty':
        options.includeEmpty = true;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (!options.url) throw new Error('set --url or ZBX_URL');

  const client = createZabbixClient(options);
  if (!options.token) {
    if (!options.password) throw new Error('provide --token or --password');
    await client.login(options.user, options.password);
  }

  const report = await provisionDashboards(client, {
    groups: options.groups,
    nameTemplate: options.nameTemplate,
    perHost: options.graphsPerHost,
    maxTotal: options.maxGraphs,
    skipEmpty: !options.includeEmpty,
    apply: options.apply,
    onProgress: (entry) => {
      if (!options.apply) process.stdout.write(`${JSON.stringify(entry.payload, null, 2)}\n`);
    },
  });

  process.stdout.write('\n');
  for (const row of report) {
    const id = row.dashboardid ? ` (id ${row.dashboardid})` : '';
    const name = row.name ? ` ${row.name}${id}` : '';
    process.stdout.write(
      `${row.action.padEnd(12)}${name} — ${row.hostCount} host(s), ${row.widgetCount} widget(s)\n`,
    );
  }
  if (!options.apply) process.stdout.write('\nDry run. Pass --apply to write changes.\n');
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
