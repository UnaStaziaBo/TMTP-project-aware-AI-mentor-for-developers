# TMTP

Teach Me This Project (TMTP) is an open-source, project-aware learning engine for software developers.

TMTP is designed to help developers understand unfamiliar codebases by grounding guidance in the structure, technologies, and conventions of the project itself. At this stage, the project is focused on establishing a solid foundation for future capabilities rather than shipping full product features.

## Why TMTP exists

Most developer learning tools are generic and disconnected from the actual repository a person is working in. TMTP aims to change that by creating a system that can interpret a project’s context and provide project-specific learning support over time.

The project exists to make onboarding, code exploration, and skill development more structured, more contextual, and more useful for real development work.

## Vision

The long-term vision for TMTP is simple:

- help developers understand a codebase faster
- make project-specific learning more actionable
- reduce the friction of onboarding into unfamiliar systems
- build a reusable architecture that can evolve with new capabilities

## Architecture overview

TMTP is organized as a TypeScript monorepo with a clear separation between client-facing surfaces and core platform logic.

- Apps provide user-facing entry points.
- Packages contain reusable core logic.
- Shared code holds common contracts and utilities.
- Examples act as reference repositories for testing and documentation.

## Repository structure

```text
TMTP/
├── apps/
│   └── vscode-extension/
├── packages/
│   ├── scanner/
│   └── shared/
├── examples/
│   ├── fastapi-demo/
│   ├── react-demo/
│   ├── spring-demo/
│   ├── nestjs-demo/
│   └── django-demo/
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── roadmap.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── tsconfig.base.json
```

## Development philosophy

TMTP is being built with a deliberately careful and extensible approach:

- keep the core architecture modular and deterministic
- avoid coupling core logic to AI providers
- favor explicit package boundaries over hidden dependencies
- document planned work clearly so the project remains understandable
- build the foundation before adding advanced learning features

## Current project status

The repository currently contains the foundation architecture for the project.

### Implemented

- a TypeScript-based monorepo structure
- workspace-level package management with pnpm
- a VS Code extension application shell
- a scanner package scaffold
- a shared package scaffold
- example repository folders for future testing and demos
- initial documentation files

### Planned

- real repository scanning logic
- project graph construction
- concept and usage analysis
- developer profile modeling
- recommendation and explanation engines
- learning progress and goal tracking

## Roadmap summary

The project is currently moving from foundation to product-oriented capabilities. The immediate focus is on building a reliable scanner and the project graph layer that will support later learning features.
