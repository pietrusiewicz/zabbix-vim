import test from 'node:test';
import assert from 'node:assert/strict';

import { createZabbixClient, normalizeUrl } from '../src/api/zabbix.js';

test('normalises frontend URLs with and without a path', () => {
  assert.equal(normalizeUrl('https://zabbix.example'), 'https://zabbix.example/');
  assert.equal(normalizeUrl('https://zabbix.example/zabbix'), 'https://zabbix.example/zabbix/');
  assert.equal(normalizeUrl('  http://127.0.0.1:8080/  '), 'http://127.0.0.1:8080/');
  assert.equal(normalizeUrl('https://zabbix.example/zabbix/?x=1'), 'https://zabbix.example/zabbix/');
});

function fakeFetch(response, calls = []) {
  return async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      async json() {
        return response;
      },
    };
  };
}

test('builds the API endpoint from the frontend URL', () => {
  const client = createZabbixClient({ url: 'https://zabbix.example/zabbix', token: 't' });
  assert.equal(client.endpoint, 'https://zabbix.example/zabbix/api_jsonrpc.php');
});

test('sends a bearer token instead of a session', async () => {
  const calls = [];
  const client = createZabbixClient({
    url: 'https://zabbix.example',
    token: 'secret',
    fetchImpl: fakeFetch({ jsonrpc: '2.0', result: [], id: 1 }, calls),
  });
  await client.call('hostgroup.get', { output: ['groupid'] });

  const [request] = calls;
  assert.equal(request.init.headers.authorization, 'Bearer secret');
  assert.equal(JSON.parse(request.init.body).auth, undefined);
});

test('logs in and reuses the session for later calls', async () => {
  const calls = [];
  const responses = [
    { jsonrpc: '2.0', result: 'session-id', id: 1 },
    { jsonrpc: '2.0', result: [{ groupid: '2' }], id: 2 },
  ];
  const client = createZabbixClient({
    url: 'https://zabbix.example',
    fetchImpl: async (url, init) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => responses.shift() };
    },
  });

  await client.login('Admin', 'zabbix');
  await client.call('hostgroup.get', {});

  assert.equal(calls[0].method, 'user.login');
  assert.equal(calls[1].auth, 'session-id');
});

test('surfaces JSON-RPC errors with details', async () => {
  const client = createZabbixClient({
    url: 'https://zabbix.example',
    token: 't',
    fetchImpl: fakeFetch({
      jsonrpc: '2.0',
      error: { code: -32602, message: 'Invalid params.', data: 'Field "name" is required.' },
    }),
  });

  await assert.rejects(
    () => client.call('dashboard.create', {}),
    /dashboard\.create: Invalid params\. \(Field "name" is required\.\)/,
  );
});

test('surfaces HTTP failures', async () => {
  const client = createZabbixClient({
    url: 'https://zabbix.example',
    token: 't',
    fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }),
  });

  await assert.rejects(() => client.call('host.get', {}), /host\.get: HTTP 502/);
});
