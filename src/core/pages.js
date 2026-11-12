const LEGACY_PAGE = /\.php$/i;

export function parseTarget(href) {
  if (typeof href !== 'string' || href === '') return null;
  let url;
  try {
    url = new URL(href, 'https://zabbix.invalid/');
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const action = url.searchParams.get('action');
  if (action) return { kind: 'action', name: action, href: url.href };

  const file = url.pathname.split('/').filter(Boolean).pop() || '';
  if (LEGACY_PAGE.test(file)) return { kind: 'page', name: file.toLowerCase(), href: url.href };

  return null;
}

export function findActionTarget(anchors, wanted) {
  const needle = String(wanted).toLowerCase();
  const exact = [];
  const partial = [];
  for (const anchor of anchors) {
    const target = parseTarget(anchor.href);
    if (!target) continue;
    const name = target.name.toLowerCase();
    if (name === needle) exact.push(anchor);
    else if (name.includes(needle)) partial.push(anchor);
  }
  return exact[0] || partial[0] || null;
}
