import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { GraphNodeView } from '../src/projectGraphView.js';
import {
  buildRepositoryHierarchy,
  expansionForFile,
  initialExpandedGroups,
  projectVisibleGraph,
} from '../src/webview/graph/repositoryHierarchy.js';

function node(file: string): GraphNodeView {
  return {
    file,
    title: file.split('/').pop()!,
    area: 'Test',
    description: 'Test file',
    score: file.includes('main') ? 10 : 0,
    confidence: file.includes('main') ? 0.1 : 0,
    tier: 'small',
    learningStatus: { icon: '⚪', label: 'Not visited' },
    hasEdge: false,
  };
}

function project(files: string[], edges: Array<[string, string]> = []) {
  const nodes = files.map(node);
  const hierarchy = buildRepositoryHierarchy(nodes);
  return {
    nodes,
    hierarchy,
    edges: edges.map(([source, target]) => ({ id: `${source}=>${target}`, source, target, kind: 'import' as const })),
  };
}

describe('repository hierarchy and visible graph projection', () => {
  it('shows a tiny flat repository as files without group-only indirection', () => {
    const { nodes, hierarchy, edges } = project(['a.py', 'b.py', 'c.py', 'd.py']);
    const projection = projectVisibleGraph(hierarchy, nodes, edges, new Set(nodes.map((entry) => entry.file)), initialExpandedGroups(hierarchy));
    assert.deepEqual(projection.nodes.map((entry) => entry.file), ['a.py', 'b.py', 'c.py', 'd.py']);
  });

  it('preserves a single-file project as a direct file node', () => {
    const { nodes, hierarchy, edges } = project(['main.py']);
    const projection = projectVisibleGraph(hierarchy, nodes, edges, new Set(['main.py']), initialExpandedGroups(hierarchy));
    assert.deepEqual(projection.nodes.map((entry) => entry.file), ['main.py']);
  });

  it('builds deterministic nested directories and compresses unbranched paths', () => {
    const { nodes, hierarchy, edges } = project(['src/components/projectGraph/Canvas.tsx', 'src/components/projectGraph/layout.ts']);
    const projection = projectVisibleGraph(hierarchy, nodes, edges, new Set(nodes.map((entry) => entry.file)), new Set(['']));
    assert.deepEqual(projection.nodes.map((entry) => entry.file), ['group:src/components/projectGraph']);
    assert.deepEqual(
      [...expansionForFile(hierarchy, 'src/components/projectGraph/Canvas.tsx')],
      ['', 'src', 'src/components', 'src/components/projectGraph'],
    );
  });

  it('keeps package boundaries explicit in a large monorepo initial view', () => {
    const files = [
      'apps/a/package.json', 'apps/a/src/main.ts', 'packages/b/package.json', 'packages/b/src/index.ts', 'packages/c/package.json',
      ...Array.from({ length: 10 }, (_, index) => `docs/${index}.md`),
    ];
    const { nodes, hierarchy, edges } = project(files);
    const projection = projectVisibleGraph(hierarchy, nodes, edges, new Set(files), initialExpandedGroups(hierarchy));
    const ids = projection.nodes.map((entry) => entry.file);
    assert.ok(ids.includes('group:apps/a'));
    assert.ok(ids.includes('group:packages/b'));
    assert.ok(ids.includes('group:packages/c'));
  });

  it('expands and collapses groups without removing files from the complete model', () => {
    const { nodes, hierarchy, edges } = project(['src/a.ts', 'src/b.ts', 'test/c.ts']);
    const files = new Set(nodes.map((entry) => entry.file));
    const collapsed = projectVisibleGraph(hierarchy, nodes, edges, files, new Set(['']));
    const expanded = projectVisibleGraph(hierarchy, nodes, edges, files, new Set(['', 'src']));
    assert.ok(collapsed.nodes.some((entry) => entry.file === 'group:src'));
    assert.ok(!collapsed.nodes.some((entry) => entry.file === 'src/a.ts'));
    assert.ok(expanded.nodes.some((entry) => entry.file === 'src/a.ts'));
    assert.equal(hierarchy.groups.get('')!.descendantFiles.length, 3);
  });

  it('aggregates cross-group dependencies and suppresses hidden internal dependencies', () => {
    const { nodes, hierarchy, edges } = project(
      ['a/x.ts', 'a/y.ts', 'b/z.ts'],
      [['a/x.ts', 'b/z.ts'], ['a/y.ts', 'b/z.ts'], ['a/x.ts', 'a/y.ts']],
    );
    const projection = projectVisibleGraph(hierarchy, nodes, edges, new Set(nodes.map((entry) => entry.file)), new Set(['']));
    assert.equal(projection.edges.length, 1);
    assert.equal(projection.edges[0]!.id, 'group:a=>group:b');
    assert.equal(projection.edges[0]!.underlyingEdgeCount, 2);
  });

  it('reveals every deeply hidden file through its deterministic ancestors', () => {
    const file = 'packages/scanner/src/dependencies/detectors/JWTDetector.ts';
    const { nodes, hierarchy, edges } = project([file, 'packages/scanner/package.json', 'apps/ui/package.json']);
    const visibleFiles = new Set(nodes.map((entry) => entry.file));
    const projection = projectVisibleGraph(hierarchy, nodes, edges, visibleFiles, expansionForFile(hierarchy, file));
    assert.ok(projection.nodes.some((entry) => entry.file === file));
  });

  it('is deterministic and keeps edgeless isolated files reachable', () => {
    const { nodes, hierarchy, edges } = project(['z/isolated.ts', 'a/other.ts', 'a/main.ts']);
    const expanded = new Set(['']);
    const first = projectVisibleGraph(hierarchy, nodes, edges, new Set(nodes.map((entry) => entry.file)), expanded);
    const second = projectVisibleGraph(hierarchy, [...nodes].reverse(), edges, new Set(nodes.map((entry) => entry.file)), expanded);
    assert.deepEqual(first.nodes.map((entry) => entry.file), second.nodes.map((entry) => entry.file));
    assert.equal(hierarchy.groups.get('')!.descendantFiles.length, 3);
  });
});
