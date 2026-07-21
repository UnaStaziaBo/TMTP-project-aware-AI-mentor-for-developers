# Changelog

All notable changes to TMTP will be documented in this file.

The project currently uses semantic versioning for its packages and VS Code extension. This changelog begins with the first packaged public preview; earlier repository history remains available through Git.

## Unreleased

### Added

- Anthropic Claude and Google Gemini as alternatives to OpenAI for guided lessons and practice generation.
- Provider selection, provider-specific default models, connection testing, and separately stored API keys in the AI settings screen.

## [0.1.0] — Public preview

### Added

- Deterministic six-stage repository analysis for filesystem structure, languages, frameworks, infrastructure, dependencies, and starting files.
- Evidence and confidence values for detected project technologies.
- Ranked starting-file recommendations with explainable scoring reasons.
- Verified project-local import relationships for supported TypeScript/JavaScript and Python patterns.
- Interactive Project Graph with Core, Related, and All Files scopes, search, routed layout, relationship highlighting, and a separately labelled recommended lesson sequence.
- Guided Project Tour grounded in each selected file's real content, detected primary language, and scanner evidence.
- Project Context and Key Construct explanations covering project role, language usage, and architectural rationale.
- Native, collapsible in-editor commentary with persistent read/unread state and automatic removal after source edits.
- Learning Readiness Check based on the developer's confidence in toured files.
- Confidence-weighted Day 1 Practice and focused per-file architectural scenarios.
- Deterministically controlled practice answers, options, ordering, and difficulty, with AI used only for scenario and explanation prose.
- Persistent per-workspace progress for explained, read, practised, and mastered files.
- Activity Bar Learning Home with project status, progress, navigation, AI configuration status, and focused-practice entry points.
- OpenAI API configuration with API keys stored in VS Code SecretStorage.

### Current limitations

- Multi-root workspaces analyze only the first workspace folder.
- Import graph extraction is limited to supported TypeScript/JavaScript and Python patterns.
- Technology and dependency detection is heuristic.
- Progress is file-level and does not yet represent a concept-level developer profile or knowledge-gap model.
- This repository does not yet include an open-source license file.
