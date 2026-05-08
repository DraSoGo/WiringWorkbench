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

function prefersSharedBoardPort(role: PortDef['role']): boolean {
  return role === 'power' || role === 'gnd';
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

type BoardPortCandidate = {
  port: PortDef;
  portOrder: number;
  plannedCount: number;
  usedCount: number;
  score: number;
};

function compareCapacityCandidate(
  left: BoardPortCandidate,
  right: BoardPortCandidate
): number {
  if (right.score !== left.score) return right.score - left.score;
  const leftRemaining = left.plannedCount - left.usedCount;
  const rightRemaining = right.plannedCount - right.usedCount;
  if (rightRemaining !== leftRemaining) return rightRemaining - leftRemaining;
  return left.portOrder - right.portOrder;
}

function compareGrowthCandidate(
  sensorPort: PortDef,
  left: BoardPortCandidate,
  right: BoardPortCandidate
): number {
  const preferShared = prefersSharedBoardPort(sensorPort.role);
  const leftHasExisting = left.plannedCount > 0 ? 0 : 1;
  const rightHasExisting = right.plannedCount > 0 ? 0 : 1;
  const leftIsUnused = left.plannedCount === 0 ? 0 : 1;
  const rightIsUnused = right.plannedCount === 0 ? 0 : 1;

  if (preferShared) {
    if (leftHasExisting !== rightHasExisting) return leftHasExisting - rightHasExisting;
  } else {
    if (leftIsUnused !== rightIsUnused) return leftIsUnused - rightIsUnused;
    if (left.plannedCount !== right.plannedCount) return left.plannedCount - right.plannedCount;
  }

  if (right.score !== left.score) return right.score - left.score;
  return left.portOrder - right.portOrder;
}

function findBestCapacityCandidate(
  sensorPort: PortDef,
  boardPorts: PortDef[],
  boardPortOrder: Map<string, number>,
  plannedCounts: Record<string, number>,
  usedCounts: Record<string, number>
): BoardPortCandidate | null {
  const candidates = boardPorts
    .map((port) => ({
      port,
      portOrder: boardPortOrder.get(port.id) ?? Number.MAX_SAFE_INTEGER,
      plannedCount: plannedCounts[port.id] ?? 0,
      usedCount: usedCounts[port.id] ?? 0,
      score: getPortCompatibilityScore(sensorPort, port),
    }))
    .filter((candidate) => candidate.score > 0 && candidate.plannedCount > candidate.usedCount)
    .sort(compareCapacityCandidate);

  return candidates[0] ?? null;
}

function findBestGrowthCandidate(
  sensorPort: PortDef,
  boardPorts: PortDef[],
  boardPortOrder: Map<string, number>,
  plannedCounts: Record<string, number>,
  usedCounts: Record<string, number>
): BoardPortCandidate | null {
  const candidates = boardPorts
    .map((port) => ({
      port,
      portOrder: boardPortOrder.get(port.id) ?? Number.MAX_SAFE_INTEGER,
      plannedCount: plannedCounts[port.id] ?? 0,
      usedCount: usedCounts[port.id] ?? 0,
      score: getPortCompatibilityScore(sensorPort, port),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => compareGrowthCandidate(sensorPort, left, right));

  return candidates[0] ?? null;
}

export function suggestAutoBoardPortCounts(
  boardId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  defs: ComponentDef[]
): Record<string, number> | null {
  const boardNode = nodes.find((node) => node.instanceId === boardId);
  if (!boardNode || getNodeType(boardNode, defs) !== 'board') return null;

  const boardPorts = getEffectivePorts(boardNode, defs);
  const boardPortOrder = new Map(boardPorts.map((port, index) => [port.id, index]));
  const plannedCounts: Record<string, number> = {};
  const usedCounts: Record<string, number> = {};

  for (const port of boardPorts) {
    const count = getPortCount(boardNode, port.id);
    if (count > 0) plannedCounts[port.id] = count;
  }

  const relatedPairs = edges
    .map((edge) => resolveBoardSensorPair(edge, nodes, defs))
    .filter((pair): pair is BoardSensorPair => !!pair && pair.boardNode.instanceId === boardId);

  for (const pair of relatedPairs) {
    const sensorPorts = getSelectedPorts(pair.sensorNode, defs);
    for (const sensorPort of sensorPorts) {
      const capacityCandidate = findBestCapacityCandidate(
        sensorPort,
        boardPorts,
        boardPortOrder,
        plannedCounts,
        usedCounts
      );

      if (capacityCandidate) {
        usedCounts[capacityCandidate.port.id] = (usedCounts[capacityCandidate.port.id] ?? 0) + 1;
        continue;
      }

      const growthCandidate = findBestGrowthCandidate(
        sensorPort,
        boardPorts,
        boardPortOrder,
        plannedCounts,
        usedCounts
      );
      if (!growthCandidate) continue;

      plannedCounts[growthCandidate.port.id] = (plannedCounts[growthCandidate.port.id] ?? 0) + 1;
      usedCounts[growthCandidate.port.id] = (usedCounts[growthCandidate.port.id] ?? 0) + 1;
    }
  }

  return plannedCounts;
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
