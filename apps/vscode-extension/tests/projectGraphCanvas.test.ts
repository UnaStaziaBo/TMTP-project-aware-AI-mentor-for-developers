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
  it('mounts, renders a node per file, and reports clicks via onSelectFile', async () => {
    await withGraphDom(async () => {
      const { createElement } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { ProjectGraphCanvas } = await import('../src/webview/graph/ProjectGraphCanvas.js');

      const nodes = [
        {
          file: 'app/main.py',
          title: 'main.py',
          area: 'App',
          description: 'Entry point',
          score: 55,
          confidence: 0.55,
          tier: 'large' as const,
          learningStatus: { icon: '⚪', label: 'Not visited' },
          hasEdge: true,
        },
        {
          file: 'app/router.py',
          title: 'router.py',
          area: 'App',
          description: 'Routing',
          score: 10,
          confidence: 0.1,
          tier: 'small' as const,
          learningStatus: { icon: '🟡', label: 'Explained' },
          hasEdge: true,
        },
      ];
      const edges = [{ id: 'app/main.py=>app/router.py', source: 'app/main.py', target: 'app/router.py' }];

      let selected: string | null = null;
      const container = document.getElementById('app')!;
      Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });

      const root = createRoot(container);
      root.render(
        createElement(ProjectGraphCanvas, {
          nodes,
          edges,
          selectedFile: null,
          onSelectFile: (file: string) => {
            selected = file;
          },
        }),
      );

      await tick(150);

      const renderedNodes = container.querySelectorAll('.graph-node');
      assert.equal(renderedNodes.length, 2, `expected 2 graph nodes in the DOM, got ${renderedNodes.length}`);

      const titles = [...container.querySelectorAll('.graph-node-title')].map((el) => el.textContent);
      assert.ok(titles.includes('main.py'));
      assert.ok(titles.includes('router.py'));

      const mainNode = [...renderedNodes].find((el) => el.textContent?.includes('main.py'));
      assert.ok(mainNode, 'could not find the main.py node element to click');
      (mainNode as HTMLElement).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

      await tick(50);
      assert.equal(selected, 'app/main.py');

      root.unmount();
      await tick(50);
    });
  });

  it('shows only core nodes by default but reveals orphan nodes in the All files view', async () => {
    await withGraphDom(async () => {
      const { createElement } = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { ProjectGraphCanvas } = await import('../src/webview/graph/ProjectGraphCanvas.js');

      const nodes = [
        {
          file: 'app/main.py',
          title: 'main.py',
          area: 'App',
          description: 'Entry point',
          score: 55,
          confidence: 0.55,
          tier: 'large' as const,
          learningStatus: { icon: '⚪', label: 'Not visited' },
          hasEdge: false,
        },
        {
          file: 'app/orphan.py',
          title: 'orphan.py',
          area: 'App',
          description: 'orphan',
          score: 0,
          confidence: 0,
          tier: 'small' as const,
          learningStatus: { icon: '⚪', label: 'Not visited' },
          hasEdge: false,
        },
      ];

      const container = document.getElementById('app')!;
      Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });

      const root = createRoot(container);
      root.render(createElement(ProjectGraphCanvas, { nodes, edges: [], selectedFile: null, onSelectFile: () => {} }));
      await tick(150);

      let titles = [...container.querySelectorAll('.graph-node-title')].map((el) => el.textContent);
      assert.ok(titles.includes('main.py'));
      assert.ok(!titles.includes('orphan.py'), 'orphan file should be hidden by default');

      const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('All files'));
      assert.ok(toggle, 'expected an "All files" view button');
      toggle!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(150);

      titles = [...container.querySelectorAll('.graph-node-title')].map((el) => el.textContent);
      assert.ok(titles.includes('orphan.py'), 'orphan file should appear in the All files view');

      root.unmount();
      await tick(50);
    });
  });

  it('switches to the cached architecture projection without requesting another analysis', async () => {
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
      const container = document.getElementById('app')!;
      Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });
      const root = createRoot(container);
      root.render(createElement(ProjectGraphCanvas, { nodes, edges: [], selectedFile: null, onSelectFile: () => {}, architecture, onRequestArchitecture: () => { requests += 1; } }));
      await tick(150);

      const architectureButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Architecture');
      assert.ok(architectureButton, 'expected the Architecture mode switch');
      architectureButton!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(250);

      const architectureNodes = [...container.querySelectorAll('.architecture-graph-node')];
      assert.equal(architectureNodes.length, 3, 'root and validated areas should render on the canvas');
      const entryArea = architectureNodes.find((node) => node.textContent?.includes('Entry'))!;
      assert.ok(entryArea.querySelector('.architecture-graph-purpose')?.textContent?.includes('Starts the app.'));
      assert.ok(entryArea.querySelector('.architecture-graph-actions button'), 'the expand action belongs inside its architecture card');
      assert.ok(entryArea.closest('.react-flow__node')?.getAttribute('style')?.includes('width: 280px'), 'ELK uses the larger architecture-card width');
      assert.ok(container.textContent?.includes('Architecture overview'));
      assert.equal(container.querySelectorAll('.react-flow__edge.animated').length, 0, 'architecture edges remain static during graph interactions');
      assert.equal(requests, 0, 'viewing cached architecture must not trigger another AI request');

      const help = [...container.querySelectorAll('button')].find((button) => button.textContent === 'How to read this map?');
      assert.ok(help, 'expected architecture help affordance');
      help!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      const fit = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fit to Screen');
      fit!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(30);
      assert.equal(requests, 0, 'architecture help and viewport interactions must not request analysis');

      const expand = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Expand');
      assert.ok(expand, 'expected an architecture-area expansion affordance');
      expand!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(300);
      assert.ok([...container.querySelectorAll('.graph-node-title')].some((element) => element.textContent === 'adapter.ts'));
      assert.equal(requests, 0, 'exploring the architecture canvas must not request analysis');

      root.unmount();
      await tick(50);
    });
  });
});
