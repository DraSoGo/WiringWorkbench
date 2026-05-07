import { useState } from 'react';
import { BOARDS } from '../../data/boards';
import { SENSORS } from '../../data/sensors';
import { useDiagramStore, type ComponentDef } from '../../store/diagram';
import ComponentModal from './ComponentModal';

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  open,
  onToggle,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 12px',
        background: 'var(--bg-surface)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.1em',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      <span>
        {label}{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          display: 'inline-block',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.12s',
          lineHeight: 1,
        }}
      >
        ▾
      </span>
    </button>
  );
}

function ComponentRow({
  def,
  onEdit,
  onDelete,
}: {
  def: ComponentDef;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isCustom = !!onEdit;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/easyarduino-def', def.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        cursor: 'grab',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            fontWeight: 500,
            color: hovered ? 'var(--phosphor)' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {def.name}
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
          {def.ports.length} ports{def.category ? ` · ${def.category}` : ''}
        </div>
      </div>

      {/* edit/delete — custom only, shown on hover */}
      {isCustom && hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit!(); }}
            title="Edit"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px 5px',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ✎
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete!(); }}
            title="Delete"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--red)',
              cursor: 'pointer',
              padding: '2px 5px',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type ModalState = { open: false } | { open: true; editing?: ComponentDef };

export default function Library() {
  const { customDefs, addCustomDef, updateCustomDef, removeCustomDef } = useDiagramStore();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [open, setOpen] = useState({ boards: true, sensors: true, custom: true });

  const q = query.toLowerCase();
  const boards = BOARDS.filter((d) => d.name.toLowerCase().includes(q));
  const sensors = SENSORS.filter((d) => d.name.toLowerCase().includes(q));
  const custom = customDefs.filter((d) => d.name.toLowerCase().includes(q));

  const toggleSection = (k: keyof typeof open) =>
    setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <>
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* header */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'var(--phosphor)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          COMPONENTS
        </div>

        {/* search */}
        <div style={{ padding: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search..."
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 12,
              padding: '5px 8px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--phosphor-dim)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Boards */}
          <SectionHeader
            label="BOARDS"
            count={boards.length}
            open={open.boards}
            onToggle={() => toggleSection('boards')}
          />
          {open.boards && boards.map((d) => <ComponentRow key={d.id} def={d} />)}

          {/* Sensors */}
          <SectionHeader
            label="SENSORS"
            count={sensors.length}
            open={open.sensors}
            onToggle={() => toggleSection('sensors')}
          />
          {open.sensors && sensors.map((d) => <ComponentRow key={d.id} def={d} />)}

          {/* Custom (only shown if any exist or no active search) */}
          {(custom.length > 0 || (!query && customDefs.length > 0)) && (
            <>
              <SectionHeader
                label="CUSTOM"
                count={custom.length}
                open={open.custom}
                onToggle={() => toggleSection('custom')}
              />
              {open.custom &&
                custom.map((d) => (
                  <ComponentRow
                    key={d.id}
                    def={d}
                    onEdit={() => setModal({ open: true, editing: d })}
                    onDelete={() => removeCustomDef(d.id)}
                  />
                ))}
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={() => setModal({ open: true })}
            style={{
              width: '100%',
              background: 'var(--phosphor-mute)',
              border: '1px solid var(--phosphor-dim)',
              color: 'var(--phosphor)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '6px 0',
              cursor: 'pointer',
            }}
          >
            + NEW COMPONENT
          </button>
        </div>
      </aside>

      {modal.open && (
        <ComponentModal
          initial={modal.editing}
          onSave={(def) => {
            modal.editing ? updateCustomDef(def) : addCustomDef(def);
            setModal({ open: false });
          }}
          onClose={() => setModal({ open: false })}
        />
      )}
    </>
  );
}
