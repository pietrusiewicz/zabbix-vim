export const HINT_SELECTOR = [
  'a[href]',
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  '[role="button"]',
  '[onclick]',
  'summary',
].join(',');

const SKIP_SELECTOR = '#zbxvim-root';
const MAX_TARGETS = 300;
const SEARCH_SELECTORS = [
  'input#search',
  'input[name="search"]',
  '#global-search input',
  'input[type="search"]',
];

export function isVisible(el) {
  if (!el || el.hidden) return false;
  const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
  if (!rect || rect.width === 0 || rect.height === 0) return false;
  const view = el.ownerDocument && el.ownerDocument.defaultView;
  const style = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(el) : null;
  if (style && (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0')) {
    return false;
  }
  return true;
}

function attribute(el, name) {
  return typeof el.getAttribute === 'function' ? el.getAttribute(name) || '' : '';
}

export function describeElement(el) {
  const tag = String(el.tagName || '').toUpperCase();
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  const value = tag === 'INPUT' ? String(el.value || attribute(el, 'value') || '') : '';
  const label =
    attribute(el, 'aria-label') ||
    attribute(el, 'title') ||
    value ||
    text ||
    attribute(el, 'alt') ||
    attribute(el, 'href') ||
    '';
  return label.slice(0, 80);
}

function closestSkipped(el) {
  let node = el;
  while (node && typeof node.closest !== 'function') node = node.parentElement;
  return Boolean(node && node.closest && node.closest(SKIP_SELECTOR));
}

export function collectHintTargets(doc) {
  const targets = [];
  const seen = new Set();
  for (const el of doc.querySelectorAll(HINT_SELECTOR)) {
    if (targets.length >= MAX_TARGETS) break;
    if (el.disabled || seen.has(el)) continue;
    if (closestSkipped(el)) continue;
    if (!isVisible(el)) continue;
    const label = describeElement(el);
    if (!label) continue;
    seen.add(el);
    targets.push({ element: el, label });
  }
  return targets;
}

export function collectNavigationAnchors(doc) {
  const anchors = [];
  const seen = new Set();
  for (const el of doc.querySelectorAll('a[href]')) {
    const href = el.href || attribute(el, 'href');
    if (!href || /^javascript:/i.test(href)) continue;
    if (!/zabbix\.php\?|\.php(?:[?#]|$)/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    anchors.push({ href, label: describeElement(el) });
  }
  return anchors;
}

export function findSearchInput(doc) {
  for (const selector of SEARCH_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el && isVisible(el)) return el;
  }
  return null;
}
