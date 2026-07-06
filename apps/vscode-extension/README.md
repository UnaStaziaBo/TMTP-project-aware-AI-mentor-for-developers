# TMTP VS Code Extension

The first visual surface for TMTP. On activation, it runs the deterministic
`@tmpt/scanner` pipeline against the open workspace folder and shows the
results — the five pipeline stages, detected languages/frameworks/
infrastructure/dependencies with confidence and evidence, and a file-type
breakdown — in a themed webview panel.

No AI, no learning features, no new scanner stages: this package only
visualizes the existing `ProjectScanResult`.

## Running it

Open the repo root in VS Code and press F5 (`Run TMTP Extension`). This
builds the extension and webview bundles and launches an Extension
Development Host with a workspace folder open, so the overview panel appears
immediately.

To reopen the panel manually, run the `TMTP: Show Project Overview` command.

## Structure

- `src/extension.ts` — activation, runs each pipeline stage in turn and
  streams progress to the webview.
- `src/webview/main.ts` — renders the webview UI from the streamed messages.
- `src/protocol.ts` — message types shared between the two.
- `scripts/build.mjs` — esbuild bundling for both the extension host
  (CommonJS, Node) and the webview (browser IIFE) entry points.
