# @tmpt/ai

The AI provider abstraction for TMTP. This is the first package in the monorepo
that talks to an AI provider — the scanner remains fully deterministic and has
no dependency on this package; the dependency only goes one way.

## What it does

- `AIProvider` — the shared interface implemented by `OpenAIProvider`,
  `AnthropicProvider`, and `GeminiProvider` (`testConnection`,
  `generateFileLesson`, `generatePracticePlan`). `createAIProvider` selects the
  configured implementation without changing lesson or practice call sites.
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
- `generatePracticePlan` — fills deterministic scenario slots prepared by the
  caller. Each slot specifies `file` (the correct answer), available options,
  and difficulty. Focused exercises may also specify `learningFile`, the file
  the developer chose to study; it intentionally does not have to equal the
  correct answer. The AI writes situation/explanation prose about that file's
  architectural boundaries but cannot substitute files or change the plan.
- `parsePracticePlan` — validates scenario count, options, correct answers, and
  explanatory text against the caller's `ScenarioFocus` contracts. The parser
  copies options and correct answers from those contracts, never from AI output.

## Practice-plan contract

```ts
interface ScenarioFocus {
  learningFile?: string; // file being studied in focused practice
  file: string;          // correct answer for this scenario
  options: string[];     // deterministic displayed choices
  difficulty: 'intro' | 'intermediate' | 'advanced';
}
```

For tour-wide practice, `file` is weighted toward files the developer rated
least confidently. For focused practice, the client rotates `file` across the
selected learning file and related choices, while retaining `learningFile` as
the pedagogical subject. The prompt is therefore asked to test ownership,
delegation, callers, and neighboring responsibilities—not to repeatedly make
the selected file the obvious answer.

## What it deliberately doesn't do

This package does not scan repositories, choose starting files, create graph
relationships, decide the recommended learning order, store progress, or own
caching. Those responsibilities remain deterministic scanner/client concerns.
It generates grounded lesson text and practice-scenario prose only after the
caller supplies real files and a constrained plan. Caching/idempotency is the
caller's responsibility (see the VS Code extension's `extension.ts`).

## Testing

Tests are unit-level and don't require a real API key: all three provider
adapters are tested against a mocked `fetch`; lesson and practice parsers are tested against
well-formed and malformed responses; and correct answers/options are verified
to remain controlled by deterministic `ScenarioFocus` input.
