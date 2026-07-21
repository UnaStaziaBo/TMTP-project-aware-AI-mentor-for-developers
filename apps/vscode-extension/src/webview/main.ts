import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ProjectScanResult } from '@tmpt/scanner';
import type { AIProviderId, FileLesson, PracticePlan } from '@tmpt/ai';
import { buildProjectGraphViewModel } from '../projectGraphView.js';
import { ProjectGraphCanvas } from './graph/ProjectGraphCanvas.js';
import { STAGES, type ExtensionMessage, type FileConfidence, type StageKey, type WorkspaceTab } from '../protocol.js';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();
const rootContainer = document.getElementById('root')!;

// `render()` below does a full innerHTML rewrite of `appShell` on every state
// change. The graph canvas is a persistent React root mounted into its own
// sibling container instead, so pan/zoom/selection survive re-renders that
// have nothing to do with the graph (e.g. an unrelated tour message arriving
// while the developer is exploring the graph).
const appShell = document.createElement('div');
appShell.id = 'app-shell';
const graphMount = document.createElement('div');
graphMount.id = 'graph-mount';
graphMount.style.display = 'none';
rootContainer.append(appShell, graphMount);
let graphRoot: Root | undefined;
let pendingPracticeFile: string | undefined;

type Tab = WorkspaceTab;

interface AIConfigState {
  configured: boolean;
  provider?: AIProviderId;
  model?: string;
  editingConfig: boolean;
  providerDraft: AIProviderId;
  apiKeyDraft: string;
  modelDraft: string;
  testStatus: 'idle' | 'testing' | 'success' | 'failure';
  testMessage?: string;
}

const AI_PROVIDERS: Array<{ id: AIProviderId; label: string; defaultModel: string; keyPlaceholder: string }> = [
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5.5', keyPlaceholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-opus-4-8', keyPlaceholder: 'sk-ant-...' },
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-3.5-flash', keyPlaceholder: 'Google AI API key' },
];

function providerOption(id: AIProviderId) {
  return AI_PROVIDERS.find((provider) => provider.id === id)!;
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

/**
 * 'idle' = still touring. Everything else replaces the tour-step screen
 * with the post-tour Learning Readiness Assessment: a confidence check per
 * toured file, then an AI-generated set of realistic "first day" scenarios
 * weighted toward the files the developer felt least confident about.
 */
interface PracticeState {
  phase: 'idle' | 'confidence' | 'generating' | 'ready' | 'error' | 'done';
  confidenceIndex: number;
  ratings: Record<string, FileConfidence>;
  plan?: PracticePlan;
  scenarioIndex: number;
  selectedOption?: number;
  errorMessage?: string;
}

function createInitialPracticeState(): PracticeState {
  return { phase: 'idle', confidenceIndex: 0, ratings: {}, scenarioIndex: 0 };
}

/** Server-reported learning progress — persists across sessions, so the Knowledge Map is accurate on first open. */
interface LearningProgressState {
  explained: Set<string>;
  practiced: Set<string>;
  mastered: Set<string>;
  commentary: Map<string, { read: number; total: number }>;
}

/** The node currently opened from the Knowledge Map, and which of its three actions is showing. */
interface KnowledgeMapNodeDetailState {
  file: string;
  view: 'menu' | 'explain' | 'practice';
  explainStatus: 'idle' | 'generating' | 'done' | 'error';
  explainError?: string;
  practiceStatus: 'idle' | 'generating' | 'ready' | 'error';
  practiceScenarioIndex: number;
  practiceSelectedOption?: number;
  practiceError?: string;
}

interface KnowledgeMapState {
  node?: KnowledgeMapNodeDetailState;
  /** Single-file practice plans, separate from the tour-wide "Day 1 Practice" plan. */
  filePracticePlans: Map<string, PracticePlan>;
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
  practice: PracticeState;
  learningProgress: LearningProgressState;
  knowledgeMap: KnowledgeMapState;
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
  projectGraph: { edges: [] },
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
    providerDraft: 'openai',
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
  practice: createInitialPracticeState(),
  learningProgress: { explained: new Set(), practiced: new Set(), mastered: new Set(), commentary: new Map() },
  knowledgeMap: { filePracticePlans: new Map() },
};

function learningStatusFor(file: string): { icon: string; label: string; progress: number } {
  if (state.learningProgress.mastered.has(file)) {
    return { icon: '⭐', label: 'Mastered', progress: 100 };
  }
  if (state.learningProgress.practiced.has(file)) {
    return { icon: '🟠', label: 'Practiced', progress: 80 };
  }
  if (state.learningProgress.explained.has(file) || state.tour.lessons.has(file)) {
    const commentary = state.learningProgress.commentary.get(file);
    const readRatio = commentary && commentary.total > 0 ? commentary.read / commentary.total : 0;
    return { icon: '🟡', label: 'Explained', progress: Math.round(10 + readRatio * 50) };
  }
  return { icon: '⚪', label: 'Not visited', progress: 0 };
}

/** The toured files, in the same order as "Where Should I Start?", filtered to ones actually explained. */
function touredFiles(): string[] {
  return state.result.startingFiles.map((c) => c.file).filter((file) => state.tour.lessons.has(file));
}

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
  ['projectGraph', '🕸️ Project Graph'],
  ['overview', 'Project Overview'],
  ['startingFiles', 'Where Should I Start?'],
  ['guidedTour', 'Guided Tour'],
];

