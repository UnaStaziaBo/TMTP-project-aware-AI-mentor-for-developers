import type { ProjectScanResult } from '@tmpt/scanner';
import type { GuidedTour } from '@tmpt/ai';
import { STAGES, type ExtensionMessage, type StageKey } from '../protocol.js';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();
const root = document.getElementById('root')!;

type Tab = 'overview' | 'startingFiles' | 'guidedTour';

interface AIState {
  configured: boolean;
  provider?: string;
  model?: string;
  editingConfig: boolean;
  apiKeyDraft: string;
  modelDraft: string;
  testStatus: 'idle' | 'testing' | 'success' | 'failure';
  testMessage?: string;
  generationStatus: 'idle' | 'generating' | 'done' | 'error';
  tour?: GuidedTour;
  /** -1 = welcome screen, 0..stops.length-1 = a stop, stops.length = finished. */
  currentStopIndex: number;
  cached: boolean;
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
  ai: AIState;
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
  ai: {
    configured: false,
    editingConfig: true,
    apiKeyDraft: '',
    modelDraft: 'gpt-5.5',
    testStatus: 'idle',
    generationStatus: 'idle',
    currentStopIndex: -1,
    cached: false,
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
          </div>
        </div>`;
        })
        .join('')}
    </div>`;
}

function renderAISettingsForm(): string {
  const ai = state.ai;
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

function renderTourStop(tour: GuidedTour, index: number): string {
  const stop = tour.stops[index]!;
  const isLast = index === tour.stops.length - 1;

  return `
    <div class="tour-progress">Stop ${index + 1} of ${tour.stops.length}</div>
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-stop-marker">📍 Stop ${index + 1}</div>
        <div class="ai-briefing-label">${escapeHtml(stop.title)}</div>
        <div class="ai-briefing-file">${escapeHtml(stop.file)}</div>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Why are we here?</div>
        <p class="ai-briefing-text">${escapeHtml(stop.whyThisFile)}</p>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Things to notice</div>
        <div class="starting-file-why"><ul>${stop.whatToNotice.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      </div>
      <div class="ai-briefing-divider"></div>
      ${
        !isLast && stop.nextReason
          ? `<div class="tour-next-hint">→ Up next: ${escapeHtml(stop.nextReason)}</div>`
          : ''
      }
    </div>
    <div class="tour-nav">
      <button class="ai-link-button" id="ai-tour-previous">← Previous</button>
      <button class="rescan-button" id="ai-tour-open-file">Open File</button>
      <button class="ai-explain-button" id="ai-tour-continue">Continue →</button>
    </div>`;
}

function renderTourWelcome(tour: GuidedTour): string {
  if (tour.stops.length === 0) {
    return `
      <p class="ai-intro-copy">${escapeHtml(tour.introduction)}</p>
      <div class="empty-line">No valid starting files were available to build a tour from.</div>
      <div class="ai-actions">
        <button class="ai-link-button" id="ai-regenerate">↻ Regenerate</button>
        <button class="ai-link-button" id="ai-edit-config">⚙ Change API Key</button>
      </div>`;
  }

  return `
    <p class="ai-intro-copy tour-welcome-text">${escapeHtml(tour.introduction)}</p>
    <div class="ai-actions">
      <button class="ai-explain-button" id="ai-tour-begin">Let's begin →</button>
    </div>`;
}

function renderTourFinished(): string {
  return `
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <p class="ai-briefing-text">Great!</p>
        <p class="ai-briefing-text">You now understand the structure of this project.</p>
        <p class="ai-briefing-text">Next we'll start learning the programming language by using the code you've just explored.</p>
      </div>
      <div class="ai-briefing-divider"></div>
    </div>
    <div class="ai-actions">
      <div>
        <button class="tour-placeholder-button" disabled>Begin Learning →</button>
        <div class="tour-placeholder-caption">Coming in a future milestone</div>
      </div>
      <button class="ai-link-button" id="ai-tour-previous">← Previous</button>
      <button class="ai-link-button" id="ai-regenerate">↻ Regenerate</button>
    </div>`;
}

function renderGuidedTour(): string {
  const ai = state.ai;
  const subtitle =
    ai.tour && ai.currentStopIndex >= 0 && ai.currentStopIndex < ai.tour.stops.length
      ? `Stop ${ai.currentStopIndex + 1} of ${ai.tour.stops.length}`
      : ai.configured && ai.provider && ai.model
        ? `Configured — ${ai.provider} / ${ai.model}`
        : '';
  const heading = `
    <div class="screen-heading">
      <h2>✨ Guided Project Tour</h2>
      <p>${escapeHtml(subtitle)}</p>
    </div>`;

  if (ai.generationStatus === 'generating') {
    return `${heading}<div class="empty-line">Generating your guided tour…</div>`;
  }

  if (ai.generationStatus === 'error') {
    return `
      ${heading}
      <div class="empty-line">${escapeHtml(ai.errorMessage ?? 'Generation failed.')}</div>
      <div class="ai-actions">
        <button class="ai-explain-button" id="ai-generate">✨ Try Again</button>
        <button class="ai-link-button" id="ai-edit-config">⚙ Change API Key</button>
      </div>`;
  }

  if (ai.generationStatus === 'done' && ai.tour) {
    const tour = ai.tour;
    let body: string;
    if (ai.currentStopIndex < 0) {
      body = renderTourWelcome(tour);
    } else if (ai.currentStopIndex >= tour.stops.length) {
      body = renderTourFinished();
    } else {
      body = renderTourStop(tour, ai.currentStopIndex);
    }
    return `${heading}${body}`;
  }

  return `
    ${heading}
    <p class="ai-intro-copy">Take a guided walkthrough of this repository, grounded entirely in what the deterministic scan already found — no re-analysis, no invented files.</p>
    <div class="ai-actions">
      <button class="ai-explain-button" id="ai-generate">✨ Take the Tour</button>
      <button class="ai-link-button" id="ai-edit-config">⚙ Change API Key</button>
    </div>`;
}

function renderGuidedTourScreen(): string {
  if (state.ai.editingConfig || !state.ai.configured) {
    return renderAISettingsForm();
  }
  return renderGuidedTour();
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
    state.ai.apiKeyDraft = (event.target as HTMLInputElement).value;
  });
  document.getElementById('ai-model')?.addEventListener('input', (event) => {
    state.ai.modelDraft = (event.target as HTMLInputElement).value;
  });
  document.getElementById('ai-test')?.addEventListener('click', () => {
    if (!state.ai.apiKeyDraft) return;
    state.ai.testStatus = 'testing';
    render();
    vscodeApi.postMessage({
      type: 'aiTestConnection',
      apiKey: state.ai.apiKeyDraft,
      model: state.ai.modelDraft || 'gpt-5.5',
    });
  });
  document.getElementById('ai-save')?.addEventListener('click', () => {
    if (!state.ai.apiKeyDraft) return;
    vscodeApi.postMessage({
      type: 'aiSaveConfig',
      apiKey: state.ai.apiKeyDraft,
      model: state.ai.modelDraft || 'gpt-5.5',
    });
    state.ai.apiKeyDraft = '';
  });
  document.getElementById('ai-cancel-edit')?.addEventListener('click', () => {
    state.ai.editingConfig = false;
    render();
  });
  document.getElementById('ai-edit-config')?.addEventListener('click', () => {
    state.ai.editingConfig = true;
    render();
  });
  document.getElementById('ai-generate')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'aiGenerate' });
  });
  document.getElementById('ai-regenerate')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'aiRegenerate' });
  });
  document.getElementById('ai-tour-begin')?.addEventListener('click', () => {
    state.ai.currentStopIndex = 0;
    render();
  });
  document.getElementById('ai-tour-previous')?.addEventListener('click', () => {
    state.ai.currentStopIndex = Math.max(-1, state.ai.currentStopIndex - 1);
    render();
  });
  document.getElementById('ai-tour-continue')?.addEventListener('click', () => {
    state.ai.currentStopIndex += 1;
    render();
  });
  document.getElementById('ai-tour-open-file')?.addEventListener('click', () => {
    const stop = state.ai.tour?.stops[state.ai.currentStopIndex];
    if (stop) {
      vscodeApi.postMessage({ type: 'openFile', file: stop.file });
    }
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
      state.ai.configured = message.configured;
      state.ai.provider = message.provider;
      state.ai.model = message.model;
      state.ai.editingConfig = !message.configured;
      if (message.model) {
        state.ai.modelDraft = message.model;
      }
      break;
    case 'aiTestResult':
      state.ai.testStatus = message.result.ok ? 'success' : 'failure';
      state.ai.testMessage = message.result.ok ? undefined : message.result.message;
      break;
    case 'aiGenerating':
      state.ai.generationStatus = 'generating';
      break;
    case 'aiResult':
      state.ai.generationStatus = 'done';
      state.ai.tour = message.tour;
      state.ai.cached = message.cached;
      state.ai.currentStopIndex = -1;
      break;
    case 'aiError':
      state.ai.generationStatus = 'error';
      state.ai.errorMessage = message.message;
      break;
  }

  render();
});

render();
vscodeApi.postMessage({ type: 'ready' });
