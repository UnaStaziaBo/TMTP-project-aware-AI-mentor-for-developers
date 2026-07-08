import type { ProjectScanResult } from '@tmpt/scanner';
import type { FileLesson } from '@tmpt/ai';
import { STAGES, type ExtensionMessage, type StageKey } from '../protocol.js';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();
const root = document.getElementById('root')!;

type Tab = 'overview' | 'startingFiles' | 'guidedTour';

interface AIConfigState {
  configured: boolean;
  provider?: string;
  model?: string;
  editingConfig: boolean;
  apiKeyDraft: string;
  modelDraft: string;
  testStatus: 'idle' | 'testing' | 'success' | 'failure';
  testMessage?: string;
}

interface GuidedTourState {
  /** false = intro screen, true = stepping through a starting file. */
  active: boolean;
  /** Index into result.startingFiles. */
  fileIndex: number;
  status: 'idle' | 'generating' | 'done' | 'error';
  lessons: Map<string, FileLesson>;
  errorMessage?: string;
}

interface State {
  status: 'scanning' | 'done' | 'no-workspace' | 'error';
  projectName: string;
  result: ProjectScanResult;
  completed: Set<StageKey>;
  stageElapsed: Partial<Record<StageKey, number>>;
  totalElapsedMs: number | null;
  errorMessage: string | null;
  activeTab: Tab;
  aiConfig: AIConfigState;
  tour: GuidedTourState;
}

const emptyResult: ProjectScanResult = {
  files: [],
  folders: [],
  manifests: [],
  languages: [],
  frameworks: [],
  infrastructure: [],
  dependencies: [],
  startingFiles: [],
};

