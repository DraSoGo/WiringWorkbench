import type { ExportState } from './export';

const DIAGRAM_KEY = 'easyarduino_diagram';
const THEME_KEY = 'easyarduino_theme';

export function saveDiagram(state: ExportState): void {
  try {
    localStorage.setItem(DIAGRAM_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function loadDiagram(): ExportState | null {
  try {
    const raw = localStorage.getItem(DIAGRAM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      customDefs: Array.isArray(parsed.customDefs) ? parsed.customDefs : [],
    };
  } catch {
    return null;
  }
}

export function saveTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadTheme(): 'dark' | 'light' {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}
