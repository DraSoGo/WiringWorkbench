# EasyArduino AI Prompt File

Use this file as the working prompt when asking an AI to add or modify code in `easyarduino`.

## Project Goal

`easyarduino` is a browser-based wiring and configuration tool for boards and sensors.
Users can:

- drag boards and sensors onto a canvas
- connect nodes visually
- activate ports and assign board pin quantities
- configure custom ports
- save diagrams to browser storage
- export JSON, Arduino stub code, and share URLs

## Tech Stack

- Vite
- React
- TypeScript
- Zustand
- `@xyflow/react`
- Inline style-driven UI with theme variables from `src/index.css`

## Source Layout

- `src/App.tsx`
  Main app shell. Mounts `Toolbar`, `Library`, `Canvas`, and `Inspector`.

- `src/components/Toolbar/Toolbar.tsx`
  Top bar actions: new, save, undo/redo, export, share, theme toggle.

- `src/components/Library/Library.tsx`
  Left panel listing boards, sensors, and custom components.

- `src/components/Library/ComponentModal.tsx`
  Modal for creating or editing custom components.

- `src/components/Canvas/Canvas.tsx`
  React Flow integration, drag/drop, node creation, connection handling, edge label editing.

- `src/components/Canvas/ComponentNode.tsx`
  Visual node card for boards and sensors. Board ports support quantity controls.

- `src/components/Canvas/WireEdge.tsx`
  Custom edge rendering and mismatch warnings.

- `src/components/Inspector/Inspector.tsx`
  Right panel for rename, port activation, quantity adjustment, connection summaries, and port configuration.

- `src/store/diagram.ts`
  Central Zustand store for nodes, edges, selection, undo/redo, custom definitions, and per-port counts.

- `src/lib/portMapping.ts`
  Shared mapping logic for board/sensor port assignments. Reuse this instead of reimplementing mapping rules.

- `src/lib/export.ts`
  Export logic for JSON, `.ino`, and share URLs.

- `src/lib/storage.ts`
  Browser persistence using `localStorage`.

- `src/data/boards.ts`
  Built-in board definitions.

- `src/data/sensors.ts`
  Built-in sensor definitions.

## Current Data Model

### `DiagramNode`

Important fields:

- `instanceId`
- `defId`
- `label`
- `position`
- `activePorts: string[]`
- `portCounts?: Record<string, number>`
- `portsOverride?: PortDef[]`

### Rules

- Sensors usually behave like simple active/inactive port selections.
- Boards can assign multiple sensor ports to the same board pin by increasing `portCounts[portId]`.
- Keep `activePorts` and `portCounts` consistent.
- Backward compatibility matters because old saved diagrams may only have `activePorts`.

## Implementation Rules For AI

- Preserve the current file structure.
- Put state changes in `src/store/diagram.ts`.
- Put shared mapping or assignment logic in `src/lib/portMapping.ts`.
- Put export-related logic only in `src/lib/export.ts`.
- Keep UI-specific behavior inside the relevant component.
- Do not duplicate mapping rules across `Canvas`, `Inspector`, and export code.
- Reuse existing theme tokens like `var(--phosphor)`, `var(--border)`, and `var(--text-muted)`.
- Match the current visual style: compact, terminal-like, mono-heavy, dark-panel UI.
- Prefer small targeted changes over broad refactors.
- Maintain save/load compatibility with existing diagrams in `localStorage`.
- If a feature affects both board assignment logic and exports, update both.

## When Adding A New Feature

1. Identify whether the feature is:
   - state/model
   - UI-only
   - mapping logic
   - export/save logic
2. Update the smallest correct layer first.
3. Reuse existing helpers before adding new ones.
4. If the feature changes how ports are counted or assigned, update:
   - `src/store/diagram.ts`
   - `src/lib/portMapping.ts`
   - any affected UI in `Canvas` or `Inspector`
   - `src/lib/export.ts` if exported mappings change
5. Verify with:
   - `npm run build`
   - `npm run lint`

## Prompt Template

Use this template when asking AI to make a change:

```md
You are editing the `easyarduino` project.

Follow the architecture in `downloads.md`.

Task:
[describe the feature or bug clearly]

Constraints:
- keep the current file structure
- reuse Zustand store and shared mapping helpers
- preserve save/load compatibility
- keep the existing visual style
- run build and lint after changes

Relevant files:
[list likely files if known]

Expected behavior:
[describe exact user-facing result]
```

## Example Prompt

```md
You are editing the `easyarduino` project.

Follow the architecture in `downloads.md`.

Task:
Add support for labeling grouped sensor bundles on the canvas and in exported JSON.

Constraints:
- keep the current file structure
- reuse Zustand store and shared mapping helpers
- preserve save/load compatibility
- keep the existing visual style
- run build and lint after changes

Relevant files:
- src/store/diagram.ts
- src/components/Canvas/Canvas.tsx
- src/components/Inspector/Inspector.tsx
- src/lib/export.ts

Expected behavior:
Users can set a bundle label in the inspector, see it on the canvas, and exported JSON includes that label.
```