function renderTabBar(): string {
  const practiceFile = state.knowledgeMap.node?.file
    ?? (state.tour.active ? state.result.startingFiles[state.tour.fileIndex]?.file : undefined)
    ?? state.result.startingFiles[0]?.file;
  return `<div class="tab-bar">${TABS.map(
    ([key, label]) =>
      `<button class="tab-button ${state.activeTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`,
  ).join('')}<button class="workspace-practice-button" id="workspace-practice-file" ${practiceFile ? `data-file="${escapeHtml(practiceFile)}"` : 'disabled'}>🧪 Practice this File</button><button class="workspace-api-key-button" id="workspace-api-key">⚙ Change AI Provider</button></div>`;
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
        <h2>Where Should I Start?</h2>
        <p>Recommended Starting Files</p>
      </div>
      <div class="empty-line">${
        stillScanning ? 'Scanning for the best files to start with…' : 'No clear starting point detected yet.'
      }</div>`;
  }

  return `
    <div class="screen-heading">
      <h2>Where Should I Start?</h2>
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
  const selectedProvider = providerOption(ai.providerDraft);
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
      <h2>Guided Project Tour</h2>
      <p>Configure an AI provider</p>
    </div>
    <div class="ai-settings-form">
      <label class="ai-field-label" for="ai-provider">AI Provider</label>
      <select class="ai-text-input" id="ai-provider">
        ${AI_PROVIDERS.map(
          (provider) =>
            `<option value="${provider.id}" ${provider.id === ai.providerDraft ? 'selected' : ''}>${provider.label}</option>`,
        ).join('')}
      </select>

      <label class="ai-field-label" for="ai-api-key">API Key</label>
      <input class="ai-text-input" id="ai-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(selectedProvider.keyPlaceholder)}" value="${escapeHtml(ai.apiKeyDraft)}" />

      <label class="ai-field-label" for="ai-model">Model</label>
      <input class="ai-text-input" id="ai-model" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(ai.modelDraft)}" />

      <div class="ai-form-actions">
        <button class="rescan-button" id="ai-test">Test Connection</button>
        <button class="retry-button" id="ai-save">Save</button>
        ${ai.configured ? `<button class="ai-link-button" id="ai-cancel-edit">Cancel</button>` : ''}
      </div>
      ${statusText ? `<div class="ai-test-message ${ai.testStatus}">${escapeHtml(statusText)}</div>` : ''}
    </div>
    <p class="ai-privacy-note">Each provider's API key is stored separately in VS Code's Secret Storage. Keys are never written to settings.json or sent back to this webview.</p>`;
}

