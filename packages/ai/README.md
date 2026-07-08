# @tmpt/ai

The AI provider abstraction for TMTP. This is the first package in the monorepo
that talks to an AI provider — the scanner remains fully deterministic and has
no dependency on this package; the dependency only goes one way.

## What it does

- `AIProvider` — the interface future providers implement (`testConnection`,
  `generateFileLesson`). `OpenAIProvider` is the first implementation.
- `generateFileLesson` — given a `FileLessonContext` (a single file's path,
  full real content, detected language, and the scanner's deterministic
  reasons for flagging it as a starting point), produces a `FileLesson`: a
  short project-context summary (`title` + `responsibility`) followed by an
  ordered list of `keyConstructs`. Each construct carries a snippet copied
  verbatim from the file plus three explanations of it — `project`,
  `language`, and `architecture` — so every explanation stays grounded in
  this specific file rather than drifting into generic language teaching.
- `parseFileLesson` — shape-validates a raw AI response into a `FileLesson`,
  throwing `InvalidAIResponseError` on a fundamentally malformed response
  (missing title/responsibility, or a key construct missing one of its three
  explanations).

## What it deliberately doesn't do

No quizzes, no practice exercises, no global progress tracking — this package
generates one file's lesson at a time, and caching/idempotency is the
caller's responsibility (see the VS Code extension's `extension.ts`). It
never decides which files exist or which file to explain next — the caller
picks the file and passes in its content.

## Testing

Tests are unit-level and don't require a real API key: `OpenAIProvider` is
tested against a mocked `fetch`, and `parseFileLesson` is tested against both
well-formed and malformed AI responses.
