import { useDiagramStore } from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import type { PortDef } from '../../store/diagram';

const ALL_DEFS = [...BOARDS, ...SENSORS];

const ROLE_COLOR: Record<string, string> = {
  digital: 'var(--text-secondary)',
  analog:  'var(--amber)',
  power:   'var(--red)',
  gnd:     'var(--text-muted)',
  i2c:     'var(--blue)',
  spi:     'var(--blue)',
  uart:    'var(--blue)',
  pwm:     'var(--phosphor)',
  custom:  'var(--text-primary)',
};

function PortRow({ port, connected }: { port: PortDef; connected: string | null }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1 border-b"
      style={{ borderColor: 'var(--border)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' }}
    >
      <span style={{ color: ROLE_COLOR[port.role] ?? 'var(--text-primary)' }}>
        {port.label}
      </span>
      <span style={{ color: connected ? 'var(--phosphor)' : 'var(--text-muted)' }}>
        {connected ?? '—'}
      </span>
    </div>
  );
}

export default function Inspector() {
  const { selectedId, nodes, edges, customDefs } = useDiagramStore();
  const node = nodes.find((n) => n.instanceId === selectedId);
  const def = node
    ? [...ALL_DEFS, ...customDefs].find((d) => d.id === node.defId)
    : null;

  if (!node || !def) {
    return (
      <aside
        className="flex items-center justify-center border-l"
        style={{ width: 220, background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        <span
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          no selection
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col border-l"
      style={{ width: 220, background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
    >
      {/* header */}
      <div
        className="px-3 py-2 border-b"
        style={{ borderColor: 'var(--border)', fontFamily: 'IBM Plex Mono, monospace' }}
      >
        <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--phosphor)', fontWeight: 600 }}>
          INSPECTOR
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: 4 }}>
          {node.label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {def.type} · {def.ports.length} ports
        </div>
      </div>

      {/* port list */}
      <div className="flex-1 overflow-y-auto">
        {def.ports.map((port) => {
          const edge = edges.find(
            (e) =>
              (e.fromNode === node.instanceId && e.fromPort === port.id) ||
              (e.toNode === node.instanceId && e.toPort === port.id)
          );
          const connectedNode = edge
            ? nodes.find(
                (n) =>
                  n.instanceId === (edge.fromNode === node.instanceId ? edge.toNode : edge.fromNode)
              )
            : null;

          return (
            <PortRow
              key={port.id}
              port={port}
              connected={connectedNode ? connectedNode.label : null}
            />
          );
        })}
      </div>

      {def.notes && (
        <div
          className="px-3 py-2 border-t"
          style={{
            borderColor: 'var(--border)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          {def.notes}
        </div>
      )}
    </aside>
  );
}