function renderGuidedTourIntro(): string {
  const hasStartingFiles = state.result.startingFiles.length > 0;
  const subtitle =
    state.aiConfig.configured && state.aiConfig.provider && state.aiConfig.model
      ? `Configured — ${providerOption(state.aiConfig.provider).label} / ${state.aiConfig.model}`
      : '';

  return `
    <div class="screen-heading">
      <h2>Guided Project Tour</h2>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <p class="ai-intro-copy">Take a guided walkthrough of this repository's most important files — grounded entirely in their real code, one file at a time, in the same order as "Where Should I Start?".</p>
    <div class="ai-actions">
      ${
        hasStartingFiles
          ? `<button class="ai-explain-button" id="tour-begin">Start Guided Tour</button>`
          : `<button class="tour-placeholder-button" disabled>Start Guided Tour</button>
             <div class="tour-placeholder-caption">No starting files were detected yet.</div>`
      }
      <button class="ai-link-button" id="ai-edit-config">⚙ Change AI Provider</button>
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
      <h2>Guided Project Tour</h2>
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
      <button class="rescan-button" id="tour-practice-file">Practice this File</button>
      <button class="ai-link-button" id="tour-return-overview">Return to Overview</button>
      <button class="ai-explain-button" id="${isLast ? 'tour-start-assessment' : 'tour-next'}">${isLast ? 'Start Self-Assessment →' : 'Next →'}</button>
    </div>`;
}

function renderConfidenceScreen(): string {
  const files = touredFiles();
  const file = files[state.practice.confidenceIndex];

  if (!file) {
    return `
      <div class="screen-heading">
        <h2>🧭 Learning Readiness Check</h2>
      </div>
      <div class="empty-line">No toured files to assess yet.</div>`;
  }

  const selected = state.practice.ratings[file];
  const levels: Array<{ level: FileConfidence; label: string }> = [
    { level: 'green', label: '🟢 I understand it well' },
    { level: 'yellow', label: '🟡 I mostly understand it' },
    { level: 'red', label: '🔴 I would like to learn this better' },
  ];

  return `
    <div class="screen-heading">
      <h2>🧭 Learning Readiness Check</h2>
      <p>File ${state.practice.confidenceIndex + 1} of ${files.length}</p>
    </div>
    <p class="ai-intro-copy">How confident do you feel working with this file?</p>
    <div class="ai-briefing-file">${escapeHtml(file)}</div>
    <div class="confidence-options">
      ${levels
        .map(
          ({ level, label }) => `
        <button class="confidence-option ${selected === level ? 'selected' : ''}" data-level="${level}">
          <span class="confidence-option-radio"></span>
          <span>${label}</span>
        </button>`,
        )
        .join('')}
    </div>
    <div class="tour-nav">
      ${state.practice.confidenceIndex > 0 ? `<button class="ai-link-button" id="confidence-previous">← Previous</button>` : ''}
      <button class="ai-link-button" id="practice-return-overview">Return to Overview</button>
    </div>`;
}

function renderPracticeGeneratingScreen(): string {
  return `
    <div class="screen-heading">
      <h2>🧭 Day 1 Practice</h2>
    </div>
    <div class="empty-line">Building your personalized practice plan…</div>`;
}

function renderPracticeErrorScreen(): string {
  return `
    <div class="screen-heading">
      <h2>🧭 Day 1 Practice</h2>
    </div>
    <div class="empty-line">${escapeHtml(state.practice.errorMessage ?? 'Could not build a practice plan.')}</div>
    <div class="tour-nav">
      <button class="ai-link-button" id="practice-return-overview">Return to Overview</button>
      <button class="ai-explain-button" id="practice-retry">Try Again</button>
    </div>`;
}

