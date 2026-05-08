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
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  useDiagramStore,
  type ComponentDef,
  type DiagramEdge,
  type DiagramNode,
} from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import { getEffectivePorts, getTotalAssignedPorts, suggestAutoBoardPortCounts } from '../../lib/portMapping';
import ComponentNode, { type ComponentNodeData } from './ComponentNode';
import WireEdge from './WireEdge';

const ALL_DEFS = [...BOARDS, ...SENSORS];
const NODE_TYPES: NodeTypes = { componentNode: ComponentNode };
const EDGE_TYPES: EdgeTypes = { wireEdge: WireEdge };

const LABEL_STYLE = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 10,
  fill: 'var(--text-secondary)',
} as const;

const LABEL_BG_STYLE = { fill: 'var(--bg-surface)', fillOpacity: 0.9 } as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

type RuntimeNodeData = Pick<ComponentNodeData, 'connectArmed' | 'onStartConnect'>;

function buildRfNode(
  storeNode: DiagramNode,
  extraDefs: ComponentDef[],
  runtime: RuntimeNodeData
): Node<ComponentNodeData> {
  const def = [...ALL_DEFS, ...extraDefs].find((d) => d.id === storeNode.defId);
  if (!def) throw new Error(`Unknown defId: ${storeNode.defId}`);
  const effectiveDef = storeNode.portsOverride ? { ...def, ports: storeNode.portsOverride } : def;
  return {
    id: storeNode.instanceId,
    type: 'componentNode',
    position: storeNode.position,
    dragHandle: '.node-drag-handle',
    data: {
      def: effectiveDef,
      label: storeNode.label,
      connectArmed: runtime.connectArmed,
      onStartConnect: runtime.onStartConnect,
    } satisfies ComponentNodeData,
  };
}

function buildRfEdge(edge: DiagramEdge): Edge {
  const rfEdge: Edge = {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: 'center',
    targetHandle: 'center',
    type: 'wireEdge',
    label: edge.label ?? '',
  };

  if (edge.label?.trim()) {
    rfEdge.labelStyle = LABEL_STYLE;
    rfEdge.labelBgStyle = LABEL_BG_STYLE;
  }

  return rfEdge;
}

