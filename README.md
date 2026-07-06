# TMTP

Teach Me This Project (TMTP) is a project-aware AI mentor for software developers.

Unlike traditional coding assistants that begin from a prompt, TMTP first understands the software project itself. It analyzes the repository structure, technologies, conventions, and dependencies before offering guidance, so learning support is grounded in the actual codebase.

TMTP is an early open-source project with three completed milestones: a deterministic project analysis pipeline, a starting-file discovery engine that ranks which files a developer should read first, and — the first AI-powered feature — a Guided Project Tour that walks a developer through those files one at a time, grounded entirely in that deterministic analysis.

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

### Milestone 3: AI Guided Project Tour

The first AI-powered feature — a single, one-shot generation, not a chat. Instead of
answering "what technologies are in this project?", it answers "come with me, I'll
show you this project": a senior-developer-style walkthrough, one file at a time, in
the order the deterministic Starting File Discovery engine already ranked them. The
scanner itself is untouched by this milestone.

- ✅ AI Guided Project Tour (`packages/ai`)
  - provider abstraction (`AIProvider`) with an OpenAI implementation — designed
    so a second provider is a new implementation, not a call-site change
  - API key stored only in VS Code SecretStorage, never in settings.json, never
    sent to the webview — the webview only ever learns whether a provider is configured
  - structured JSON response (`GuidedTour`: an introduction plus an ordered list of
    `TourStop`s), shape-validated on the way in
  - "never invent files, never reorder the ranking": any stop referencing a file
    outside the deterministic `startingFiles` list is silently dropped, and the
    surviving stops are re-sorted to match the scanner's own ranking regardless of
    what order the model produced
  - one stop shown at a time, with a "Stop N of M" stepper and an **Open File**
    button that opens that exact file in the editor — no manual searching
  - idempotent: cached until the user explicitly regenerates
  - ends with a placeholder "Begin Learning →" step for the next milestone — inert,
    not wired to anything yet

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
has unit tests for the deterministic context builder, response validation, and
the OpenAI provider (against a mocked network layer — no real API key needed).

Current status:

- 123 scanner integration tests
- 18 ai package tests
- 0 failures

## Running the project

```bash
pnpm install
pnpm build
pnpm --filter @tmpt/scanner test:integration
pnpm --filter @tmpt/ai test:integration
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
- ✅ AI Guided Project Tour (Milestone 3 — first AI feature; one-shot, no chat, no lessons)

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
