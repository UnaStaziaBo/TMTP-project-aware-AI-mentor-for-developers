import type { ProjectScanResult } from '@tmpt/scanner';
import { STAGES, type ExtensionMessage, type StageKey } from '../protocol.js';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();
const root = document.getElementById('root')!;

interface State {
  status: 'scanning' | 'done' | 'no-workspace' | 'error';
  projectName: string;
  result: ProjectScanResult;
  completed: Set<StageKey>;
  stageElapsed: Partial<Record<StageKey, number>>;
  totalElapsedMs: number | null;
  errorMessage: string | null;
}

const emptyResult: ProjectScanResult = {
  files: [],
  folders: [],
  manifests: [],
  languages: [],
  frameworks: [],
  infrastructure: [],
  dependencies: [],
};

const state: State = {
  status: 'scanning',
  projectName: '',
  result: emptyResult,
  completed: new Set(),
  stageElapsed: {},
  totalElapsedMs: null,
  errorMessage: null,
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

  const r = state.result;
  root.innerHTML = `
    ${renderHeader()}
    ${renderPipeline()}
    ${renderStatTiles()}
    ${renderBarSection('languages', 'Languages', r.languages)}
    ${renderBarSection('frameworks', 'Frameworks', r.frameworks)}
    ${renderBarSection('infrastructure', 'Infrastructure', r.infrastructure)}
    ${renderBarSection('dependencies', 'Dependencies', r.dependencies)}
    ${renderFileTypes()}
  `;

  document.getElementById('rescan')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'rescan' });
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
  }

  render();
});

render();
vscodeApi.postMessage({ type: 'ready' });
