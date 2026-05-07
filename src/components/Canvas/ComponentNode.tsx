import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentDef } from '../../store/diagram';

export type ComponentNodeData = {
  def: ComponentDef;
  label: string;
  usedPorts: Set<string>;
};

const PORT_H = 22;
const HEADER_H = 32;
const NODE_W = 180;

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

function ComponentNode({ data, selected }: NodeProps) {
  const { def, label, usedPorts } = data as ComponentNodeData;
  const ports = def.ports;
  const split = Math.ceil(ports.length / 2);
  const leftPorts = ports.slice(0, split);
  const rightPorts = ports.slice(split);
  const rows = Math.max(leftPorts.length, rightPorts.length);
  const nodeH = HEADER_H + rows * PORT_H + 8;

  return (
    <div
      style={{
        width: NODE_W,
        height: nodeH,
        background: 'var(--bg-surface)',
        border: `1px solid ${selected ? 'var(--phosphor)' : 'var(--border)'}`,
        boxShadow: selected ? '0 0 0 1px var(--phosphor-dim), 0 0 16px rgba(0,230,118,0.1)' : 'none',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* header */}
      <div
        style={{
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
          fontSize: '11px',
          letterSpacing: '0.05em',
          color: selected ? 'var(--phosphor)' : 'var(--text-primary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '1px 4px',
            flexShrink: 0,
          }}
        >
          {def.type.toUpperCase()}
        </span>
        {label}
      </div>

      {/* left port labels */}
      {leftPorts.map((port, i) => {
        const used = usedPorts.has(port.id);
        return (
          <div
            key={port.id}
            style={{
              position: 'absolute',
              left: 0,
              top: HEADER_H + i * PORT_H,
              width: '50%',
              height: PORT_H,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '10px',
              color: used ? (ROLE_COLOR[port.role] ?? 'var(--text-primary)') : 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {port.label}
          </div>
        );
      })}

      {/* right port labels */}
      {rightPorts.map((port, i) => {
        const used = usedPorts.has(port.id);
        return (
          <div
            key={port.id}
            style={{
              position: 'absolute',
              right: 0,
              top: HEADER_H + i * PORT_H,
              width: '50%',
              height: PORT_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 12,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '10px',
              color: used ? (ROLE_COLOR[port.role] ?? 'var(--text-primary)') : 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {port.label}
          </div>
        );
      })}

      {/* left handles */}
      {leftPorts.map((port, i) => {
        const used = usedPorts.has(port.id);
        return (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Left}
            style={{
              top: HEADER_H + i * PORT_H + PORT_H / 2,
              transform: 'translateX(-50%)',
              width: 8,
              height: 8,
              borderRadius: 0,
              background: used ? 'var(--phosphor)' : 'var(--bg-hover)',
              border: `1px solid ${used ? 'var(--phosphor-dim)' : 'var(--border-accent)'}`,
            }}
          />
        );
      })}

      {/* right handles */}
      {rightPorts.map((port, i) => {
        const used = usedPorts.has(port.id);
        return (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Right}
            style={{
              top: HEADER_H + i * PORT_H + PORT_H / 2,
              transform: 'translateX(50%)',
              width: 8,
              height: 8,
              borderRadius: 0,
              background: used ? 'var(--phosphor)' : 'var(--bg-hover)',
              border: `1px solid ${used ? 'var(--phosphor-dim)' : 'var(--border-accent)'}`,
            }}
          />
        );
      })}
    </div>
  );
}

export default memo(ComponentNode);
