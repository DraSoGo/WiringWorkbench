import { useLayoutEffect, useEffect, useState } from 'react';
import { useDiagramStore } from './store/diagram';
import { parseShareURL } from './lib/export';
import { loadDiagram, loadTheme, saveTheme } from './lib/storage';
import Toolbar from './components/Toolbar/Toolbar';
import Library from './components/Library/Library';
import Canvas from './components/Canvas/Canvas';
import Inspector from './components/Inspector/Inspector';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme());

  // Apply theme class synchronously before paint to avoid flash
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  };

  // Restore diagram: share URL takes priority, then localStorage
  useEffect(() => {
    const urlState = parseShareURL(window.location.search);
    if (urlState) {
      useDiagramStore.getState().loadDiagram(urlState);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    const saved = loadDiagram();
    if (saved) {
      useDiagramStore.getState().loadDiagram(saved);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fire when user is typing
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') {
        e.preventDefault();
        useDiagramStore.getState().undo();
      }
      if (ctrl && e.key === 'y') {
        e.preventDefault();
        useDiagramStore.getState().redo();
      }
      if (e.key === 'Escape') {
        useDiagramStore.getState().clearSelection();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Library />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}
