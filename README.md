# Zabbix Vim Keys

Vim-style keyboard navigation and hint mode for the Zabbix web frontend. Manifest V3, works in Firefox and Chromium, no build dependencies beyond Node.js.

The extension is a content script only: it injects a keyboard layer on top of the page, renders its UI in a shadow root, and never talks to the network or stores credentials.

## Status

Early scaffold. Core logic is unit-tested and the extension has been exercised end-to-end in headless Chromium against a local DOM mock of the Zabbix frontend. It has **not** been validated against a real Zabbix instance yet, so selectors may need tuning for your version and theme.

Scope is deliberately read-only: navigation, scrolling, hints, and a command palette. No API calls, no mutations (acknowledge, maintenance, disable).

## Features

- **Normal/insert/hint/palette modes** — keys pass through untouched while typing in inputs, textareas, selects, and contenteditable elements.
- **Hint mode** — labels every visible link, button, and clickable element; typing filters candidates; `F` opens the target in a new tab.
- **Command palette** — commands are discovered from the page's own navigation (`zabbix.php?action=…` and legacy `*.php` links), deduplicated by action, so no URLs are hardcoded.
- **Multi-key bindings** — `gg`, `gh`, `gp`, … resolve through a small sequence matcher.
- **HUD** — current mode and pending key prefix, bottom right.
- **Page detection** — a page is treated as Zabbix when it contains at least two Zabbix-style navigation links, so the content script stays inert everywhere else.

## Key bindings

| Key | Action |
| --- | --- |
| `j` / `k` | scroll down / up |
| `d` / `u` | half page down / up |
| `h` / `l` | scroll left / right |
| `gg` / `G` | scroll to top / bottom |
| `f` / `F` | hint mode (same tab / new tab) |
| `:` | command palette |
| `/` | focus the Zabbix search field |
| `gh` `gp` `gl` `gd` `gm` | hosts, problems, latest data, dashboards, maps |
| `i` | insert mode (let the page handle keys) |
| `Esc` | leave hint/palette/insert mode, clear pending keys |

Inside hint mode: type the label to follow it, `Backspace` removes the last character, `Esc` cancels.

## Install

Build once, then load the unpacked extension:

```bash
npm run build
```

- **Chromium**: `chrome://extensions` → enable Developer mode → *Load unpacked* → `dist/chromium`
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `dist/firefox/manifest.json`

Firefox uses an event-page manifest and requires the `browser_specific_settings.gecko.id` present in `src/manifest.firefox.json` for permanent installs.

## Development

```bash
npm run build   # writes dist/chromium and dist/firefox
npm test        # node:test unit tests
npm run check   # syntax-check the built bundles
```

No dependencies, no bundler: `scripts/build.mjs` inlines the ESM module graph into a single IIFE, because content scripts cannot be ES modules. The script also rejects duplicate top-level declarations, which would otherwise collide silently in the shared scope.

### Layout

```
src/
  content/main.js     wiring: modes, key bindings, commands
  core/               pure logic (keymap, labels, modes, page parsing)
  zabbix/             Zabbix-specific detection and DOM selectors
  ui/                 hint overlay, palette, HUD, shadow root
  manifest.*.json     per-browser manifests
scripts/build.mjs     inlines modules, writes dist/
tests/                unit tests for the pure modules
```

Zabbix-specific code lives only in `src/zabbix/` and in the command definitions in `src/content/main.js`; everything else is generic.

## Known limitations

- Host detection is heuristic and the `matches` pattern is broad (`http://*/*`, `https://*/*`); there is no per-instance allowlist yet.
- Hints are collected when hint mode starts; live re-scanning while the DOM changes (dashboards, AJAX filters) is not implemented.
- Graphs and SVG dashboard widgets are not keyboard-navigable.
- The palette lists navigation targets, not arbitrary Zabbix actions.
- Selectors have only been tested against a local mock, not a production instance.
