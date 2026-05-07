import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentDef } from '../../store/diagram';
import { useDiagramStore } from '../../store/diagram';
import { getPortCount } from '../../lib/portMapping';

export type ComponentNodeData = {
  def: ComponentDef;
  label: string;
  connectArmed: boolean;
  onStartConnect: (nodeId: string) => void;
};

const PORT_H = 24;
const HEADER_H = 32;
const NODE_W = 248;

const ROLE_COLOR: Record<string, string> = {
  digital: '#7a9b7a',
  analog:  '#ffab00',
  power:   '#ff4757',
  gnd:     '#4a6b4a',
  i2c:     '#00b4d8',
  spi:     '#00b4d8',
  uart:    '#00b4d8',
  pwm:     '#00e676',
  custom:  '#d4e8d0',
};

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

const handleStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  border: 'none',
  background: 'transparent',
  zIndex: 1,
};

function ComponentNode({ id, data, selected }: NodeProps) {
  const { def, label, connectArmed, onStartConnect } = data as ComponentNodeData;
  const node = useDiagramStore(
    (s) => s.nodes.find((n) => n.instanceId === id)
  );
  const togglePort = useDiagramStore((s) => s.togglePort);
  const setPortCount = useDiagramStore((s) => s.setPortCount);
  const [hovered, setHovered] = useState(false);

  const ports = def.ports;
  const isBoard = def.type === 'board';
  const columns = isBoard ? 2 : 1;
  const nodeH = HEADER_H + Math.ceil(ports.length / columns) * PORT_H + 8;

  const renderPort = (port: ComponentDef['ports'][number]) => {
    const count = node ? getPortCount(node, port.id) : 0;
    const active = count > 0;

    return (
      <div
        key={port.id}
        style={{
          height: PORT_H,
          display: 'flex',
          alignItems: 'center',
          padding: isBoard ? '0 6px' : '0 8px',
          gap: 5,
          minWidth: 0,
        }}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={() => togglePort(id, port.id)}
          onClick={(e) => e.stopPropagation()}
          className="nodrag"
          style={{
            accentColor: 'var(--phosphor)',
            cursor: 'pointer',
            width: 11,
            height: 11,
            flexShrink: 0,
            margin: 0,
          }}
        />
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: ROLE_COLOR[port.role] ?? '#888',
            flexShrink: 0,
            display: 'inline-block',
            opacity: active ? 1 : 0.35,
          }}
        />
        <span
          style={{
            ...mono,
            fontSize: 9,
            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={port.label}
        >
          {port.label}
        </span>
        {isBoard && active && (
          <div
            className="nodrag"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPortCount(id, port.id, count - 1);
              }}
              style={{
                width: 14,
                height: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-secondary)',
                fontSize: 10,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
              }}
              title={`Remove one mapping from ${port.id}`}
            >
              -
            </button>
            <span
              style={{
                ...mono,
                fontSize: 8,
                color: 'var(--phosphor)',
                minWidth: 10,
                textAlign: 'center',
              }}
              title={`${count} mapped sensor port${count !== 1 ? 's' : ''}`}
            >
              {count}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPortCount(id, port.id, count + 1);
              }}
              style={{
                width: 14,
                height: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-secondary)',
                fontSize: 10,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
              }}
              title={`Add one mapping to ${port.id}`}
            >
              +
            </button>
          </div>
        )}
        {!isBoard && (
          <span
            style={{
              ...mono,
              fontSize: 8,
              color: 'var(--text-muted)',
              flexShrink: 0,
              opacity: 0.6,
            }}
          >
            {port.id}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: NODE_W,
        height: nodeH,
        background: 'var(--bg-surface)',
        border: `1px solid ${selected ? 'var(--phosphor)' : 'var(--border)'}`,
        boxShadow: selected
          ? '0 0 0 1px var(--phosphor-dim), 0 0 16px rgba(0,230,118,0.1)'
          : 'none',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        id="center"
        style={handleStyle}
      />

      {/* header */}
      <div
        className="node-drag-handle"
        style={{
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
          ...mono,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '0.05em',
          color: selected ? 'var(--phosphor)' : 'var(--text-primary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          gap: 6,
          position: 'relative',
          zIndex: 2,
          cursor: 'grab',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '1px 4px',
            flexShrink: 0,
          }}
        >
          {def.type.toUpperCase()}
        </span>
        {label}

        <button
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation();
            onStartConnect(id);
          }}
          style={{
            marginLeft: 'auto',
            background: connectArmed ? 'var(--amber)' : 'var(--bg-panel)',
            border: `1px solid ${connectArmed ? 'var(--amber-dim)' : 'var(--border-accent)'}`,
            color: connectArmed ? '#0d0f0e' : 'var(--text-secondary)',
            ...mono,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '2px 6px',
            opacity: hovered || connectArmed ? 1 : 0,
            pointerEvents: hovered || connectArmed ? 'all' : 'none',
            cursor: 'pointer',
          }}
          title={connectArmed ? 'Cancel connect mode' : 'Connect this node'}
        >
          {connectArmed ? 'cancel' : 'connect'}
        </button>
      </div>

      {/* port rows */}
      <div
        style={{
          padding: '4px 0',
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: isBoard ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          columnGap: isBoard ? 6 : 0,
        }}
      >
        {ports.map(renderPort)}
      </div>
    </div>
  );
}

export default memo(ComponentNode);
