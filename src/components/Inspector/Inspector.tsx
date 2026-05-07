import { useState } from 'react';
import {
  useDiagramStore,
  type ComponentDef,
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

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

// ─── InlineEdit ───────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

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
          ...mono,
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
        ...mono,
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

// ─── PortList ─────────────────────────────────────────────────────────────────

function PortList({
  nodeId,
  ports,
  activePorts,
}: {
  nodeId: string;
  ports: PortDef[];
  activePorts: string[];
}) {
  const togglePort = useDiagramStore((s) => s.togglePort);

  return (
    <div style={{ flex: 1, overflowY: 'auto', ...mono }}>
      {/* column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 14px 1fr 50px',
          gap: 0,
          padding: '3px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 9,
          letterSpacing: '0.09em',
          color: 'var(--text-muted)',
        }}
      >
        <span>USE</span>
        <span />
        <span>PORT</span>
        <span style={{ textAlign: 'right' }}>ID</span>
      </div>

      {ports.map((port) => {
        const active = activePorts.includes(port.id);
        return (
          <div
            key={port.id}
            onClick={() => togglePort(nodeId, port.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 14px 1fr 50px',
              gap: 0,
              padding: '0 12px',
              height: 26,
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: active ? 'rgba(0,230,118,0.05)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={active}
              readOnly
              onClick={(e) => e.stopPropagation()}
              onChange={() => togglePort(nodeId, port.id)}
              style={{
                accentColor: 'var(--phosphor)',
                cursor: 'pointer',
                margin: 0,
                pointerEvents: 'none',
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ROLE_COLOR[port.role] ?? '#888',
                display: 'inline-block',
                opacity: active ? 1 : 0.3,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {port.label}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: ROLE_COLOR[port.role] ?? 'var(--text-secondary)',
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={port.id}
            >
              {port.id}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── ConnectionsSection ───────────────────────────────────────────────────────

function ConnectionsSection({
  nodeId,
  defs,
}: {
  nodeId: string;
  defs: ComponentDef[];
}) {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);

  const myNode = nodes.find((n) => n.instanceId === nodeId);
  const myTicks = myNode?.activePorts.length ?? 0;
  const myType = myNode ? defs.find((def) => def.id === myNode.defId)?.type : undefined;

  const connectedEdges = edges.filter(
    (e) => e.fromNode === nodeId || e.toNode === nodeId
  );

  if (connectedEdges.length === 0) return null;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 12px',
        ...mono,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>
        CONNECTIONS
      </div>
      {connectedEdges.map((edge) => {
        const otherId = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
        const other = nodes.find((n) => n.instanceId === otherId);
        if (!other) return null;

        const otherType = defs.find((def) => def.id === other.defId)?.type;
        const otherTicks = other.activePorts.length;
        const bothZero = myTicks === 0 && otherTicks === 0;
        const mismatch = !bothZero && myTicks !== otherTicks;
        const otherTickLabel = otherType === 'board' ? 'assigned pin' : 'active port';
        const myLabel = myType === 'board' ? 'assigned' : 'active';
        const otherLabel = otherType === 'board' ? 'board' : 'sensor';

        return (
          <div key={edge.id} style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: bothZero ? 'var(--text-muted)' : mismatch ? '#f59e0b' : 'var(--phosphor)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {other.label}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
                {otherTicks} {otherTickLabel}{otherTicks !== 1 ? 's' : ''}
              </span>
            </div>
            {mismatch && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3, lineHeight: 1.4 }}>
                ⚠ Connected to {other.label}: you have {myTicks} {myLabel}, {otherLabel} has {otherTicks} {otherType === 'board' ? 'assigned' : 'active'}.
              </div>
            )}
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
  ...mono,
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
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 10px', ...mono }}>
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
            ...mono,
            fontSize: 10,
            padding: '4px 0',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          + ADD PORT
        </button>
      </div>

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
            ...mono,
            fontSize: 10,
            padding: '5px 0',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          CANCEL
        </button>
        <button
          onClick={() =>
            onApply(drafts.map((draft) => ({
              id: draft.id,
              label: draft.label,
              role: draft.role,
            })))
          }
          disabled={!valid}
          style={{
            flex: 2,
            background: valid ? 'var(--phosphor-mute)' : 'transparent',
            border: `1px solid ${valid ? 'var(--phosphor-dim)' : 'var(--border)'}`,
            color: valid ? 'var(--phosphor)' : 'var(--text-muted)',
            ...mono,
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

function getEffectivePorts(node: DiagramNode, defs: ComponentDef[]): PortDef[] {
  if (node.portsOverride) return node.portsOverride;
  return defs.find((d) => d.id === node.defId)?.ports ?? [];
}

export default function Inspector() {
  const store = useDiagramStore();
  const allDefs = [...ALL_DEFS, ...store.customDefs];

  const node = store.nodes.find((n) => n.instanceId === store.selectedId);
  const def = node ? allDefs.find((d) => d.id === node.defId) : undefined;
  const effectivePorts = node && def ? getEffectivePorts(node, allDefs) : [];

  const [configuringForId, setConfiguringForId] = useState<string | null>(null);

  if (!node || !def) {
    return (
      <aside
        className="flex items-center justify-center border-l"
        style={{ width: 280, flexShrink: 0, background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)' }}>
          select a component
        </span>
      </aside>
    );
  }

  const activeTicks = node.activePorts.length;
  const configuring = configuringForId === node.instanceId;

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
          <div style={mono}>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--amber)', marginBottom: 3 }}>
              CONFIGURE PORTS
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{node.label}</div>
          </div>
        ) : (
          <div style={mono}>
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
              {' · '}{activeTicks} active
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
            setConfiguringForId(null);
          }}
          onCancel={() => setConfiguringForId(null)}
        />
      ) : (
        <>
          <PortList
            nodeId={node.instanceId}
            ports={effectivePorts}
            activePorts={node.activePorts}
          />

          <ConnectionsSection nodeId={node.instanceId} defs={allDefs} />

          {/* footer */}
          <div
            className="border-t"
            style={{ borderColor: 'var(--border)', padding: '8px 12px', flexShrink: 0 }}
          >
            {def.type === 'board' && (
              <button
                onClick={() => setConfiguringForId(node.instanceId)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  ...mono,
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
                  ...mono,
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
