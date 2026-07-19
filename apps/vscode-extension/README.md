# TMTP VS Code Extension

The visual surface for TMTP. It contributes a permanent TMTP icon to VS Code's
Activity Bar instead of interrupting startup with an automatically opened
editor. Clicking the icon opens a lightweight Learning Home sidebar with
project status, progress, AI configuration status, and direct navigation. The
full learning workspace runs the deterministic `@tmpt/scanner` pipeline against
the open folder and streams results into a themed editor webview with four tabs:

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
  Generating or reopening a cached lesson also opens the real source beside
  TMTP and attaches rich native editor comment threads to each matched Key
  Construct. The complete Project Context, Role, Language, and Why it matters
  text therefore appears directly beneath the relevant code without modifying
  the file. Every construct starts collapsed so the source remains primary.
  Opening a block exposes an explicit **Mark as read** action; read/unread state
  is shown in the thread label, can be toggled again, and persists in
  `workspaceState`. Any source edit removes that file's commentary to avoid stale anchors.
  Each commentary block also includes **Practice this File**, which jumps
  directly to that file's dedicated exercise flow. The same action is present
  alongside the Guided Tour navigation buttons, so practice does not require
  finishing the whole tour or returning to the graph first.
  Run `TMTP: Hide AI Commentary` to clear all visible teaching threads.
  The percentage shown on graph nodes is real learning progress rather than
  scanner confidence: 0% unvisited, 10% when explained, up to 60% as Key
  Constructs are marked read, 80% after practice, and 100% when mastered.
  Scanner confidence still controls visual importance, but is no longer shown
  as though it were study completion.
- **🕸️ Project Graph** — an explorable code-and-learning graph of the project
  (React Flow + ELK.js), replacing the old flat Knowledge Map list. ELK's
  layered algorithm lays every file out top-to-bottom by dependency direction
  (entry points on top, imports flowing down), minimizes edge crossings, and
  keeps disconnected files clustered separately instead of interleaved into
  one hairball. All nodes share the same size — importance is communicated
  through border weight and color intensity instead, so a dense graph stays
  readable rather than lopsided. Solid edges are real, scanner-verified local
  import relationships — never invented — while green dashed edges are an
  explicitly labelled deterministic recommended lesson sequence. Both use
  ELK's routed paths rather than straight endpoint guesses. Every core node
  shows its learning step and scanner-derived reason for being useful. Its
  status icon also reflects live learning progress
  (⚪ not visited / 🟡 explained / 🟠 practiced / ⭐ mastered), which updates
  automatically as you use the Guided Tour and Practice. Clicking a node just
  selects it and opens the same detail panel as before — **Open File**,
  **Explain this File**, **Practice this File**, **Mark as Learned** —
  without moving the camera; **Fit to Screen** and search provide explicit
  navigation. The graph opens in **Core** scope, **Related** adds one-hop
  neighbours, and **All files** reveals the full scan. Generated TypeScript
  sidecars, source maps, tests, examples, and build output do not lead the
  Core view but remain inspectable in All files. Hovering a node highlights
  outgoing “uses” imports in orange and incoming “used by” imports in blue.
  A permanent legend distinguishes code dependencies from teaching order.

No chat, no global progress tracking beyond per-file learning status yet —
that's future milestones. The scanner itself has no AI dependency, and
neither does the graph.

## Running it

Open the repo root in VS Code and press F5 (`Run TMTP Extension`). This builds
the extension and webview bundles and launches an Extension Development Host.
Click the TMTP icon in the Activity Bar, then choose a destination from the
Learning Home sidebar. The full workspace opens only when requested.

To reopen the panel manually, run the `TMTP: Show Project Overview` command.

## Structure

- `src/extension.ts` — activation, runs each pipeline stage in turn, streams
  progress to the webview, generates a file's lesson on request (config
  lookup, provider call, caching), maps lesson snippets back to source ranges,
  owns native AI-commentary threads, and opens files on request. Never sends
  the API key to the webview or writes AI commentary into source files.
- `src/sidebarView.ts` — the Activity Bar Learning Home: project/scan status,
  persisted learning counts, AI status, and navigation into a selected full
  workspace tab. It intentionally keeps the graph and lessons in the editor.
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
  model from `ProjectScanResult` (`startingFiles` for importance and teaching
  rationale, `projectGraph.edges` for verified imports) plus the caller's
  learning-status lookup. It classifies generated/test/example files as
  auxiliary for progressive disclosure; they are not deleted from the model.
- `src/webview/graph/` — the only React code in the extension, isolated to
  the graph tab: `ProjectGraphCanvas.tsx` (Core/Related/All scopes,
  deterministic lesson order, search, import highlighting, minimap, and
  controls), `FileNode.tsx` (the uniformly-sized node with learning step and
  rationale), `layout.ts`
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
