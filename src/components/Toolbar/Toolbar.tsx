import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram';
import {
  buildProjectFileName,
  downloadFile,
  exportArduinoPromptMarkdown,
  exportProjectFile,
  exportArduinoStub,
  exportJSON,
  exportShareURL,
  parseProjectFileContent,
} from '../../lib/export';
import { saveDiagram } from '../../lib/storage';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const mono: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  letterSpacing: '0.06em',
};

function Btn({
  label,
  title,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
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
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: 'var(--border)',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

export default function Toolbar({ theme, onToggleTheme }: Props) {
  const store = useDiagramStore();
  const { undo, redo, history, future } = store;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const exportState = useMemo(() => ({
    nodes: store.nodes,
    edges: store.edges,
    customDefs: store.customDefs,
  }), [store.customDefs, store.edges, store.nodes]);

  const handleNew = () => {
    if (
      store.nodes.length === 0 ||
      window.confirm('Clear the current diagram? This cannot be undone.')
    ) {
      store.loadDiagram({ nodes: [], edges: [], customDefs: [] });
    }
  };

  const handleSave = () => {
    saveDiagram(exportState);
    showToast('Saved!');
  };

  const handleSaveProject = useCallback(() => {
    const filename = buildProjectFileName(store.nodes[0]?.label || 'wiringworkbench-project');
    downloadFile(
      filename,
      exportProjectFile(exportState),
      'application/json;charset=utf-8'
    );
    showToast('Project file downloaded');
  }, [exportState, store.nodes]);

  const handleOpenProject = useCallback(() => {
    openFileInputRef.current?.click();
  }, []);

  const handleProjectFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const parsed = parseProjectFileContent(await file.text());
    if (!parsed) {
      showToast('Invalid project file');
      return;
    }

    store.loadDiagram(parsed.state);
    saveDiagram(parsed.state);
    showToast(`Opened ${parsed.name}`);
  };

  const handleExportJSON = () => {
    downloadFile('diagram.json', exportJSON(exportState), 'application/json');
  };

  const handleExportArduino = () => {
    downloadFile('sketch.ino', exportArduinoStub(exportState), 'text/plain');
  };

  const handleExportPrompt = () => {
    downloadFile(
      'arduino-code-prompt.md',
      exportArduinoPromptMarkdown(exportState),
      'text/markdown;charset=utf-8'
    );
  };

  const handleShare = async () => {
    const url = exportShareURL(exportState);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {
      window.open(url, '_blank');
      showToast('Opened in new tab');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      }
      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProject();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOpenProject, handleSaveProject]);

  return (
    <>
      <input
        ref={openFileInputRef}
        type="file"
        accept=".wiringworkbench.json,.json,application/json"
        onChange={handleProjectFileSelected}
        style={{ display: 'none' }}
      />

      <header
        style={{
          height: 44,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 10,
        }}
      >
        {/* wordmark */}
        <div style={{ ...mono, fontWeight: 600, fontSize: 13, color: 'var(--phosphor)', flexShrink: 0 }}>
          WIRING<span style={{ color: 'var(--amber)' }}>WORKBENCH</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* diagram ops */}
        <Btn label="NEW" title="New diagram" onClick={handleNew} />
        <Btn label="OPEN" title="Open project file (Ctrl+O)" onClick={handleOpenProject} />
        <Btn label="SAVE" title="Save project file (Ctrl+S)" onClick={handleSaveProject} accent />
        <Btn label="LOCAL" title="Save to browser storage" onClick={handleSave} />

        <Sep />

        {/* history */}
        <Btn label="UNDO" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.length} />
        <Btn label="REDO" title="Redo (Ctrl+Y)" onClick={redo} disabled={!future.length} />

        <Sep />

        {/* export */}
        <Btn label="JSON" title="Download pin map as JSON" onClick={handleExportJSON} accent />
        <Btn label=".INO" title="Download Arduino sketch stub" onClick={handleExportArduino} accent />
        <Btn label=".MD" title="Download AI prompt for Arduino IDE code generation" onClick={handleExportPrompt} accent />

        <Sep />

        <Btn label="SHARE" title="Copy shareable URL to clipboard" onClick={handleShare} accent />

        <Sep />

        {/* theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            ...mono,
            fontSize: 14,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {theme === 'dark' ? '○' : '●'}
        </button>
      </header>

      {/* toast */}
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
