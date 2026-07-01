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

The scanner package is the first foundational package and is intended to own project discovery and technology detection. At the current stage, it contains a minimal scaffold and does not yet implement scanning behavior.

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

## Dependency flow between packages

The current dependency flow is intentionally simple:

- the VS Code extension may depend on platform packages for data and services
- the scanner package provides project-level detection capabilities
- shared package contains reusable contracts that other packages may depend on

The system is designed to avoid circular dependencies and to keep package boundaries clear.

## Future package architecture

The current layout is a starting point for a larger system. Planned package responsibilities may include:

- scanner: detect technologies and inspect project structure
- graph: represent project relationships and dependencies
- concepts: identify concepts and usage patterns
- profile: model developer behavior and interests
- gap-engine: identify missing knowledge or skill gaps
- recommendations: suggest learning content and next steps
- explain: explain project structure and concepts in context
- progress: track learning progression over time

These packages are planned directions rather than implemented modules.
