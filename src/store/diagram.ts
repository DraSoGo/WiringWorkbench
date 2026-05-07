import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PortRole =
  | 'digital'
  | 'analog'
  | 'power'
  | 'gnd'
  | 'i2c'
  | 'spi'
  | 'uart'
  | 'pwm'
  | 'custom';

export interface PortDef {
  id: string;
  label: string;
  role: PortRole;
}

export interface ComponentDef {
  id: string;
  name: string;
  type: 'board' | 'sensor' | 'custom';
  category?: string;
  ports: PortDef[];
  notes?: string;
}

export interface DiagramNode {
  instanceId: string;
  defId: string;
  label: string;
  position: { x: number; y: number };
  activePorts: string[];
  portCounts?: Record<string, number>;
  portsOverride?: PortDef[];
}

export interface DiagramEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
}

export type DiagramSnapshot = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  customDefs: ComponentDef[];
  selectedId: string | null;
  history: DiagramSnapshot[];
  future: DiagramSnapshot[];
  _loadGen: number;

  // node actions
  addNode: (node: DiagramNode) => void;
  removeNode: (instanceId: string) => void;
  moveNode: (instanceId: string, position: { x: number; y: number }) => void;
  renameNode: (instanceId: string, label: string) => void;
  togglePort: (instanceId: string, portId: string) => void;
  setPortCount: (instanceId: string, portId: string, count: number) => void;

  // edge actions
  addEdge: (edge: DiagramEdge) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string | undefined) => void;

  // selection
  selectNode: (instanceId: string | null) => void;
  clearSelection: () => void;

  // node port overrides
  setNodePortsOverride: (instanceId: string, ports: PortDef[] | undefined, allowedPortIds?: string[]) => void;

  // custom defs
  addCustomDef: (def: ComponentDef) => void;
  updateCustomDef: (def: ComponentDef) => void;
  removeCustomDef: (defId: string) => void;

  // load
  loadDiagram: (snapshot: { nodes: DiagramNode[]; edges: DiagramEdge[]; customDefs: ComponentDef[] }) => void;

  // history
  undo: () => void;
  redo: () => void;
}

function snapshot(state: DiagramState): DiagramSnapshot {
  return {
    nodes: [...state.nodes],
    edges: [...state.edges],
  };
}

function normalizePortState(
  activePorts: unknown,
  portCounts: unknown
): Pick<DiagramNode, 'activePorts' | 'portCounts'> {
  const counts: Record<string, number> = {};

  if (portCounts && typeof portCounts === 'object') {
    for (const [portId, rawCount] of Object.entries(portCounts)) {
      const count = Math.max(0, Math.floor(Number(rawCount) || 0));
      if (count > 0) counts[portId] = count;
    }
  }

  if (Array.isArray(activePorts)) {
    for (const portId of activePorts) {
      if (typeof portId !== 'string' || !portId.trim()) continue;
      counts[portId] = Math.max(counts[portId] ?? 0, 1);
    }
  }

  return {
    activePorts: Object.keys(counts),
    portCounts: counts,
  };
}

function withPortCount(
  node: DiagramNode,
  portId: string,
  count: number
): DiagramNode {
  const nextCount = Math.max(0, Math.floor(count));
  const nextCounts = { ...(node.portCounts ?? {}) };

  if (nextCount > 0) nextCounts[portId] = nextCount;
  else delete nextCounts[portId];

  const nextActivePorts = Array.from(
    new Set(
      nextCount > 0
        ? [...node.activePorts.filter((id) => id !== portId), portId]
        : node.activePorts.filter((id) => id !== portId)
    )
  );

  return {
    ...node,
    activePorts: nextActivePorts,
    portCounts: nextCounts,
  };
}

