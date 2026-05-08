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
  const [guideOpen, setGuideOpen] = useState(false);
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
      if (e.key === 'Escape' && guideOpen) {
        e.preventDefault();
        setGuideOpen(false);
        return;
      }

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
  }, [guideOpen, handleOpenProject, handleSaveProject]);

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
        <Btn label="GUIDE" title="How to use WiringWorkbench" onClick={() => setGuideOpen(true)} />
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

      {guideOpen && (
        <div
          onClick={() => setGuideOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,15,14,0.74)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 100%)',
              maxHeight: 'min(82vh, 760px)',
              overflowY: 'auto',
              background: 'var(--bg-panel)',
              border: '1px solid var(--phosphor-dim)',
              boxShadow: '0 0 0 1px rgba(0,230,118,0.08), 0 24px 64px rgba(0,0,0,0.35)',
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    ...mono,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: 'var(--amber)',
                    marginBottom: 8,
                  }}
                >
                  FEATURE GUIDE
                </div>
                <h2
                  style={{
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: 22,
                    lineHeight: 1.1,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                  }}
                >
                  How to use WiringWorkbench
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 580 }}>
                  WiringWorkbench is a visual planning tool for Arduino-style projects. It helps
                  you place boards and sensors, assign ports, and export a clean wiring map.
                </p>
              </div>

              <button
                onClick={() => setGuideOpen(false)}
                title="Close guide"
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  background: 'none',
                  border: '1px solid var(--border)',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                CLOSE
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 18,
              }}
            >
              {[
                '1. Drag a board or sensor from the left library onto the canvas.',
                '2. Connect one sensor node to one board node with a single wire.',
                '3. Check the ports you want to use on the sensor or in the inspector.',
                '4. The board can auto-select compatible pins when a new connection is created.',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    padding: 12,
                    color: 'var(--text-primary)',
                    lineHeight: 1.45,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  CONNECTING NODES
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Hover a node and use the connect control, or drag from one node body to another.
                  Only board-to-sensor connections are allowed, and only one wire can exist per
                  board/sensor pair.
                </p>
              </section>

              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  ASSIGNING PORTS
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Each checkbox marks a port as active. Sensor checks describe what the part needs.
                  Board checks describe which board pins are assigned. For boards, some pins can
                  be used multiple times with the small quantity controls.
                </p>
              </section>

              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  WARNINGS
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  A gray dashed wire means nothing is assigned yet. A green wire means the
                  connection currently matches. A yellow <span style={{ color: '#f59e0b' }}>!</span>
                  {' '}means the checked sensor ports and assigned board pins do not line up.
                </p>
              </section>

              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  INSPECTOR PANEL
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Click any node to rename it, review its ports, and inspect current connection
                  mappings. The inspector is the fastest place to verify whether a wiring plan is
                  complete or still missing assignments.
                </p>
              </section>

              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  SAVE AND EXPORT
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Use <span style={{ color: 'var(--text-primary)' }}>SAVE</span> to download a full
                  project file, <span style={{ color: 'var(--text-primary)' }}>OPEN</span> to restore it,
                  and <span style={{ color: 'var(--text-primary)' }}>LOCAL</span> to keep a browser copy.
                </p>
                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-primary)' }}>JSON</span> downloads the wiring
                    map as structured data, including matched sensor-to-board pin pairs.
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-primary)' }}>.INO</span> downloads an Arduino
                    starter sketch with `#define` pin mappings for matched connections.
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-primary)' }}>.MD</span> downloads a Markdown
                    prompt you can give to an AI or use as a project handoff note.
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-primary)' }}>SHARE</span> copies a link that
                    encodes the current diagram so someone else can open the same layout directly.
                  </div>
                </div>
              </section>

              <section>
                <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 8 }}>
                  SHORTCUTS
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--text-primary)' }}>Ctrl/Cmd + S</span> saves a project
                  file, <span style={{ color: 'var(--text-primary)' }}>Ctrl/Cmd + O</span> opens one,
                  <span style={{ color: 'var(--text-primary)' }}> Ctrl/Cmd + Z</span> undoes,
                  <span style={{ color: 'var(--text-primary)' }}> Ctrl/Cmd + Y</span> redoes, and
                  <span style={{ color: 'var(--text-primary)' }}> Esc</span> closes this guide or clears
                  selection on the canvas.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
