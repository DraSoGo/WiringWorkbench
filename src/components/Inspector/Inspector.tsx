import { useEffect, useState } from 'react';
import {
  useDiagramStore,
  type ComponentDef,
  type DiagramEdge,
  type DiagramNode,
  type PortDef,
  type PortRole,
} from '../../store/diagram';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';

const ALL_DEFS: ComponentDef[] = [...BOARDS, ...SENSORS];
const PORT_ROLES: PortRole[] = ['digital', 'analog', 'power', 'gnd', 'i2c', 'spi', 'uart', 'pwm', 'custom'];

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

// ─── helpers ──────────────────────────────────────────────────────────────────

function getEffectivePorts(node: DiagramNode, allDefs: ComponentDef[]): PortDef[] {
  if (node.portsOverride) return node.portsOverride;
  return allDefs.find((d) => d.id === node.defId)?.ports ?? [];
}

/** Maps connected-node instanceId → IC number for I2C/SPI bus ports on this node. */
function computeIcMap(
  nodeId: string,
  ports: PortDef[],
  edges: DiagramEdge[]
): { nodeToIc: Map<string, number>; show: boolean } {
  const busPorts = ports.filter((p) => p.role === 'i2c' || p.role === 'spi');
  const nodeToIc = new Map<string, number>();
  let counter = 1;

  for (const port of busPorts) {
    const edge = edges.find(
      (e) =>
        (e.fromNode === nodeId && e.fromPort === port.id) ||
        (e.toNode === nodeId && e.toPort === port.id)
    );
    if (!edge) continue;
    const otherId = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
    if (!nodeToIc.has(otherId)) nodeToIc.set(otherId, counter++);
  }

  return { nodeToIc, show: nodeToIc.size > 1 };
}

function getConnectedText(
  nodeId: string,
  port: PortDef,
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  allDefs: ComponentDef[],
  icMap: ReturnType<typeof computeIcMap>
): string | null {
  const edge = edges.find(
    (e) =>
      (e.fromNode === nodeId && e.fromPort === port.id) ||
      (e.toNode === nodeId && e.toPort === port.id)
  );
  if (!edge) return null;

  const otherId = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
  const otherPortId = edge.fromNode === nodeId ? edge.toPort : edge.fromPort;
  const otherNode = nodes.find((n) => n.instanceId === otherId);
  if (!otherNode) return null;

  const otherPorts = getEffectivePorts(otherNode, allDefs);
  const otherPort = otherPorts.find((p) => p.id === otherPortId);
  const portLabel = otherPort?.label ?? otherPortId;
  let text = `${otherNode.label} (${portLabel})`;

  if (icMap.show && (port.role === 'i2c' || port.role === 'spi')) {
    const icNum = icMap.nodeToIc.get(otherId);
    if (icNum !== undefined) text += ` [IC ${icNum}]`;
  }

  return text;
}

// ─── InlineEdit ───────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Keep draft in sync when value prop changes externally
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        autoFocus
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--phosphor-dim)',
          color: 'var(--text-primary)',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 13,
          fontWeight: 500,
          padding: '1px 5px',
          outline: 'none',
          width: '100%',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to rename"
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-primary)',
        cursor: 'text',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        borderBottom: '1px dashed transparent',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'var(--border-accent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent'; }}
    >
      {value}
    </span>
  );
}

// ─── PortTable ────────────────────────────────────────────────────────────────

