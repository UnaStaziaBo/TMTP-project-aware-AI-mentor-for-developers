import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphNodeView } from '../src/projectGraphView.js';
import { buildArchitectureGraph } from '../src/webview/graph/architectureGraph.js';
import { layoutProjectGraph } from '../src/webview/graph/layout.js';

const files: GraphNodeView[] = ['src/a.ts', 'src/b.ts', 'src/c.ts'].map((file) => ({ file, title: file.slice(4), area: 'Source', description: 'Real file', score: 0, confidence: 0, tier: 'small', learningStatus: { icon: '⚪', label: 'Not visited' }, hasEdge: false }));
const architecture: ArchitectureModel = {
  fingerprint: 'fixture', summary: 'Fixture architecture.', warnings: [], fileRoles: [],
  areas: [
    { id: 'one', name: 'One', shortPurpose: 'First area.', files: ['src/a.ts', 'src/b.ts'], importantFiles: ['src/a.ts'], evidenceFiles: ['src/a.ts'], confidence: 0.8 },
    { id: 'two', name: 'Two', shortPurpose: 'Second area.', files: ['src/c.ts'], importantFiles: ['src/c.ts'], evidenceFiles: ['src/c.ts'], confidence: 0.7 },
  ],
  relationships: [{ sourceAreaId: 'one', targetAreaId: 'two', label: 'supports', explanation: 'Fixture relation.', evidenceFiles: ['src/a.ts'], confidence: 0.7 }],
};

describe('ArchitectureModel graph adapter', () => {
  it('deterministically renders a synthetic root, areas, and validated relationships', () => {
    const first = buildArchitectureGraph(architecture, files, new Set(), new Set(), 'Fixture');
    const second = buildArchitectureGraph(architecture, files, new Set(), new Set(), 'Fixture');
    assert.deepEqual(first, second);
    assert.deepEqual(first.nodes.map((node) => node.file), ['architecture:area:one', 'architecture:area:two', 'architecture:project']);
    assert.ok(first.edges.some((edge) => edge.kind === 'architecture' && edge.label === 'supports'));
    assert.ok(first.edges.some((edge) => edge.kind === 'membership'));
    assert.equal(first.edges.filter((edge) => edge.kind === 'architecture').length, 1);
    assert.equal(first.edges.filter((edge) => edge.kind === 'membership').length, 2);
    assert.ok(!first.nodes.some((node) => node.file === 'src/a.ts'));
  });

  it('does not project relationships whose referenced areas are absent', () => {
    const invalidRelationship: ArchitectureModel = {
      ...architecture,
      relationships: [...architecture.relationships, {
        sourceAreaId: 'missing', targetAreaId: 'two', label: 'invalid', explanation: 'Not renderable.', evidenceFiles: [], confidence: 0,
      }],
    };
    const graph = buildArchitectureGraph(invalidRelationship, files, new Set(), new Set());
    assert.ok(!graph.edges.some((edge) => edge.label === 'invalid'));
  });

  it('progressively reveals important files, all files, then collapses them', () => {
    const initial = buildArchitectureGraph(architecture, files, new Set(), new Set());
    const expanded = buildArchitectureGraph(architecture, files, new Set(['one']), new Set());
    const all = buildArchitectureGraph(architecture, files, new Set(['one']), new Set(['one']));
    assert.ok(!initial.nodes.some((node) => node.file === 'src/a.ts'));
    assert.ok(expanded.nodes.some((node) => node.file === 'src/a.ts'));
    assert.ok(!expanded.nodes.some((node) => node.file === 'src/b.ts'));
    assert.ok(all.nodes.some((node) => node.file === 'src/b.ts'));
    const revealed = all.nodes.find((node) => node.file === 'src/a.ts');
    assert.equal(revealed?.entityType, 'architecture-file');
    assert.equal(revealed?.file, files[0]!.file, 'revealed nodes preserve the canonical scanner file identity');

    const collapsed = buildArchitectureGraph(architecture, files, new Set(), new Set());
    assert.ok(!collapsed.nodes.some((node) => node.file === 'src/a.ts'));
    assert.ok(!collapsed.edges.some((edge) => edge.source === 'architecture:area:one' && edge.target === 'src/a.ts'));
  });

  it('has deterministic ELK geometry for the same architecture graph', async () => {
    const graph = buildArchitectureGraph(architecture, files, new Set(), new Set());
    const first = await layoutProjectGraph(graph.nodes, graph.edges);
    const second = await layoutProjectGraph(graph.nodes, graph.edges);
    assert.deepEqual(first, second);
  });
});
