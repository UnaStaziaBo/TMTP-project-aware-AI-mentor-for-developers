import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { layoutProjectGraph, NODE_WIDTH, NODE_HEIGHT } from '../src/webview/graph/layout.js';
import type { GraphNodeView } from '../src/projectGraphView.js';

function node(file: string, tier: GraphNodeView['tier'] = 'medium'): GraphNodeView {
  return {
    file,
    title: file,
    area: 'Test',
    description: 'x',
    score: 0,
    confidence: 0,
    tier,
    learningStatus: { icon: '⚪', label: 'Not visited' },
    hasEdge: false,
  };
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('layoutProjectGraph', () => {
  it('places a depended-upon node higher (smaller y) than its dependent', async () => {
    const nodes = [node('main.ts'), node('lib.ts')];
    const edges = [{ id: 'main.ts=>lib.ts', source: 'main.ts', target: 'lib.ts' }];

    const { nodes: positioned } = await layoutProjectGraph(nodes, edges);
    const main = positioned.find((n) => n.file === 'main.ts')!;
    const lib = positioned.find((n) => n.file === 'lib.ts')!;

    assert.ok(main.y < lib.y, 'the importing file should be laid out above the file it imports');
  });

  it('is deterministic: identical input produces identical output', async () => {
    const nodes = [node('a.ts'), node('b.ts'), node('c.ts')];
    const edges = [
      { id: 'a=>b', source: 'a.ts', target: 'b.ts' },
      { id: 'b=>c', source: 'b.ts', target: 'c.ts' },
    ];

    const first = await layoutProjectGraph(nodes, edges);
    const second = await layoutProjectGraph(nodes, edges);
    assert.deepEqual(first, second);
  });

  it('handles nodes with no edges at all without throwing', async () => {
    const nodes = [node('orphan.ts')];
    const { nodes: positioned } = await layoutProjectGraph(nodes, []);
    assert.equal(positioned.length, 1);
    assert.equal(typeof positioned[0]!.x, 'number');
    assert.equal(typeof positioned[0]!.y, 'number');
  });

  it('arranges multiple edgeless files deterministically without overlap', async () => {
    const nodes = [node('utils.py'), node('hello.py'), node('config.py')];
    const first = await layoutProjectGraph(nodes, []);
    const second = await layoutProjectGraph([...nodes].reverse(), []);

    assert.deepEqual(
      first.nodes
        .map((placed) => [placed.file, { x: placed.x, y: placed.y }])
        .sort(([left], [right]) => left.localeCompare(right)),
      second.nodes
        .map((placed) => [placed.file, { x: placed.x, y: placed.y }])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    for (let i = 0; i < first.nodes.length; i += 1) {
      for (let j = i + 1; j < first.nodes.length; j += 1) {
        assert.ok(!rectsOverlap(first.nodes[i]!, first.nodes[j]!));
      }
    }
  });

  it('keeps a branching dependency graph in stable hierarchical ranks', async () => {
    const nodes = ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map(node);
    const edges = [
      { id: 'a=>b', source: 'a.ts', target: 'b.ts' },
      { id: 'a=>c', source: 'a.ts', target: 'c.ts' },
      { id: 'b=>d', source: 'b.ts', target: 'd.ts' },
      { id: 'c=>d', source: 'c.ts', target: 'd.ts' },
    ];
    const { nodes: positioned } = await layoutProjectGraph(nodes, edges);
    const byFile = new Map(positioned.map((placed) => [placed.file, placed]));

    assert.ok(byFile.get('a.ts')!.y < byFile.get('b.ts')!.y);
    assert.equal(byFile.get('b.ts')!.y, byFile.get('c.ts')!.y);
    assert.ok(byFile.get('b.ts')!.y < byFile.get('d.ts')!.y);
  });

  it('lays out cycles without recursion or unstable output', async () => {
    const nodes = ['a.ts', 'b.ts', 'c.ts'].map(node);
    const edges = [
      { id: 'a=>b', source: 'a.ts', target: 'b.ts' },
      { id: 'b=>c', source: 'b.ts', target: 'c.ts' },
      { id: 'c=>a', source: 'c.ts', target: 'a.ts' },
    ];
    const first = await layoutProjectGraph(nodes, edges);
    const second = await layoutProjectGraph(nodes, edges);

    assert.equal(first.nodes.length, 3);
    assert.equal(first.edges.length, 3);
    assert.deepEqual(first, second);
  });

  it('does not let learning-path overlay edges affect dependency ranks', async () => {
    const nodes = [node('a.ts'), node('b.ts'), node('isolated.ts')];
    const dependencies = [{ id: 'a=>b', source: 'a.ts', target: 'b.ts', kind: 'import' as const }];
    const withLearning = [
      ...dependencies,
      { id: 'learn:a=>isolated', source: 'a.ts', target: 'isolated.ts', kind: 'learning' as const },
    ];
    const base = await layoutProjectGraph(nodes, dependencies);
    const overlay = await layoutProjectGraph(nodes, withLearning);
    const baseByFile = new Map(base.nodes.map((placed) => [placed.file, placed]));
    const overlayByFile = new Map(overlay.nodes.map((placed) => [placed.file, placed]));

    assert.deepEqual(
      { x: overlayByFile.get('a.ts')!.x, y: overlayByFile.get('a.ts')!.y },
      { x: baseByFile.get('a.ts')!.x, y: baseByFile.get('a.ts')!.y },
    );
    assert.deepEqual(
      { x: overlayByFile.get('b.ts')!.x, y: overlayByFile.get('b.ts')!.y },
      { x: baseByFile.get('b.ts')!.x, y: baseByFile.get('b.ts')!.y },
    );
    assert.ok(overlay.edges.some((edge) => edge.id === 'learn:a=>isolated'));
  });

  it('returns an empty layout for an empty graph', async () => {
    const result = await layoutProjectGraph([], []);
    assert.deepEqual(result, { nodes: [], edges: [] });
  });

  it('keeps every node the same size regardless of importance tier', async () => {
    const nodes = [node('big.ts', 'large'), node('small.ts', 'small')];
    const { nodes: positioned } = await layoutProjectGraph(nodes, []);
    const big = positioned.find((n) => n.file === 'big.ts')!;
    const small = positioned.find((n) => n.file === 'small.ts')!;

    assert.equal(big.width, NODE_WIDTH);
    assert.equal(big.height, NODE_HEIGHT);
    assert.equal(small.width, NODE_WIDTH);
    assert.equal(small.height, NODE_HEIGHT);
  });

  it('never overlaps two nodes, even in a dense graph', async () => {
    const nodes = Array.from({ length: 30 }, (_, i) => node(`f${i}.ts`));
    const edges = [];
    for (let i = 1; i < 30; i += 1) {
      edges.push({ id: `e${i}`, source: `f${Math.max(0, i - 1 - (i % 4))}.ts`, target: `f${i}.ts` });
    }

    const { nodes: positioned } = await layoutProjectGraph(nodes, edges);
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        assert.ok(
          !rectsOverlap(positioned[i]!, positioned[j]!),
          `expected ${positioned[i]!.file} and ${positioned[j]!.file} not to overlap`,
        );
      }
    }
  });

  it('routes every edge with a real, multi-point path rather than a straight guess', async () => {
    const nodes = [node('main.ts'), node('lib.ts')];
    const edges = [{ id: 'main.ts=>lib.ts', source: 'main.ts', target: 'lib.ts' }];

    const { edges: routed } = await layoutProjectGraph(nodes, edges);
    assert.equal(routed.length, 1);
    assert.ok(routed[0]!.points.length >= 2);
    for (const point of routed[0]!.points) {
      assert.equal(typeof point.x, 'number');
      assert.equal(typeof point.y, 'number');
    }
  });

  it('drops edges referencing a node outside the given set instead of throwing', async () => {
    const nodes = [node('a.ts')];
    const edges = [{ id: 'a=>ghost', source: 'a.ts', target: 'ghost.ts' }];

    const result = await layoutProjectGraph(nodes, edges);
    assert.equal(result.edges.length, 0);
  });

  it('separates disconnected files from the main dependency chain (no forced hairball)', async () => {
    const nodes = [node('main.ts'), node('lib.ts'), node('unrelated.ts')];
    const edges = [{ id: 'main=>lib', source: 'main.ts', target: 'lib.ts' }];

    const { nodes: positioned } = await layoutProjectGraph(nodes, edges);
    const unrelated = positioned.find((n) => n.file === 'unrelated.ts')!;
    const main = positioned.find((n) => n.file === 'main.ts')!;

    // Disconnected components are placed side by side, not stacked into the
    // same chain — the unrelated file should not simply inherit main's rank.
    assert.ok(!rectsOverlap(unrelated, main));
  });
});
