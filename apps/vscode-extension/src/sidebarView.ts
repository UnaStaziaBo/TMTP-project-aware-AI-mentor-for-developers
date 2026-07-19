import * as vscode from 'vscode';
import type { WorkspaceTab } from './protocol.js';

export interface SidebarSnapshot {
  projectName: string;
  scanned: boolean;
  fileCount: number;
  startingFileCount: number;
  explainedCount: number;
  practicedCount: number;
  masteredCount: number;
  aiConfigured: boolean;
}

export class TmtpSidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'tmtp.home';
  private view?: vscode.WebviewView;
  private snapshot: SidebarSnapshot;

  constructor(
    private readonly openWorkspace: (tab: WorkspaceTab) => void,
    private readonly openAIConfig: () => void,
    initialSnapshot: SidebarSnapshot,
  ) {
    this.snapshot = initialSnapshot;
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message: { type?: string; tab?: WorkspaceTab }) => {
      if (message.type === 'open' && message.tab) this.openWorkspace(message.tab);
      if (message.type === 'configureAI') this.openAIConfig();
    });
    this.render();
  }

  update(snapshot: SidebarSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  private render(): void {
    if (!this.view) return;
    const webview = this.view.webview;
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const s = this.snapshot;
    const nextAction = s.scanned ? 'Continue learning' : 'Scan and understand this project';

    this.view.description = s.scanned ? `${s.masteredCount}/${s.startingFileCount} mastered` : 'Ready to scan';
    webview.html = `<!doctype html><html><head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style nonce="${nonce}">
        *{box-sizing:border-box}body{margin:0;padding:14px;color:var(--vscode-foreground);font:var(--vscode-font-size) var(--vscode-font-family)}
        h2{font-size:15px;margin:0 0 3px}.muted{color:var(--vscode-descriptionForeground);font-size:11px}.hero{padding:12px;border:1px solid var(--vscode-widget-border);border-radius:7px;background:var(--vscode-editorWidget-background);margin-bottom:12px}
        button{width:100%;text-align:left;border:0;border-radius:4px;padding:8px 9px;margin-top:6px;color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground);font:inherit;cursor:pointer}button:hover{background:var(--vscode-button-secondaryHoverBackground)}
        .primary{color:var(--vscode-button-foreground);background:var(--vscode-button-background);font-weight:600;margin-top:12px}.primary:hover{background:var(--vscode-button-hoverBackground)}
        .stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}.stat{padding:8px;border:1px solid var(--vscode-widget-border);border-radius:5px}.value{font-size:17px;font-weight:600}.label{font-size:10px;color:var(--vscode-descriptionForeground)}
        .section{margin-top:16px}.section-title{font-size:10px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}.status{margin-top:10px;font-size:11px;color:${s.aiConfigured ? 'var(--vscode-charts-green)' : 'var(--vscode-descriptionForeground)'}}
      </style></head><body>
      <div class="hero"><h2>${escapeHtml(s.projectName || 'No project open')}</h2><div class="muted">${s.scanned ? `${s.fileCount} files · ${s.startingFileCount} learning stops` : 'TMTP is ready when you are.'}</div>
      <button class="primary" data-tab="${s.scanned ? 'startingFiles' : 'overview'}">${nextAction} →</button></div>
      <div class="stats"><div class="stat"><div class="value">${s.explainedCount}</div><div class="label">Explained</div></div><div class="stat"><div class="value">${s.masteredCount}</div><div class="label">Mastered</div></div></div>
      <div class="section"><div class="section-title">Learning workspace</div>
        <button data-tab="projectGraph">Project Graph</button><button data-tab="overview">Project Overview</button><button data-tab="startingFiles">Where Should I Start?</button><button data-tab="guidedTour">Guided Tour</button>
      </div><div class="status">AI provider: ${s.aiConfigured ? 'Configured' : 'Not configured'}</div>
      <button data-action="configure-ai">⚙ Change API Key</button>
      <script nonce="${nonce}">const vscode=acquireVsCodeApi();document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>vscode.postMessage({type:'open',tab:b.dataset.tab})));document.querySelector('[data-action="configure-ai"]')?.addEventListener('click',()=>vscode.postMessage({type:'configureAI'}));</script>
      </body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
