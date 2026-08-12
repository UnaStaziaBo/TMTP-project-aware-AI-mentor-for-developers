import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { JSDOM } from 'jsdom';

// Left permanently in place for the life of the test process (not torn down
// per-test): React Flow's viewport/zoom animation keeps rescheduling itself
// via rAF for a little while after unmount, and tearing this down too early
// just turns that harmless tail activity into a spurious uncaught exception.
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

async function withGraphDom<T>(run: () => Promise<T>): Promise<T> {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>');
  const { window } = dom;

  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      // React Flow waits for a measured, non-zero size before laying nodes out.
      this.callback(
        [
          {
            target,
            contentRect: { width: 200, height: 80, top: 0, left: 0, bottom: 80, right: 200, x: 0, y: 0 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }

  (globalThis as any).window = window;
  (globalThis as any).document = window.document;
  (globalThis as any).navigator = window.navigator;
  (globalThis as any).HTMLElement = window.HTMLElement;
  (globalThis as any).SVGElement = window.SVGElement;
  (globalThis as any).Element = window.Element;
  (globalThis as any).Node = window.Node;
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (window as any).ResizeObserver = FakeResizeObserver;
  // Assigned directly on this jsdom window (not just globalThis) and never
  // torn down for this window instance — see the top-of-file note on why.
  (window as any).requestAnimationFrame = (globalThis as any).requestAnimationFrame;
  (window as any).cancelAnimationFrame = (globalThis as any).cancelAnimationFrame;

  class FakeDOMMatrixReadOnly {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: readonly number[]) {
      if (init && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init as [number, number, number, number, number, number];
      }
    }
  }
  (globalThis as any).DOMMatrixReadOnly = FakeDOMMatrixReadOnly;
  (window as any).DOMMatrixReadOnly = FakeDOMMatrixReadOnly;

  try {
    return await run();
  } finally {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).navigator;
    delete (globalThis as any).HTMLElement;
    delete (globalThis as any).SVGElement;
    delete (globalThis as any).Element;
    delete (globalThis as any).Node;
    delete (globalThis as any).ResizeObserver;
    delete (globalThis as any).DOMMatrixReadOnly;
  }
}

function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ProjectGraphCanvas (real DOM via jsdom)', () => {
  it('requests the architecture projection once when no model has reached the webview yet', async () => {
    await withGraphDom(async () => {
      const { createElement } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { ProjectGraphCanvas } = await import('../src/webview/graph/ProjectGraphCanvas.js');
      const container = document.getElementById('app')!;
      Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });
      let requests = 0;
      const root = createRoot(container);
      root.render(createElement(ProjectGraphCanvas, { nodes: [], edges: [], selectedFile: null, onSelectFile: () => {}, onRequestArchitecture: () => { requests += 1; } }));
      await tick(80);

      assert.equal(requests, 1, 'opening Project Graph should use one existing architecture request path');
      assert.ok(container.textContent?.includes('Analyzing verified project evidence…'));
      assert.equal([...container.querySelectorAll('button')].filter((button) => button.textContent === 'Dependencies' || button.textContent === 'Architecture').length, 0);

      root.unmount();
      await tick(50);
    });
  });

  it('opens directly into the cached architecture projection without initializing the dependency canvas', async () => {
    await withGraphDom(async () => {
      const { createElement } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { ProjectGraphCanvas } = await import('../src/webview/graph/ProjectGraphCanvas.js');
      const nodes = [
        { file: 'src/main.ts', title: 'main.ts', area: 'Source', description: 'Entry point', score: 70, confidence: 0.7, tier: 'large' as const, learningStatus: { icon: '⚪', label: 'Not visited' }, hasEdge: true },
        { file: 'src/adapter.ts', title: 'adapter.ts', area: 'Source', description: 'Adapter', score: 30, confidence: 0.3, tier: 'medium' as const, learningStatus: { icon: '⚪', label: 'Not visited' }, hasEdge: true },
      ];
      const architecture = {
        fingerprint: 'fixture', summary: 'Fixture', warnings: [], fileRoles: [],
        areas: [
          { id: 'entry', name: 'Entry', shortPurpose: 'Starts the app.', files: ['src/main.ts'], importantFiles: ['src/main.ts'], evidenceFiles: ['src/main.ts'], confidence: 0.8 },
          { id: 'adapter', name: 'Adapter', shortPurpose: 'Adapts services.', files: ['src/adapter.ts'], importantFiles: ['src/adapter.ts'], evidenceFiles: ['src/adapter.ts'], confidence: 0.7 },
        ],
        relationships: [{ sourceAreaId: 'entry', targetAreaId: 'adapter', label: 'uses', explanation: 'Entry uses adapter.', evidenceFiles: ['src/main.ts'], confidence: 0.7 }],
      };
      let requests = 0;
      let selected: string | null = null;
      const container = document.getElementById('app')!;
      Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });
      const root = createRoot(container);
      root.render(createElement(ProjectGraphCanvas, { nodes, edges: [], selectedFile: null, onSelectFile: (file: string) => { selected = file; }, architecture, onRequestArchitecture: () => { requests += 1; } }));
      await tick(250);

      const architectureNodes = [...container.querySelectorAll('.architecture-graph-node')];
      assert.equal(architectureNodes.length, 3, 'root and validated areas should render on the canvas');
      assert.equal(container.querySelectorAll('.graph-node').length, 0, 'the legacy dependency canvas must not initialize behind Architecture');
      assert.equal([...container.querySelectorAll('button')].filter((button) => button.textContent === 'Dependencies' || button.textContent === 'Architecture').length, 0, 'Project Graph no longer exposes graph modes');
      const entryArea = architectureNodes.find((node) => node.textContent?.includes('Entry'))!;
      assert.ok(entryArea.querySelector('.architecture-graph-purpose')?.textContent?.includes('Starts the app.'));
      assert.ok(entryArea.querySelector('.architecture-graph-actions button'), 'the expand action belongs inside its architecture card');
      assert.ok(entryArea.closest('.react-flow__node')?.getAttribute('style')?.includes('width: 280px'), 'ELK uses the larger architecture-card width');
      assert.ok(container.textContent?.includes('Architecture Navigator'));
      const navigatorAreas = [...container.querySelectorAll('.architecture-navigator-node.area')];
      assert.equal(navigatorAreas.length, 2, 'navigator should show only the root-level architecture areas');
      const navigatorEntry = navigatorAreas.find((area) => area.getAttribute('aria-label')?.startsWith('Entry,'));
      assert.ok(navigatorEntry, 'expected Entry to be navigable from the architecture navigator');
      navigatorEntry!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(30);
      assert.ok(container.querySelector('.architecture-navigator-summary')?.textContent?.includes('Entry'), 'navigator should describe the selected area');
      assert.equal(container.querySelectorAll('.react-flow__edge.animated').length, 0, 'architecture edges remain static during graph interactions');
      assert.equal(requests, 0, 'viewing cached architecture must not trigger another AI request');

      const help = [...container.querySelectorAll('button')].find((button) => button.textContent === 'How to read this map?');
      assert.ok(help, 'expected architecture help affordance');
      help!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      const fit = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fit to Screen');
      fit!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(30);
      assert.equal(requests, 0, 'architecture help and viewport interactions must not request analysis');

      const search = container.querySelector<HTMLInputElement>('.graph-search-input');
      assert.ok(search, 'Architecture search remains available without selecting a graph mode');
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      valueSetter.call(search, 'adapter.ts');
      search.dispatchEvent(new window.Event('input', { bubbles: true }));
      await tick(300);
      assert.ok([...container.querySelectorAll('.graph-node-title')].some((element) => element.textContent === 'adapter.ts'), 'search reveals canonical files in the Architecture graph');

      const expand = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Expand');
      assert.ok(expand, 'expected an architecture-area expansion affordance');
      expand!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(300);
      assert.ok([...container.querySelectorAll('.graph-node-title')].some((element) => element.textContent === 'adapter.ts'));
      assert.equal(container.querySelectorAll('.architecture-navigator-node.area').length, 2, 'expanded files must not clutter the architecture navigator');
      const adapterFile = [...container.querySelectorAll('.graph-node')].find((node) => node.textContent?.includes('adapter.ts'));
      assert.ok(adapterFile, 'expanded canonical files retain their existing selection behavior');
      adapterFile!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(30);
      assert.equal(selected, 'src/adapter.ts');
      assert.equal(requests, 0, 'exploring the architecture canvas must not request analysis');

      root.unmount();
      await tick(50);
    });
  });
});
