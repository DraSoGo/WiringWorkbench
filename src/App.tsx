import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDiagramStore } from './store/diagram';
import { parseShareURL } from './lib/export';
import { loadDiagram, loadTheme, saveTheme } from './lib/storage';
import Toolbar from './components/Toolbar/Toolbar';
import Library from './components/Library/Library';
import Canvas from './components/Canvas/Canvas';
import Inspector from './components/Inspector/Inspector';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const mono = { fontFamily: 'IBM Plex Mono, monospace' } as const;

type RoutePath = '/' | '/features' | '/how-it-works' | '/faq' | '/contact' | '/project';

type RouteMeta = {
  title: string;
  description: string;
  url: string;
  robots: 'index, follow' | 'noindex, follow';
};

const BASE_URL = 'https://wiringworkbench.com';

const routeMeta: Record<RoutePath, RouteMeta> = {
  '/': {
    title: 'WiringWorkbench | Visual Wiring Planner for Arduino and Embedded Projects',
    description:
      'WiringWorkbench is a professional visual wiring planner for engineers, developers, and hardware hobbyists. Plan Arduino and microcontroller connections, assign pins, validate mappings, and export clean wiring data.',
    url: `${BASE_URL}/`,
    robots: 'index, follow',
  },
  '/features': {
    title: 'WiringWorkbench Features | Pin Mapping, Validation, and Export Tools',
    description:
      'Explore WiringWorkbench features including node-to-node wiring, port assignment, pin validation, project save/load, custom components, and export options for Arduino workflows.',
    url: `${BASE_URL}/features`,
    robots: 'index, follow',
  },
  '/how-it-works': {
    title: 'How WiringWorkbench Works | Visual Wiring Workflow for Arduino Projects',
    description:
      'Learn how WiringWorkbench helps developers and makers plan board-to-sensor wiring, assign active ports, review mismatches, and export structured project output.',
    url: `${BASE_URL}/how-it-works`,
    robots: 'index, follow',
  },
  '/faq': {
    title: 'WiringWorkbench FAQ | Arduino Wiring Planner Questions and Answers',
    description:
      'Read common questions about WiringWorkbench, including what the tool does, how saving and export work, and how it fits into Arduino and embedded prototyping workflows.',
    url: `${BASE_URL}/faq`,
    robots: 'index, follow',
  },
  '/contact': {
    title: 'Contact | WiringWorkbench',
    description:
      'Get in touch with the WiringWorkbench developer. Find links to GitHub and email for questions, feedback, or collaboration.',
    url: `${BASE_URL}/contact`,
    robots: 'index, follow',
  },
  '/project': {
    title: 'WiringWorkbench Project Editor',
    description:
      'Open the WiringWorkbench project editor to design board-to-sensor wiring layouts, assign ports, and export connection data.',
    url: `${BASE_URL}/project`,
    robots: 'noindex, follow',
  },
};

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

const featureCards = [
  'One wire per board-to-sensor relationship',
  'Pin assignment with fast checkbox workflows',
  'Connection warnings when mappings do not line up',
  'Project export for JSON, Markdown, and Arduino starter code',
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

function normalizeRoute(pathname: string): RoutePath {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/features') return '/features';
  if (trimmed === '/how-it-works') return '/how-it-works';
  if (trimmed === '/faq') return '/faq';
  if (trimmed === '/contact') return '/contact';
  if (trimmed === '/project') return '/project';
  return '/';
}

function ensureMeta(attrName: 'name' | 'property', key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attrName, key);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function ensureCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function trackPageView(title: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_title: title,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_location: window.location.href,
  });
}

