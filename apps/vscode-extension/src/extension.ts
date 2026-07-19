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
import { OpenAIProvider, type FileLesson, type FileSummary, type KeyConstruct, type PracticePlan } from '@tmpt/ai';
import { getAIConfig, saveAIConfig } from './ai/aiConfig.js';
import { determinePrimaryLanguage } from './languageProfile.js';
import { buildScenarioPlan, buildSingleFileScenarioPlan } from './practicePlanner.js';
import { TmtpSidebarProvider, type SidebarSnapshot } from './sidebarView.js';
import { STAGES, type ExtensionMessage, type FileConfidence, type StageKey, type WebviewMessage, type WorkspaceTab } from './protocol.js';

const FILE_LESSON_CACHE_KEY = 'tmtp.ai.fileLessons';
const PRACTICE_PLAN_CACHE_KEY = 'tmtp.ai.practicePlan';
const FILE_PRACTICE_CACHE_KEY = 'tmtp.ai.filePractice';
const LEARNING_PROGRESS_CACHE_KEY = 'tmtp.ai.learningProgress';
const COMMENTARY_READ_CACHE_KEY = 'tmtp.ai.commentaryRead';

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
let requestedPracticeFile: string | undefined;
let commentaryController: vscode.CommentController | undefined;
const commentaryThreads = new Map<string, vscode.CommentThread[]>();
const commentaryEntries = new Map<string, { thread: vscode.CommentThread; lesson: FileLesson; construct: KeyConstruct; index: number }>();
let commentaryRead = new Set<string>();

function commentaryReadKey(file: string, construct: KeyConstruct): string {
  // FNV-1a keeps persisted keys compact while tying read state to the actual
  // snippet rather than its position in a lesson that may later be reordered.
  let hash = 0x811c9dc5;
  for (const char of construct.snippet) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${file}::${(hash >>> 0).toString(16)}`;
}

function commentaryEntryKey(uri: vscode.Uri, index: number): string {
  return `${uri.toString()}::${index}`;
}

function disposeCommentaryForUri(uri: vscode.Uri): void {
  const key = uri.toString();
  for (const thread of commentaryThreads.get(key) ?? []) thread.dispose();
  commentaryThreads.delete(key);
  for (const entryKey of commentaryEntries.keys()) {
    if (entryKey.startsWith(`${key}::`)) commentaryEntries.delete(entryKey);
  }
}

function clearAllCommentary(): void {
  for (const threads of commentaryThreads.values()) {
    for (const thread of threads) thread.dispose();
  }
  commentaryThreads.clear();
  commentaryEntries.clear();
}

function findConstructRange(document: vscode.TextDocument, construct: KeyConstruct): vscode.Range | undefined {
  const source = document.getText();
  const snippet = construct.snippet.trim();
  let start = source.indexOf(snippet);
  let length = snippet.length;

  // The prompt requests verbatim snippets, but models occasionally normalize
  // indentation. A whitespace-tolerant fallback still anchors only the same
  // ordered source tokens; it does not guess based on semantic similarity.
  if (start < 0) {
    const tokens = snippet.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const pattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      const match = new RegExp(pattern, 'm').exec(source);
      if (match) {
        start = match.index;
        length = match[0].length;
      }
    }
  }

  if (start < 0) return undefined;
  return new vscode.Range(document.positionAt(start), document.positionAt(start + length));
}

function lessonComment(lesson: FileLesson, construct: KeyConstruct, index: number, read: boolean): vscode.Comment {
  const body = new vscode.MarkdownString();
  body.isTrusted = { enabledCommands: ['tmtp.toggleCommentaryRead', 'tmtp.practiceFile'] };
  body.supportThemeIcons = true;
  body.appendMarkdown(`### ${read ? '$(pass-filled) Read' : '$(circle-large-outline) Unread'} · TMTP Step ${index + 1}\n\n`);
  if (index === 0) {
    body.appendMarkdown(`**Project context — ${lesson.title}**\n\n${lesson.responsibility}\n\n---\n\n`);
  }
  body.appendMarkdown(`📦 **Role in this project**\n\n${construct.project}\n\n`);
  body.appendMarkdown(`🔷 **Language**\n\n${construct.language}\n\n`);
  body.appendMarkdown(`🏗 **Why it matters**\n\n${construct.architecture}\n\n---\n\n`);
  const commandArgs = encodeURIComponent(JSON.stringify([lesson.file, index]));
  const practiceArgs = encodeURIComponent(JSON.stringify([lesson.file]));
  body.appendMarkdown(`[${read ? 'Mark as unread' : '✓ Mark as read'}](command:tmtp.toggleCommentaryRead?${commandArgs}) · [$(beaker) Practice this File](command:tmtp.practiceFile?${practiceArgs})`);
  return {
    body,
    mode: vscode.CommentMode.Preview,
    author: { name: 'TMTP AI Mentor' },
  };
}

