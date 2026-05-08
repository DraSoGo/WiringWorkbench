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
import { analyzeEdgeAssignment, getEffectivePorts } from '../../lib/portMapping';

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

// Tune these to adjust where the warning badge and tooltip sit relative to the sensor.
const NODE_HEADER_HEIGHT = 32;
const NODE_PORT_HEIGHT = 24;
const NODE_PADDING_HEIGHT = 8;
const WARNING_X_FROM_SENSOR_RIGHT = 12;
const WARNING_Y_FROM_SENSOR_TOP = 10;
const WARNING_TOOLTIP_TOP_OFFSET = -22;
const WARNING_TOOLTIP_SIDE_OFFSET = 14;
const WARNING_TOOLTIP_WIDTH = 250;

export default function WireEdge({
  id,
  source,
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
  const assignedBoardTicks = assignment?.assignedBoardPorts.length ?? 0;

  const bothZero = sensorTicks === 0 && assignedBoardTicks === 0;
  const mismatch = !!assignment && !bothZero && assignment.edgeMismatch;
  const matched = !!assignment && !bothZero && !assignment.edgeMismatch;

  const edgeColor = bothZero
    ? 'var(--edge-color)'
    : matched
    ? 'var(--phosphor)'
    : '#f59e0b';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const hasLabel = typeof label === 'string' && label.length > 0;
  const towardTarget = targetX >= sourceX ? 1 : -1;
  const sensorIsSource = assignment?.sensorNode.instanceId === source;
  const sensorAnchorX = sensorIsSource ? sourceX : targetX;
  const sensorAnchorY = sensorIsSource ? sourceY : targetY;
  const sensorPortRows = sensorNode ? getEffectivePorts(sensorNode, defs).length : 0;
  const sensorHeight = NODE_HEADER_HEIGHT + sensorPortRows * NODE_PORT_HEIGHT + NODE_PADDING_HEIGHT;
  const warningX = sensorAnchorX + WARNING_X_FROM_SENSOR_RIGHT;
  const warningY = sensorAnchorY - sensorHeight / 2 - WARNING_Y_FROM_SENSOR_TOP;
  const firstLine = `${sensorNode?.label ?? 'Sensor'} uses ${sensorTicks} active port${sensorTicks !== 1 ? 's' : ''}.`;
  const secondLine = `${boardNode?.label ?? 'Board'} has ${assignedBoardTicks} assigned slot${assignedBoardTicks !== 1 ? 's' : ''}.${assignment?.edgeMissingBoardSlots ? ` Missing ${assignment.edgeMissingBoardSlots}.` : ''}${assignment?.edgeIncompatibleSlots ? ` Invalid ${assignment.edgeIncompatibleSlots}.` : ''}`;

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
              transform: `translate(-50%,-50%) translate(${warningX}px,${warningY}px)`,
              pointerEvents: 'all',
              zIndex: 5000,
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
                  top: WARNING_TOOLTIP_TOP_OFFSET,
                  ...(towardTarget === 1
                    ? { left: WARNING_TOOLTIP_SIDE_OFFSET }
                    : { right: WARNING_TOOLTIP_SIDE_OFFSET }),
                  background: 'var(--bg-panel)',
                  border: '1px solid #f59e0b',
                  color: 'var(--text-primary)',
                  ...mono,
                  fontSize: 10,
                  padding: '6px 10px',
                  width: WARNING_TOOLTIP_WIDTH,
                  whiteSpace: 'normal',
                  lineHeight: 1.35,
                  zIndex: 20,
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 1px rgba(255,171,0,0.08)',
                }}
              >
                <div>{firstLine}</div>
                <div>{secondLine}</div>
              </div>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
