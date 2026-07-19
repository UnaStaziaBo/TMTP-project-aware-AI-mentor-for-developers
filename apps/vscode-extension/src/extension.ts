import * as vscode from 'vscode';
import path from 'node:path';
import { promises as fs } from 'node:fs';
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
import { OpenAIProvider, type FileLesson, type FileSummary, type PracticePlan } from '@tmpt/ai';
import { getAIConfig, saveAIConfig } from './ai/aiConfig.js';
import { determinePrimaryLanguage } from './languageProfile.js';
import { buildScenarioPlan, buildSingleFileScenarioPlan } from './practicePlanner.js';
import { TmtpSidebarProvider, type SidebarSnapshot } from './sidebarView.js';
import { STAGES, type ExtensionMessage, type FileConfidence, type StageKey, type WebviewMessage, type WorkspaceTab } from './protocol.js';

const FILE_LESSON_CACHE_KEY = 'tmtp.ai.fileLessons';
const PRACTICE_PLAN_CACHE_KEY = 'tmtp.ai.practicePlan';
const FILE_PRACTICE_CACHE_KEY = 'tmtp.ai.filePractice';
const LEARNING_PROGRESS_CACHE_KEY = 'tmtp.ai.learningProgress';

let panel: vscode.WebviewPanel | undefined;
let latestResult: ProjectScanResult | undefined;
let fileLessonCache = new Map<string, FileLesson>();
let practicePlanCache: { signature: string; plan: PracticePlan } | undefined;
let filePracticeCache = new Map<string, PracticePlan>();
let practicedFiles = new Set<string>();
let masteredFiles = new Set<string>();
let sidebarProvider: TmtpSidebarProvider | undefined;
let activeContext: vscode.ExtensionContext | undefined;
let requestedTab: WorkspaceTab = 'overview';
let requestedAIConfig = false;