const state: State = {
  status: 'scanning',
  projectName: '',
  result: emptyResult,
  completed: new Set(),
  stageElapsed: {},
  totalElapsedMs: null,
  errorMessage: null,
  activeTab: 'overview',
  aiConfig: {
    configured: false,
    editingConfig: true,
    apiKeyDraft: '',
    modelDraft: 'gpt-5.5',
    testStatus: 'idle',
  },
  tour: {
    active: false,
    fileIndex: 0,
    status: 'idle',
    lessons: new Map(),
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const checkIcon = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const refreshIcon = '<svg viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 10-1.7 3.97M13.5 8V4.5M13.5 8H10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function stageSummary(key: StageKey, result: ProjectScanResult): string {
  switch (key) {
    case 'filesystem':
      return `${result.files.length} files · ${result.folders.length} folders`;
    case 'language':
      return `${result.languages.length} language${result.languages.length === 1 ? '' : 's'}`;
    case 'framework':
      return `${result.frameworks.length} framework${result.frameworks.length === 1 ? '' : 's'}`;
    case 'infrastructure':
      return `${result.infrastructure.length} item${result.infrastructure.length === 1 ? '' : 's'}`;
    case 'dependency':
      return `${result.dependencies.length} dependenc${result.dependencies.length === 1 ? 'y' : 'ies'}`;
    case 'startingFiles':
      return `${result.startingFiles.length} candidate${result.startingFiles.length === 1 ? '' : 's'}`;
  }
}

function renderPipeline(): string {
  const nextPendingIndex = STAGES.findIndex((s) => !state.completed.has(s.key));

  return `<div class="pipeline">${STAGES.map((stage, index) => {
    const done = state.completed.has(stage.key);
    const active = !done && state.status === 'scanning' && index === nextPendingIndex;
    const cls = done ? 'done' : active ? 'active' : 'pending';
    const meta = done ? stageSummary(stage.key, state.result) : '';
    return `
      <div class="pipeline-step ${cls}">
        <div class="connector"></div>
        <div class="dot">${checkIcon}</div>
        <div class="label">${stage.label}</div>
        <div class="meta">${meta}</div>
      </div>`;
  }).join('')}</div>`;
}

function renderStatTiles(): string {
  const r = state.result;
  const tiles: Array<[number, string]> = [
    [r.files.length, 'Files'],
    [r.folders.length, 'Folders'],
    [r.manifests.length, 'Manifests'],
    [r.languages.length, 'Languages'],
    [r.frameworks.length, 'Frameworks'],
    [r.infrastructure.length, 'Infrastructure'],
    [r.dependencies.length, 'Dependencies'],
  ];
  return `<div class="stat-grid">${tiles
    .map(
      ([value, label], i) =>
        `<div class="stat-tile" style="animation-delay:${i * 40}ms"><div class="value">${value}</div><div class="label">${label}</div></div>`,
    )
    .join('')}</div>`;
}

interface Detected {
  name: string;
  confidence: number;
  evidence: string[];
}

function renderBarSection(id: string, title: string, items: Detected[]): string {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
  const body =
    sorted.length === 0
      ? `<div class="empty-line">No ${title.toLowerCase()} detected</div>`
      : sorted
          .map((item, i) => {
            const percent = Math.round(item.confidence * 100);
            return `
        <details class="bar-row" style="animation-delay:${i * 35}ms">
          <summary>
            <span class="name">${escapeHtml(item.name)}</span>
            <span class="bar-track"><span class="bar-fill" data-target="${percent}"></span></span>
            <span class="percent">${percent}%</span>
          </summary>
          <div class="evidence">${item.evidence.map((e) => `<code>${escapeHtml(e)}</code>`).join('')}</div>
        </details>`;
          })
          .join('');

  return `
    <div class="section section-accent-${id}">
      <div class="section-heading"><h2>${title}</h2><span class="count">${items.length}</span></div>
      ${body}
    </div>`;
}

function renderFileTypes(): string {
  const counts = new Map<string, number>();
  for (const file of state.result.files) {
    const key = file.extension || '(no extension)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top.length > 0 ? top[0][1] : 1;

  if (top.length === 0) {
    return '';
  }

  return `
    <div class="section section-accent-filetypes">
      <div class="section-heading"><h2>Top file types</h2></div>
      ${top
        .map(([ext, count], i) => {
          const percent = Math.round((count / max) * 100);
          return `
        <details class="bar-row" style="animation-delay:${i * 35}ms" open>
          <summary>
            <span class="name">${escapeHtml(ext)}</span>
            <span class="bar-track"><span class="bar-fill" data-target="${percent}"></span></span>
            <span class="percent">${count}</span>
          </summary>
        </details>`;
        })
        .join('')}
    </div>`;
}

const TABS: Array<[Tab, string]> = [
  ['overview', 'Project Overview'],
  ['startingFiles', '🚀 Where Should You Start?'],
  ['guidedTour', '✨ Guided Tour'],
];

function renderTabBar(): string {
  return `<div class="tab-bar">${TABS.map(
    ([key, label]) =>
      `<button class="tab-button ${state.activeTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`,
  ).join('')}</div>`;
}

function circledNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + (n - 1));
  return `${n}.`;
}

function renderOverviewBody(): string {
  const r = state.result;
  return `
    ${renderStatTiles()}
    ${renderBarSection('languages', 'Languages', r.languages)}
    ${renderBarSection('frameworks', 'Frameworks', r.frameworks)}
    ${renderBarSection('infrastructure', 'Infrastructure', r.infrastructure)}
    ${renderBarSection('dependencies', 'Dependencies', r.dependencies)}
    ${renderFileTypes()}
  `;
}

function renderStartingFilesScreen(): string {
  const candidates = state.result.startingFiles;

  if (candidates.length === 0) {
    const stillScanning = state.status === 'scanning' && !state.completed.has('startingFiles');
    return `
      <div class="screen-heading">
        <h2>🚀 Where Should You Start?</h2>
        <p>Recommended Starting Files</p>
      </div>
      <div class="empty-line">${
        stillScanning ? 'Scanning for the best files to start with…' : 'No clear starting point detected yet.'
      }</div>`;
  }

  return `
    <div class="screen-heading">
      <h2>🚀 Where Should You Start?</h2>
      <p>Recommended Starting Files</p>
    </div>
    <p class="starting-files-intro">If you have never seen this project before, start here.</p>
    <div class="starting-files">
      ${candidates
        .map((candidate, i) => {
          const percent = Math.round(candidate.confidence * 100);
          return `
        <div class="starting-file-card" style="animation-delay:${i * 45}ms">
          <div class="starting-file-rank">${circledNumber(i + 1)}</div>
          <div class="starting-file-body">
            <div class="starting-file-path">${escapeHtml(candidate.file)}</div>
            <div class="starting-file-confidence-row">
              <span class="starting-file-confidence-label">Confidence</span>
              <span class="bar-track"><span class="bar-fill" data-target="${percent}"></span></span>
              <span class="percent">${percent}%</span>
            </div>
            <div class="starting-file-why">
              <span class="why-label">Why?</span>
              <ul>${candidate.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
            </div>
            <div class="starting-file-actions">
              <button class="rescan-button starting-file-open" data-index="${i}">Open File</button>
              <button class="ai-explain-button starting-file-explain" data-index="${i}">Explain</button>
            </div>
          </div>
        </div>`;
        })
        .join('')}
    </div>`;
}

function renderAISettingsForm(): string {
  const ai = state.aiConfig;
  const statusText =
    ai.testStatus === 'success'
      ? '✓ Connection successful'
      : ai.testStatus === 'failure'
        ? `✗ ${ai.testMessage ?? 'Connection failed'}`
        : ai.testStatus === 'testing'
          ? 'Testing…'
          : '';

  return `
    <div class="screen-heading">
      <h2>✨ Guided Project Tour</h2>
      <p>Configure an AI provider</p>
    </div>
    <div class="ai-settings-form">
      <div class="ai-field-label">AI Provider</div>
      <label class="ai-radio-row"><input type="radio" checked disabled /> OpenAI</label>

      <label class="ai-field-label" for="ai-api-key">API Key</label>
      <input class="ai-text-input" id="ai-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." value="${escapeHtml(ai.apiKeyDraft)}" />

      <label class="ai-field-label" for="ai-model">Model</label>
      <input class="ai-text-input" id="ai-model" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(ai.modelDraft)}" />

      <div class="ai-form-actions">
        <button class="rescan-button" id="ai-test">Test Connection</button>
        <button class="retry-button" id="ai-save">Save</button>
        ${ai.configured ? `<button class="ai-link-button" id="ai-cancel-edit">Cancel</button>` : ''}
      </div>
      ${statusText ? `<div class="ai-test-message ${ai.testStatus}">${escapeHtml(statusText)}</div>` : ''}
    </div>
    <p class="ai-privacy-note">Your API key is stored only in VS Code's Secret Storage. It is never written to settings.json and never sent back to this webview.</p>`;
}

