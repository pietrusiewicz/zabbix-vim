export const GRID_WIDTH = 72;
export const PROBLEMS_HEIGHT = 5;
export const SUMMARY_HEIGHT = 4;
export const GRAPH_WIDTH = 36;
export const GRAPH_HEIGHT = 5;

const GRAPH_PRIORITY = [
  /cpu utilization/i,
  /cpu usage/i,
  /cpu load/i,
  /memory utilization/i,
  /memory usage/i,
  /swap usage/i,
  /disk/i,
];

function graphScore(name) {
  const index = GRAPH_PRIORITY.findIndex((pattern) => pattern.test(name));
  return index === -1 ? GRAPH_PRIORITY.length : index;
}

function widget(type, name, x, y, width, height, fields) {
  return {
    type,
    name,
    x,
    y,
    width,
    height,
    view_mode: 0,
    fields: fields.map(([fieldType, fieldName, value]) => ({
      type: fieldType,
      name: fieldName,
      value: String(value),
    })),
  };
}

export function dashboardName(template, groupName) {
  return template.replaceAll('{group}', groupName);
}

// Picks a bounded set of graphs per host, preferring CPU/memory graphs over
// arbitrary ones. Graphs are taken round-robin so one noisy host cannot fill
// the whole dashboard.
export function selectGraphs(hostGraphs, options = {}) {
  const perHost = options.perHost ?? 2;
  const maxTotal = options.maxTotal ?? 8;
  const queues = hostGraphs
    .filter((entry) => entry.graphs && entry.graphs.length > 0)
    .map((entry) => ({
      hostid: entry.hostid,
      hostName: entry.hostName,
      queue: [...entry.graphs].sort(
        (left, right) => graphScore(left.name) - graphScore(right.name) || left.name.localeCompare(right.name),
      ),
    }));

  const picked = [];
  for (let round = 0; round < perHost; round += 1) {
    for (const entry of queues) {
      if (picked.length >= maxTotal) return picked;
      const graph = entry.queue[round];
      if (!graph) continue;
      picked.push({
        hostid: entry.hostid,
        hostName: entry.hostName,
        graphid: graph.graphid,
        name: graph.name,
      });
    }
  }
  return picked;
}

export const DEFAULT_WIDGETS = Object.freeze({
  problems: true,
  severity: true,
  availability: true,
  graphs: true,
});

function groupFields(groupids) {
  // The dashboard API has no array type for widget fields; a multiselect is
  // encoded as repeated fields with the same name.
  return groupids.map((groupid) => [0, 'groupids', groupid]);
}

function layoutWidgets({ groupids, graphs = [], widgets = {}, options = {} }) {
  const include = { ...DEFAULT_WIDGETS, ...widgets };
  const list = [];
  let y = 0;

  if (include.problems) {
    list.push(
      widget('problems', 'Problems', 0, y, GRID_WIDTH, PROBLEMS_HEIGHT, [
        ...groupFields(groupids),
        [0, 'show', '1'],
        [0, 'show_tags', '3'],
      ]),
    );
    y += PROBLEMS_HEIGHT;
  }

  if (include.severity || include.availability) {
    const half = include.severity && include.availability;
    if (include.severity) {
      list.push(
        widget('problemsbysv', 'Problems by severity', 0, y, half ? GRAPH_WIDTH : GRID_WIDTH, SUMMARY_HEIGHT, groupFields(groupids)),
      );
    }
    if (include.availability) {
      list.push(
        widget(
          'hostavail',
          'Host availability',
          half ? GRAPH_WIDTH : 0,
          y,
          half ? GRAPH_WIDTH : GRID_WIDTH,
          SUMMARY_HEIGHT,
          groupFields(groupids),
        ),
      );
    }
    y += SUMMARY_HEIGHT;
  }

  if (include.graphs) {
    selectGraphs(graphs, options).forEach((graph, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      list.push(
        widget(
          'graph',
          `${graph.name} — ${graph.hostName}`,
          column * GRAPH_WIDTH,
          y + row * GRAPH_HEIGHT,
          GRAPH_WIDTH,
          GRAPH_HEIGHT,
          [
            [0, 'source', '0'],
            [0, 'graphid', graph.graphid],
          ],
        ),
      );
    });
  }

  return list;
}

export function buildDashboard({ group, graphs = [], nameTemplate = 'Auto: {group}', options = {} }) {
  return {
    name: dashboardName(nameTemplate, group.name),
    display_period: 30,
    auto_start: 1,
    pages: [{ widgets: layoutWidgets({ groupids: [group.groupid], graphs, options }) }],
  };
}

export function buildCustomDashboard({
  name,
  groupids = [],
  graphs = [],
  widgets = {},
  options = {},
}) {
  if (!name) throw new Error('dashboard name is required');
  if (groupids.length === 0) throw new Error('at least one host group is required');
  return {
    name,
    display_period: 30,
    auto_start: 1,
    pages: [{ widgets: layoutWidgets({ groupids, graphs, widgets, options }) }],
  };
}
