import type { ComponentDef, DiagramEdge, DiagramNode, PortDef } from '../store/diagram';

export function getEffectivePorts(node: DiagramNode, defs: ComponentDef[]): PortDef[] {
  if (node.portsOverride) return node.portsOverride;
  return defs.find((def) => def.id === node.defId)?.ports ?? [];
}

export function getPortCount(node: DiagramNode, portId: string): number {
  const rawCount = node.portCounts?.[portId];
  if (typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount > 0) {
    return Math.max(1, Math.floor(rawCount));
  }
  return node.activePorts.includes(portId) ? 1 : 0;
}

export function getTotalAssignedPorts(node: DiagramNode): number {
  const portIds = new Set<string>(node.activePorts);
  Object.entries(node.portCounts ?? {}).forEach(([portId, count]) => {
    if (count > 0) portIds.add(portId);
  });
  return Array.from(portIds).reduce((total, portId) => total + getPortCount(node, portId), 0);
}

export function getSelectedPorts(node: DiagramNode, defs: ComponentDef[]): PortDef[] {
  return getEffectivePorts(node, defs).filter((port) => getPortCount(node, port.id) > 0);
}

export function getExpandedSelectedPorts(node: DiagramNode, defs: ComponentDef[]): PortDef[] {
  const expanded: PortDef[] = [];
  for (const port of getEffectivePorts(node, defs)) {
    const count = getPortCount(node, port.id);
    for (let index = 0; index < count; index += 1) {
      expanded.push(port);
    }
  }
  return expanded;
}

function getNodeType(
  node: DiagramNode | undefined,
  defs: ComponentDef[]
): ComponentDef['type'] | null {
  if (!node) return null;
  return defs.find((def) => def.id === node.defId)?.type ?? null;
}

type BoardSensorPair = {
  edge: DiagramEdge;
  boardNode: DiagramNode;
  sensorNode: DiagramNode;
};

function resolveBoardSensorPair(
  edge: DiagramEdge,
  nodes: DiagramNode[],
  defs: ComponentDef[]
): BoardSensorPair | null {
  const fromNode = nodes.find((node) => node.instanceId === edge.fromNode);
  const toNode = nodes.find((node) => node.instanceId === edge.toNode);
  if (!fromNode || !toNode) return null;

  const fromIsBoard = getNodeType(fromNode, defs) === 'board';
  const toIsBoard = getNodeType(toNode, defs) === 'board';
  if (fromIsBoard === toIsBoard) return null;

  return fromIsBoard
    ? { edge, boardNode: fromNode, sensorNode: toNode }
    : { edge, boardNode: toNode, sensorNode: fromNode };
}

export type EdgeAssignment = {
  edge: DiagramEdge;
  boardNode: DiagramNode;
  sensorNode: DiagramNode;
  sensorPorts: PortDef[];
  assignedBoardPorts: PortDef[];
  boardPortSlots: PortDef[];
  totalSensorPorts: number;
  aggregateMismatch: boolean;
  missingBoardSlots: number;
  extraBoardSlots: number;
};

export function analyzeBoardAssignments(
  boardId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  defs: ComponentDef[]
): {
  boardNode: DiagramNode;
  boardPortSlots: PortDef[];
  totalSensorPorts: number;
  aggregateMismatch: boolean;
  assignments: EdgeAssignment[];
} | null {
  const boardNode = nodes.find((node) => node.instanceId === boardId);
  if (!boardNode || getNodeType(boardNode, defs) !== 'board') return null;

  const boardPortSlots = getExpandedSelectedPorts(boardNode, defs);
  const relatedPairs = edges
    .map((edge) => resolveBoardSensorPair(edge, nodes, defs))
    .filter((pair): pair is BoardSensorPair => !!pair && pair.boardNode.instanceId === boardId);

  let cursor = 0;
  const assignments = relatedPairs.map(({ edge, sensorNode }) => {
    const sensorPorts = getSelectedPorts(sensorNode, defs);
    const assignedBoardPorts = boardPortSlots.slice(cursor, cursor + sensorPorts.length);
    cursor += sensorPorts.length;
    return {
      edge,
      boardNode,
      sensorNode,
      sensorPorts,
      assignedBoardPorts,
      boardPortSlots,
      totalSensorPorts: 0,
      aggregateMismatch: false,
      missingBoardSlots: 0,
      extraBoardSlots: 0,
    };
  });

  const totalSensorPorts = assignments.reduce(
    (total, assignment) => total + assignment.sensorPorts.length,
    0
  );
  const aggregateMismatch = boardPortSlots.length !== totalSensorPorts;
  const missingBoardSlots = Math.max(0, totalSensorPorts - boardPortSlots.length);
  const extraBoardSlots = Math.max(0, boardPortSlots.length - totalSensorPorts);

  return {
    boardNode,
    boardPortSlots,
    totalSensorPorts,
    aggregateMismatch,
    assignments: assignments.map((assignment) => ({
      ...assignment,
      totalSensorPorts,
      aggregateMismatch,
      missingBoardSlots,
      extraBoardSlots,
    })),
  };
}

export function analyzeEdgeAssignment(
  edgeId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  defs: ComponentDef[]
): EdgeAssignment | null {
  const edge = edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const pair = resolveBoardSensorPair(edge, nodes, defs);
  if (!pair) return null;
  const boardSummary = analyzeBoardAssignments(pair.boardNode.instanceId, nodes, edges, defs);
  return boardSummary?.assignments.find((assignment) => assignment.edge.id === edgeId) ?? null;
}

export function formatPortMapping(assignment: EdgeAssignment): string {
  if (assignment.sensorPorts.length === 0) return 'No active ports';
  return assignment.sensorPorts
    .map((sensorPort, index) => {
      const boardPort = assignment.assignedBoardPorts[index];
      return `${sensorPort.id} -> ${boardPort?.id ?? 'unassigned'}`;
    })
    .join(', ');
}