function PublicLink({
  label,
  href,
  active,
  onNavigate,
  accent,
}: {
  label: string;
  href: RoutePath;
  active?: boolean;
  onNavigate: (to: RoutePath) => void;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      style={{
        ...mono,
        fontSize: 11,
        letterSpacing: '0.08em',
        color: accent
          ? 'var(--phosphor)'
          : active
            ? 'var(--text-primary)'
            : 'var(--text-secondary)',
        background: accent ? 'var(--phosphor-mute)' : 'transparent',
        border: accent ? '1px solid var(--phosphor-dim)' : '1px solid transparent',
        padding: accent ? '7px 12px' : '7px 0',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </a>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 24px 34px',
      }}
    >
      {eyebrow && (
        <div
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--amber)',
            marginBottom: 10,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

function MarketingShell({
  route,
  theme,
  onToggleTheme,
  onNavigate,
  children,
}: {
  route: RoutePath;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onNavigate: (to: RoutePath) => void;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-base)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(12px)',
          background: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            style={{
              ...mono,
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--phosphor)',
              textDecoration: 'none',
              marginRight: 8,
            }}
          >
            WIRING<span style={{ color: 'var(--amber)' }}>WORKBENCH</span>
          </a>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <PublicLink label="HOME" href="/" active={route === '/'} onNavigate={onNavigate} />
            <PublicLink label="FEATURES" href="/features" active={route === '/features'} onNavigate={onNavigate} />
            <PublicLink label="HOW IT WORKS" href="/how-it-works" active={route === '/how-it-works'} onNavigate={onNavigate} />
            <PublicLink label="FAQ" href="/faq" active={route === '/faq'} onNavigate={onNavigate} />
            <PublicLink label="CONTACT" href="/contact" active={route === '/contact'} onNavigate={onNavigate} />
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <PublicLink label="SUPPORT" href="/" onNavigate={() => window.open('https://buymeacoffee.com/drasogo', '_blank', 'noopener,noreferrer')} />
            <PublicLink label="OPEN PROJECT" href="/project" onNavigate={onNavigate} accent />
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
              }}
            >
              {theme === 'dark' ? '○' : '●'}
            </button>
          </div>
        </div>
      </header>

      {children}

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px',
          color: 'var(--text-muted)',
          background: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>WiringWorkbench helps teams plan wiring first and code second.</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <PublicLink label="HOME" href="/" onNavigate={onNavigate} />
            <PublicLink label="FEATURES" href="/features" onNavigate={onNavigate} />
            <PublicLink label="FAQ" href="/faq" onNavigate={onNavigate} />
            <PublicLink label="CONTACT" href="/contact" onNavigate={onNavigate} />
            <PublicLink label="PROJECT" href="/project" onNavigate={onNavigate} accent />
          </div>
        </div>
      </footer>
    </div>
  );
}

