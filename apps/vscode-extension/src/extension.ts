import * as vscode from 'vscode';
import {
  FilesystemStage,
  LanguageStage,
  FrameworkStage,
  InfrastructureStage,
  DependencyStage,
  type PipelineStage,
  type ProjectScanResult,
} from '@tmpt/scanner';
import { STAGES, type ExtensionMessage, type StageKey, type WebviewMessage } from './protocol.js';

let panel: vscode.WebviewPanel | undefined;

function makeStage(key: StageKey, projectPath: string): PipelineStage {
  switch (key) {
    case 'filesystem':
      return new FilesystemStage(projectPath);
    case 'language':
      return new LanguageStage();
    case 'framework':
      return new FrameworkStage();
    case 'infrastructure':
      return new InfrastructureStage();
    case 'dependency':
      return new DependencyStage();
  }
}

async function runScan(projectPath: string, post: (message: ExtensionMessage) => void): Promise<void> {
  const started = performance.now();
  let result: ProjectScanResult = {
    files: [],
    folders: [],
    manifests: [],
    languages: [],
    frameworks: [],
    infrastructure: [],
    dependencies: [],
  };

  try {
    for (const stage of STAGES) {
      const stageStarted = performance.now();
      result = await makeStage(stage.key, projectPath).execute(result);
      post({ type: 'stageComplete', stage: stage.key, elapsedMs: performance.now() - stageStarted, result });
    }
    post({ type: 'scanComplete', totalElapsedMs: performance.now() - started });
  } catch (error) {
    post({ type: 'scanError', message: error instanceof Error ? error.message : String(error) });
  }
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>TMTP: Project Overview</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function openOverviewPanel(context: vscode.ExtensionContext): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'tmtp.overview',
    'TMTP: Project Overview',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  const post = (message: ExtensionMessage) => panel?.webview.postMessage(message);

  const startScan = () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      post({ type: 'noWorkspace' });
      return;
    }
    post({ type: 'scanStarted', projectName: folder.name });
    void runScan(folder.uri.fsPath, post);
  };

  panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
    if (message.type === 'ready' || message.type === 'rescan') {
      startScan();
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tmtp.showOverview', () => openOverviewPanel(context)),
  );

  openOverviewPanel(context);
}

export function deactivate(): void {
  panel?.dispose();
}