async function showLessonBesideCode(projectPath: string, lesson: FileLesson): Promise<void> {
  if (!commentaryController) return;
  const absolutePath = path.resolve(projectPath, lesson.file);
  const relative = path.relative(projectPath, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: true,
    preserveFocus: false,
  });

  disposeCommentaryForUri(document.uri);
  const threads: vscode.CommentThread[] = [];
  lesson.keyConstructs.forEach((construct, index) => {
    const range = findConstructRange(document, construct);
    if (!range) return;
    const isRead = commentaryRead.has(commentaryReadKey(lesson.file, construct));
    const thread = commentaryController!.createCommentThread(document.uri, range, [lessonComment(lesson, construct, index, isRead)]);
    thread.label = `${isRead ? '✓ Read' : '○ Unread'} · TMTP ${index + 1}/${lesson.keyConstructs.length}`;
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    threads.push(thread);
    commentaryEntries.set(commentaryEntryKey(document.uri, index), { thread, lesson, construct, index });
  });
  commentaryThreads.set(document.uri.toString(), threads);

  const firstRange = threads[0]?.range;
  if (firstRange) {
    editor.revealRange(firstRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    editor.selection = new vscode.Selection(firstRange.start, firstRange.start);
  }
}

function presentLessonBesideCode(projectPath: string, lesson: FileLesson): void {
  void showLessonBesideCode(projectPath, lesson).catch((error) => {
    void vscode.window.showWarningMessage(
      `TMTP generated the lesson, but could not show its in-editor commentary: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

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
  const commentary: Record<string, { read: number; total: number }> = {};
  for (const [file, lesson] of fileLessonCache) {
    commentary[file] = {
      read: lesson.keyConstructs.filter((construct) => commentaryRead.has(commentaryReadKey(file, construct))).length,
      total: lesson.keyConstructs.length,
    };
  }
  post({
    type: 'learningProgress',
    explained: [...fileLessonCache.keys()],
    practiced: [...practicedFiles],
    mastered: [...masteredFiles],
    commentary,
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
    presentLessonBesideCode(folder.uri.fsPath, cached);
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
    presentLessonBesideCode(folder.uri.fsPath, lesson);
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
        if (requestedPracticeFile) {
          post({ type: 'startFilePractice', file: requestedPracticeFile });
          requestedPracticeFile = undefined;
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

function openFilePracticeWorkspace(context: vscode.ExtensionContext, file: string): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    void panel.webview.postMessage({ type: 'startFilePractice', file } satisfies ExtensionMessage);
    return;
  }
  requestedPracticeFile = file;
  openOverviewPanel(context, 'projectGraph');
}

async function choosePracticeFile(context: vscode.ExtensionContext): Promise<void> {
  const candidates = latestResult?.startingFiles ?? [];
  if (candidates.length === 0) {
    openOverviewPanel(context, 'startingFiles');
    return;
  }
  const selected = await vscode.window.showQuickPick(
    candidates.map((candidate, index) => ({
      label: `$(beaker) ${candidate.file}`,
      description: `Learning stop ${index + 1} · importance ${candidate.score}`,
      detail: candidate.reasons[0],
      file: candidate.file,
    })),
    { title: 'TMTP: Practice this File', placeHolder: 'Choose a file for focused exercises' },
  );
  if (selected) openFilePracticeWorkspace(context, selected.file);
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
  commentaryRead = new Set(context.workspaceState.get<string[]>(COMMENTARY_READ_CACHE_KEY) ?? []);
  commentaryController = vscode.comments.createCommentController('tmtp.aiCommentary', 'TMTP AI Commentary');

  sidebarProvider = new TmtpSidebarProvider(
    (tab) => openOverviewPanel(context, tab),
    () => openOverviewPanel(context, 'guidedTour', true),
    () => void choosePracticeFile(context),
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
    vscode.commands.registerCommand('tmtp.hideAICommentary', clearAllCommentary),
    vscode.commands.registerCommand('tmtp.toggleCommentaryRead', async (file: string, index: number) => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) return;
      const uri = vscode.Uri.file(path.resolve(folder.uri.fsPath, file));
      const entry = commentaryEntries.get(commentaryEntryKey(uri, index));
      if (!entry) return;
      const readKey = commentaryReadKey(entry.lesson.file, entry.construct);
      if (commentaryRead.has(readKey)) commentaryRead.delete(readKey);
      else commentaryRead.add(readKey);
      await context.workspaceState.update(COMMENTARY_READ_CACHE_KEY, [...commentaryRead]);
      const isRead = commentaryRead.has(readKey);
      entry.thread.label = `${isRead ? '✓ Read' : '○ Unread'} · TMTP ${entry.index + 1}/${entry.lesson.keyConstructs.length}`;
      entry.thread.comments = [lessonComment(entry.lesson, entry.construct, entry.index, isRead)];
      postLearningProgress((message) => void panel?.webview.postMessage(message));
    }),
    vscode.commands.registerCommand('tmtp.practiceFile', (file: string) => openFilePracticeWorkspace(context, file)),
    vscode.window.registerWebviewViewProvider(TmtpSidebarProvider.viewType, sidebarProvider),
    vscode.workspace.onDidChangeTextDocument((event) => disposeCommentaryForUri(event.document.uri)),
    commentaryController,
  );
  void refreshSidebar();
}

export function deactivate(): void {
  clearAllCommentary();
  panel?.dispose();
}