function renderGuidedTourIntro(): string {
  const hasStartingFiles = state.result.startingFiles.length > 0;
  const subtitle =
    state.aiConfig.configured && state.aiConfig.provider && state.aiConfig.model
      ? `Configured — ${state.aiConfig.provider} / ${state.aiConfig.model}`
      : '';

  return `
    <div class="screen-heading">
      <h2>✨ Guided Project Tour</h2>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <p class="ai-intro-copy">Take a guided walkthrough of this repository's most important files — grounded entirely in their real code, one file at a time, in the same order as "Where Should You Start?".</p>
    <div class="ai-actions">
      ${
        hasStartingFiles
          ? `<button class="ai-explain-button" id="tour-begin">✨ Start Guided Tour</button>`
          : `<button class="tour-placeholder-button" disabled>✨ Start Guided Tour</button>
             <div class="tour-placeholder-caption">No starting files were detected yet.</div>`
      }
      <button class="ai-link-button" id="ai-edit-config">⚙ Change API Key</button>
    </div>`;
}

function renderConstructCard(construct: FileLesson['keyConstructs'][number]): string {
  return `
    <div class="construct-card">
      <pre class="construct-snippet">${escapeHtml(construct.snippet)}</pre>
      <div class="construct-row">
        <span class="construct-icon">📦</span>
        <div class="construct-text">
          <div class="construct-label project">Role in this project</div>
          <p class="ai-briefing-text">${escapeHtml(construct.project)}</p>
        </div>
      </div>
      <div class="construct-row">
        <span class="construct-icon">🔷</span>
        <div class="construct-text">
          <div class="construct-label language">Language</div>
          <p class="ai-briefing-text">${escapeHtml(construct.language)}</p>
        </div>
      </div>
      <div class="construct-row">
        <span class="construct-icon">🏗</span>
        <div class="construct-text">
          <div class="construct-label architecture">Why it matters</div>
          <p class="ai-briefing-text">${escapeHtml(construct.architecture)}</p>
        </div>
      </div>
    </div>`;
}

