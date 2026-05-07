import { useCallback, useEffect, useRef } from 'react';
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
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDiagramStore } from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import ComponentNode, { type ComponentNodeData } from './ComponentNode';

const ALL_DEFS = [...BOARDS, ...SENSORS];
const NODE_TYPES: NodeTypes = { componentNode: ComponentNode };

const EDGE_STYLE = { stroke: 'var(--phosphor)', strokeWidth: 1.5 };
const EDGE_LABEL_STYLE = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 10,
  fill: 'var(--text-secondary)',
};

function buildRfNode(
  storeNode: { instanceId: string; defId: string; label: string; position: { x: number; y: number } },
  usedPorts: Set<string>,
  extraDefs: typeof ALL_DEFS = []
): Node {
  const def = [...ALL_DEFS, ...extraDefs].find((d) => d.id === storeNode.defId);
  if (!def) throw new Error(`Unknown defId: ${storeNode.defId}`);
  return {
    id: storeNode.instanceId,
    type: 'componentNode',
    position: storeNode.position,
    data: { def, label: storeNode.label, usedPorts } satisfies ComponentNodeData,
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

// ─────────────────────────────────────────────────────────────────────────────

function CanvasInner() {
  const store = useDiagramStore();
  const { screenToFlowPosition } = useReactFlow();

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>([]);

  // Track store node ids to detect adds/removes from outside (e.g. undo/redo)
  const knownIds = useRef(new Set<string>());

  // Sync store → rf when nodes are added/removed externally
  useEffect(() => {
    const storeIds = new Set(store.nodes.map((n) => n.instanceId));

    const added = store.nodes.filter((n) => !knownIds.current.has(n.instanceId));
    const removedIds = [...knownIds.current].filter((id) => !storeIds.has(id));

    if (added.length === 0 && removedIds.length === 0) return;

    setRfNodes((prev) => {
      let next = prev.filter((n) => !removedIds.includes(n.id));
      for (const n of added) {
        next = [...next, buildRfNode(n, new Set())];
      }
      return next;
    });

    knownIds.current = storeIds;
  }, [store.nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh usedPorts on all nodes whenever edges change
  useEffect(() => {
    if (rfEdges.length === 0 && rfNodes.every((n) => (n.data as ComponentNodeData).usedPorts.size === 0)) return;
    const usedMap = recomputeUsedPorts(rfEdges);
    setRfNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, usedPorts: usedMap.get(n.id) ?? new Set<string>() },
      }))
    );
  }, [rfEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selected state from store → rf
  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === store.selectedId }))
    );
  }, [store.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── event handlers ───────────────────────────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onRfNodesChange(changes);
      for (const c of changes) {
        if (c.type === 'position' && !c.dragging && c.position) {
          store.moveNode(c.id, c.position);
        }
        if (c.type === 'remove') {
          store.removeNode(c.id);
          knownIds.current.delete(c.id);
        }
      }
    },
    [onRfNodesChange, store]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;
      const rfEdge: Edge = {
        id: `${connection.source}:${connection.sourceHandle}→${connection.target}:${connection.targetHandle}`,
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
        style: EDGE_STYLE,
        labelStyle: EDGE_LABEL_STYLE,
      };
      setRfEdges((prev) => rfAddEdge(rfEdge, prev));
      store.addEdge({
        id: rfEdge.id,
        fromNode: connection.source,
        fromPort: connection.sourceHandle,
        toNode: connection.target,
        toPort: connection.targetHandle,
      });
    },
    [setRfEdges, store]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      store.selectNode(node.id);
    },
    [store]
  );

  const onPaneClick = useCallback(() => {
    store.clearSelection();
  }, [store]);

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

      const rfNode = buildRfNode({ instanceId, defId: def.id, label: def.name, position }, new Set());
      setRfNodes((prev) => [...prev, rfNode]);
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
        onEdgesChange={onRfEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
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
        <MiniMap
          nodeColor="var(--bg-surface)"
          maskColor="rgba(13,15,14,0.75)"
          style={{ border: '1px solid var(--border)' }}
        />
      </ReactFlow>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
