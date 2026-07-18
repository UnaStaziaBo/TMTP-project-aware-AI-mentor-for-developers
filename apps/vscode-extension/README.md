# TMTP VS Code Extension

The visual surface for TMTP. On activation, it runs the deterministic
`@tmpt/scanner` pipeline against the open workspace folder and streams the
results into a themed webview panel with four tabs:

- **Project Overview** — the six pipeline stages, detected languages/
  frameworks/infrastructure/dependencies with confidence and evidence, and a
  file-type breakdown.
- **Where Should I Start?** — the ranked `startingFiles` candidates from
  the Starting File Discovery stage, each with its confidence, the plain
  deterministic reasons it was recommended, an **Open File** button, and an
  **Explain** button that jumps straight into the Guided Tour at that file.
- **Guided Tour** — configure an OpenAI API key (stored only in VS Code's
  SecretStorage), then step through the same ranked starting files one at a
  time. Each file's lesson is generated on demand via `@tmpt/ai`'s
  `generateFileLesson` and grounded entirely in that file's real content:
  Step 1 explains the file's project context (what it's responsible for,
  where it fits, why it exists) before any code is shown; Step 2 walks
  through only the handful of code constructs that matter, each with a real
  snippet and three explanations — Project, Language, Architecture — so the
  reader learns the language through what this project's own code actually
  does with it. **Previous** / **Next** move across the same ranked list (no
  separate AI-invented stop order), **Open File** opens the current file in
  the editor, and **Return to Overview** switches back to the Project
  Overview tab. Lessons are cached per file (in memory and in
  `workspaceState`) so revisiting a file, or reopening the panel, never
  re-bills the same generation. Finishing the tour flows into a **Day 1
  Practice** readiness check: a per-file confidence rating, then a set of
  deterministically-planned multiple-choice scenarios (weighted toward the
  files rated least confident) whose situations and explanations are
  AI-written but whose file/option/order selection is not.
- **🕸️ Project Graph** — a real, explorable node/edge graph of the project
  (React Flow + ELK.js), replacing the old flat Knowledge Map list. ELK's
  layered algorithm lays every file out top-to-bottom by dependency direction
  (entry points on top, imports flowing down), minimizes edge crossings, and
  keeps disconnected files clustered separately instead of interleaved into
  one hairball. All nodes share the same size — importance is communicated
  through border weight and color intensity instead, so a dense graph stays
  readable rather than lopsided. Edges are real, scanner-verified local
  import relationships — never invented — and are drawn along ELK's actual
  routed path (not a straight guess between two points), so a line never cuts
  through an unrelated node. Node color also reflects live learning status
  (⚪ not visited / 🟡 explained / 🟠 practiced / ⭐ mastered), which updates
  automatically as you use the Guided Tour and Practice. Clicking a node just
  selects it and opens the same detail panel as before — **Open File**,
  **Explain this File**, **Practice this File**, **Mark as Learned** —
  without moving the camera; **Fit to Screen** and searching are the only
  actions that reposition the view. Orphan files (no score, no edges) are
  hidden by default to avoid clutter, with a toggle to reveal them and a
  search box to find and focus any file.

No chat, no global progress tracking beyond per-file learning status yet —
that's future milestones. The scanner itself has no AI dependency, and
neither does the graph.

## Running it

Open the repo root in VS Code and press F5 (`Run TMTP Extension`). This
builds the extension and webview bundles and launches an Extension
Development Host with a workspace folder open, so the overview panel appears
immediately.

To reopen the panel manually, run the `TMTP: Show Project Overview` command.

## Structure

- `src/extension.ts` — activation, runs each pipeline stage in turn, streams
  progress to the webview, generates a file's lesson on request (config
  lookup, provider call, caching), and opens a file on request. Never sends
  the API key to the webview.
- `src/ai/aiConfig.ts` — reads/writes the AI provider config: the API key goes
  only into `context.secrets`; the non-secret provider/model choice goes into
  `context.globalState` (never `settings.json`).
- `src/languageProfile.ts` — `determinePrimaryLanguage`: picks the scanner's
  own highest-confidence detected language name, so the AI knows which
  language it's teaching. No AI involved, no predefined concept catalog —
  the lesson's content comes from reading the file, not a whitelist.
- `src/knowledgeMap.ts` — deterministic per-file role/description and
  importance-tier helpers, originally built for the old Knowledge Map list;
  reused as-is by the graph's node view model.
- `src/projectGraphView.ts` — builds the graph's deterministic node/edge view
  model from `ProjectScanResult` (`startingFiles` for importance,
  `projectGraph.edges` for relationships) plus the caller's learning-status
  lookup. No AI, no new analysis, no invented edges.
- `src/webview/graph/` — the only React code in the extension, isolated to
  the graph tab: `ProjectGraphCanvas.tsx` (the React Flow canvas: search,
  clutter filter, minimap, controls, decoupling node selection from camera
  movement), `FileNode.tsx` (the custom, uniformly-sized node), `layout.ts`
  (deterministic ELK.js layered layout — same input always produces the same
  positions and routes), `RoutedEdge.tsx` (renders ELK's real computed edge
  path instead of a guessed curve), and `edgePath.ts` (smooths ELK's routed
  polyline into a curve without losing its node-avoiding path).
- `src/webview/main.ts` — renders the rest of the webview UI (vanilla DOM,
  no React) from the streamed messages, and mounts the graph canvas into a
  persistent container that survives the rest of the app's re-renders.
- `src/protocol.ts` — message types shared between the extension and webview.
- `scripts/build.mjs` — esbuild bundling for both the extension host
  (CommonJS, Node) and the webview (browser IIFE, with the automatic JSX
  runtime for the graph's React components).
