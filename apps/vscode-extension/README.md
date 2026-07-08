# TMTP VS Code Extension

The visual surface for TMTP. On activation, it runs the deterministic
`@tmpt/scanner` pipeline against the open workspace folder and streams the
results into a themed webview panel with three screens:

- **Project Overview** — the six pipeline stages, detected languages/
  frameworks/infrastructure/dependencies with confidence and evidence, and a
  file-type breakdown.
- **🚀 Where Should You Start?** — the ranked `startingFiles` candidates from
  the Starting File Discovery stage, each with its confidence, the plain
  deterministic reasons it was recommended, an **Open File** button, and an
  **Explain** button that jumps straight into the Guided Tour at that file.
- **✨ Guided Tour** — configure an OpenAI API key (stored only in VS Code's
  SecretStorage), then step through the same ranked starting files one at a
  time. Each file's lesson is generated on demand via `@tmpt/ai`'s
  `generateFileLesson` and grounded entirely in that file's real content:
  Step 1 explains the file's project context (what it's responsible for,
  where it fits, why it exists) before any code is shown; Step 2 walks
  through only the handful of code constructs that matter, each with a real
  snippet and three explanations — Project, Language, Architecture — so the
  reader learns the language through what this project's own code actually
  does with it. **Previous** / **Next** move across the same ranked list (no
  separate AI-invented stop order), **Open File** opens the current file in
  the editor, and **Return to Overview** switches back to the Project
  Overview tab. Lessons are cached per file (in memory and in
  `workspaceState`) so revisiting a file, or reopening the panel, never
  re-bills the same generation.

No chat, no quizzes, no practice exercises, no global progress tracking yet —
that's future milestones. The scanner itself has no AI dependency.

## Running it

Open the repo root in VS Code and press F5 (`Run TMTP Extension`). This
builds the extension and webview bundles and launches an Extension
Development Host with a workspace folder open, so the overview panel appears
immediately.

To reopen the panel manually, run the `TMTP: Show Project Overview` command.

## Structure

- `src/extension.ts` — activation, runs each pipeline stage in turn, streams
  progress to the webview, generates a file's lesson on request (config
  lookup, provider call, caching), and opens a file on request. Never sends
  the API key to the webview.
- `src/ai/aiConfig.ts` — reads/writes the AI provider config: the API key goes
  only into `context.secrets`; the non-secret provider/model choice goes into
  `context.globalState` (never `settings.json`).
- `src/languageProfile.ts` — `determinePrimaryLanguage`: picks the scanner's
  own highest-confidence detected language name, so the AI knows which
  language it's teaching. No AI involved, no predefined concept catalog —
  the lesson's content comes from reading the file, not a whitelist.
- `src/webview/main.ts` — renders the webview UI from the streamed messages.
- `src/protocol.ts` — message types shared between the two.
- `scripts/build.mjs` — esbuild bundling for both the extension host
  (CommonJS, Node) and the webview (browser IIFE) entry points.
