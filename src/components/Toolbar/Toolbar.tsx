import { useDiagramStore } from '../../store/diagram';

export default function Toolbar() {
  const { undo, redo, history, future } = useDiagramStore();

  return (
    <header
      className="flex items-center gap-4 border-b px-4"
      style={{
        height: 44,
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        flexShrink: 0,
      }}
    >
      {/* wordmark */}
      <div
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '0.08em',
          color: 'var(--phosphor)',
        }}
      >
        EASY<span style={{ color: 'var(--amber)' }}>ARDUINO</span>
      </div>

      <div className="flex-1" />

      {/* actions */}
      <button
        onClick={undo}
        disabled={!history.length}
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: history.length ? 'var(--text-secondary)' : 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: history.length ? 'pointer' : 'not-allowed',
          letterSpacing: '0.06em',
        }}
      >
        UNDO
      </button>

      <button
        onClick={redo}
        disabled={!future.length}
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: future.length ? 'var(--text-secondary)' : 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: future.length ? 'pointer' : 'not-allowed',
          letterSpacing: '0.06em',
        }}
      >
        REDO
      </button>

      <button
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: 'var(--phosphor)',
          background: 'var(--phosphor-mute)',
          border: '1px solid var(--phosphor-dim)',
          padding: '3px 10px',
          cursor: 'pointer',
          letterSpacing: '0.06em',
        }}
      >
        EXPORT
      </button>
    </header>
  );
}