function renderScenarioScreen(): string {
  const plan = state.practice.plan;
  if (!plan || plan.scenarios.length === 0) {
    return renderPracticeErrorScreen();
  }

  const total = plan.scenarios.length;
  const index = state.practice.scenarioIndex;
  if (index >= total) {
    return renderPracticeDoneScreen();
  }

  const scenario = plan.scenarios[index]!;
  const answered = state.practice.selectedOption !== undefined;
  const gotItRight = answered && scenario.options[state.practice.selectedOption!] === scenario.correctOption;

  return `
    <div class="screen-heading">
      <h2>🧭 Day 1 Practice</h2>
      <p>Scenario ${index + 1} of ${total}</p>
    </div>
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Scenario</div>
        <p class="ai-briefing-text">${escapeHtml(scenario.situation)}</p>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="scenario-options">
          ${scenario.options
            .map((option, i) => {
              const isCorrect = option === scenario.correctOption;
              const isSelected = state.practice.selectedOption === i;
              const cls = !answered ? '' : isSelected && isCorrect ? 'correct' : isSelected ? 'incorrect' : isCorrect ? 'correct-reveal' : '';
              return `<button class="scenario-option ${cls}" data-index="${i}" ${answered ? 'disabled' : ''}>${escapeHtml(option)}</button>`;
            })
            .join('')}
        </div>
        ${
          answered
            ? `
        <div class="scenario-explanation">
          <div class="tour-section-label">${gotItRight ? '✓ Good reasoning' : "Let's look at why"}</div>
          <p class="ai-briefing-text">${escapeHtml(scenario.explanation)}</p>
        </div>`
            : ''
        }
      </div>
      <div class="ai-briefing-divider"></div>
    </div>
    <div class="tour-nav">
      <button class="ai-link-button" id="practice-return-overview">Return to Overview</button>
      ${answered ? `<button class="ai-explain-button" id="scenario-continue">${index + 1 === total ? 'Finish' : 'Continue →'}</button>` : ''}
    </div>`;
}

function renderPracticeDoneScreen(): string {
  return `
    <div class="screen-heading">
      <h2>🧭 Day 1 Practice</h2>
    </div>
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <p class="ai-briefing-text">You now know where to start when you receive your first task on this project.</p>
      </div>
      <div class="ai-briefing-divider"></div>
    </div>
    <div class="tour-nav">
      <button class="ai-link-button" id="practice-return-overview">Return to Overview</button>
    </div>`;
}

function renderPracticeFlow(): string {
  switch (state.practice.phase) {
    case 'confidence':
      return renderConfidenceScreen();
    case 'generating':
      return renderPracticeGeneratingScreen();
    case 'ready':
      return renderScenarioScreen();
    case 'error':
      return renderPracticeErrorScreen();
    case 'done':
      return renderPracticeDoneScreen();
    case 'idle':
      return '';
  }
}

function renderKnowledgeMapExplainView(node: KnowledgeMapNodeDetailState): string {
  if (node.explainStatus === 'error') {
    return `
      <div class="empty-line">${escapeHtml(node.explainError ?? 'Could not generate this lesson.')}</div>
      <div class="tour-nav"><button class="ai-explain-button" id="km-explain-retry">Try Again</button></div>`;
  }

  const lesson = state.tour.lessons.get(node.file);
  if (node.explainStatus !== 'done' || !lesson) {
    return `<div class="empty-line">Preparing your walkthrough of ${escapeHtml(node.file)}…</div>`;
  }

  return `
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Project Context</div>
        <div class="ai-briefing-label">${escapeHtml(lesson.title)}</div>
        <p class="ai-briefing-text">${escapeHtml(lesson.responsibility)}</p>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Key Constructs</div>
        ${lesson.keyConstructs.map(renderConstructCard).join('')}
      </div>
      <div class="ai-briefing-divider"></div>
    </div>`;
}

