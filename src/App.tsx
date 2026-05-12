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
      'WiringWorkbench is a visual wiring-planning tool for Arduino and microcontroller projects. It helps engineers, developers, and hardware hobbyists map board-to-sensor connections before writing code. Instead of sketching diagrams by hand or maintaining a separate spreadsheet of pin assignments, you drag boards and sensors onto a shared canvas, draw one wire per relationship, and let the workbench track which ports are in use. The result is a clear, shareable plan that travels with the project.',
  },
  {
    question: 'Is WiringWorkbench a simulator?',
    answer:
      'No. WiringWorkbench does not simulate electrical behavior, calculate current draw, or execute embedded code. Its scope is deliberate: connection planning, port assignment, validation, and export. This keeps the tool fast and focused for the pre-coding phase of hardware work. For simulation you would use a dedicated tool such as Wokwi or Tinkercad Circuits alongside WiringWorkbench.',
  },
  {
    question: 'What can I export from the tool?',
    answer:
      'Four export formats are available. JSON gives you a structured pin-mapping object suitable for tooling, scripts, or project records. The .ino export produces an Arduino starter file with the correct pin constants already defined, so you can open it in the Arduino IDE and begin writing logic immediately. The Markdown export creates a project-context document useful as an AI prompt or a human-readable handoff. Finally, the share URL encodes the full diagram into a query parameter so collaborators can open the exact same layout in their browser without any account or file transfer.',
  },
  {
    question: 'Can I save and reopen projects later?',
    answer:
      'Yes. WiringWorkbench keeps a browser-local autosave copy while you work, so closing the tab and returning later restores your last diagram automatically. You can also download a portable project file at any point and reopen it on any device. Custom component definitions are bundled inside the project file, so everything travels together.',
  },
  {
    question: 'Does WiringWorkbench support custom components?',
    answer:
      'Yes. The custom component builder lets you define a name, category, and a list of ports with roles such as signal, power, or ground. Once saved, the component appears in the library and can be added to any diagram. Custom definitions are stored inside the project file, so sharing the file or the share URL preserves them for anyone who opens the diagram.',
  },
  {
    question: 'Which boards and sensors are included by default?',
    answer:
      'Built-in board definitions cover Arduino Uno, Arduino Nano, ESP32, and Raspberry Pi Pico. Built-in sensor definitions include the DHT11 temperature and humidity sensor, HC-SR04 ultrasonic distance sensor, MPU6050 accelerometer and gyroscope, SSD1306 OLED display, relay module, IR receiver, servo motor, NeoPixel LED strip, soil moisture sensor, and MQ-2 gas sensor. More definitions can be added at any time using the custom component builder.',
  },
  {
    question: 'How does pin validation work?',
    answer:
      'When you connect a sensor to a board and mark active ports, WiringWorkbench compares the number and role of sensor ports against the assigned board pins. If the counts do not match, or if a role such as I2C data is mapped to a pin that carries a different role, the inspector panel highlights the mismatch. This lets you correct the plan on the canvas rather than discovering the problem during assembly or debugging.',
  },
  {
    question: 'Is WiringWorkbench free to use?',
    answer:
      'Yes. WiringWorkbench is a free web application with no account required. Open the project editor, build your wiring plan, and export whenever you are ready. The tool runs entirely in the browser and does not send your project data to any server.',
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
              Each connection represents the full relationship between two components, keeping
              the canvas readable even when a project involves many sensors. The node layout
              is freely draggable so you can arrange parts the way they physically sit on
              your bench or PCB.
            </p>
          </article>
          <article style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Pin assignment and validation</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Active ports are assigned with checkboxes. The editor compares sensor
              requirements with board pins and highlights mapping problems before they
              become assembly mistakes. Port roles — signal, power, ground, clock, data —
              are checked against each other so mismatched pairs are caught immediately.
              The board can also auto-seed compatible pin assignments when a new sensor
              is connected, reducing repetitive setup.
            </p>
          </article>
          <article style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: 18 }}>
            <h3 style={{ fontSize: 20, marginBottom: 10 }}>Export for real workflows</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Export structured JSON mappings, Arduino starter files, and Markdown
              prompts for AI-assisted tooling. Saved project files also preserve custom
              component definitions. The share URL encodes the full diagram so collaborators
              can open the exact layout in their browser without any account or file
              transfer. Every export format is designed to slot directly into the next
              step of a real embedded project.
            </p>
          </article>
        </div>
      </Section>

      <Section title="Why plan wiring before coding?" eyebrow="THE CASE FOR PLANNING">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          Most wiring problems show up during firmware debugging rather than during hardware
          assembly, because the mistake happened earlier — at the point where someone decided
          which pin would carry which signal. By the time code is running, the error is buried
          under layers of software and the physical setup is already soldered or breadboarded.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          A dedicated planning step forces the pin-assignment decision to happen explicitly,
          before any wire is touched. WiringWorkbench makes that step fast enough that it
          does not feel like overhead. You open the editor, drop in your components, draw
          connections, and the tool tells you immediately if the plan is consistent. That
          feedback loop — plan, validate, correct — takes minutes instead of the hours a
          debugging session might consume.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900 }}>
          The exported files then carry that planning work forward. An Arduino .ino file
          with all the pin constants already defined means less time transcribing numbers
          and more time writing logic. A Markdown export gives AI coding assistants the
          exact context they need to generate accurate firmware without guessing at the
          hardware setup.
        </p>
      </Section>

      <Section title="Supported boards and components" eyebrow="BUILT-IN DEFINITIONS">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          WiringWorkbench includes ready-to-use definitions for common Arduino and
          microcontroller boards together with popular sensors and modules used in
          embedded education, prototyping, robotics, and IoT work. Each definition
          carries the correct port list and role metadata so validation works without
          any manual configuration.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          If your hardware is not in the built-in list, the custom component builder
          lets you define it in under a minute. Specify a name, choose a category, and
          add ports with the appropriate roles. The new component is immediately available
          in the library and behaves identically to built-in definitions during validation
          and export.
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          WiringWorkbench fits naturally into any phase of an embedded project where
          clarity about connections matters. Whether you are building alone or handing
          off to a team, the tool produces artifacts that reduce ambiguity at every step.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {[
            { title: 'Pre-breadboard planning', body: 'Map Arduino Uno sensor wiring before touching any hardware. Validate pin roles and catch conflicts before they become physical assembly mistakes.' },
            { title: 'Workshop and classroom docs', body: 'Document pin usage for demos, lessons, and workshops. Students and attendees get a clear reference they can reopen and modify on their own.' },
            { title: 'Team prototype reviews', body: 'Share a diagram URL with teammates so everyone reviews the same connection plan. No file attachment needed — the link encodes the full layout.' },
            { title: 'AI-assisted firmware setup', body: 'Export a Markdown project context and paste it into an AI coding assistant. The model gets exact board, component, and pin data and generates accurate firmware without guessing.' },
          ].map((useCase) => (
            <article
              key={useCase.title}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                padding: 16,
                lineHeight: 1.55,
              }}
            >
              <h3 style={{ fontSize: 15, marginBottom: 8, color: 'var(--text-primary)' }}>{useCase.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{useCase.body}</p>
            </article>
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 16 }}>
          WiringWorkbench is intentionally narrow: it helps you plan board-to-sensor
          connections quickly, validate port usage, and export useful project output.
          That keeps the interface fast for embedded developers and makers who care about
          clean pin mapping, not simulation complexity.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 24 }}>
          Every feature in WiringWorkbench exists to reduce the gap between "I know what
          I want to build" and "I have working firmware running on hardware." The canvas
          captures the plan, validation catches mistakes, and the export formats carry
          that work directly into code editors, Arduino IDE, and AI assistants.
        </p>
      </section>

      <Section title="Core capabilities" eyebrow="WHAT YOU CAN DO">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {[
            {
              title: 'Node-to-node connection model',
              body: 'Create one wire per board and sensor pair. This keeps diagrams simple and removes the friction of per-pin drag wiring. Each node shows its ports on the left and right sides, and connections snap to any available handle. The result is a diagram that communicates the structure of the project at a glance rather than drowning in individual signal lines.',
            },
            {
              title: 'Checkbox-based port selection',
              body: 'Mark which sensor ports are active and which board pins are assigned. The workflow is fast enough for prototyping and teaching. Port roles — signal, power, ground, clock, data — are stored per definition so the validator can check compatibility automatically. Checking a port on one side and assigning a pin on the other is all that is needed to establish a complete, validated mapping.',
            },
            {
              title: 'Automatic assignment assistance',
              body: 'The editor can seed and assign compatible board pins when a new sensor is connected, reducing repetitive setup work. When auto-assignment runs, it matches port roles against available board pins and fills in the most likely candidates. You can accept the suggestion as-is or adjust individual assignments in the inspector without starting from scratch.',
            },
            {
              title: 'Mismatch visibility',
              body: 'Warnings highlight missing or invalid mappings so teams can spot incomplete plans before they move to hardware. A mismatch can be a count difference — three sensor ports with only two board pins assigned — or a role conflict, such as a clock line mapped to a plain digital pin. Both types surface immediately in the inspector panel next to the affected connection.',
            },
            {
              title: 'Reusable custom components',
              body: 'Create your own parts with port definitions and save them with the project file so they remain portable. Custom components behave identically to built-in definitions during validation and export. If you work with a proprietary sensor or a non-standard breakout board, you can model it once and reuse it across every project that needs it.',
            },
            {
              title: 'Portable export formats',
              body: 'Generate JSON, Arduino starter scaffolding, Markdown prompts, and shareable links for collaboration. Each format is designed to slot directly into the next step of a real workflow. JSON integrates with build scripts and documentation generators. The .ino file opens in Arduino IDE immediately. The Markdown prompt gives AI coding assistants the hardware context they need to write accurate firmware.',
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 18 }}>
          Each export format targets a different downstream use. You can generate all of
          them from the same diagram in a single session, so the planning work you do
          once produces artifacts for code, documentation, and collaboration simultaneously.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            ['JSON', 'Structured pin mapping data for tooling, automation, and project records. The format is a flat object keyed by sensor port identifiers, with values describing the board pin each port is mapped to. Parsing it takes a single JSON.parse call, making it easy to integrate with build scripts, documentation generators, or custom hardware configuration pipelines.'],
            ['.INO', 'Arduino-oriented starter code with matched pin definitions for firmware setup. The file opens directly in the Arduino IDE. Every sensor port that has a board pin assignment becomes a #define constant at the top of the file, so you can start writing loop() and setup() logic without manually transcribing numbers from a wiring diagram.'],
            ['.MD', 'A Markdown handoff or AI prompt that describes the selected board, components, and resolved mapping in plain language. Paste it into ChatGPT, Claude, or any AI coding assistant and the model has the full hardware context it needs to generate accurate firmware, register configurations, and library usage examples.'],
            ['SHARE', 'A URL that opens the current diagram so teammates can review the same layout directly. The full diagram state — nodes, edges, port assignments, and custom component definitions — is encoded into a single query parameter. No account, no server, no file attachment needed.'],
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920, marginBottom: 16 }}>
          WiringWorkbench is designed to minimize setup friction. Instead of drawing a
          detailed schematic, you define which devices are involved, connect them at the
          node level, assign active ports, and let the workbench help validate the plan.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920 }}>
          The entire flow — from opening the editor to exporting finished output — takes
          minutes for a simple project and stays manageable even when the component count
          grows. Because WiringWorkbench focuses exclusively on connection planning, there
          is no simulation setup, no library configuration, and no SPICE netlist to manage.
          You work directly with the things that matter: which device connects to what, and
          which pins carry which signals.
        </p>
      </section>

      <Section title="Typical project flow" eyebrow="STEP BY STEP">
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            {
              title: '1. Start a project',
              body: 'Open the project editor and drag a board and one or more sensors from the library onto the canvas. The library panel on the left lists all built-in boards and sensors grouped by category. Custom components you have defined appear in a separate section at the bottom. Each component lands on the canvas as a node showing its available ports.',
            },
            {
              title: '2. Connect components',
              body: 'Create one wire between each sensor and the target board. Click and drag from any port handle on the sensor node to any port handle on the board node. WiringWorkbench blocks self-connections and warns about port conflicts but otherwise lets you draw the relationship freely. The resulting wire represents the full board-to-sensor relationship, not a single pin pair.',
            },
            {
              title: '3. Mark active ports',
              body: 'Select a connection and open the inspector. Check the sensor ports that are in use for this project and assign the corresponding board pins. The board can auto-select compatible assignments for new connections, which covers the common case and leaves you free to override specific pins when your hardware has constraints. Port roles are compared automatically — signal against signal, ground against ground — and mismatches appear immediately.',
            },
            {
              title: '4. Review warnings',
              body: 'If port counts or roles do not line up, WiringWorkbench flags the mismatch in the inspector so you can correct the plan before assembly or coding. A warning might appear because a sensor requires three pins but only two board pins have been assigned, or because a clock pin is mapped to a general-purpose digital pin that does not support the required protocol. Fixing it is a matter of adjusting the assignment in the inspector.',
            },
            {
              title: '5. Save and export',
              body: 'Download a portable project file that includes your diagram and any custom component definitions. Export JSON for tooling, an Arduino .ino starter file for firmware work, or a Markdown document for AI-assisted coding. Copy the share URL to send the exact diagram layout to a teammate. All export formats are generated client-side — no data leaves your browser.',
            },
          ].map(({ title, body }) => (
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

      <Section title="What makes this different from a schematic editor?" eyebrow="SCOPE AND FOCUS">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 16 }}>
          Schematic editors like KiCad or EasyEDA are powerful tools for producing
          production-ready circuit diagrams with precise electrical definitions, footprint
          assignments, and BOM generation. That power comes with a learning curve and a
          workflow that is often too heavy for the early prototyping phase of an embedded
          project.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900, marginBottom: 16 }}>
          WiringWorkbench sits earlier in the process. It answers the question "which
          sensor connects to which board pin and why?" without requiring you to know
          footprint libraries or net naming conventions. The output is not a manufacturing
          file — it is a validated connection plan and a set of code-ready artifacts that
          tell your firmware exactly what pin carries what signal.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 900 }}>
          Many hardware developers use both: WiringWorkbench for quick planning and
          communication, a full schematic editor when moving toward a custom PCB. The
          JSON export makes it straightforward to carry the pin assignment decisions
          forward into either workflow.
        </p>
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920, marginBottom: 12 }}>
          These answers explain how WiringWorkbench fits into Arduino and embedded
          workflows, what it exports, and how it differs from a simulator or schematic editor.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 920 }}>
          If your question is not listed here, open an issue on GitHub or send an email
          through the contact page and the answer will be added.
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
          <PublicLink label="HOW IT WORKS" href="/how-it-works" onNavigate={onNavigate} />
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
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 720, marginBottom: 16 }}>
          WiringWorkbench is built and maintained by a single developer. Feedback,
          bug reports, and feature suggestions are genuinely welcome — they directly
          shape what gets built next.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 720, marginBottom: 40 }}>
          For bug reports, the most useful detail is a description of what you expected
          versus what happened, plus the browser and operating system you were using.
          For feature requests, a brief description of your workflow and where
          WiringWorkbench fell short is more than enough to start a conversation.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 48 }}>
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
              github.com/DraSoGo — open an issue for bugs or feature requests, or browse
              the source code for WiringWorkbench and other projects.
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
              vdhfmfatv4321@gmail.com — for questions that are not suited to a public
              GitHub issue, email is the best way to reach out directly.
            </div>
          </a>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--amber)', letterSpacing: '0.1em', marginBottom: 14 }}>
            RESPONSE TIME
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 720, marginBottom: 12 }}>
            GitHub issues receive the fastest response because they are visible and
            easy to track alongside the rest of the project. Email responses typically
            arrive within a few days. There is no support queue or ticketing system —
            just a developer reading messages and responding when available.
          </p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 720 }}>
            WiringWorkbench is a free tool and developed in spare time, so response
            speed varies. That said, every message is read, and feedback that improves
            the tool for the broader community of hardware developers and makers is
            always appreciated.
          </p>
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
