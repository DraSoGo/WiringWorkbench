import { useEffect } from 'react';
import { useDiagramStore } from './store/diagram';
import { parseShareURL } from './lib/export';
import Toolbar from './components/Toolbar/Toolbar';
import Library from './components/Library/Library';
import Canvas from './components/Canvas/Canvas';
import Inspector from './components/Inspector/Inspector';

export default function App() {
  // Restore diagram from share URL on first load
  useEffect(() => {
    const state = parseShareURL(window.location.search);
    if (state) {
      useDiagramStore.getState().loadDiagram(state);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Library />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}