function HomePage({ onNavigate }: { onNavigate: (to: RoutePath) => void }) {
  return (
    <main
      style={{
        background:
          'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      }}
    >
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '60px 24px 40px',
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
            fontSize: 'clamp(2.3rem, 5vw, 4.4rem)',
            lineHeight: 1.02,
            color: 'var(--text-primary)',
            maxWidth: 920,
            marginBottom: 18,
          }}
        >
          WiringWorkbench gives engineers, developers, and makers a cleaner way to
          plan Arduino and embedded wiring before hardware assembly begins.
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: 'var(--text-secondary)',
            maxWidth: 920,
            marginBottom: 28,
          }}
        >
          Build board-to-sensor connection plans visually, assign active pins with a
          fast checkbox workflow, validate mismatches immediately, and export useful
          project output for firmware work, documentation, and AI-assisted coding.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 34 }}>
          <PublicLink label="OPEN PROJECT" href="/project" onNavigate={onNavigate} accent />
          <PublicLink label="SEE FEATURES" href="/features" onNavigate={onNavigate} />
          <PublicLink label="HOW IT WORKS" href="/how-it-works" onNavigate={onNavigate} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 14,
          }}
        >
          {featureCards.map((item) => (
            <div
              key={item}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                padding: 14,
                color: 'var(--text-primary)',
                lineHeight: 1.55,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <Section title="What WiringWorkbench does" eyebrow="OVERVIEW">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          <article style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Visual wiring workflow</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              WiringWorkbench uses a simplified node-to-node model so teams can connect
              boards and sensors quickly without dragging individual wires for every pin.
            </p>
          </article>
          <article style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Pin assignment and validation</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Active ports are assigned with checkboxes. The editor compares sensor
              requirements with board pins and highlights mapping problems before they
              become assembly mistakes.
            </p>
          </article>
          <article style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Export for real workflows</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Export structured JSON mappings, Arduino starter files, and Markdown
              prompts for AI-assisted tooling. Saved project files also preserve custom
              component definitions.
            </p>
          </article>
        </div>
      </Section>

      <Section title="Supported boards and components" eyebrow="BUILT-IN DEFINITIONS">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          WiringWorkbench includes ready-to-use definitions for common Arduino and
          microcontroller boards together with popular sensors and modules used in
          embedded education, prototyping, robotics, and IoT work.
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
      </Section>

      <Section title="Common use cases" eyebrow="WHERE IT FITS">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {[
            'Planning Arduino Uno sensor wiring before breadboarding',
            'Documenting pin usage for workshops, classrooms, and demos',
            'Reviewing embedded prototype connections with teammates',
            'Preparing AI-ready project context for firmware code generation',
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
      </Section>

      <Section title="Frequently asked questions" eyebrow="FAQ">
        <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
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

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PublicLink label="READ FEATURE DETAILS" href="/features" onNavigate={onNavigate} />
          <PublicLink label="OPEN FAQ PAGE" href="/faq" onNavigate={onNavigate} accent />
        </div>
      </Section>
    </main>
  );
}

function FeaturesPage({ onNavigate }: { onNavigate: (to: RoutePath) => void }) {
  return (
    <main
      style={{
        background:
          'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      }}
    >
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 32px' }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: 'var(--amber)', marginBottom: 12 }}>
          FEATURES
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.05, marginBottom: 18 }}>
          A technical workbench focused on wiring clarity instead of schematic overhead.
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 24 }}>
          WiringWorkbench is intentionally narrow: it helps you plan board-to-sensor
          connections quickly, validate port usage, and export useful project output.
          That keeps the interface fast for embedded developers and makers who care about
          clean pin mapping, not simulation complexity.
        </p>
      </section>

      <Section title="Core capabilities" eyebrow="WHAT YOU CAN DO">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {[
            {
              title: 'Node-to-node connection model',
              body: 'Create one wire per board and sensor pair. This keeps diagrams simple and removes the friction of per-pin drag wiring.',
            },
            {
              title: 'Checkbox-based port selection',
              body: 'Mark which sensor ports are active and which board pins are assigned. The workflow is fast enough for prototyping and teaching.',
            },
            {
              title: 'Automatic assignment assistance',
              body: 'The editor can seed and assign compatible board pins when a new sensor is connected, reducing repetitive setup work.',
            },
            {
              title: 'Mismatch visibility',
              body: 'Warnings highlight missing or invalid mappings so teams can spot incomplete plans before they move to hardware.',
            },
            {
              title: 'Reusable custom components',
              body: 'Create your own parts with port definitions and save them with the project file so they remain portable.',
            },
            {
              title: 'Portable export formats',
              body: 'Generate JSON, Arduino starter scaffolding, Markdown prompts, and shareable links for collaboration.',
            },
          ].map((item) => (
            <article key={item.title} style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Export formats explained" eyebrow="OUTPUT">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            ['JSON', 'Structured pin mapping data for tooling, automation, and project records.'],
            ['.INO', 'Arduino-oriented starter code with matched pin definitions for firmware setup.'],
            ['.MD', 'A Markdown handoff or AI prompt that describes the selected board, components, and resolved mapping.'],
            ['SHARE', 'A URL that opens the current diagram so teammates can review the same layout directly.'],
          ].map(([label, body]) => (
            <div key={label} style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 16 }}>
              <div style={{ ...mono, color: 'var(--phosphor)', marginBottom: 8 }}>{label}</div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>{body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PublicLink label="SEE THE WORKFLOW" href="/how-it-works" onNavigate={onNavigate} />
          <PublicLink label="OPEN PROJECT" href="/project" onNavigate={onNavigate} accent />
        </div>
      </Section>
    </main>
  );
}

function HowItWorksPage({ onNavigate }: { onNavigate: (to: RoutePath) => void }) {
  return (
    <main
      style={{
        background:
          'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      }}
    >
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 32px' }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: 'var(--amber)', marginBottom: 12 }}>
          HOW IT WORKS
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.05, marginBottom: 18 }}>
          From idea to pin map in a short, predictable workflow.
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920 }}>
          WiringWorkbench is designed to minimize setup friction. Instead of drawing a
          detailed schematic, you define which devices are involved, connect them at the
          node level, assign active ports, and let the workbench help validate the plan.
        </p>
      </section>

      <Section title="Typical project flow" eyebrow="STEP BY STEP">
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['1. Start a project', 'Open the project editor and drag a board and one or more sensors from the library onto the canvas.'],
            ['2. Connect components', 'Create one wire between each sensor and the target board. This establishes the relationship without overcomplicating the diagram.'],
            ['3. Mark active ports', 'Check the ports used by the sensor and the pins assigned on the board. The board can also auto-select compatible assignments for new connections.'],
            ['4. Review warnings', 'If counts or roles do not line up, WiringWorkbench flags the mismatch so you can correct the plan before assembly or coding.'],
            ['5. Save and export', 'Download a portable project file, export JSON or Arduino starter code, or share the layout with a link.'],
          ].map(([title, body]) => (
            <article key={title} style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{body}</p>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PublicLink label="OPEN PROJECT" href="/project" onNavigate={onNavigate} accent />
          <PublicLink label="READ THE FAQ" href="/faq" onNavigate={onNavigate} />
        </div>
      </Section>
    </main>
  );
}

function FaqPage({ onNavigate }: { onNavigate: (to: RoutePath) => void }) {
  return (
    <main
      style={{
        background:
          'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      }}
    >
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 32px' }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: 'var(--amber)', marginBottom: 12 }}>
          FAQ
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.05, marginBottom: 18 }}>
          Frequently asked questions about WiringWorkbench.
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920 }}>
          These answers explain how WiringWorkbench fits into Arduino and embedded
          workflows, what it exports, and how it differs from a simulator or schematic editor.
        </p>
      </section>

      <Section title="Questions and answers" eyebrow="SUPPORTING DETAIL">
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
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>{item.question}</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {item.answer}
              </p>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PublicLink label="SEE FEATURES" href="/features" onNavigate={onNavigate} />
          <PublicLink label="OPEN PROJECT" href="/project" onNavigate={onNavigate} accent />
        </div>
      </Section>
    </main>
  );
}

function ContactPage() {
  return (
    <main
      style={{
        background:
          'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      }}
    >
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 32px' }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: 'var(--amber)', marginBottom: 12 }}>
          CONTACT
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.05, marginBottom: 18 }}>
          Get in touch.
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 680, marginBottom: 40 }}>
          Have a question, found a bug, or want to contribute? Reach out via GitHub or email.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <a
            href="https://github.com/DraSoGo"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              padding: 24,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--phosphor)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', letterSpacing: '0.1em' }}>GITHUB</div>
            <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>DraSoGo</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              github.com/DraSoGo
            </div>
          </a>

          <a
            href="mailto:vdhfmfatv4321@gmail.com"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              padding: 24,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--phosphor)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ ...mono, fontSize: 10, color: 'var(--phosphor)', letterSpacing: '0.1em' }}>EMAIL</div>
            <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>Send a message</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              vdhfmfatv4321@gmail.com
            </div>
          </a>
        </div>
      </section>
    </main>
  );
}

