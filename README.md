# TMTP

Teach Me This Project (TMTP) is a project-aware AI mentor for software developers.

Unlike traditional coding assistants that begin from a prompt, TMTP first understands the software project itself. It analyzes the repository structure, technologies, conventions, and dependencies before offering guidance, so learning support is grounded in the actual codebase.

TMTP is an early open-source project with a completed first milestone: a deterministic project analysis pipeline that can inspect repositories and produce a structured understanding of them.

## Why TMTP exists

Most developer tools provide generic answers without understanding the project context. TMTP aims to change that by building a reusable analysis engine that can later support personalized learning, onboarding help, and concept-based guidance.

The long-term vision is to build:

- a Project Graph
- a Developer Profile
- knowledge-gap detection
- personalized learning recommendations
- explainable guidance grounded in the repository

## Current milestone: Project Analysis Pipeline v0.1

The first milestone is complete.

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
ProjectScanResult
```

This design keeps the analysis reusable, IDE-independent, and easy to extend. The scanner is intentionally deterministic and does not depend on AI for core project analysis.

## Repository structure

- apps/: user-facing applications such as the VS Code extension
- packages/: reusable core packages
  - scanner/: the project analysis engine
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

The scanner currently includes integration tests for each golden project.

Current status:

- 105 integration tests
- 0 failures

## Running the project

```bash
pnpm install
pnpm build
pnpm --filter @tmpt/scanner test:integration
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
