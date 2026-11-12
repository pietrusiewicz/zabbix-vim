export function normalizeUrl(input) {
  const url = new URL(String(input).trim());
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = '';
  return url.href;
}

export function createZabbixClient({ url, token, fetchImpl = globalThis.fetch }) {
  const endpoint = new URL('api_jsonrpc.php', normalizeUrl(url)).href;
  let requestId = 0;
  let session;

  async function call(method, params = {}) {
    const headers = { 'content-type': 'application/json-rpc' };
    const body = { jsonrpc: '2.0', method, params, id: (requestId += 1) };
    if (token) headers.authorization = `Bearer ${token}`;
    else if (session) body.auth = session;

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);

    const payload = await response.json();
    if (payload.error) {
      const details = payload.error.data ? ` (${payload.error.data})` : '';
      throw new Error(`${method}: ${payload.error.message}${details}`);
    }
    return payload.result;
  }

  return {
    endpoint,
    call,
    async login(username, password) {
      session = await call('user.login', { username, password });
      return session;
    },
  };
}
