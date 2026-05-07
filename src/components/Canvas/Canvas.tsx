import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge as rfAddEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDiagramStore, type DiagramNode, type PortRole } from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import ComponentNode, { type ComponentNodeData } from './ComponentNode';

const ALL_DEFS = [...BOARDS, ...SENSORS];
const NODE_TYPES: NodeTypes = { componentNode: ComponentNode };

const LABEL_STYLE = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 10,
  fill: 'var(--text-secondary)',
} as const;

const LABEL_BG_STYLE = { fill: 'var(--bg-surface)', fillOpacity: 0.9 } as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPortRole(nodeId: string, portId: string, nodes: Node[]): PortRole | undefined {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;
  const def = (node.data as ComponentNodeData).def;
  return def?.ports.find((p) => p.id === portId)?.role;
}

function portAlreadyUsed(nodeId: string, portId: string, edges: Edge[]): boolean {
  return edges.some(
    (e) =>
      (e.source === nodeId && e.sourceHandle === portId) ||
      (e.target === nodeId && e.targetHandle === portId)
  );
}

function buildRfNode(
  storeNode: DiagramNode,
  usedPorts: Set<string>,
  extraDefs: typeof ALL_DEFS = []
): Node {
  const def = [...ALL_DEFS, ...extraDefs].find((d) => d.id === storeNode.defId);
  if (!def) throw new Error(`Unknown defId: ${storeNode.defId}`);
  const effectiveDef = storeNode.portsOverride ? { ...def, ports: storeNode.portsOverride } : def;
  return {
    id: storeNode.instanceId,
    type: 'componentNode',
    position: storeNode.position,
    data: { def: effectiveDef, label: storeNode.label, usedPorts } satisfies ComponentNodeData,
  };
}

function recomputeUsedPorts(edges: Edge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!map.has(e.source)) map.set(e.source, new Set());
    if (!map.has(e.target)) map.set(e.target, new Set());
    if (e.sourceHandle) map.get(e.source)!.add(e.sourceHandle);
    if (e.targetHandle) map.get(e.target)!.add(e.targetHandle);
  }
  return map;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 2000,
        background: 'var(--bg-panel)',
        border: '1px solid var(--red)',
        color: 'var(--red)',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        letterSpacing: '0.04em',
        padding: '7px 14px',
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}

// ─── CanvasInner ──────────────────────────────────────────────────────────────

type LabelEditor = { edgeId: string; x: number; y: number; value: string };

