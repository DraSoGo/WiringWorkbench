import type { ComponentDef, DiagramEdge, DiagramNode } from '../store/diagram';
import { BOARDS } from '../data/boards';
import { SENSORS } from '../data/sensors';
import { analyzeEdgeAssignment } from './portMapping';

const ALL_DEFS: ComponentDef[] = [...BOARDS, ...SENSORS];

export type ExportState = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  customDefs: ComponentDef[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function sanitize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** D3→3, GPIO21→21, GP4→4, A0→A0, SDA→SDA, etc. */
function pinValue(portId: string): string {
  if (/^D(\d+)$/.test(portId)) return portId.slice(1);
  if (/^GPIO(\d+)$/i.test(portId)) return portId.replace(/^GPIO/i, '');
  if (/^GP(\d+)$/.test(portId)) return portId.slice(2);
  return portId;
}

function allDefs(customDefs: ComponentDef[]): ComponentDef[] {
  return [...ALL_DEFS, ...customDefs];
}

/** Builds a per-instance unique key: "DHT11" if only one, "DHT11_1"/"DHT11_2" if multiple. */
function buildKeyMap(nodes: DiagramNode[]): Map<string, string> {
  const labelCount = new Map<string, number>();
  for (const n of nodes) labelCount.set(n.label, (labelCount.get(n.label) ?? 0) + 1);

  const labelIdx = new Map<string, number>();
  const keyMap = new Map<string, string>();
  for (const n of nodes) {
    const idx = (labelIdx.get(n.label) ?? 0) + 1;
    labelIdx.set(n.label, idx);
    const name = sanitize(n.label);
    keyMap.set(n.instanceId, labelCount.get(n.label)! > 1 ? `${name}_${idx}` : name);
  }
  return keyMap;
}

// ─── base64 (unicode-safe) ────────────────────────────────────────────────────

function toB64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

function fromB64(b64: string): string {
  return decodeURIComponent(
    atob(b64)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

// ─── exports ──────────────────────────────────────────────────────────────────

/**
 * JSON pin map: { "DHT11.DATA": "ARDUINO_UNO.D3", ... }
 * Keys are "NodeKey.portId" for both sides.
 */
export function exportJSON(state: ExportState): string {
  const defs = allDefs(state.customDefs);
  const keyMap = buildKeyMap(state.nodes);
  const result: Record<string, string | null> = {};

  for (const edge of state.edges) {
    const assignment = analyzeEdgeAssignment(edge.id, state.nodes, state.edges, defs);
    if (!assignment) continue;

    const sensorKey = keyMap.get(assignment.sensorNode.instanceId);
    const boardKey = keyMap.get(assignment.boardNode.instanceId);
    if (!sensorKey || !boardKey) continue;

    assignment.sensorPorts.forEach((sensorPort, index) => {
      const boardPort = assignment.assignedBoardPorts[index];
      result[`${sensorKey}.${sensorPort.id}`] = boardPort
        ? `${boardKey}.${boardPort.id}`
        : null;
    });
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Arduino .ino stub with #define pin assignments.
 * Only generates defines for sensor↔board signal connections (skips power/gnd).
 */
export function exportArduinoStub(state: ExportState): string {
  const defs = allDefs(state.customDefs);
  const keyMap = buildKeyMap(state.nodes);
  const date = new Date().toISOString().slice(0, 10);

  const boards = state.nodes.filter((n) => defs.find((d) => d.id === n.defId)?.type === 'board');
  const sensors = state.nodes.filter((n) => {
    const type = defs.find((d) => d.id === n.defId)?.type;
    return type === 'sensor' || type === 'custom';
  });

  const lines: string[] = [];

  // header comment
  lines.push('/*');
  lines.push(' * EasyArduino — generated pin mapping');
  lines.push(` * Date: ${date}`);
  if (boards.length) lines.push(` * Board(s): ${boards.map((n) => n.label).join(', ')}`);
  if (sensors.length) lines.push(` * Components: ${sensors.map((n) => n.label).join(', ')}`);
  lines.push(' */');
  lines.push('');

  // #defines
  const defineLines: string[] = [];

  for (const edge of state.edges) {
    const assignment = analyzeEdgeAssignment(edge.id, state.nodes, state.edges, defs);
    if (!assignment) continue;

    const nodeKey = keyMap.get(assignment.sensorNode.instanceId) ?? sanitize(assignment.sensorNode.label);
    assignment.sensorPorts.forEach((sensorPort, index) => {
      const boardPort = assignment.assignedBoardPorts[index];
      if (!boardPort) return;

      const defineName = `${nodeKey}_${sanitize(sensorPort.id)}`;
      const pin = pinValue(boardPort.id);
      defineLines.push(`#define ${defineName.padEnd(28)} ${pin}`);
    });
  }

  if (defineLines.length) {
    defineLines.forEach((l) => lines.push(l));
  } else {
    lines.push('// No connections found — drop components on the canvas and wire them up');
  }

  lines.push('');
  lines.push('void setup() {');
  lines.push('  // TODO: configure pins');
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  // TODO: your code here');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Encodes the diagram as base64 JSON appended to current URL as ?d=<b64>.
 */
export function exportShareURL(state: ExportState): string {
  const payload = {
    nodes: state.nodes,
    edges: state.edges,
    customDefs: state.customDefs,
  };
  const b64 = toB64(JSON.stringify(payload));
  const url = new URL(window.location.href);
  url.searchParams.set('d', b64);
  return url.toString();
}

/**
 * Parses ?d= query param. Returns null if absent or invalid.
 */
export function parseShareURL(search: string): ExportState | null {
  const d = new URLSearchParams(search).get('d');
  if (!d) return null;
  try {
    const parsed = JSON.parse(fromB64(d));
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return {
      nodes: parsed.nodes as DiagramNode[],
      edges: parsed.edges as DiagramEdge[],
      customDefs: Array.isArray(parsed.customDefs) ? (parsed.customDefs as ComponentDef[]) : [],
    };
  } catch {
    return null;
  }
}

// ─── download helper (browser only) ──────────────────────────────────────────

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
