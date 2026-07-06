# @tmpt/ai

The AI provider abstraction for TMTP. This is the first package in the monorepo
that talks to an AI provider — the scanner remains fully deterministic and has
no dependency on this package; the dependency only goes one way.

## What it does

- `buildAIContext` — builds the exact, bounded, deterministic payload sent to
  an AI provider from an existing `ProjectScanResult`. No re-analysis: it only
  reshapes data the scanner already computed.
- `AIProvider` — the interface future providers implement (`testConnection`,
  `generateGuidedTour`). `OpenAIProvider` is the first implementation.
- `parseGuidedTour` — shape-validates a raw AI response into a `GuidedTour`
  (an introduction plus an ordered list of `TourStop`s), throwing
  `InvalidAIResponseError` on a fundamentally malformed response. Individual
  malformed stops are dropped rather than failing the whole tour, and a
  missing introduction falls back to `DEFAULT_INTRODUCTION`.
- `groundTourStops` — enforces "never invent files, never reorder the
  ranking": any stop referencing a file outside the `startingFiles` the model
  was given is silently dropped, and the survivors are re-sorted to match the
  scanner's own ranking — regardless of what order the model produced.

## What it deliberately doesn't do

No lessons, quizzes, exercises, or learning progression — this package only
guides a tour of the project, once per generation. No conversation state: each
generation is a single request/response, and caching/idempotency is the
caller's responsibility (see the VS Code extension's `extension.ts`).

## Testing

Tests are unit-level and don't require a real API key: `OpenAIProvider` is
tested against a mocked `fetch`, and `buildAIContext` is tested against the
real scanner output for the golden example projects.