function renderGuidedTourStep(): string {
  const candidates = state.result.startingFiles;
  const total = candidates.length;
  const file = candidates[state.tour.fileIndex]?.file;

  if (!file) {
    return renderGuidedTourIntro();
  }

  const heading = `
    <div class="screen-heading">
      <h2>✨ Guided Project Tour</h2>
      <p>File ${state.tour.fileIndex + 1} of ${total}</p>
    </div>`;

  if (state.tour.status === 'error') {
    return `
      ${heading}
      <div class="empty-line">${escapeHtml(state.tour.errorMessage ?? 'Could not generate this lesson.')}</div>
      <div class="tour-nav">
        <button class="ai-link-button" id="tour-previous">← Previous</button>
        <button class="ai-explain-button" id="tour-retry">Try Again</button>
      </div>`;
  }

  const lesson = state.tour.lessons.get(file);
  if (state.tour.status !== 'done' || !lesson) {
    return `${heading}<div class="empty-line">Preparing your walkthrough of ${escapeHtml(file)}…</div>`;
  }

  const isLast = state.tour.fileIndex === total - 1;

  return `
    ${heading}
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Step 1 — Project Context</div>
        <div class="ai-briefing-label">${escapeHtml(lesson.title)}</div>
        <div class="ai-briefing-file">${escapeHtml(lesson.file)}</div>
        <p class="ai-briefing-text">${escapeHtml(lesson.responsibility)}</p>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Step 2 — Key Constructs</div>
        ${lesson.keyConstructs.map(renderConstructCard).join('')}
      </div>
      <div class="ai-briefing-divider"></div>
    </div>
    <div class="tour-nav">
      <button class="ai-link-button" id="tour-previous">← Previous</button>
      <button class="rescan-button" id="tour-open-file">Open File</button>
      <button class="ai-link-button" id="tour-return-overview">Return to Overview</button>
      <button class="ai-explain-button" id="tour-next" ${isLast ? 'disabled' : ''}>${isLast ? 'Tour complete' : 'Next →'}</button>
    </div>`;
}

function renderGuidedTourScreen(): string {
  if (state.aiConfig.editingConfig || !state.aiConfig.configured) {
    return renderAISettingsForm();
  }
  if (!state.tour.active) {
    return renderGuidedTourIntro();
  }
  return renderGuidedTourStep();
}

function renderHeader(): string {
  const durationLabel =
    state.totalElapsedMs != null ? `Scanned in ${Math.round(state.totalElapsedMs)}ms` : 'Scanning…';
  const spinning = state.status === 'scanning';
  return `
    <div class="header">
      <div class="title-block">
        <h1>${escapeHtml(state.projectName || 'TMTP')}</h1>
        <p>${durationLabel}</p>
      </div>
      <button class="rescan-button ${spinning ? 'spinning' : ''}" id="rescan">${refreshIcon}<span>Rescan</span></button>
    </div>`;
}

function renderFullPageState(title: string, body: string, showRetry: boolean): void {
  root.innerHTML = `
    <div class="state-page">
      <h2>${title}</h2>
      <p>${body}</p>
      ${showRetry ? `<button class="retry-button" id="retry">Rescan</button>` : ''}
    </div>`;
  document.getElementById('retry')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'rescan' });
  });
}

function goToFile(index: number): void {
  const candidates = state.result.startingFiles;
  if (index < 0 || index >= candidates.length) {
    return;
  }

  state.tour.active = true;
  state.tour.fileIndex = index;
  state.activeTab = 'guidedTour';

  const file = candidates[index]!.file;
  const cachedLesson = state.tour.lessons.get(file);
  if (cachedLesson) {
    state.tour.status = 'done';
    render();
    return;
  }

  state.tour.status = 'generating';
  render();
  vscodeApi.postMessage({ type: 'explainFile', file });
}

