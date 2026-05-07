import { useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram';
import {
  downloadFile,
  exportArduinoStub,
  exportJSON,
  exportShareURL,
} from '../../lib/export';

const mono: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  letterSpacing: '0.06em',
};

function ToolBtn({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...mono,
        fontSize: 11,
        color: disabled
          ? 'var(--text-muted)'
          : accent
            ? 'var(--phosphor)'
            : 'var(--text-secondary)',
        background: accent ? 'var(--phosphor-mute)' : 'none',
        border: accent ? '1px solid var(--phosphor-dim)' : 'none',
        padding: accent ? '3px 10px' : '0',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 18,
        background: 'var(--border)',
        display: 'inline-block',
        margin: '0 4px',
        flexShrink: 0,
      }}
    />
  );
}

export default function Toolbar() {
  const store = useDiagramStore();
  const { undo, redo, history, future } = store;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const state = {
    nodes: store.nodes,
    edges: store.edges,
    customDefs: store.customDefs,
  };

  const handleExportJSON = () => {
    downloadFile('diagram.json', exportJSON(state), 'application/json');
  };

  const handleExportArduino = () => {
    downloadFile('sketch.ino', exportArduinoStub(state), 'text/plain');
  };

  const handleShare = async () => {
    const url = exportShareURL(state);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {
      // Fallback: open in new tab so user can copy manually
      window.open(url, '_blank');
      showToast('Opened in new tab — copy URL');
    }
  };

  return (
    <>
      <header
        className="flex items-center border-b"
        style={{
          height: 44,
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          flexShrink: 0,
          padding: '0 16px',
          gap: 12,
        }}
      >
        {/* wordmark */}
        <div style={{ ...mono, fontWeight: 600, fontSize: 13, color: 'var(--phosphor)' }}>
          EASY<span style={{ color: 'var(--amber)' }}>ARDUINO</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* history */}
        <ToolBtn label="UNDO" onClick={undo} disabled={!history.length} />
        <ToolBtn label="REDO" onClick={redo} disabled={!future.length} />

        <Divider />

        {/* export */}
        <ToolBtn label="JSON" onClick={handleExportJSON} accent />
        <ToolBtn label=".INO" onClick={handleExportArduino} accent />

        <Divider />

        {/* share */}
        <ToolBtn label="SHARE" onClick={handleShare} accent />
      </header>

      {/* share toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3000,
            background: 'var(--bg-panel)',
            border: '1px solid var(--phosphor-dim)',
            color: 'var(--phosphor)',
            ...mono,
            fontSize: 11,
            padding: '7px 18px',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
