import { useEffect, useState } from 'react';
import type { ComponentDef, PortRole } from '../../store/diagram';

const PORT_ROLES: PortRole[] = ['digital', 'analog', 'power', 'gnd', 'i2c', 'spi', 'uart', 'pwm', 'custom'];

type PortDraft = { _key: number; id: string; label: string; role: PortRole };

let _keyCounter = 0;
const nextKey = () => ++_keyCounter;

const emptyPort = (): PortDraft => ({ _key: nextKey(), id: '', label: '', role: 'digital' });

interface Props {
  initial?: ComponentDef;
  onSave: (def: ComponentDef) => void;
  onClose: () => void;
}

const field: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 12,
  padding: '5px 8px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function ComponentModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<'board' | 'sensor'>(
    initial?.type === 'board' ? 'board' : 'sensor'
  );
  const [ports, setPorts] = useState<PortDraft[]>(
    initial?.ports.map((p) => ({ ...p, _key: nextKey() })) ?? [emptyPort()]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addPort = () => setPorts((prev) => [...prev, emptyPort()]);
  const removePort = (key: number) => setPorts((prev) => prev.filter((p) => p._key !== key));
  const updatePort = (key: number, patch: Partial<PortDraft>) =>
    setPorts((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));

  const canSave =
    name.trim().length > 0 &&
    ports.length > 0 &&
    ports.every((p) => p.id.trim().length > 0 && p.label.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      ports: ports.map(({ _key, ...p }) => p),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-accent)',
          width: 500,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--phosphor)', fontWeight: 600 }}>
            {initial ? 'EDIT COMPONENT' : 'NEW COMPONENT'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* name */}
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
            NAME
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Sensor"
            style={field}
            autoFocus
          />

          {/* type */}
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>
            TYPE
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'board' | 'sensor')}
            style={{ ...field, width: 'auto', paddingRight: 24 }}
          >
            <option value="sensor">sensor</option>
            <option value="board">board</option>
          </select>

          {/* ports */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              PORTS ({ports.length})
            </span>
            <button
              onClick={addPort}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10,
                padding: '3px 10px',
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              + ADD PORT
            </button>
          </div>

          {/* port table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 100px 28px',
              gap: 4,
              marginBottom: 4,
              padding: '0 2px',
            }}
          >
            {['ID', 'LABEL', 'ROLE', ''].map((h) => (
              <span key={h} style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>

          {ports.map((port) => (
            <div
              key={port._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 100px 28px',
                gap: 4,
                marginBottom: 4,
              }}
            >
              <input
                value={port.id}
                onChange={(e) => updatePort(port._key, { id: e.target.value })}
                placeholder="D3"
                style={{ ...field, padding: '4px 6px' }}
              />
              <input
                value={port.label}
                onChange={(e) => updatePort(port._key, { label: e.target.value })}
                placeholder="D3 (~PWM)"
                style={{ ...field, padding: '4px 6px' }}
              />
              <select
                value={port.role}
                onChange={(e) => updatePort(port._key, { role: e.target.value as PortRole })}
                style={{ ...field, padding: '4px 4px' }}
              >
                {PORT_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={() => removePort(port._key)}
                disabled={ports.length === 1}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: ports.length === 1 ? 'var(--text-muted)' : 'var(--red)',
                  cursor: ports.length === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              padding: '5px 14px',
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: canSave ? 'var(--phosphor-mute)' : 'transparent',
              border: `1px solid ${canSave ? 'var(--phosphor-dim)' : 'var(--border)'}`,
              color: canSave ? 'var(--phosphor)' : 'var(--text-muted)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 20px',
              cursor: canSave ? 'pointer' : 'not-allowed',
              letterSpacing: '0.06em',
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
