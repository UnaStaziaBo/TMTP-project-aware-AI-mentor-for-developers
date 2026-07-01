# Development Guide

This guide covers the current development workflow for TMTP and outlines how contributors can work with the repository in its present form.

## Prerequisites

Before working with the repository, make sure you have:

- Node.js installed
- pnpm installed
- a terminal with access to the repository root

## Install dependencies

From the repository root, run:

```bash
pnpm install
```

## Build the workspace

To build the current workspace packages, run:

```bash
pnpm build
```

This uses the workspace-level build script defined in the repository root.

## Workspace structure

The repository is organized as a pnpm workspace:

- apps/: user-facing applications
- packages/: reusable core packages
- examples/: sample projects for future demos and validation
- docs/: architecture and contributor documentation

## Coding conventions

The current codebase is intentionally lightweight and should remain easy to follow.

Recommended conventions:

- use TypeScript for all implementation work
- keep packages focused and modular
- prefer explicit interfaces and contracts over implicit behavior
- avoid introducing AI dependencies into the core architecture
- keep documentation aligned with actual implementation status

## How to add a new package

To add a new package to the monorepo:

1. create a new folder under packages/
2. add a package manifest with a unique package name
3. add the package to the pnpm workspace if needed
4. add a TypeScript configuration for the package
5. document the package responsibility in the architecture docs

Keep new packages small and focused on a single concern.

## How to create a detector

The scanner package is the intended place for detectors. A detector should:

- focus on a single technology or project signal
- expose a clear interface for discovery
- remain independent from UI concerns
- avoid direct coupling to AI services

At this stage, detector implementations are still planned work. The package structure is ready for future expansion.

## How to run examples

The examples directory contains starter repositories that may be used for future testing and demonstrations.

To work with them:

1. open an example directory
2. inspect its repository structure
3. use it as a sample project input for scanner-related development

Examples are currently reference material rather than fully integrated test harnesses.
