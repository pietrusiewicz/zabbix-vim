import { createZabbixClient } from '../api/zabbix.js';
import { provisionDashboards } from '../core/provision.js';

const ext = globalThis.browser ?? globalThis.chrome;
const SETTING_KEYS = ['url', 'token', 'user', 'groups', 'apply'];

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
const button = $('generate');

function setStatus(lines, isError = false) {
  statusEl.textContent = lines.join('\n');
  statusEl.classList.toggle('error', isError);
}

function readForm() {
  return {
    url: $('url').value.trim(),
    token: $('token').value.trim(),
    user: $('user').value.trim() || 'Admin',
    password: $('password').value,
    groups: $('groups')
      .value.split(',')
      .map((group) => group.trim())
      .filter(Boolean),
    apply: $('apply').checked,
  };
}

async function generate() {
  const settings = readForm();
  if (!settings.url) return setStatus(['Zabbix URL is required.'], true);
  if (!settings.token && !settings.password) {
    return setStatus(['Provide an API token, or a user and password.'], true);
  }

  button.disabled = true;
  const lines = [];
  const push = (line) => {
    lines.push(line);
    setStatus(lines);
  };

  try {
    await storageSet({
      url: settings.url,
      token: settings.token,
      user: settings.user,
      groups: settings.groups.join(', '),
      apply: settings.apply,
    });
    const client = createZabbixClient({ url: settings.url, token: settings.token });
    if (!settings.token) await client.login(settings.user, settings.password);
    const report = await provisionDashboards(client, {
      groups: settings.groups,
      apply: settings.apply,
      onProgress: (entry) => {
        if (entry.action === 'skipped') {
          push(`skipped      ${entry.group} — no hosts`);
          return;
        }
        push(
          `${entry.action.padEnd(12)} ${entry.name} — ${entry.hostCount} host(s), ${entry.widgetCount} widget(s)`,
        );
      },
    });
    if (report.length === 0) push('No host groups matched.');
    if (!settings.apply) push('Dry run — tick "Apply changes" to write.');
  } catch (error) {
    push(`error: ${error.message}`);
    statusEl.classList.add('error');
  } finally {
    button.disabled = false;
  }
}

async function restore() {
  const saved = await storageGet(SETTING_KEYS);
  if (saved.url) $('url').value = saved.url;
  if (saved.token) $('token').value = saved.token;
  if (saved.user) $('user').value = saved.user;
  if (saved.groups) $('groups').value = saved.groups;
  $('apply').checked = saved.apply === true;
}

button.addEventListener('click', generate);

restore().catch(() => {});
