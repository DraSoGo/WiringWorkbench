import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { useDiagramStore } from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import { analyzeEdgeAssignment } from '../../lib/portMapping';

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

export default function WireEdge({
  id,
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
  const edges = useDiagramStore((s) => s.edges);
  const defs = [...BOARDS, ...SENSORS, ...customDefs];

  const assignment = analyzeEdgeAssignment(id, nodes, edges, defs);
  const sensorNode = assignment?.sensorNode;
  const boardNode = assignment?.boardNode;
  const sensorTicks = assignment?.sensorPorts.length ?? 0;
  const boardTotal = assignment?.boardPortSlots.length ?? 0;
  const sensorTotal = assignment?.totalSensorPorts ?? 0;

  const bothZero = sensorTicks === 0 && boardTotal === 0;
  const mismatch = !!assignment && !bothZero && assignment.aggregateMismatch;
  const matched = !!assignment && !bothZero && !assignment.aggregateMismatch;

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
                {sensorNode?.label ?? 'Sensor'} uses {sensorTicks} active port{sensorTicks !== 1 ? 's' : ''}.{' '}
                {boardNode?.label ?? 'Board'} has {boardTotal} assigned slot{boardTotal !== 1 ? 's' : ''} across
                all connected sensors, and {sensorTotal} sensor port{sensorTotal !== 1 ? 's' : ''} need mapping.
                {assignment?.missingBoardSlots
                  ? ` Missing ${assignment.missingBoardSlots} slot${assignment.missingBoardSlots !== 1 ? 's' : ''}.`
                  : assignment?.extraBoardSlots
                  ? ` ${assignment.extraBoardSlots} extra slot${assignment.extraBoardSlots !== 1 ? 's' : ''} selected.`
                  : ''}
              </div>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
