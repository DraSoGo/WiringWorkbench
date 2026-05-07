import Toolbar from './components/Toolbar/Toolbar';
import Library from './components/Library/Library';
import Canvas from './components/Canvas/Canvas';
import Inspector from './components/Inspector/Inspector';

export default function App() {
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
