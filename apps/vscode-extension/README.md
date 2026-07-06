# TMTP VS Code Extension

The visual surface for TMTP. On activation, it runs the deterministic
`@tmpt/scanner` pipeline against the open workspace folder and streams the
results into a themed webview panel with three screens:

- **Project Overview** — the six pipeline stages, detected languages/
  frameworks/infrastructure/dependencies with confidence and evidence, and a
  file-type breakdown.
- **🚀 Where Should You Start?** — the ranked `startingFiles` candidates from
  the Starting File Discovery stage, each with its confidence and the plain
  deterministic reasons it was recommended.
- **✨ Guided Tour** — configure an OpenAI API key (stored only in VS Code's
  SecretStorage) and generate a one-shot Guided Project Tour via `@tmpt/ai`:
  a senior-developer-style walkthrough that visits the ranked starting files
  one at a time — "come with me, I'll show you this project," not a repo
  summary. Each stop has an **Open File** button that opens that exact file in
  the editor. Not a chat: one generation, cached until you explicitly
  regenerate, grounded entirely in the deterministic `ProjectScanResult` — a
  stop can never reference a file that doesn't exist, and stops always follow
  the scanner's own ranking order regardless of what the model produced. Ends
  with an inert "Begin Learning →" placeholder for a future milestone.

No chat, no lessons, no quizzes, no learning progression yet — that's future
milestones. The scanner itself has no AI dependency.

## Running it

Open the repo root in VS Code and press F5 (`Run TMTP Extension`). This
builds the extension and webview bundles and launches an Extension
Development Host with a workspace folder open, so the overview panel appears
immediately.

To reopen the panel manually, run the `TMTP: Show Project Overview` command.

## Structure

- `src/extension.ts` — activation, runs each pipeline stage in turn, streams
  progress to the webview, orchestrates AI generation (config lookup, provider
  call, grounding, caching), and opens a stop's file on request. Never sends
  the API key to the webview.
- `src/ai/aiConfig.ts` — reads/writes the AI provider config: the API key goes
  only into `context.secrets`; the non-secret provider/model choice goes into
  `context.globalState` (never `settings.json`).
- `src/webview/main.ts` — renders the webview UI from the streamed messages.
- `src/protocol.ts` — message types shared between the two.
- `scripts/build.mjs` — esbuild bundling for both the extension host
  (CommonJS, Node) and the webview (browser IIFE) entry points.