function renderKnowledgeMapPracticeView(node: KnowledgeMapNodeDetailState): string {
  if (node.practiceStatus === 'error') {
    return `
      <div class="empty-line">${escapeHtml(node.practiceError ?? 'Could not build practice scenarios.')}</div>
      <div class="tour-nav"><button class="ai-explain-button" id="km-practice-retry">Try Again</button></div>`;
  }

  const plan = state.knowledgeMap.filePracticePlans.get(node.file);
  if (node.practiceStatus !== 'ready' || !plan) {
    return `<div class="empty-line">Building practice scenarios for ${escapeHtml(node.file)}…</div>`;
  }

  const total = plan.scenarios.length;
  const index = node.practiceScenarioIndex;
  if (index >= total) {
    return `
      <div class="ai-briefing">
        <div class="ai-briefing-divider"></div>
        <div class="ai-briefing-block">
          <p class="ai-briefing-text">You've worked through every practice scenario for this file.</p>
        </div>
        <div class="ai-briefing-divider"></div>
      </div>`;
  }

  const scenario = plan.scenarios[index]!;
  const answered = node.practiceSelectedOption !== undefined;
  const gotItRight = answered && scenario.options[node.practiceSelectedOption!] === scenario.correctOption;

  return `
    <div class="tour-progress">Scenario ${index + 1} of ${total}</div>
    <div class="ai-briefing">
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="tour-section-label">Scenario</div>
        <p class="ai-briefing-text">${escapeHtml(scenario.situation)}</p>
      </div>
      <div class="ai-briefing-divider"></div>
      <div class="ai-briefing-block">
        <div class="scenario-options">
          ${scenario.options
            .map((option, i) => {
              const isCorrect = option === scenario.correctOption;
              const isSelected = node.practiceSelectedOption === i;
              const cls = !answered ? '' : isSelected && isCorrect ? 'correct' : isSelected ? 'incorrect' : isCorrect ? 'correct-reveal' : '';
              return `<button class="scenario-option km-scenario-option ${cls}" data-index="${i}" ${answered ? 'disabled' : ''}>${escapeHtml(option)}</button>`;
            })
            .join('')}
        </div>
        ${
          answered
            ? `
        <div class="scenario-explanation">
          <div class="tour-section-label">${gotItRight ? '✓ Good reasoning' : "Let's look at why"}</div>
          <p class="ai-briefing-text">${escapeHtml(scenario.explanation)}</p>
        </div>`
            : ''
        }
      </div>
      <div class="ai-briefing-divider"></div>
    </div>
    ${answered ? `<div class="tour-nav"><button class="ai-explain-button" id="km-scenario-continue">${index + 1 === total ? 'Finish' : 'Continue →'}</button></div>` : ''}`;
}

function renderKnowledgeMapNodeDetail(node: KnowledgeMapNodeDetailState): string {
  const status = learningStatusFor(node.file);
  const heading = `
    <div class="screen-heading">
      <h2>🕸️ ${escapeHtml(node.file)}</h2>
      <p>${status.icon} ${escapeHtml(status.label)}</p>
    </div>`;
  const backNav = `<div class="tour-nav"><button class="ai-link-button" id="km-back">← Back to graph</button></div>`;

  if (node.view === 'explain') {
    return `${heading}${renderKnowledgeMapExplainView(node)}${backNav}`;
  }
  if (node.view === 'practice') {
    return `${heading}${renderKnowledgeMapPracticeView(node)}${backNav}`;
  }

  const alreadyMastered = state.learningProgress.mastered.has(node.file);

  return `
    ${heading}
    <div class="ai-actions km-node-actions">
      <button class="rescan-button" id="km-open-file">Open File</button>
      <button class="ai-explain-button" id="km-explain-file">Explain this File</button>
      <button class="ai-explain-button" id="km-practice-file">Practice this File</button>
      <button class="ai-link-button" id="km-mark-learned" ${alreadyMastered ? 'disabled' : ''}>
        ${alreadyMastered ? '⭐ Mastered' : '⭐ Mark as Learned'}
      </button>
    </div>
    ${backNav}`;
}

