import { useLayoutEffect, useEffect, useState } from 'react';
import { useDiagramStore } from './store/diagram';
import { parseShareURL } from './lib/export';
import { loadDiagram, loadTheme, saveTheme } from './lib/storage';
import Toolbar from './components/Toolbar/Toolbar';
import Library from './components/Library/Library';
import Canvas from './components/Canvas/Canvas';
import Inspector from './components/Inspector/Inspector';

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

const supportedBoards = [
  'Arduino Uno',
  'Arduino Nano',
  'ESP32',
  'Raspberry Pi Pico',
];

const supportedComponents = [
  'DHT11',
  'HC-SR04',
  'MPU6050',
  'SSD1306 OLED',
  'Relay Module',
  'IR Receiver',
  'Servo Motor',
  'NeoPixel Strip',
  'Soil Moisture Sensor',
  'MQ-2 Gas Sensor',
];

const faqs = [
  {
    question: 'What is WiringWorkbench?',
    answer:
      'WiringWorkbench is a visual wiring-planning tool for Arduino and microcontroller projects. It helps engineers, developers, and hardware hobbyists map board-to-sensor connections before writing code.',
  },
  {
    question: 'Is WiringWorkbench a simulator?',
    answer:
      'No. WiringWorkbench does not simulate electrical behavior or execute embedded code. It focuses on connection planning, port assignment, validation, and export.',
  },
  {
    question: 'What can I export from the tool?',
    answer:
      'You can export structured JSON pin mappings, Arduino .ino starter scaffolding, a Markdown project prompt, and a shareable link for the current diagram.',
  },
  {
    question: 'Can I save and reopen projects later?',
    answer:
      'Yes. You can save a full project file, reopen it later, or keep a browser-local copy for quick recovery while iterating.',
  },
];

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
    <div style={{ minHeight: '100%', background: 'var(--bg-base)' }}>
      <section style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Toolbar theme={theme} onToggleTheme={toggleTheme} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Library />
          <Canvas />
          <Inspector />
        </div>
      </section>

      <main
        style={{
          borderTop: '1px solid var(--border)',
          background:
            'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
        }}
      >
        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '56px 24px 28px',
          }}
        >
          <div
            style={{
              ...mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--amber)',
              marginBottom: 12,
            }}
          >
            VISUAL WIRING PLANNER
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              lineHeight: 1.05,
              color: 'var(--text-primary)',
              maxWidth: 860,
              marginBottom: 18,
            }}
          >
            WiringWorkbench helps engineers and developers plan Arduino and embedded
            wiring clearly before code or assembly begins.
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: 880,
              marginBottom: 28,
            }}
          >
            Use a fast visual workbench to connect boards and sensors, assign active
            pins, validate mappings, and export clean wiring data. WiringWorkbench is
            built for practical prototyping workflows where clarity matters more than
            schematic complexity.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 34,
            }}
          >
            {[
              'One wire per board-to-sensor relationship',
              'Pin assignment with fast checkbox workflows',
              'Connection warnings when mappings do not line up',
              'Project export for JSON, Markdown, and Arduino starter code',
            ].map((item) => (
              <div
                key={item}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-panel)',
                  padding: 14,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px 30px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          <article
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              padding: 18,
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>How WiringWorkbench works</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Place a board and one or more components on the canvas, connect each sensor
              to a board with a single node-level wire, then mark which ports are active.
              WiringWorkbench compares the active sensor requirements against the assigned
              board pins and surfaces mismatches immediately.
            </p>
          </article>

          <article
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              padding: 18,
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>Who it is for</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              This tool is designed for embedded developers, robotics teams, Arduino
              makers, electronics students, and hardware hobbyists who want a simpler
              way to plan wiring layouts, review pin usage, and document prototypes.
            </p>
          </article>

          <article
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              padding: 18,
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>What you can export</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Export structured JSON mappings for tooling, Arduino <code>.ino</code>
              starter files for firmware setup, and Markdown prompts for AI-assisted
              coding workflows. Teams can also share the current project with a URL.
            </p>
          </article>
        </section>

        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '22px 24px 30px',
          }}
        >
          <h2 style={{ fontSize: 24, marginBottom: 14 }}>Supported boards and components</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 860, marginBottom: 18 }}>
            WiringWorkbench includes ready-to-use definitions for common Arduino and
            microcontroller boards together with popular sensors and modules used in
            prototyping, IoT, and embedded education.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 18,
            }}
          >
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
              <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 10 }}>
                BOARDS
              </div>
              <ul style={{ display: 'grid', gap: 8, paddingLeft: 18, color: 'var(--text-primary)' }}>
                {supportedBoards.map((board) => (
                  <li key={board}>{board}</li>
                ))}
              </ul>
            </div>

            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
              <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', marginBottom: 10 }}>
                COMPONENTS
              </div>
              <ul style={{ display: 'grid', gap: 8, paddingLeft: 18, color: 'var(--text-primary)' }}>
                {supportedComponents.map((component) => (
                  <li key={component}>{component}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '8px 24px 48px',
          }}
        >
          <h2 style={{ fontSize: 24, marginBottom: 14 }}>Common use cases</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {[
              'Planning Arduino Uno sensor wiring before breadboarding',
              'Documenting pin usage for classroom or workshop demos',
              'Reviewing embedded prototype connections with teammates',
              'Preparing AI-ready project context for code generation',
            ].map((useCase) => (
              <div
                key={useCase}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-panel)',
                  padding: 16,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                {useCase}
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px 72px',
          }}
        >
          <h2 style={{ fontSize: 24, marginBottom: 14 }}>Frequently asked questions</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {faqs.map((item) => (
              <article
                key={item.question}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-panel)',
                  padding: 18,
                }}
              >
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>{item.question}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
