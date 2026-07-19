# TMTP

Teach Me This Project (TMTP) is a project-aware AI mentor for software developers.

Unlike traditional coding assistants that begin from a prompt, TMTP first understands the software project itself. It analyzes the repository structure, technologies, conventions, and dependencies before offering guidance, so learning support is grounded in the actual codebase.

TMTP is an early open-source project with four completed milestones: a deterministic project analysis pipeline, a starting-file discovery engine, a Guided Project Tour that turns the ranked starting files themselves into the textbook, and an Interactive Learning Graph. The graph combines scanner-verified imports with an explicitly labelled, deterministic learning sequence, so it answers both “how is this code connected?” and “what should I learn next?” without presenting teaching relationships as code facts.

## Why TMTP exists

Most developer tools provide generic answers without understanding the project context. TMTP aims to change that by building a reusable analysis engine that can later support personalized learning, onboarding help, and concept-based guidance.

The long-term vision is to build:

- a Project Graph (the visualization now exists — see Milestone 4 — though a
  deeper standalone `graph` package with richer relationship types is still future work)
- a Developer Profile
- knowledge-gap detection
- personalized learning recommendations
- explainable guidance grounded in the repository

## Current milestones

### Milestone 1: Project Analysis Pipeline v0.1

### Implemented stages

- ✅ Filesystem Scanner
  - recursive project scanning
  - file discovery
  - folder discovery
  - manifest detection
  - ignore rules

- ✅ Language Detection
  - Python
  - TypeScript
  - Java
  - Go
  - Rust
  - evidence-based detection with confidence scores

- ✅ Framework Detection
  - FastAPI
  - React
  - NestJS
  - Django
  - Spring Boot

- ✅ Infrastructure Detection
  - Docker
  - Docker Compose
  - GitHub Actions
  - Kubernetes
  - Terraform
  - Dev Containers
  - Nginx

- ✅ Dependency Detection
  - Pydantic
  - SQLAlchemy
  - React Router
  - Axios
  - JWT
  - Django REST Framework
  - Spring Security
  - FastAPI
  - Prisma
  - Redux
  - Jest
  - Vitest
  - Zod
  - Alembic

### Milestone 2: Starting File Discovery Engine

Answers a single question before any AI is involved: *if a developer has never seen
this project before, which file(s) should they open first?* Many projects have no
single entry point (frontend + backend, CLI + API, training + inference, a library
with examples), so the stage produces a ranked list rather than assuming one.

- ✅ Starting File Discovery
  - deterministic, rule-based scoring (executable entry, framework bootstrap,
    conventional filenames, import centrality, reverse-reference counts,
    orchestration size, small-file penalties)
  - every score is explainable via a plain-language `reasons` list
  - confidence normalized to 0.0–1.0
  - never collapses multiple valid starting points into one

### Milestone 3: Guided Project Tour

The first AI-powered feature, and the first real teaching experience in one: instead
of a one-shot repository summary, the ranked `startingFiles` list from Milestone 2
*is* the tour. Clicking **Explain** on any starting-file card generates that file's
lesson on demand — never a batch of invented stops, never a generic example.

- ✅ Guided Project Tour (`packages/ai`, `apps/vscode-extension`)
  - provider abstraction (`AIProvider`) with an OpenAI implementation — designed
    so a second provider is a new implementation, not a call-site change
  - API key stored only in VS Code SecretStorage, never in settings.json, never
    sent to the webview — the webview only ever learns whether a provider is configured
  - `generateFileLesson` grounds every lesson in one real file: its full content,
    the detected primary language, and the deterministic `reasons` Starting File
    Discovery already assigned it — never re-analysis, never an invented file
  - structured JSON response (`FileLesson`: a project-context summary — `title` +
    `responsibility` — followed by an ordered `keyConstructs` list), shape-validated
    on the way in
  - **Step 1 — Project Context**: what the file is responsible for, where it fits,
    and why it exists, explained before any code is shown
  - **Step 2 — Key Constructs**: only the handful of constructs that matter (not
    every line), each with a snippet copied verbatim from the file and three tied-
    together explanations — Project (what's happening here), Language (which
    language feature this is), Architecture (why this project chose this approach)
  - navigation is **Previous** / **Next** / **Return to Overview**, stepping
    through the same ranked starting-files list — no separate AI-invented stop
    order to keep in sync
  - **Open File** opens the current file in the editor from either the starting-files
    list or the tour itself
  - idempotent: each file's lesson is cached (in memory and in `workspaceState`)
    the first time it's generated, so revisiting a file or reopening the panel never
    re-bills the same generation