function renderGuidedTourScreen(): string {
  if (state.aiConfig.editingConfig || !state.aiConfig.configured) {
    return renderAISettingsForm();
  }
  if (state.practice.phase !== 'idle') {
    return renderPracticeFlow();
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
  document.body.classList.remove('graph-mode');
  appShell.classList.remove('graph-mode');
  graphMount.style.display = 'none';
  appShell.innerHTML = `
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

function selectGraphNode(file: string): void {
  state.knowledgeMap.node = {
    file,
    view: 'menu',
    explainStatus: 'idle',
    practiceStatus: 'idle',
    practiceScenarioIndex: 0,
  };
  render();
}

function startFilePractice(file: string): void {
  const cached = state.knowledgeMap.filePracticePlans.has(file);
  state.activeTab = 'projectGraph';
  state.knowledgeMap.node = {
    file,
    view: 'practice',
    explainStatus: 'idle',
    practiceStatus: cached ? 'ready' : 'generating',
    practiceScenarioIndex: 0,
  };
  render();
  if (state.status !== 'done') {
    pendingPracticeFile = file;
    return;
  }
  if (!cached) vscodeApi.postMessage({ type: 'requestFilePractice', file });
}

/**
 * Mounts (once) and re-renders the React Flow graph canvas into its own
 * persistent container — never through the vanilla innerHTML rewrite below,
 * so pan/zoom/search state survives unrelated re-renders.
 */
function updateGraphCanvas(): void {
  if (!graphRoot) {
    graphRoot = createRoot(graphMount);
  }

  const model = buildProjectGraphViewModel(state.result, learningStatusFor, { includeAll: true });
  graphRoot.render(
    createElement(ProjectGraphCanvas, {
      nodes: model.nodes,
      edges: model.edges,
      selectedFile: state.knowledgeMap.node?.file ?? null,
      onSelectFile: selectGraphNode,
    }),
  );
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

  const showingGraphCanvas = state.activeTab === 'projectGraph' && !state.knowledgeMap.node;

  // The normal screens benefit from the roomy project header and pipeline.
  // On the graph, however, that chrome can consume about half of a short
  // editor viewport (particularly when VS Code's panel is open). Compact it
  // so React Flow receives the viewport rather than only its lower half.
  document.body.classList.toggle('graph-mode', showingGraphCanvas);
  appShell.classList.toggle('graph-mode', showingGraphCanvas);

  if (showingGraphCanvas) {
    appShell.innerHTML = `${renderHeader()}${renderPipeline()}${renderTabBar()}`;
    graphMount.style.display = '';
    updateGraphCanvas();
  } else {
    graphMount.style.display = 'none';
    const screen =
      state.activeTab === 'overview'
        ? renderOverviewBody()
        : state.activeTab === 'startingFiles'
          ? renderStartingFilesScreen()
          : state.activeTab === 'projectGraph'
            ? renderKnowledgeMapNodeDetail(state.knowledgeMap.node!)
            : renderGuidedTourScreen();

    appShell.innerHTML = `
    ${renderHeader()}
    ${renderPipeline()}
    ${renderTabBar()}
    ${screen}
  `;
  }

  document.getElementById('rescan')?.addEventListener('click', () => {
    vscodeApi.postMessage({ type: 'rescan' });
  });

  document.querySelectorAll<HTMLElement>('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      state.activeTab =
        tab === 'startingFiles' || tab === 'guidedTour' || tab === 'projectGraph' ? tab : 'overview';
      render();
    });
  });

  document.getElementById('ai-api-key')?.addEventListener('input', (event) => {
    state.aiConfig.apiKeyDraft = (event.target as HTMLInputElement).value;
  });
  document.getElementById('ai-provider')?.addEventListener('change', (event) => {
    const provider = (event.target as HTMLSelectElement).value as AIProviderId;
    state.aiConfig.providerDraft = provider;
    state.aiConfig.modelDraft = providerOption(provider).defaultModel;
    state.aiConfig.apiKeyDraft = '';
    state.aiConfig.testStatus = 'idle';
    state.aiConfig.testMessage = undefined;
    render();
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
      provider: state.aiConfig.providerDraft,
      apiKey: state.aiConfig.apiKeyDraft,
      model: state.aiConfig.modelDraft || providerOption(state.aiConfig.providerDraft).defaultModel,
    });
  });
  document.getElementById('ai-save')?.addEventListener('click', () => {
    if (!state.aiConfig.apiKeyDraft) return;
    vscodeApi.postMessage({
      type: 'aiSaveConfig',
      provider: state.aiConfig.providerDraft,
      apiKey: state.aiConfig.apiKeyDraft,
      model: state.aiConfig.modelDraft || providerOption(state.aiConfig.providerDraft).defaultModel,
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
  document.getElementById('workspace-api-key')?.addEventListener('click', () => {
    state.activeTab = 'guidedTour';
    state.aiConfig.editingConfig = true;
    state.aiConfig.testStatus = 'idle';
    state.aiConfig.testMessage = undefined;
    render();
  });
  document.getElementById('workspace-practice-file')?.addEventListener('click', (event) => {
    const file = (event.currentTarget as HTMLElement).dataset.file;
    if (file) startFilePractice(file);
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
  document.getElementById('tour-practice-file')?.addEventListener('click', () => {
    const file = state.result.startingFiles[state.tour.fileIndex]?.file;
    if (file) startFilePractice(file);
  });
  document.getElementById('tour-return-overview')?.addEventListener('click', () => {
    state.activeTab = 'overview';
    render();
  });

  document.getElementById('tour-start-assessment')?.addEventListener('click', () => {
    state.practice = createInitialPracticeState();
    state.practice.phase = 'confidence';
    render();
  });

  document.querySelectorAll<HTMLElement>('.confidence-option').forEach((button) => {
    button.addEventListener('click', () => {
      const level = button.dataset.level as FileConfidence;
      const files = touredFiles();
      const file = files[state.practice.confidenceIndex];
      if (!file) return;

      state.practice.ratings[file] = level;

      if (state.practice.confidenceIndex + 1 < files.length) {
        state.practice.confidenceIndex += 1;
        render();
        return;
      }

      state.practice.phase = 'generating';
      render();
      vscodeApi.postMessage({ type: 'submitConfidenceProfile', ratings: { ...state.practice.ratings } });
    });
  });
  document.getElementById('confidence-previous')?.addEventListener('click', () => {
    state.practice.confidenceIndex = Math.max(0, state.practice.confidenceIndex - 1);
    render();
  });

  document.querySelectorAll<HTMLElement>('.scenario-option').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const scenario = state.practice.plan?.scenarios[state.practice.scenarioIndex];
      state.practice.selectedOption = index;
      render();
      if (scenario) {
        vscodeApi.postMessage({
          type: 'recordPracticeAttempt',
          file: scenario.correctOption,
          correct: scenario.options[index] === scenario.correctOption,
        });
      }
    });
  });
  document.getElementById('scenario-continue')?.addEventListener('click', () => {
    const plan = state.practice.plan;
    if (!plan) return;
    state.practice.scenarioIndex += 1;
    state.practice.selectedOption = undefined;
    if (state.practice.scenarioIndex >= plan.scenarios.length) {
      state.practice.phase = 'done';
    }
    render();
  });
  document.getElementById('practice-retry')?.addEventListener('click', () => {
    state.practice.phase = 'generating';
    render();
    vscodeApi.postMessage({ type: 'submitConfidenceProfile', ratings: { ...state.practice.ratings } });
  });
  document.getElementById('practice-return-overview')?.addEventListener('click', () => {
    state.activeTab = 'overview';
    render();
  });

  document.getElementById('km-back')?.addEventListener('click', () => {
    state.knowledgeMap.node = undefined;
    render();
  });
  document.getElementById('km-open-file')?.addEventListener('click', () => {
    const file = state.knowledgeMap.node?.file;
    if (file) {
      vscodeApi.postMessage({ type: 'openFile', file });
    }
  });
  document.getElementById('km-mark-learned')?.addEventListener('click', () => {
    const file = state.knowledgeMap.node?.file;
    if (file) {
      vscodeApi.postMessage({ type: 'markFileLearned', file });
    }
  });
  document.getElementById('km-explain-file')?.addEventListener('click', () => {
    const node = state.knowledgeMap.node;
    if (!node) return;
    node.view = 'explain';
    if (state.tour.lessons.has(node.file)) {
      node.explainStatus = 'done';
      render();
      return;
    }
    node.explainStatus = 'generating';
    render();
    vscodeApi.postMessage({ type: 'explainFile', file: node.file });
  });
  document.getElementById('km-explain-retry')?.addEventListener('click', () => {
    const node = state.knowledgeMap.node;
    if (!node) return;
    node.explainStatus = 'generating';
    render();
    vscodeApi.postMessage({ type: 'explainFile', file: node.file });
  });
  document.getElementById('km-practice-file')?.addEventListener('click', () => {
    const node = state.knowledgeMap.node;
    if (!node) return;
    startFilePractice(node.file);
  });
  document.getElementById('km-practice-retry')?.addEventListener('click', () => {
    const node = state.knowledgeMap.node;
    if (!node) return;
    node.practiceStatus = 'generating';
    render();
    vscodeApi.postMessage({ type: 'requestFilePractice', file: node.file });
  });
  document.querySelectorAll<HTMLElement>('.km-scenario-option').forEach((button) => {
    button.addEventListener('click', () => {
      const node = state.knowledgeMap.node;
      const plan = node && state.knowledgeMap.filePracticePlans.get(node.file);
      const scenario = plan?.scenarios[node!.practiceScenarioIndex];
      if (!node || !scenario) return;

      const index = Number(button.dataset.index);
      node.practiceSelectedOption = index;
      render();
      vscodeApi.postMessage({
        type: 'recordPracticeAttempt',
        file: scenario.correctOption,
        correct: scenario.options[index] === scenario.correctOption,
      });
    });
  });
  document.getElementById('km-scenario-continue')?.addEventListener('click', () => {
    const node = state.knowledgeMap.node;
    if (!node) return;
    node.practiceScenarioIndex += 1;
    node.practiceSelectedOption = undefined;
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
      if (pendingPracticeFile) {
        const file = pendingPracticeFile;
        pendingPracticeFile = undefined;
        startFilePractice(file);
        return;
      }
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
      if (message.provider) {
        state.aiConfig.providerDraft = message.provider;
      }
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
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.explainStatus = 'generating';
      }
      break;
    case 'fileLessonResult':
      state.tour.lessons.set(message.file, message.lesson);
      if (message.file === state.result.startingFiles[state.tour.fileIndex]?.file) {
        state.tour.status = 'done';
      }
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.explainStatus = 'done';
      }
      break;
    case 'fileLessonError':
      if (message.file === state.result.startingFiles[state.tour.fileIndex]?.file) {
        state.tour.status = 'error';
        state.tour.errorMessage = message.message;
      }
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.explainStatus = 'error';
        state.knowledgeMap.node.explainError = message.message;
      }
      break;
    case 'practicePlanGenerating':
      state.practice.phase = 'generating';
      break;
    case 'practicePlanResult':
      state.practice.plan = message.plan;
      state.practice.phase = 'ready';
      state.practice.scenarioIndex = 0;
      state.practice.selectedOption = undefined;
      break;
    case 'practicePlanError':
      state.practice.phase = 'error';
      state.practice.errorMessage = message.message;
      break;
    case 'filePracticeGenerating':
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.practiceStatus = 'generating';
      }
      break;
    case 'filePracticeResult':
      state.knowledgeMap.filePracticePlans.set(message.file, message.plan);
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.practiceStatus = 'ready';
        state.knowledgeMap.node.practiceScenarioIndex = 0;
        state.knowledgeMap.node.practiceSelectedOption = undefined;
      }
      break;
    case 'filePracticeError':
      if (state.knowledgeMap.node?.file === message.file) {
        state.knowledgeMap.node.practiceStatus = 'error';
        state.knowledgeMap.node.practiceError = message.message;
      }
      break;
    case 'learningProgress':
      state.learningProgress = {
        explained: new Set(message.explained),
        practiced: new Set(message.practiced),
        mastered: new Set(message.mastered),
        commentary: new Map(Object.entries(message.commentary)),
      };
      break;
    case 'navigateToTab':
      state.activeTab = message.tab;
      state.knowledgeMap.node = undefined;
      break;
    case 'showAIConfig':
      state.activeTab = 'guidedTour';
      state.aiConfig.editingConfig = true;
      state.aiConfig.testStatus = 'idle';
      state.aiConfig.testMessage = undefined;
      break;
    case 'startFilePractice':
      startFilePractice(message.file);
      return;
  }

  render();
});

render();
vscodeApi.postMessage({ type: 'ready' });
