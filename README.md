# TMTP

Teach Me This Project (TMTP) is a project-aware AI mentor for software developers.

Unlike traditional coding assistants that begin from a prompt, TMTP first understands the software project itself. It analyzes the repository structure, technologies, conventions, and dependencies before offering guidance, so learning support is grounded in the actual codebase.

TMTP is an early open-source project with three completed milestones: a deterministic project analysis pipeline, a starting-file discovery engine, and a Guided Project Tour that turns the ranked starting files themselves into the textbook — teaching a project's architecture and its primary language together, one real file at a time.

## Why TMTP exists

Most developer tools provide generic answers without understanding the project context. TMTP aims to change that by building a reusable analysis engine that can later support personalized learning, onboarding help, and concept-based guidance.

The long-term vision is to build:

- a Project Graph
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
- packages/: reusable core packages
  - scanner/: the deterministic project analysis engine (no AI dependency)
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

The scanner includes integration tests for each golden project; the ai package
has unit tests for `FileLesson` response validation and the OpenAI provider
(against a mocked network layer — no real API key needed).

Current status:

- 123 scanner integration tests
- 14 ai package tests
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
- ✅ Starting File Discovery Engine (Milestone 2, deterministic — ships ahead of the Project Graph below)
- ✅ Guided Project Tour (Milestone 3 — first AI feature and first real teaching experience; per-file lessons grounded in real code, no chat, no quizzes)

### Upcoming

- 🔜 Level 2 — Project Graph
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