function prunePorts(
  node: DiagramNode,
  allowedPortIds: string[] | undefined
): DiagramNode {
  if (!allowedPortIds) return node;
  const allowed = new Set(allowedPortIds);
  const nextCounts = Object.fromEntries(
    Object.entries(node.portCounts ?? {}).filter(([portId, count]) => allowed.has(portId) && count > 0)
  );

  return {
    ...node,
    activePorts: node.activePorts.filter((portId) => allowed.has(portId)),
    portCounts: nextCounts,
  };
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],
  customDefs: [],
  selectedId: null,
  history: [],
  future: [],
  _loadGen: 0,

  addNode: (node) => set((s) => ({
    history: [...s.history, snapshot(s)].slice(-50),
    future: [],
    nodes: [...s.nodes, node],
  })),

  removeNode: (instanceId) => set((s) => ({
    history: [...s.history, snapshot(s)].slice(-50),
    future: [],
    nodes: s.nodes.filter((n) => n.instanceId !== instanceId),
    edges: s.edges.filter((e) => e.fromNode !== instanceId && e.toNode !== instanceId),
    selectedId: s.selectedId === instanceId ? null : s.selectedId,
  })),

  moveNode: (instanceId, position) => set((s) => ({
    nodes: s.nodes.map((n) => n.instanceId === instanceId ? { ...n, position } : n),
  })),

  renameNode: (instanceId, label) => set((s) => ({
    nodes: s.nodes.map((n) => n.instanceId === instanceId ? { ...n, label } : n),
  })),

  togglePort: (instanceId, portId) => set((s) => ({
    nodes: s.nodes.map((n) => {
      if (n.instanceId !== instanceId) return n;
      const currentCount = n.portCounts?.[portId] ?? (n.activePorts.includes(portId) ? 1 : 0);
      return withPortCount(n, portId, currentCount > 0 ? 0 : 1);
    }),
  })),

  setPortCount: (instanceId, portId, count) => set((s) => ({
    nodes: s.nodes.map((n) => (
      n.instanceId === instanceId ? withPortCount(n, portId, count) : n
    )),
  })),

  addEdge: (edge) => set((s) => {
    const duplicate = s.edges.some(
      (e) =>
        (e.fromNode === edge.fromNode && e.toNode === edge.toNode) ||
        (e.fromNode === edge.toNode && e.toNode === edge.fromNode)
    );
    if (duplicate) return s;
    return {
      history: [...s.history, snapshot(s)].slice(-50),
      future: [],
      edges: [...s.edges, edge],
    };
  }),

  removeEdge: (edgeId) => set((s) => ({
    history: [...s.history, snapshot(s)].slice(-50),
    future: [],
    edges: s.edges.filter((e) => e.id !== edgeId),
  })),

  updateEdgeLabel: (edgeId, label) => set((s) => ({
    edges: s.edges.map((e) => (e.id === edgeId ? { ...e, label } : e)),
  })),

  selectNode: (instanceId) => set({ selectedId: instanceId }),

  clearSelection: () => set({ selectedId: null }),

  setNodePortsOverride: (instanceId, ports, allowedPortIds) => set((s) => ({
    nodes: s.nodes.map((n) => {
      if (n.instanceId !== instanceId) return n;
      return prunePorts({ ...n, portsOverride: ports }, allowedPortIds);
    }),
  })),

  addCustomDef: (def) => set((s) => ({ customDefs: [...s.customDefs, def] })),

  updateCustomDef: (def) => set((s) => ({
    customDefs: s.customDefs.map((d) => (d.id === def.id ? def : d)),
  })),

  removeCustomDef: (defId) => set((s) => ({
    customDefs: s.customDefs.filter((d) => d.id !== defId),
  })),

  loadDiagram: (snap) => set((s) => ({
    nodes: snap.nodes.map((n) => ({
      ...n,
      ...normalizePortState(n.activePorts, n.portCounts),
    })),
    edges: snap.edges,
    customDefs: snap.customDefs ?? [],
    selectedId: null,
    history: [],
    future: [],
    _loadGen: s._loadGen + 1,
  })),

  undo: () => {
    const { history, future, nodes, edges } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      history: history.slice(0, -1),
      future: [{ nodes, edges }, ...future],
    });
  },

  redo: () => {
    const { history, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      history: [...history, snapshot(get())],
      future: future.slice(1),
    });
  },
}));