function nodeTypeFor(node: DiagramNode, defs: ComponentDef[]): ComponentDef['type'] | null {
  return defs.find((def) => def.id === node.defId)?.type ?? null;
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
  const [pendingConnectionSource, setPendingConnectionSource] = useState<string | null>(null);

  const rfEdgesRef = useRef(rfEdges);
  useEffect(() => { rfEdgesRef.current = rfEdges; }, [rfEdges]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labelCancelled = useRef(false);
  const knownIds = useRef(new Set<string>());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const startConnectFromNode = useCallback((nodeId: string) => {
    if (pendingConnectionSource === nodeId) {
      setPendingConnectionSource(null);
      return;
    }
    setPendingConnectionSource(nodeId);
    showToast('Click a target node');
  }, [pendingConnectionSource, showToast]);

  const attemptConnection = useCallback((sourceId: string, targetId: string): boolean => {
    if (sourceId === targetId) return false;

    const sourceNode = store.nodes.find((node) => node.instanceId === sourceId);
    const targetNode = store.nodes.find((node) => node.instanceId === targetId);
    if (!sourceNode || !targetNode) return false;

    const allDefs = [...ALL_DEFS, ...store.customDefs];
    const sourceIsBoard = nodeTypeFor(sourceNode, allDefs) === 'board';
    const targetIsBoard = nodeTypeFor(targetNode, allDefs) === 'board';
    if (sourceIsBoard === targetIsBoard) {
      showToast('Connect a board to a sensor');
      return false;
    }

    const alreadyConnected = rfEdgesRef.current.some(
      (edge) =>
        (edge.source === sourceId && edge.target === targetId) ||
        (edge.source === targetId && edge.target === sourceId)
    );
    if (alreadyConnected) {
      showToast('Already connected');
      return false;
    }

    const edge: DiagramEdge = {
      id: `${sourceId}→${targetId}`,
      fromNode: sourceId,
      toNode: targetId,
    };
    const boardNode = sourceIsBoard ? sourceNode : targetNode;
    const sensorNode = sourceIsBoard ? targetNode : sourceNode;
    const sensorHasSelections = getTotalAssignedPorts(sensorNode) > 0;
    const seededSensorCounts = sensorHasSelections
      ? sensorNode.portCounts ?? Object.fromEntries(sensorNode.activePorts.map((portId) => [portId, 1]))
      : Object.fromEntries(
          getEffectivePorts(sensorNode, allDefs).map((port) => [port.id, 1] as const)
        );
    const nextNodes = store.nodes.map((node) =>
      node.instanceId === sensorNode.instanceId
        ? {
            ...node,
            activePorts: Object.keys(seededSensorCounts),
            portCounts: seededSensorCounts,
          }
        : node
    );
    const nextEdges = [...store.edges, edge];
    const autoBoardPortCounts = suggestAutoBoardPortCounts(
      boardNode.instanceId,
      nextNodes,
      nextEdges,
      allDefs
    );

    if (!sensorHasSelections) {
      store.replaceNodePortCounts(sensorNode.instanceId, seededSensorCounts);
    }
    if (autoBoardPortCounts) {
      store.replaceNodePortCounts(boardNode.instanceId, autoBoardPortCounts);
    }
    setRfEdges((prev) => rfAddEdge(buildRfEdge(edge), prev));
    store.addEdge(edge);
    return true;
  }, [setRfEdges, showToast, store]);

  // ── full reset on loadDiagram ────────────────────────────────────────────────

  useEffect(() => {
    if (store._loadGen === 0) return;
    const newNodes = store.nodes.map((node) =>
      buildRfNode(node, store.customDefs, {
        connectArmed: pendingConnectionSource === node.instanceId,
        onStartConnect: startConnectFromNode,
      })
    );
    const newEdges = store.edges.map(buildRfEdge);
    setRfNodes(newNodes);
    setRfEdges(newEdges);
    knownIds.current = new Set(store.nodes.map((n) => n.instanceId));
  }, [store._loadGen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── sync store → rf (undo/redo, external adds/removes) ──────────────────────

  useEffect(() => {
    const storeIds = new Set(store.nodes.map((n) => n.instanceId));
    const added = store.nodes.filter((n) => !knownIds.current.has(n.instanceId));
    const removedIds = [...knownIds.current].filter((id) => !storeIds.has(id));
    const addedIds = new Set(added.map((n) => n.instanceId));

    setRfNodes((prev) => {
      let next = prev.filter((n) => !removedIds.includes(n.id));
      for (const node of added) {
        next = [...next, buildRfNode(node, store.customDefs, {
          connectArmed: pendingConnectionSource === node.instanceId,
          onStartConnect: startConnectFromNode,
        })];
      }
      next = next.map((rfNode) => {
        if (addedIds.has(rfNode.id)) return rfNode;
        const storeNode = store.nodes.find((node) => node.instanceId === rfNode.id);
        if (!storeNode) return rfNode;
        const builtNode = buildRfNode(storeNode, store.customDefs, {
          connectArmed: pendingConnectionSource === storeNode.instanceId,
          onStartConnect: startConnectFromNode,
        });
        return {
          ...rfNode,
          position: storeNode.position,
          dragHandle: builtNode.dragHandle,
          data: builtNode.data,
        };
      });
      return next;
    });
    knownIds.current = storeIds;
  }, [pendingConnectionSource, setRfNodes, startConnectFromNode, store.customDefs, store.nodes]);

  useEffect(() => {
    setRfEdges(store.edges.map(buildRfEdge));
  }, [setRfEdges, store.edges]);

  // ── mirror selection from store → rf ────────────────────────────────────────

  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === store.selectedId }))
    );
  }, [store.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── event handlers ───────────────────────────────────────────────────────────

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
      const { source, target } = connection;
      if (!source || !target) return;
      attemptConnection(source, target);
    },
    [attemptConnection]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (pendingConnectionSource && pendingConnectionSource !== node.id) {
      if (attemptConnection(pendingConnectionSource, node.id)) {
        setPendingConnectionSource(null);
      }
      return;
    }
    store.selectNode(node.id);
  }, [attemptConnection, pendingConnectionSource, store]);

  const onEdgeClick = useCallback(() => {
    store.clearSelection();
  }, [store]);

  const onPaneClick = useCallback(() => {
    store.clearSelection();
    setLabelEditor(null);
    setPendingConnectionSource(null);
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
      const defId = e.dataTransfer.getData('application/wiringworkbench-def');
      if (!defId) return;
      const def = [...ALL_DEFS, ...store.customDefs].find((d) => d.id === defId);
      if (!def) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const instanceId = crypto.randomUUID();
      const newNode: DiagramNode = {
        instanceId,
        defId: def.id,
        label: def.name,
        position,
        activePorts: [],
        portCounts: {},
      };
      setRfNodes((prev) => [...prev, buildRfNode(newNode, store.customDefs, {
        connectArmed: false,
        onStartConnect: startConnectFromNode,
      })]);
      store.addNode(newNode);
      knownIds.current.add(instanceId);
    },
    [screenToFlowPosition, setRfNodes, startConnectFromNode, store]
  );

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
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
        deleteKeyCode={['Delete', 'Backspace']}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap nodeColor="var(--bg-surface)" maskColor="rgba(13,15,14,0.75)" style={{ border: '1px solid var(--border)' }} />
      </ReactFlow>

      {/* empty state hint */}
      {rfNodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontFamily: 'IBM Plex Mono, monospace',
              color: 'var(--text-muted)',
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.25, lineHeight: 1 }}>◻</div>
            <div style={{ fontSize: 13 }}>Drag a board or sensor from the left panel</div>
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>to get started</div>
          </div>
        </div>
      )}

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
