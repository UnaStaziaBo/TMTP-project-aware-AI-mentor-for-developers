# TMTP VS Code Extension

The visual surface for TMTP. It contributes a permanent TMTP icon to VS Code's
Activity Bar instead of interrupting startup with an automatically opened
editor. Clicking the icon opens a lightweight Learning Home sidebar with
project status, progress, AI configuration status, direct navigation, and a
**Practice this File** picker over the recommended learning stops. The
full learning workspace runs the deterministic `@tmpt/scanner` pipeline against
the open folder and streams results into a themed editor webview with four tabs:

- **Project Overview** — the six pipeline stages, detected languages/
  frameworks/infrastructure/dependencies with confidence and evidence, and a
  file-type breakdown.
- **Where Should I Start?** — the ranked `startingFiles` candidates from
  the Starting File Discovery stage, each with its confidence, the plain
  deterministic reasons it was recommended, an **Open File** button, and an
  **Explain** button that jumps straight into the Guided Tour at that file.
- **Guided Tour** — choose OpenAI, Anthropic Claude, or Google Gemini and
  configure its API key (stored only in VS Code's SecretStorage), then step
  through the same ranked starting files one at a
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
  Focused practice tests the selected file's architectural boundaries rather
  than always making it the answer: correct files rotate across the selected
  file and related choices, and option positions rotate too. The deterministic
  planner fixes those answers before AI writes the scenario prose.
  **Practice this File** is also persistent in the full workspace toolbar. It
  targets the selected graph file, current tour file, or first recommended
  learning stop, in that order. Consequently, a developer can use exercises
  independently without first completing lessons or navigating through graph details.
  Run `TMTP: Hide AI Commentary` to clear all visible teaching threads.
  The percentage shown on graph nodes is real learning progress rather than
  scanner confidence: 0% unvisited, 10% when explained, up to 60% as Key
  Constructs are marked read, 80% after practice, and 100% when mastered.
  Scanner confidence still controls visual importance, but is no longer shown
  as though it were study completion.
- **🕸️ Project Graph** — opens directly into the AI-interpreted Architecture
  Graph (React Flow + ELK.js); users do not choose between Dependencies and
  Architecture modes. The graph renders a synthetic project root,
  evidence-backed architecture areas, semantic architecture relationships,
  membership connectors, and canonical file cards on demand. The
  **Architecture Navigator** shows the compact topology, current viewport,
  selected area or file context, and aggregated real learning progress; it can
  center the main graph on an area. Search, pan, zoom, **Fit to Screen**,
  relationship inspection, expansion, file selection, and file actions remain
  available. A configured AI provider is required to create the architecture
  model; the extension reuses a compatible cached model when available and
  clearly reports when configuration is required. Scanner dependency/import
  analysis remains local verified evidence for the architecture model, even
  though the legacy Dependencies graph is no longer user-facing.

No chat, no global progress tracking beyond per-file learning status yet —
that's future milestones. The scanner itself has no AI dependency; Project
Graph needs AI configuration only to generate its architecture model.

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
  the graph tab: `ProjectGraphCanvas.tsx` mounts Architecture directly and
  retains the old Dependencies projection only as dormant code for potential
  future reuse; `ArchitectureGraphCanvas.tsx` renders the architecture cards,
  relationships, search, fit controls, and Navigator; `architectureGraph.ts`
  adapts the AI model to graph nodes and edges; and `layout.ts`,
  `RoutedEdge.tsx`, and `edgePath.ts` preserve deterministic routed layout.
- `src/webview/main.ts` — renders the rest of the webview UI (vanilla DOM,
  no React) from the streamed messages, and mounts the graph canvas into a
  persistent container that survives the rest of the app's re-renders. It also
  routes every global or contextual practice action into the same per-file flow.
- `src/practicePlanner.ts` — deterministically plans confidence-weighted tour
  practice and focused file practice. Focused plans separate `learningFile`
  from the slot's correct `file`, rotate answers/options, and preserve the
  selected file in every option set so exercises test architectural boundaries.
- `src/protocol.ts` — message types shared between the extension and webview.
- `scripts/build.mjs` — esbuild bundling for both the extension host
  (CommonJS, Node) and the webview (browser IIFE, with the automatic JSX
  runtime for the graph's React components).
