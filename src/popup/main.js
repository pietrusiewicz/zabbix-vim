import { createZabbixClient } from '../api/zabbix.js';
import { provisionCustomDashboard, provisionDashboards } from '../core/provision.js';

const ext = globalThis.browser ?? globalThis.chrome;
const SETTING_KEYS = [
  'url',
  'token',
  'user',
  'groups',
  'apply',
  'customName',
  'customGroups',
  'widgets',
  'graphsPerHost',
  'maxGraphs',
];

function storageGet(keys) {
  const area = ext.storage.local;
  const result = area.get(keys);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => area.get(keys, resolve));
}

function storageSet(values) {
  const area = ext.storage.local;
  const result = area.set(values);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => area.set(values, resolve));
}

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function setStatus(lines, isError = false) {
  statusEl.textContent = lines.join('\n');
  statusEl.classList.toggle('error', isError);
}

function readCredentials() {
  return {
    url: $('url').value.trim(),
    token: $('token').value.trim(),
    user: $('user').value.trim() || 'Admin',
    password: $('password').value,
  };
}

function readWidgets() {
  return {
    problems: $('w-problems').checked,
    severity: $('w-severity').checked,
    availability: $('w-availability').checked,
    graphs: $('w-graphs').checked,
  };
}

async function connect() {
  const credentials = readCredentials();
  if (!credentials.url) throw new Error('Zabbix URL is required.');
  if (!credentials.token && !credentials.password) {
    throw new Error('Provide an API token, or a user and password.');
  }
  const client = createZabbixClient({ url: credentials.url, token: credentials.token });
  if (!credentials.token) await client.login(credentials.user, credentials.password);
  return client;
}

function progressLine(entry) {
  if (entry.action === 'skipped') return `skipped      ${entry.group} — no hosts`;
  return `${entry.action.padEnd(12)} ${entry.name} — ${entry.hostCount} host(s), ${entry.widgetCount} widget(s)`;
}

async function saveSettings() {
  const credentials = readCredentials();
  await storageSet({
    url: credentials.url,
    token: credentials.token,
    user: credentials.user,
    groups: $('groups').value,
    apply: $('apply').checked,
    customName: $('custom-name').value,
    customGroups: [...$('custom-groups').selectedOptions].map((option) => option.value),
    widgets: readWidgets(),
    graphsPerHost: $('graphs-per-host').value,
    maxGraphs: $('max-graphs').value,
  });
}

function runWithStatus(action) {
  return async (event) => {
    const button = event?.currentTarget;
    if (button) button.disabled = true;
    const lines = [];
    const push = (line) => {
      lines.push(line);
      setStatus(lines);
    };
    setStatus([]);
    try {
      await action(push);
      if (lines.length === 0) push('Nothing to do.');
      if (!$('apply').checked) push('Dry run — tick "Apply changes" to write.');
    } catch (error) {
      push(`error: ${error.message}`);
      statusEl.classList.add('error');
    } finally {
      if (button) button.disabled = false;
    }
  };
}

async function generateAuto(push) {
  const groups = $('groups')
    .value.split(',')
    .map((group) => group.trim())
    .filter(Boolean);

  await saveSettings();
  const client = await connect();
  const report = await provisionDashboards(client, {
    groups,
    apply: $('apply').checked,
    onProgress: (entry) => push(progressLine(entry)),
  });
  if (report.length === 0) push('No host groups matched.');
}

async function loadGroups(push) {
  const client = await connect();
  const groups = await client.call('hostgroup.get', {
    output: ['groupid', 'name'],
    sortfield: 'name',
  });
  const select = $('custom-groups');
  const selected = new Set([...select.selectedOptions].map((option) => option.value));
  select.replaceChildren();
  for (const group of groups) {
    const option = document.createElement('option');
    option.value = group.groupid;
    option.textContent = group.name;
    option.selected = selected.has(group.groupid);
    select.appendChild(option);
  }
  push(`loaded ${groups.length} host group(s)`);
}

async function generateCustom(push) {
  const name = $('custom-name').value.trim();
  const groupids = [...$('custom-groups').selectedOptions].map((option) => option.value);
  if (!name) throw new Error('dashboard name is required.');
  if (groupids.length === 0) throw new Error('select at least one host group.');

  await saveSettings();
  const client = await connect();
  await provisionCustomDashboard(client, {
    name,
    groupids,
    widgets: readWidgets(),
    perHost: Number($('graphs-per-host').value) || 0,
    maxTotal: Number($('max-graphs').value) || 0,
    apply: $('apply').checked,
    onProgress: (entry) => push(progressLine(entry)),
  });
}

function selectTab(which) {
  $('tab-auto').classList.toggle('is-active', which === 'auto');
  $('tab-custom').classList.toggle('is-active', which === 'custom');
  $('panel-auto').hidden = which !== 'auto';
  $('panel-custom').hidden = which !== 'custom';
}

$('tab-auto').addEventListener('click', () => selectTab('auto'));
$('tab-custom').addEventListener('click', () => selectTab('custom'));

$('generate').addEventListener('click', runWithStatus(generateAuto));
$('custom-generate').addEventListener('click', runWithStatus(generateCustom));
$('load-groups').addEventListener('click', runWithStatus(loadGroups));

async function restore() {
  const saved = await storageGet(SETTING_KEYS);
  if (saved.url) $('url').value = saved.url;
  if (saved.token) $('token').value = saved.token;
  if (saved.user) $('user').value = saved.user;
  if (saved.groups) $('groups').value = saved.groups;
  $('apply').checked = saved.apply === true;
  if (saved.customName) $('custom-name').value = saved.customName;
  if (saved.graphsPerHost) $('graphs-per-host').value = saved.graphsPerHost;
  if (saved.maxGraphs) $('max-graphs').value = saved.maxGraphs;
  if (saved.widgets) {
    $('w-problems').checked = saved.widgets.problems !== false;
    $('w-severity').checked = saved.widgets.severity !== false;
    $('w-availability').checked = saved.widgets.availability !== false;
    $('w-graphs').checked = saved.widgets.graphs !== false;
  }
  if (Array.isArray(saved.customGroups) && saved.customGroups.length > 0) {
    selectTab('custom');
  }
}

restore().catch(() => {});