async function refreshSidebar(): Promise<void> {
  if (!sidebarProvider || !activeContext) return;
  const folder = vscode.workspace.workspaceFolders?.[0];
  const aiConfigured = (await getAIConfig(activeContext)) !== undefined;
  const snapshot: SidebarSnapshot = {
    projectName: folder?.name ?? '',
    scanned: latestResult !== undefined,
    fileCount: latestResult?.files.length ?? 0,
    startingFileCount: latestResult?.startingFiles.length ?? 0,
    explainedCount: fileLessonCache.size,
    practicedCount: practicedFiles.size,
    masteredCount: masteredFiles.size,
    aiConfigured,
  };
  sidebarProvider.update(snapshot);
}

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
    projectGraph: { edges: [] },
  };

  try {
    for (const stage of STAGES) {
      const stageStarted = performance.now();
      result = await makeStage(stage.key, projectPath).execute(result);
      post({ type: 'stageComplete', stage: stage.key, elapsedMs: performance.now() - stageStarted, result });
    }
    latestResult = result;
    post({ type: 'scanComplete', totalElapsedMs: performance.now() - started });
    void refreshSidebar();
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

function postLearningProgress(post: (message: ExtensionMessage) => void): void {
  post({
    type: 'learningProgress',
    explained: [...fileLessonCache.keys()],
    practiced: [...practicedFiles],
    mastered: [...masteredFiles],
  });
  void refreshSidebar();
}

async function openFile(file: string, post: (message: ExtensionMessage) => void): Promise<void> {
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

async function handleExplainFile(
  context: vscode.ExtensionContext,
  file: string,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder || !latestResult) {
    post({ type: 'fileLessonError', file, message: 'Run a scan before requesting a lesson.' });
    return;
  }

  const cached = fileLessonCache.get(file);
  if (cached) {
    post({ type: 'fileLessonResult', file, lesson: cached, cached: true });
    return;
  }

  const language = determinePrimaryLanguage(latestResult.languages);
  if (!language) {
    post({ type: 'fileLessonError', file, message: 'No supported primary language was detected for this project.' });
    return;
  }

  const stored = await getAIConfig(context);
  if (!stored) {
    post({ type: 'fileLessonError', file, message: 'Configure an AI provider first.' });
    return;
  }

  post({ type: 'fileLessonGenerating', file });

  try {
    const fileContent = await fs.readFile(path.join(folder.uri.fsPath, file), 'utf8');
    const reasons = latestResult.startingFiles.find((candidate) => candidate.file === file)?.reasons ?? [];
    const provider = new OpenAIProvider();
    const lesson = await provider.generateFileLesson(
      { language, file, fileContent, reasons },
      { apiKey: stored.apiKey, model: stored.config.model },
    );

    fileLessonCache.set(file, lesson);
    await context.workspaceState.update(FILE_LESSON_CACHE_KEY, Object.fromEntries(fileLessonCache));
    post({ type: 'fileLessonResult', file, lesson, cached: false });
    postLearningProgress(post);
  } catch (error) {
    post({ type: 'fileLessonError', file, message: error instanceof Error ? error.message : String(error) });
  }
}

async function handleRequestFilePractice(
  context: vscode.ExtensionContext,
  file: string,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  if (!latestResult) {
    post({ type: 'filePracticeError', file, message: 'Run a scan before requesting practice scenarios.' });
    return;
  }

  const cached = filePracticeCache.get(file);
  if (cached) {
    post({ type: 'filePracticeResult', file, plan: cached, cached: true });
    return;
  }

  const stored = await getAIConfig(context);
  if (!stored) {
    post({ type: 'filePracticeError', file, message: 'Configure an AI provider first.' });
    return;
  }

  post({ type: 'filePracticeGenerating', file });

  try {
    const allFiles = latestResult.startingFiles.map((candidate) => candidate.file);
    const files: FileSummary[] = allFiles.map((f) => {
      const lesson = fileLessonCache.get(f);
      return { file: f, title: lesson?.title ?? f, responsibility: lesson?.responsibility ?? '' };
    });
    const scenarios = buildSingleFileScenarioPlan(file, allFiles);
    const provider = new OpenAIProvider();
    const plan = await provider.generatePracticePlan(
      { files, scenarios },
      { apiKey: stored.apiKey, model: stored.config.model },
    );

    filePracticeCache.set(file, plan);
    await context.workspaceState.update(FILE_PRACTICE_CACHE_KEY, Object.fromEntries(filePracticeCache));
    post({ type: 'filePracticeResult', file, plan, cached: false });
  } catch (error) {
    post({ type: 'filePracticeError', file, message: error instanceof Error ? error.message : String(error) });
  }
}

async function handleRecordPracticeAttempt(
  context: vscode.ExtensionContext,
  file: string,
  correct: boolean,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  practicedFiles.add(file);
  if (correct) {
    masteredFiles.add(file);
  } else {
    masteredFiles.delete(file);
  }
  await context.workspaceState.update(LEARNING_PROGRESS_CACHE_KEY, {
    practiced: [...practicedFiles],
    mastered: [...masteredFiles],
  });
  postLearningProgress(post);
}

async function handleMarkFileLearned(
  context: vscode.ExtensionContext,
  file: string,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  practicedFiles.add(file);
  masteredFiles.add(file);
  await context.workspaceState.update(LEARNING_PROGRESS_CACHE_KEY, {
    practiced: [...practicedFiles],
    mastered: [...masteredFiles],
  });
  postLearningProgress(post);
}

async function handleSubmitConfidenceProfile(
  context: vscode.ExtensionContext,
  ratings: Record<string, FileConfidence>,
  post: (message: ExtensionMessage) => void,
): Promise<void> {
  if (!latestResult) {
    post({ type: 'practicePlanError', message: 'Run a scan before requesting a practice plan.' });
    return;
  }

  // Order deterministically from the scanner's own ranking rather than
  // trusting object-key order carried over postMessage/JSON.
  const touredFiles = latestResult.startingFiles
    .map((candidate) => candidate.file)
    .filter((file) => Object.prototype.hasOwnProperty.call(ratings, file));

  if (touredFiles.length === 0) {
    post({ type: 'practicePlanError', message: 'No toured files to build a practice plan from.' });
    return;
  }

  const signature = JSON.stringify(touredFiles.map((file) => [file, ratings[file]]));
  if (practicePlanCache?.signature === signature) {
    post({ type: 'practicePlanResult', plan: practicePlanCache.plan, cached: true });
    return;
  }

  const stored = await getAIConfig(context);
  if (!stored) {
    post({ type: 'practicePlanError', message: 'Configure an AI provider first.' });
    return;
  }

  post({ type: 'practicePlanGenerating' });

  try {
    const files: FileSummary[] = touredFiles.map((file) => {
      const lesson = fileLessonCache.get(file);
      return { file, title: lesson?.title ?? file, responsibility: lesson?.responsibility ?? '' };
    });
    const scenarios = buildScenarioPlan(touredFiles, ratings);
    const provider = new OpenAIProvider();
    const plan = await provider.generatePracticePlan(
      { files, scenarios },
      { apiKey: stored.apiKey, model: stored.config.model },
    );

    practicePlanCache = { signature, plan };
    await context.workspaceState.update(PRACTICE_PLAN_CACHE_KEY, practicePlanCache);
    post({ type: 'practicePlanResult', plan, cached: false });
  } catch (error) {
    post({ type: 'practicePlanError', message: error instanceof Error ? error.message : String(error) });
  }
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
  const reactFlowStyleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'reactflow.css'),
  );
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${reactFlowStyleUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>TMTP: Project Overview</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function openOverviewPanel(
  context: vscode.ExtensionContext,
  tab: WorkspaceTab = 'overview',
  showAIConfig = false,
): void {
  requestedTab = tab;
  requestedAIConfig = showAIConfig;
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    void panel.webview.postMessage({ type: 'navigateToTab', tab } satisfies ExtensionMessage);
    if (showAIConfig) void panel.webview.postMessage({ type: 'showAIConfig' } satisfies ExtensionMessage);
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
        startScan();
        void postAIConfigStatus(context, post);
        postLearningProgress(post);
        post({ type: 'navigateToTab', tab: requestedTab });
        if (requestedAIConfig) {
          post({ type: 'showAIConfig' });
          requestedAIConfig = false;
        }
        break;
      case 'rescan':
        startScan();
        void postAIConfigStatus(context, post);
        postLearningProgress(post);
        break;
      case 'aiTestConnection':
        void new OpenAIProvider()
          .testConnection({ apiKey: message.apiKey, model: message.model })
          .then((result) => post({ type: 'aiTestResult', result }));
        break;
      case 'aiSaveConfig':
        void saveAIConfig(context, 'openai', message.model, message.apiKey).then(() => {
          void postAIConfigStatus(context, post);
          void refreshSidebar();
        });
        break;
      case 'openFile':
        void openFile(message.file, post);
        break;
      case 'explainFile':
        void handleExplainFile(context, message.file, post);
        break;
      case 'submitConfidenceProfile':
        void handleSubmitConfidenceProfile(context, message.ratings, post);
        break;
      case 'requestFilePractice':
        void handleRequestFilePractice(context, message.file, post);
        break;
      case 'recordPracticeAttempt':
        void handleRecordPracticeAttempt(context, message.file, message.correct, post);
        break;
      case 'markFileLearned':
        void handleMarkFileLearned(context, message.file, post);
        break;
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

export function activate(context: vscode.ExtensionContext): void {
  activeContext = context;
  const storedLessons = context.workspaceState.get<Record<string, FileLesson>>(FILE_LESSON_CACHE_KEY);
  fileLessonCache = new Map(Object.entries(storedLessons ?? {}));
  practicePlanCache = context.workspaceState.get<{ signature: string; plan: PracticePlan }>(PRACTICE_PLAN_CACHE_KEY);
  const storedFilePractice = context.workspaceState.get<Record<string, PracticePlan>>(FILE_PRACTICE_CACHE_KEY);
  filePracticeCache = new Map(Object.entries(storedFilePractice ?? {}));
  const storedProgress = context.workspaceState.get<{ practiced: string[]; mastered: string[] }>(
    LEARNING_PROGRESS_CACHE_KEY,
  );
  practicedFiles = new Set(storedProgress?.practiced ?? []);
  masteredFiles = new Set(storedProgress?.mastered ?? []);

  sidebarProvider = new TmtpSidebarProvider(
    (tab) => openOverviewPanel(context, tab),
    () => openOverviewPanel(context, 'guidedTour', true),
    {
      projectName: vscode.workspace.workspaceFolders?.[0]?.name ?? '',
      scanned: false,
      fileCount: 0,
      startingFileCount: 0,
      explainedCount: fileLessonCache.size,
      practicedCount: practicedFiles.size,
      masteredCount: masteredFiles.size,
      aiConfigured: false,
    },
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tmtp.showOverview', () => openOverviewPanel(context)),
    vscode.window.registerWebviewViewProvider(TmtpSidebarProvider.viewType, sidebarProvider),
  );
  void refreshSidebar();
}

export function deactivate(): void {
  panel?.dispose();
}
