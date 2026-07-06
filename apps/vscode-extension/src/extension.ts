import * as vscode from 'vscode';
import path from 'node:path';
import {
  FilesystemStage,
  LanguageStage,
  FrameworkStage,
  InfrastructureStage,
  DependencyStage,
  StartingFileStage,
  type PipelineStage,
  type ProjectScanResult,
} from '@tmpt/scanner';
import { buildAIContext, groundTourStops, OpenAIProvider, type GuidedTour } from '@tmpt/ai';
import { getAIConfig, saveAIConfig } from './ai/aiConfig.js';
import { STAGES, type ExtensionMessage, type StageKey, type WebviewMessage } from './protocol.js';

const GUIDED_TOUR_CACHE_KEY = 'tmtp.ai.lastGuidedTour';

let panel: vscode.WebviewPanel | undefined;
let latestResult: ProjectScanResult | undefined;
let cachedTour: GuidedTour | undefined;

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
    case 'startingFiles':
      return new StartingFileStage(projectPath);
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
    startingFiles: [],
  };

  try {
    for (const stage of STAGES) {
      const stageStarted = performance.now();
      result = await makeStage(stage.key, projectPath).execute(result);
      post({ type: 'stageComplete', stage: stage.key, elapsedMs: performance.now() - stageStarted, result });
    }
    latestResult = result;
    post({ type: 'scanComplete', totalElapsedMs: performance.now() - started });
  } catch (error) {
    post({ type: 'scanError', message: error instanceof Error ? error.message : String(error) });
  }
}

async function postAIConfigStatus(
  context: vscode.ExtensionContext,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  const stored = await getAIConfig(context);
  post({
    type: 'aiConfigStatus',
    configured: stored !== undefined,
    provider: stored?.config.provider,
    model: stored?.config.model,
  });
}

async function generateTour(
  context: vscode.ExtensionContext,
  post: (message: ExtensionMessage) => void,
  force: boolean,
): Promise<void> {
  if (!latestResult) {
    post({ type: 'aiError', message: 'Run a scan before generating a tour.' });
    return;
  }

  if (!force && cachedTour) {
    post({ type: 'aiResult', tour: cachedTour, cached: true });
    return;
  }

  const stored = await getAIConfig(context);
  if (!stored) {
    post({ type: 'aiError', message: 'Configure an AI provider first.' });
    return;
  }

  post({ type: 'aiGenerating' });

  try {
    const projectName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'this project';
    const aiContext = buildAIContext(projectName, latestResult);
    const provider = new OpenAIProvider();
    const raw = await provider.generateGuidedTour(aiContext, {
      apiKey: stored.apiKey,
      model: stored.config.model,
    });
    const tour = groundTourStops(raw, aiContext.startingFiles);

    cachedTour = tour;
    await context.workspaceState.update(GUIDED_TOUR_CACHE_KEY, tour);
    post({ type: 'aiResult', tour, cached: false });
  } catch (error) {
    post({ type: 'aiError', message: error instanceof Error ? error.message : String(error) });
  }
}

async function openTourFile(file: string, post: (message: ExtensionMessage) => void): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    post({ type: 'aiError', message: 'No workspace folder is open.' });
    return;
  }

  try {
    const uri = vscode.Uri.file(path.join(folder.uri.fsPath, file));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  } catch (error) {
    post({ type: 'aiError', message: error instanceof Error ? error.message : String(error) });
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
    switch (message.type) {
      case 'ready':
      case 'rescan':
        startScan();
        void postAIConfigStatus(context, post);
        break;
      case 'aiTestConnection':
        void new OpenAIProvider()
          .testConnection({ apiKey: message.apiKey, model: message.model })
          .then((result) => post({ type: 'aiTestResult', result }));
        break;
      case 'aiSaveConfig':
        void saveAIConfig(context, 'openai', message.model, message.apiKey).then(() =>
          postAIConfigStatus(context, post),
        );
        break;
      case 'aiGenerate':
        void generateTour(context, post, false);
        break;
      case 'aiRegenerate':
        void generateTour(context, post, true);
        break;
      case 'openFile':
        void openTourFile(message.file, post);
        break;
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

export function activate(context: vscode.ExtensionContext): void {
  cachedTour = context.workspaceState.get<GuidedTour>(GUIDED_TOUR_CACHE_KEY);

  context.subscriptions.push(
    vscode.commands.registerCommand('tmtp.showOverview', () => openOverviewPanel(context)),
  );

  openOverviewPanel(context);
}

export function deactivate(): void {
  panel?.dispose();
}