function ProjectWorkspace({
  theme,
  onToggleTheme,
}: {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar theme={theme} onToggleTheme={onToggleTheme} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Library />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme());
  const [route, setRoute] = useState<RoutePath>(() => {
    const hasShare = new URLSearchParams(window.location.search).has('d');
    return hasShare ? '/project' : normalizeRoute(window.location.pathname);
  });
  const projectBootstrapped = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const next = currentTheme === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  const navigate = useCallback((
    nextRoute: RoutePath,
    options?: { replace?: boolean; preserveSearch?: boolean }
  ) => {
    const search = options?.preserveSearch ? window.location.search : '';
    const nextUrl = `${nextRoute}${search}`;
    if (options?.replace) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.history.pushState(null, '', nextUrl);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const hasShare = new URLSearchParams(window.location.search).has('d');
      setRoute(hasShare ? '/project' : normalizeRoute(window.location.pathname));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const meta = routeMeta[route];
    document.title = meta.title;
    ensureMeta('name', 'description', meta.description);
    ensureMeta('name', 'robots', meta.robots);
    ensureMeta('property', 'og:title', meta.title);
    ensureMeta('property', 'og:description', meta.description);
    ensureMeta('property', 'og:url', meta.url);
    ensureMeta('name', 'twitter:title', meta.title);
    ensureMeta('name', 'twitter:description', meta.description);
    ensureCanonical(meta.url);
  }, [route]);

  useEffect(() => {
    if (route !== '/project') return;

    const urlState = parseShareURL(window.location.search);
    if (urlState) {
      useDiagramStore.getState().loadDiagram(urlState);
      window.history.replaceState(null, '', '/project');
      projectBootstrapped.current = true;
      return;
    }

    if (projectBootstrapped.current) return;
    const saved = loadDiagram();
    if (saved) {
      useDiagramStore.getState().loadDiagram(saved);
    }
    projectBootstrapped.current = true;
  }, [route]);

  useEffect(() => {
    if (route !== '/project') return;

    const onKey = (e: KeyboardEvent) => {
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
  }, [route]);

  useEffect(() => {
    trackPageView(routeMeta[route].title);
  }, [route]);

  const publicPage = useMemo(() => {
    switch (route) {
      case '/features':
        return <FeaturesPage onNavigate={navigate} />;
      case '/how-it-works':
        return <HowItWorksPage onNavigate={navigate} />;
      case '/faq':
        return <FaqPage onNavigate={navigate} />;
      case '/contact':
        return <ContactPage />;
      case '/':
      default:
        return <HomePage onNavigate={navigate} />;
    }
  }, [navigate, route]);

  if (route === '/project') {
    return <ProjectWorkspace theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <MarketingShell
      route={route}
      theme={theme}
      onToggleTheme={toggleTheme}
      onNavigate={navigate}
    >
      {publicPage}
    </MarketingShell>
  );
}
