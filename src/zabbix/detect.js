const ZABBIX_ACTION = /zabbix\.php\?(?:[^#]*&)?action=[a-z0-9._-]+/i;
const ZABBIX_LEGACY_PAGE = /(?:^|\/)(?:hosts|latest|triggers|graphs|charts|maps|screens|dashboards|discovery|reports|users|actionconf|adm|sysmap|history|item|popup|chart\d*)\.php(?:[?#]|$)/i;

export function isZabbixHref(href) {
  if (typeof href !== 'string' || href === '') return false;
  return ZABBIX_ACTION.test(href) || ZABBIX_LEGACY_PAGE.test(href);
}

function hrefOf(element) {
  if (!element) return '';
  if (typeof element.getAttribute === 'function') return element.getAttribute('href') || '';
  return element.href || '';
}

export function detectZabbix(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { isZabbix: false, matches: 0 };
  }
  let matches = 0;
  for (const anchor of doc.querySelectorAll('a[href]')) {
    if (isZabbixHref(hrefOf(anchor))) matches += 1;
  }
  // A single hit can be a link to Zabbix from a wiki or a dashboard; the real
  // frontend always ships a whole navigation tree of matching anchors.
  return { isZabbix: matches >= 2, matches };
}
