# Architecture

This document describes the current architecture of TMTP as it exists in this repository. The focus is on the foundation layer and the intended separation of responsibilities.

## Why the monorepo was chosen

TMTP uses a monorepo structure because the project combines several related concerns that are easier to evolve together:

- a client application in the VS Code extension
- reusable packages for scanning and shared logic
- examples that demonstrate the project in practice
- documentation and contributor guidance that should stay close to the code

A monorepo keeps these parts aligned while avoiding unnecessary duplication and making cross-package changes easier to coordinate.

## Responsibility of apps/

The apps directory is reserved for user-facing entry points.

At the moment, the VS Code extension is the only application in this space. Its role is to act as a client surface for the underlying platform rather than as the home of core business logic.

This keeps the extension lightweight and makes it easier to support future interfaces later if needed.

## Responsibility of packages/

The packages directory contains the core architecture of TMTP.

### scanner

The scanner package owns project discovery and technology detection through a
deterministic pipeline (filesystem → language → framework → infrastructure →
dependency → starting-file discovery). Each stage enriches the same
`ProjectScanResult` object; no stage depends on AI. The starting-file stage's
import resolver also produces `projectGraph.edges` — a deterministic, verified
set of local import relationships between files, used to visualize the
project as an explorable graph rather than a flat list.

### ai

The ai package is the first (and, so far, only) package that talks to an AI
provider. It depends on scanner's *types* only — the dependency is strictly
one-directional, and the scanner has no knowledge that this package exists.
Its job is narrow: generate a lesson or a practice scenario from a
deterministic context the caller assembled, and validate/shape the response
that comes back. It never decides which files exist, which concepts a
language has, or which files to recommend — those all come from the
deterministic packages and callers.

### shared

The shared package is intended to hold reusable contracts, types, and utilities that may be used by multiple packages. In the current state, it is intentionally minimal and serves as a place for future shared abstractions.

## Why the VS Code extension is only a client

The VS Code extension is treated as a client layer rather than the primary home of the product logic.

This design keeps the core architecture portable and reusable. The extension can surface information and interact with the user, but the real analysis and reasoning layers live in the packages. That makes the system easier to evolve beyond VS Code if needed.

## Why AI is intentionally excluded from the core architecture

TMTP is intentionally structured so that the core platform does not depend on AI as a prerequisite for its architecture.

This is important for three reasons:

- the foundation should be deterministic and predictable
- the platform should remain understandable and debuggable
- AI can be layered in later as an optional capability rather than a core dependency

In other words, the architecture is being designed to support AI-enhanced experiences in the future without making AI the foundation of the product.

This has held up in practice: the `ai` package now exists and generates real
lessons and practice scenarios, but the scanner still has zero knowledge of
it, and every AI generation is handed a context object built entirely from
data the deterministic pipeline already produced (file content, detected
language, starting-file scores and reasons). The Interactive Project Graph is
a further example — the graph itself (which files, which relationships, how
important each one is) is 100% deterministic scanner output; AI is not
involved in deciding what the graph looks like at all.

## Dependency flow between packages

The current dependency flow is intentionally simple:

- the VS Code extension may depend on platform packages for data and services
- the scanner package provides project-level detection capabilities
- shared package contains reusable contracts that other packages may depend on

The system is designed to avoid circular dependencies and to keep package boundaries clear.

## Future package architecture

The current layout is a starting point for a larger system. Planned package responsibilities may include:

- scanner: detect technologies and inspect project structure ✅ implemented
- ai: generate lessons and practice content from deterministic context ✅ implemented
- graph: represent project relationships and dependencies — delivered
  differently than originally planned here. Rather than a standalone package,
  the deterministic edges live directly in the scanner (reusing its existing
  import resolver at zero extra cost) and the visualization lives in the
  extension (React Flow, isolated to one screen). A standalone package may
  still make sense if relationship types grow beyond simple imports (e.g. a
  real call graph or execution flow), but there was no reason to introduce one
  before that need existed.
- concepts: identify concepts and usage patterns
- profile: model developer behavior and interests
- gap-engine: identify missing knowledge or skill gaps
- recommendations: suggest learning content and next steps
- explain: explain project structure and concepts in context
- progress: track learning progression over time — partially exists today as
  simple per-file learning status (explained/practiced/mastered), not yet a
  dedicated package.

The unimplemented items above are still planned directions, not implemented modules.