### Milestone 4: Interactive Learning Graph

Replaces the old flat, accordion-style Knowledge Map with a real, explorable node/edge
graph — the goal is to *see* the project, not browse a list of it. Built with
[React Flow](https://reactflow.dev) and [ELK.js](https://github.com/kieler/elkjs)
for layout; this is the first React code in the extension, deliberately contained
to this one screen — everything else stays the vanilla-DOM architecture it always was.
(The layout originally used [dagre](https://github.com/dagrejs/dagre); it was replaced
by ELK's layered algorithm after the first version's layout felt cluttered — see
"Graph layout redesign" below.)

- ✅ Interactive Learning Graph (`packages/scanner`, `apps/vscode-extension`)
  - **the graph is deterministic, never AI-generated.** The scanner's existing
    import resolver (already built for Starting File Discovery) now also emits the
    verified edges it finds while scoring files — zero extra file reads, zero new
    analysis, and an edge only ever exists if the resolver could actually verify
    the relationship. A project with only partial import support (or none) just
    gets a sparser graph, never a padded or invented one.
  - **node design**: file name, project area, deterministic role/description (reusing the same
    `deriveShortDescription`/`deriveProjectArea` helpers from the old Knowledge
    Map), importance score, learning step and rationale, and live learning status
    (⚪ not visited / 🟡 explained / 🟠 practiced / ⭐ mastered) — all visible
    without opening the node.
  - **two relationship types are deliberately separated**: solid arrows are
    scanner-verified imports (`source → imported file`); green dashed arrows are
    the deterministic recommended lesson sequence. Learning edges organize the
    reading experience but are never represented as code dependencies.
  - **progressive scope**: **Core** opens with a small project backbone,
    **Related** adds the core files' direct neighbours, and **All files** exposes
    the complete scan. Search can reveal a matching file outside the current scope.
  - generated JavaScript beside TypeScript source, declarations, source maps,
    tests, examples, and build output remain available in **All files** but do not
    lead the Core view. Core representatives are spread across project areas so
    one package or demo cannot consume the entire opening graph.
  - **visual hierarchy is driven by the same deterministic score**: border weight
    and color intensity scale with importance, and the layered layout naturally
    floats heavily-depended-upon files toward the top.
  - clicking a node opens the *exact same* detail panel Milestone 3 already
    built — **Open File**, **Explain this File** (the Guided Tour lesson),
    **Practice this File** (the Day 1 Practice system) are all reused verbatim,
    plus a new **Mark as Learned** action for explicitly promoting a file to ⭐.
  - hovering a node emphasizes outgoing “uses” imports in orange and incoming
    “used by” imports in blue while fading unrelated imports; the permanent
    legend explains both import direction and recommended learning order
  - zoom, pan, minimap, and fit-to-screen come from React Flow directly; the
    canvas is mounted once into its own persistent DOM container rather than
    torn down on every unrelated re-render, so pan/zoom/search state survives
    normal use of the rest of the extension

#### Graph layout redesign

The first version's dagre-based layout looked cluttered in practice: nodes
overlapped, edges crossed through unrelated nodes, and unrelated files got
pulled into the same tangled mass as the main dependency chain. Root causes:

  - node size varied by importance tier, and a layered layout sizes each rank
    by its tallest node — one large node next to several small ones wasted a
    lot of vertical space and threw off consistent spacing.
  - edges were drawn as a React Flow `smoothstep` curve computed from just the
    two endpoints, with no awareness of where other nodes actually sat, so a
    line could easily cut straight through an unrelated node.
  - dagre's single-pass crossing-minimization is weaker than a true layered
    (Sugiyama-style) algorithm's, so busier graphs crossed more than necessary.
  - disconnected files (no import path to anything else) were laid out
    alongside the main chain instead of set apart, contributing to a
    "hairball" look as the file count grew.
  - every node click re-ran `fitView`, so simply selecting a file could
    recenter/rezoom the camera unexpectedly.

The layout now runs on [ELK.js](https://github.com/kieler/elkjs)'s layered
algorithm (`elk.algorithm: 'layered'`, strong `LAYER_SWEEP` crossing
minimization, `BRANDES_KOEPF` node placement) instead of dagre:

  - all nodes are now a single, fixed size — importance shows through border
    weight and color intensity only, so one rank is never stretched by a
    single oversized node.
  - edges are drawn along ELK's real computed route (its `sections`
    bend points), not a guessed curve, and are smoothed client-side into a
    curve that still follows that node-avoiding path.
  - `elk.separateConnectedComponents` clusters disconnected files apart from
    the main chain instead of interleaving them into one hairball.
  - selecting a node (click) no longer moves the camera; only explicit
    navigation — "Fit to Screen" or searching and pressing Enter — does.
  - the layout is computed asynchronously off ELK, cached per visible node
    set (not recomputed on every selection), with an "Arranging…" indicator
    while it runs.
  - graph mode uses compact project chrome and all remaining editor height, so
    it stays useful even when VS Code's terminal panel is open.

## Architecture

TMTP uses a deterministic pipeline architecture. Each stage enriches the same project analysis result object.

```text
Project
↓
Filesystem Stage
↓
Language Stage
↓
Framework Stage
↓
Infrastructure Stage
↓
Dependency Stage
↓
Starting File Stage
↓
ProjectScanResult
```

This design keeps the analysis reusable, IDE-independent, and easy to extend. The scanner is intentionally deterministic and does not depend on AI for core project analysis.

## Repository structure

- apps/: user-facing applications such as the VS Code extension
  - the extension contributes a TMTP Activity Bar icon and compact Learning
    Home sidebar; the full graph, tour, and practice experience opens in an
    editor tab only when the developer requests it
  - vscode-extension/src/webview/graph/: the Interactive Project Graph — the
    only React code in the repo, isolated to this one screen
- packages/: reusable core packages
  - scanner/: the deterministic project analysis engine (no AI dependency) —
    now also the source of the deterministic `projectGraph.edges` relationships
  - ai/: the AI provider abstraction, prompt, and response validation — depends
    on scanner's types only, never the reverse
  - shared/: shared contracts and utilities
- examples/: minimal real-world golden projects used as long-term integration fixtures
- docs/: architecture, development, and roadmap documentation

## Golden projects

The examples directory contains minimal but realistic projects that act as long-term integration fixtures.

Current projects include:

- FastAPI
- React
- NestJS
- Django
- Spring Boot

## Testing

The scanner includes integration tests for each golden project (including the
deterministic project-graph edges); the ai package has unit tests for `FileLesson`/
`PracticePlan` response validation and the OpenAI provider (against a mocked
network layer — no real API key needed); the vscode-extension package tests the
graph view-model and layout algorithm directly, plus the actual React Flow
canvas mounted in a real DOM via jsdom (verifying render, click-to-select, and
the clutter-filter toggle all actually work, not just that the code compiles).

Current status:

- 128 scanner integration tests
- 23 ai package tests
- 20 vscode-extension tests
- 0 failures

## Running the project

```bash
pnpm install
pnpm build
pnpm --filter @tmpt/scanner test:integration
pnpm --filter @tmpt/ai test:integration
pnpm --filter @tmpt/vscode-extension test:integration
```

## Roadmap

### Completed

- ✅ Level 0 — Monorepo Architecture
- ✅ Level 1 — Project Scanner
  - Filesystem
  - Languages
  - Frameworks
  - Infrastructure
  - Dependencies
- ✅ Starting File Discovery Engine (Milestone 2, deterministic)
- ✅ Guided Project Tour (Milestone 3 — first AI feature and first real teaching experience; per-file lessons grounded in real code, no chat, no quizzes)
- ✅ Interactive Learning Graph (Milestone 4 — verified scanner imports plus a clearly distinguished deterministic learning path, rendered with React Flow; a standalone `graph` package with richer code relationship types is still open)

### Upcoming

- 🔜 Level 2 — Project Graph (partially delivered — see Milestone 4)
- 🔜 Level 3 — Concept Usage
- 🔜 Level 4 — Developer Profile
- 🔜 Level 5 — Gap Engine
- 🔜 Level 6 — Learning Recommendation
- 🔜 Level 7 — Explain Engine
- 🔜 Level 8 — Learning Progress
- 🔜 Level 9 — Today Goal

## Engineering principles

TMTP is being built around a few core principles:

- modular pipeline architecture
- deterministic analysis before AI
- registry-based detectors
- evidence-based detection
- reusable analysis engine
- IDE-independent backend

## Future vision

The scanner is only the first component of TMTP. Over time, the project will transform raw repository analysis into a concept-aware understanding of a software project, and AI will be used only after deterministic analysis has established a reliable foundation.
