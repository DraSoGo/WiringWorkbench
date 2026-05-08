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

function isBoardSignalRole(role: PortDef['role']): boolean {
  return role === 'digital' || role === 'pwm' || role === 'spi' || role === 'uart' || role === 'i2c';
}

function arePortRolesCompatible(sensorPort: PortDef, boardPort: PortDef): boolean {
  return getPortCompatibilityScore(sensorPort, boardPort) > 0;
}

function getPortCompatibilityScore(sensorPort: PortDef, boardPort: PortDef): number {
  switch (sensorPort.role) {
    case 'power':
      return boardPort.role === 'power' ? 100 : -1;
    case 'gnd':
      return boardPort.role === 'gnd' ? 100 : -1;
    case 'analog':
      return boardPort.role === 'analog' ? 100 : -1;
    case 'i2c':
      return boardPort.role === 'i2c' ? 100 : -1;
    case 'spi':
      return boardPort.role === 'spi' ? 100 : -1;
    case 'uart':
      return boardPort.role === 'uart' ? 100 : -1;
    case 'pwm':
      if (boardPort.role === 'pwm') return 100;
      if (boardPort.role === 'digital') return 90;
      if (boardPort.role === 'spi' || boardPort.role === 'uart' || boardPort.role === 'i2c') return 75;
      return -1;
    case 'digital':
      if (boardPort.role === 'digital') return 100;
      if (boardPort.role === 'pwm') return 95;
      if (boardPort.role === 'spi' || boardPort.role === 'uart' || boardPort.role === 'i2c') return 85;
      return -1;
    case 'custom':
      if (boardPort.role === 'custom') return 100;
      if (isBoardSignalRole(boardPort.role)) return 70;
      return -1;
    default:
      return -1;
  }
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

type BoardSlot = {
  port: PortDef;
  slotOrder: number;
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
  connectionOrder: number;
  edgeMismatch: boolean;
  edgeMissingBoardSlots: number;
  edgeIncompatibleSlots: number;
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
  const availableSlots: BoardSlot[] = boardPortSlots.map((port, slotOrder) => ({ port, slotOrder }));
  const relatedPairs = edges
    .map((edge) => resolveBoardSensorPair(edge, nodes, defs))
    .filter((pair): pair is BoardSensorPair => !!pair && pair.boardNode.instanceId === boardId);

  const assignments = relatedPairs.map(({ edge, sensorNode }, index) => {
    const sensorPorts = getSelectedPorts(sensorNode, defs);
    const assignedBoardPorts: PortDef[] = [];
    let edgeMissingBoardSlots = 0;
    let edgeIncompatibleSlots = 0;

    for (const sensorPort of sensorPorts) {
      if (!availableSlots.length) {
        edgeMissingBoardSlots += 1;
        continue;
      }

      let chosenIndex = -1;
      let chosenScore = Number.NEGATIVE_INFINITY;

      for (let slotIndex = 0; slotIndex < availableSlots.length; slotIndex += 1) {
        const score = getPortCompatibilityScore(sensorPort, availableSlots[slotIndex].port);
        if (score > chosenScore) {
          chosenScore = score;
          chosenIndex = slotIndex;
        }
      }

      const [chosenSlot] = availableSlots.splice(chosenIndex, 1);
      assignedBoardPorts.push(chosenSlot.port);
      if (chosenScore <= 0) edgeIncompatibleSlots += 1;
    }

    return {
      edge,
      boardNode,
      sensorNode,
      sensorPorts,
      assignedBoardPorts,
      connectionOrder: index,
      edgeMismatch: edgeMissingBoardSlots > 0 || edgeIncompatibleSlots > 0,
      edgeMissingBoardSlots,
      edgeIncompatibleSlots,
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
      const incompatible = boardPort && !arePortRolesCompatible(sensorPort, boardPort);
      return `${sensorPort.id} -> ${boardPort?.id ?? 'unassigned'}${incompatible ? ' !' : ''}`;
    })
    .join(', ');
}
