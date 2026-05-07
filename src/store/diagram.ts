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
  portCount?: number;
}

export interface DiagramEdge {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
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

  // node actions
  addNode: (node: DiagramNode) => void;
  removeNode: (instanceId: string) => void;
  moveNode: (instanceId: string, position: { x: number; y: number }) => void;
  renameNode: (instanceId: string, label: string) => void;

  // edge actions
  addEdge: (edge: DiagramEdge) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string | undefined) => void;

  // selection
  selectNode: (instanceId: string | null) => void;
  clearSelection: () => void;

  // custom defs
  addCustomDef: (def: ComponentDef) => void;
  updateCustomDef: (def: ComponentDef) => void;
  removeCustomDef: (defId: string) => void;

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

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],
  customDefs: [],
  selectedId: null,
  history: [],
  future: [],

  addNode: (node) => set((s) => ({
    history: [...s.history, snapshot(s)],
    future: [],
    nodes: [...s.nodes, node],
  })),

  removeNode: (instanceId) => set((s) => ({
    history: [...s.history, snapshot(s)],
    future: [],
    nodes: s.nodes.filter((n) => n.instanceId !== instanceId),
    edges: s.edges.filter(
      (e) => e.fromNode !== instanceId && e.toNode !== instanceId
    ),
    selectedId: s.selectedId === instanceId ? null : s.selectedId,
  })),

  moveNode: (instanceId, position) => set((s) => ({
    nodes: s.nodes.map((n) =>
      n.instanceId === instanceId ? { ...n, position } : n
    ),
  })),

  renameNode: (instanceId, label) => set((s) => ({
    nodes: s.nodes.map((n) =>
      n.instanceId === instanceId ? { ...n, label } : n
    ),
  })),

  addEdge: (edge) => set((s) => {
    const duplicate = s.edges.some(
      (e) =>
        (e.fromNode === edge.fromNode && e.fromPort === edge.fromPort) ||
        (e.toNode === edge.toNode && e.toPort === edge.toPort)
    );
    if (duplicate) return s;
    return {
      history: [...s.history, snapshot(s)],
      future: [],
      edges: [...s.edges, edge],
    };
  }),

  removeEdge: (edgeId) => set((s) => ({
    history: [...s.history, snapshot(s)],
    future: [],
    edges: s.edges.filter((e) => e.id !== edgeId),
  })),

  updateEdgeLabel: (edgeId, label) => set((s) => ({
    edges: s.edges.map((e) => (e.id === edgeId ? { ...e, label } : e)),
  })),

  selectNode: (instanceId) => set({ selectedId: instanceId }),

  clearSelection: () => set({ selectedId: null }),

  addCustomDef: (def) => set((s) => ({
    customDefs: [...s.customDefs, def],
  })),

  updateCustomDef: (def) => set((s) => ({
    customDefs: s.customDefs.map((d) => (d.id === def.id ? def : d)),
  })),

  removeCustomDef: (defId) => set((s) => ({
    customDefs: s.customDefs.filter((d) => d.id !== defId),
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