function CanvasInner() {
  const store = useDiagramStore();
  const { screenToFlowPosition } = useReactFlow();

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [labelEditor, setLabelEditor] = useState<LabelEditor | null>(null);

  // Refs so callbacks stay stable without stale closures
  const rfNodesRef = useRef(rfNodes);
  const rfEdgesRef = useRef(rfEdges);
  useEffect(() => { rfNodesRef.current = rfNodes; }, [rfNodes]);
  useEffect(() => { rfEdgesRef.current = rfEdges; }, [rfEdges]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labelCancelled = useRef(false);
  const knownIds = useRef(new Set<string>());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── sync store → rf (undo/redo, external adds/removes) ────────────────────

  useEffect(() => {
    const storeIds = new Set(store.nodes.map((n) => n.instanceId));
    const added = store.nodes.filter((n) => !knownIds.current.has(n.instanceId));
    const removedIds = [...knownIds.current].filter((id) => !storeIds.has(id));
    const addedIds = new Set(added.map((n) => n.instanceId));

    setRfNodes((prev) => {
      // remove deleted nodes
      let next = prev.filter((n) => !removedIds.includes(n.id));
      // add new nodes
      for (const n of added) next = [...next, buildRfNode(n, new Set(), store.customDefs)];
      // patch existing nodes: label and portsOverride may have changed
      next = next.map((rfNode) => {
        if (addedIds.has(rfNode.id)) return rfNode;
        const sn = store.nodes.find((n) => n.instanceId === rfNode.id);
        if (!sn) return rfNode;
        const baseDef = [...ALL_DEFS, ...store.customDefs].find((d) => d.id === sn.defId);
        if (!baseDef) return rfNode;
        const effectiveDef = sn.portsOverride ? { ...baseDef, ports: sn.portsOverride } : baseDef;
        const cur = rfNode.data as ComponentNodeData;
        if (cur.label === sn.label && cur.def === effectiveDef) return rfNode;
        return { ...rfNode, data: { ...rfNode.data, def: effectiveDef, label: sn.label } };
      });
      return next;
    });
    knownIds.current = storeIds;
  }, [store.nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── refresh usedPorts when edges change ───────────────────────────────────

  useEffect(() => {
    const usedMap = recomputeUsedPorts(rfEdges);
    setRfNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, usedPorts: usedMap.get(n.id) ?? new Set<string>() },
      }))
    );
  }, [rfEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── mirror selection from store → rf ─────────────────────────────────────

  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === store.selectedId }))
    );
  }, [store.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── event handlers ────────────────────────────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onRfNodesChange(changes);
      for (const c of changes) {
        if (c.type === 'position' && !c.dragging && c.position) store.moveNode(c.id, c.position);
        if (c.type === 'remove') { store.removeNode(c.id); knownIds.current.delete(c.id); }
      }
    },
    [onRfNodesChange, store]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onRfEdgesChange(changes);
      for (const c of changes) {
        if (c.type === 'remove') store.removeEdge(c.id);
      }
    },
    [onRfEdgesChange, store]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) return;
      // prevent self-connection
      if (source === target) return;

      const nodes = rfNodesRef.current;
      const edges = rfEdgesRef.current;

      const srcRole = getPortRole(source, sourceHandle, nodes);
      const tgtRole = getPortRole(target, targetHandle, nodes);
      const srcFanOut = srcRole === 'power' || srcRole === 'gnd';
      const tgtFanOut = tgtRole === 'power' || tgtRole === 'gnd';

      if (!srcFanOut && portAlreadyUsed(source, sourceHandle, edges)) {
        showToast(`${sourceHandle} already connected`);
        return;
      }
      if (!tgtFanOut && portAlreadyUsed(target, targetHandle, edges)) {
        showToast(`${targetHandle} already connected`);
        return;
      }

      const id = `${source}:${sourceHandle}→${target}:${targetHandle}`;
      const rfEdge: Edge = { id, source, sourceHandle, target, targetHandle };
      setRfEdges((prev) => rfAddEdge(rfEdge, prev));
      store.addEdge({ id, fromNode: source, fromPort: sourceHandle, toNode: target, toPort: targetHandle });
    },
    [setRfEdges, store, showToast]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    store.selectNode(node.id);
  }, [store]);

  const onEdgeClick = useCallback(() => {
    store.clearSelection();
  }, [store]);

  const onPaneClick = useCallback(() => {
    store.clearSelection();
    setLabelEditor(null);
  }, [store]);

  const onEdgeDoubleClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    labelCancelled.current = false;
    setLabelEditor({
      edgeId: edge.id,
      x: e.clientX,
      y: e.clientY,
      value: (edge.label as string) ?? '',
    });
  }, []);

  const applyLabel = useCallback(() => {
    if (labelCancelled.current) { labelCancelled.current = false; return; }
    setLabelEditor((editor) => {
      if (!editor) return null;
      const label = editor.value.trim() || undefined;
      setRfEdges((prev) =>
        prev.map((e) =>
          e.id === editor.edgeId
            ? { ...e, label: label ?? '', labelStyle: LABEL_STYLE, labelBgStyle: LABEL_BG_STYLE }
            : e
        )
      );
      store.updateEdgeLabel(editor.edgeId, label);
      return null;
    });
  }, [setRfEdges, store]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const defId = e.dataTransfer.getData('application/easyarduino-def');
      if (!defId) return;
      const def = [...ALL_DEFS, ...store.customDefs].find((d) => d.id === defId);
      if (!def) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const instanceId = crypto.randomUUID();
      setRfNodes((prev) => [...prev, buildRfNode({ instanceId, defId: def.id, label: def.name, position }, new Set(), store.customDefs)]);
      store.addNode({ instanceId, defId: def.id, label: def.name, position });
      knownIds.current.add(instanceId);
    },
    [screenToFlowPosition, setRfNodes, store]
  );

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.15}
        maxZoom={2}
        deleteKeyCode="Delete"
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap nodeColor="var(--bg-surface)" maskColor="rgba(13,15,14,0.75)" style={{ border: '1px solid var(--border)' }} />
      </ReactFlow>

      {/* floating edge label editor */}
      {labelEditor && (
        <input
          autoFocus
          value={labelEditor.value}
          onChange={(e) => setLabelEditor((prev) => prev ? { ...prev, value: e.target.value } : null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyLabel();
            if (e.key === 'Escape') { labelCancelled.current = true; setLabelEditor(null); }
          }}
          onBlur={applyLabel}
          style={{
            position: 'fixed',
            left: labelEditor.x - 60,
            top: labelEditor.y - 12,
            zIndex: 2000,
            width: 120,
            background: 'var(--bg-panel)',
            border: '1px solid var(--phosphor-dim)',
            color: 'var(--text-primary)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            padding: '3px 7px',
            outline: 'none',
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
