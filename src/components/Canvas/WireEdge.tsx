import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { useDiagramStore, type ComponentDef, type DiagramNode } from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

function nodeTypeFor(node: DiagramNode | undefined, defs: ComponentDef[]): ComponentDef['type'] | null {
  if (!node) return null;
  return defs.find((def) => def.id === node.defId)?.type ?? null;
}

export default function WireEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const nodes = useDiagramStore((s) => s.nodes);
  const customDefs = useDiagramStore((s) => s.customDefs);
  const defs = [...BOARDS, ...SENSORS, ...customDefs];

  const srcNode = nodes.find((n) => n.instanceId === source);
  const tgtNode = nodes.find((n) => n.instanceId === target);
  const srcTicks = srcNode?.activePorts.length ?? 0;
  const tgtTicks = tgtNode?.activePorts.length ?? 0;
  const srcIsBoard = nodeTypeFor(srcNode, defs) === 'board';
  const sensorNode = srcIsBoard ? tgtNode : srcNode;
  const boardNode = srcIsBoard ? srcNode : tgtNode;
  const sensorTicks = srcIsBoard ? tgtTicks : srcTicks;
  const boardTicks = srcIsBoard ? srcTicks : tgtTicks;

  const bothZero = srcTicks === 0 && tgtTicks === 0;
  const mismatch = !bothZero && srcTicks !== tgtTicks;
  const matched = !bothZero && srcTicks === tgtTicks;

  const edgeColor = bothZero
    ? 'var(--edge-color)'
    : matched
    ? 'var(--phosphor)'
    : '#f59e0b';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const hasLabel = typeof label === 'string' && label.length > 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          ...style,
          stroke: edgeColor,
          strokeDasharray: bothZero ? '5 4' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        {hasLabel && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              ...mono,
              fontSize: 10,
              padding: '1px 5px',
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        )}

        {mismatch && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + (hasLabel ? 18 : 0)}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={(e) => { e.stopPropagation(); setTipOpen((v) => !v); }}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#f59e0b',
                border: 'none',
                color: '#0d0f0e',
                ...mono,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              !
            </button>
            {tipOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bg-panel)',
                  border: '1px solid #f59e0b',
                  color: 'var(--text-primary)',
                  ...mono,
                  fontSize: 10,
                  padding: '6px 10px',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                {sensorNode?.label ?? 'Sensor'} has {sensorTicks} active port{sensorTicks !== 1 ? 's' : ''},{' '}
                {boardNode?.label ?? 'board'} has {boardTicks} assigned pin{boardTicks !== 1 ? 's' : ''}. Counts must match.
              </div>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