function render(): void {
  if (state.status === 'no-workspace') {
    renderFullPageState(
      'No project open',
      'Open a folder to see what TMTP discovers about your project.',
      false,
    );
    return;
  }

  if (state.status === 'error') {
    renderFullPageState('Scan failed', escapeHtml(state.errorMessage ?? 'Unknown error'), true);
    return;
  }

  const screen =
    state.activeTab === 'overview'
      ? renderOverviewBody()
      : state.activeTab === 'startingFiles'
        ? renderStartingFilesScreen()
        : renderGuidedTourScreen();

  root.innerHTML = `
    ${renderHeader()}
    ${renderPipeline()}
    ${renderTabBar()}
    ${screen}
  `;

  document.getElementById('rescan')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'rescan' });
  });

  document.querySelectorAll<HTMLElement>('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      state.activeTab = tab === 'startingFiles' || tab === 'guidedTour' ? tab : 'overview';
      render();
    });
  });

  document.getElementById('ai-api-key')?.addEventListener('input', (event) => {
    state.aiConfig.apiKeyDraft = (event.target as HTMLInputElement).value;
  });
  document.getElementById('ai-model')?.addEventListener('input', (event) => {
    state.aiConfig.modelDraft = (event.target as HTMLInputElement).value;
  });
  document.getElementById('ai-test')?.addEventListener('click', () => {
    if (!state.aiConfig.apiKeyDraft) return;
    state.aiConfig.testStatus = 'testing';
    render();
    vscodeApi.postMessage({
      type: 'aiTestConnection',
      apiKey: state.aiConfig.apiKeyDraft,
      model: state.aiConfig.modelDraft || 'gpt-5.5',
    });
  });
  document.getElementById('ai-save')?.addEventListener('click', () => {
    if (!state.aiConfig.apiKeyDraft) return;
    vscodeApi.postMessage({
      type: 'aiSaveConfig',
      apiKey: state.aiConfig.apiKeyDraft,
      model: state.aiConfig.modelDraft || 'gpt-5.5',
    });
    state.aiConfig.apiKeyDraft = '';
  });
  document.getElementById('ai-cancel-edit')?.addEventListener('click', () => {
    state.aiConfig.editingConfig = false;
    render();
  });
  document.getElementById('ai-edit-config')?.addEventListener('click', () => {
    state.aiConfig.editingConfig = true;
    render();
  });

  document.querySelectorAll<HTMLElement>('.starting-file-open').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const file = state.result.startingFiles[index]?.file;
      if (file) {
        vscodeApi.postMessage({ type: 'openFile', file });
      }
    });
  });
  document.querySelectorAll<HTMLElement>('.starting-file-explain').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      goToFile(index);
    });
  });

  document.getElementById('tour-begin')?.addEventListener('click', () => {
    goToFile(0);
  });
  document.getElementById('tour-previous')?.addEventListener('click', () => {
    if (state.tour.fileIndex === 0) {
      state.tour.active = false;
      render();
      return;
    }
    goToFile(state.tour.fileIndex - 1);
  });
  document.getElementById('tour-next')?.addEventListener('click', () => {
    goToFile(state.tour.fileIndex + 1);
  });
  document.getElementById('tour-retry')?.addEventListener('click', () => {
    const file = state.result.startingFiles[state.tour.fileIndex]?.file;
    if (file) {
      state.tour.status = 'generating';
      render();
      vscodeApi.postMessage({ type: 'explainFile', file });
    }
  });
  document.getElementById('tour-open-file')?.addEventListener('click', () => {
    const file = state.result.startingFiles[state.tour.fileIndex]?.file;
    if (file) {
      vscodeApi.postMessage({ type: 'openFile', file });
    }
  });
  document.getElementById('tour-return-overview')?.addEventListener('click', () => {
    state.activeTab = 'overview';
    render();
  });

  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>('.bar-fill').forEach((el) => {
      el.style.width = `${el.dataset.target}%`;
    });
  });
}

window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'noWorkspace':
      state.status = 'no-workspace';
      break;
    case 'scanStarted':
      state.status = 'scanning';
      state.projectName = message.projectName;
      state.result = emptyResult;
      state.completed = new Set();
      state.stageElapsed = {};
      state.totalElapsedMs = null;
      state.errorMessage = null;
      break;
    case 'stageComplete':
      state.completed.add(message.stage);
      state.stageElapsed[message.stage] = message.elapsedMs;
      state.result = message.result;
      break;
    case 'scanComplete':
      state.status = 'done';
      state.totalElapsedMs = message.totalElapsedMs;
      break;
    case 'scanError':
      state.status = 'error';
      state.errorMessage = message.message;
      break;
    case 'aiConfigStatus':
      state.aiConfig.configured = message.configured;
      state.aiConfig.provider = message.provider;
      state.aiConfig.model = message.model;
      state.aiConfig.editingConfig = !message.configured;
      if (message.model) {
        state.aiConfig.modelDraft = message.model;
      }
      break;
    case 'aiTestResult':
      state.aiConfig.testStatus = message.result.ok ? 'success' : 'failure';
      state.aiConfig.testMessage = message.result.ok ? undefined : message.result.message;
      break;
    case 'aiError':
      console.error('TMTP:', message.message);
      break;
    case 'fileLessonGenerating':
      if (message.file === state.result.startingFiles[state.tour.fileIndex]?.file) {
        state.tour.status = 'generating';
      }
      break;
    case 'fileLessonResult':
      state.tour.lessons.set(message.file, message.lesson);
      if (message.file === state.result.startingFiles[state.tour.fileIndex]?.file) {
        state.tour.status = 'done';
      }
      break;
    case 'fileLessonError':
      if (message.file === state.result.startingFiles[state.tour.fileIndex]?.file) {
        state.tour.status = 'error';
        state.tour.errorMessage = message.message;
      }
      break;
  }

  render();
});

render();
vscodeApi.postMessage({ type: 'ready' });