function PortTable({
  nodeId,
  ports,
  edges,
  nodes,
  allDefs,
}: {
  nodeId: string;
  ports: PortDef[];
  edges: DiagramEdge[];
  nodes: DiagramNode[];
  allDefs: ComponentDef[];
}) {
  const usedPortIds = new Set(
    edges
      .filter((e) => e.fromNode === nodeId || e.toNode === nodeId)
      .map((e) => (e.fromNode === nodeId ? e.fromPort : e.toPort))
  );

  const icMap = computeIcMap(nodeId, ports, edges);

  return (
    <div className="flex-1 overflow-y-auto" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      {/* column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 72px 1fr 48px',
          gap: 0,
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 9,
          letterSpacing: '0.09em',
          color: 'var(--text-muted)',
        }}
      >
        <span>ID</span>
        <span>LABEL</span>
        <span>CONNECTED TO</span>
        <span style={{ textAlign: 'right' }}>STATUS</span>
      </div>

      {ports.map((port) => {
        const used = usedPortIds.has(port.id);
        const connText = getConnectedText(nodeId, port, edges, nodes, allDefs, icMap);

        return (
          <div
            key={port.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 72px 1fr 48px',
              gap: 0,
              padding: '0 12px',
              height: 26,
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: used ? 'rgba(0,230,118,0.04)' : 'transparent',
              fontSize: 11,
            }}
          >
            {/* port id */}
            <span
              style={{
                color: ROLE_COLOR[port.role] ?? 'var(--text-primary)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={port.id}
            >
              {port.id}
            </span>

            {/* label */}
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: 10,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: 4,
              }}
              title={port.label}
            >
              {port.label}
            </span>

            {/* connected to */}
            <span
              style={{
                color: connText ? 'var(--text-primary)' : 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={connText ?? '—'}
            >
              {connText ?? '—'}
            </span>

            {/* status */}
            <span
              style={{
                textAlign: 'right',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: used ? 'var(--phosphor)' : 'var(--text-muted)',
              }}
            >
              {used ? 'IN USE' : 'free'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── ConfigurePanel ───────────────────────────────────────────────────────────

let _pk = 0;
const nextPk = () => ++_pk;
type PortDraft = PortDef & { _key: number };

const cfgInput: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  padding: '3px 5px',
  outline: 'none',
  boxSizing: 'border-box',
};

function ConfigurePanel({
  effectivePorts,
  onApply,
  onCancel,
}: {
  effectivePorts: PortDef[];
  onApply: (ports: PortDef[]) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<PortDraft[]>(() =>
    effectivePorts.map((p) => ({ ...p, _key: nextPk() }))
  );

  const addPort = () => setDrafts((prev) => [...prev, { id: '', label: '', role: 'digital', _key: nextPk() }]);
  const removePort = (key: number) => setDrafts((prev) => prev.filter((p) => p._key !== key));
  const updatePort = (key: number, patch: Partial<PortDef>) =>
    setDrafts((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));

  const valid = drafts.length > 0 && drafts.every((p) => p.id.trim() && p.label.trim());

  return (
    <>
      {/* port rows */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace' }}>
        {/* column labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr 76px 22px',
            gap: 3,
            marginBottom: 5,
            fontSize: 9,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          <span>ID</span><span>LABEL</span><span>ROLE</span><span />
        </div>

        {drafts.map((port) => (
          <div
            key={port._key}
            style={{ display: 'grid', gridTemplateColumns: '56px 1fr 76px 22px', gap: 3, marginBottom: 3 }}
          >
            <input
              value={port.id}
              onChange={(e) => updatePort(port._key, { id: e.target.value })}
              placeholder="D3"
              style={cfgInput}
            />
            <input
              value={port.label}
              onChange={(e) => updatePort(port._key, { label: e.target.value })}
              placeholder="D3 (~)"
              style={cfgInput}
            />
            <select
              value={port.role}
              onChange={(e) => updatePort(port._key, { role: e.target.value as PortRole })}
              style={{ ...cfgInput, paddingRight: 2 }}
            >
              {PORT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={() => removePort(port._key)}
              disabled={drafts.length === 1}
              style={{
                background: 'none',
                border: 'none',
                color: drafts.length === 1 ? 'var(--text-muted)' : 'var(--red)',
                cursor: drafts.length === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={addPort}
          style={{
            marginTop: 6,
            width: '100%',
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            padding: '4px 0',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          + ADD PORT
        </button>
      </div>

      {/* footer */}
      <div
        className="flex gap-2 border-t"
        style={{ borderColor: 'var(--border)', padding: '8px 10px', flexShrink: 0 }}
      >
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            padding: '5px 0',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          CANCEL
        </button>
        <button
          onClick={() => onApply(drafts.map(({ _key, ...p }) => p))}
          disabled={!valid}
          style={{
            flex: 2,
            background: valid ? 'var(--phosphor-mute)' : 'transparent',
            border: `1px solid ${valid ? 'var(--phosphor-dim)' : 'var(--border)'}`,
            color: valid ? 'var(--phosphor)' : 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            fontWeight: 600,
            padding: '5px 0',
            cursor: valid ? 'pointer' : 'not-allowed',
            letterSpacing: '0.06em',
          }}
        >
          APPLY
        </button>
      </div>
    </>
  );
}

// ─── Inspector ────────────────────────────────────────────────────────────────

export default function Inspector() {
  const store = useDiagramStore();
  const allDefs = [...ALL_DEFS, ...store.customDefs];

  const node = store.nodes.find((n) => n.instanceId === store.selectedId);
  const def = node ? allDefs.find((d) => d.id === node.defId) : undefined;
  const effectivePorts = node && def ? (node.portsOverride ?? def.ports) : [];

  const [configuring, setConfiguring] = useState(false);

  // reset configure mode on selection change
  useEffect(() => { setConfiguring(false); }, [store.selectedId]);

  // ── placeholder ────────────────────────────────────────────────────────────

  if (!node || !def) {
    return (
      <aside
        className="flex items-center justify-center border-l"
        style={{ width: 280, flexShrink: 0, background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
          select a component
        </span>
      </aside>
    );
  }

  // ── main panel ─────────────────────────────────────────────────────────────

  return (
    <aside
      className="flex flex-col border-l"
      style={{ width: 280, flexShrink: 0, background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
    >
      {/* header */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--border)', padding: '8px 12px', flexShrink: 0 }}
      >
        {configuring ? (
          <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--amber)', marginBottom: 3 }}>
              CONFIGURE PORTS
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{node.label}</div>
          </div>
        ) : (
          <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--phosphor)', marginBottom: 3 }}>
              INSPECTOR
            </div>
            <InlineEdit
              value={node.label}
              onSave={(label) => store.renameNode(node.instanceId, label)}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              {def.type}
              {def.category ? ` · ${def.category}` : ''}
              {' · '}{effectivePorts.length} ports
              {node.portsOverride && (
                <span style={{ color: 'var(--amber)', marginLeft: 4 }}>★ custom</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* body */}
      {configuring ? (
        <ConfigurePanel
          effectivePorts={effectivePorts}
          onApply={(ports) => {
            store.setNodePortsOverride(node.instanceId, ports);
            setConfiguring(false);
          }}
          onCancel={() => setConfiguring(false)}
        />
      ) : (
        <>
          <PortTable
            nodeId={node.instanceId}
            ports={effectivePorts}
            edges={store.edges}
            nodes={store.nodes}
            allDefs={allDefs}
          />

          {/* footer */}
          <div
            className="border-t"
            style={{ borderColor: 'var(--border)', padding: '8px 12px', flexShrink: 0 }}
          >
            {def.type === 'board' && (
              <button
                onClick={() => setConfiguring(true)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  padding: '5px 0',
                  cursor: 'pointer',
                }}
              >
                CONFIGURE PORTS
              </button>
            )}
            {node.portsOverride && (
              <button
                onClick={() => store.setNodePortsOverride(node.instanceId, undefined)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  padding: '4px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  marginTop: def.type === 'board' ? 4 : 0,
                }}
              >
                reset to default ports
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
