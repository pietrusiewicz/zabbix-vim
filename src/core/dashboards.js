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

export function buildDashboard({ group, graphs = [], nameTemplate = 'Auto: {group}', options = {} }) {
  const widgets = [];

  widgets.push(
    widget('problems', 'Problems', 0, 0, GRID_WIDTH, PROBLEMS_HEIGHT, [
      [0, 'groupids', group.groupid],
      [0, 'show', '1'],
      [0, 'show_tags', '3'],
    ]),
  );

  const summaryY = PROBLEMS_HEIGHT;
  widgets.push(
    widget('problemsbysv', 'Problems by severity', 0, summaryY, GRAPH_WIDTH, SUMMARY_HEIGHT, [
      [0, 'groupids', group.groupid],
    ]),
  );
  widgets.push(
    widget('hostavail', 'Host availability', GRAPH_WIDTH, summaryY, GRAPH_WIDTH, SUMMARY_HEIGHT, [
      [0, 'groupids', group.groupid],
    ]),
  );

  const firstGraphY = summaryY + SUMMARY_HEIGHT;
  selectGraphs(graphs, options).forEach((graph, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    widgets.push(
      widget(
        'graph',
        `${graph.name} — ${graph.hostName}`,
        column * GRAPH_WIDTH,
        firstGraphY + row * GRAPH_HEIGHT,
        GRAPH_WIDTH,
        GRAPH_HEIGHT,
        [
          [0, 'source', '0'],
          [0, 'graphid', graph.graphid],
        ],
      ),
    );
  });

  return {
    name: dashboardName(nameTemplate, group.name),
    display_period: 30,
    auto_start: 1,
    pages: [{ widgets }],
  };
}
