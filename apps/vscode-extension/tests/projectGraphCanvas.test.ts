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

  it('hides orphan (no score, no edge) nodes by default but reveals them via "Show more files"', async () => {
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

      const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Show'));
      assert.ok(toggle, 'expected a "Show N more files" toggle button');
      toggle!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await tick(150);

      titles = [...container.querySelectorAll('.graph-node-title')].map((el) => el.textContent);
      assert.ok(titles.includes('orphan.py'), 'orphan file should appear after toggling "Show more files"');

      root.unmount();
      await tick(50);
    });
  });
});
