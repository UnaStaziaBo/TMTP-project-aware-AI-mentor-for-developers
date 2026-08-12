import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphNodeView } from '../src/projectGraphView.js';
import { architectureFocusAreaIds, architectureRelationshipsForArea, buildArchitectureGraph, isSemanticArchitectureEdge, visibleArchitectureConnectionLabel, visibleArchitectureEdgeLabel } from '../src/webview/graph/architectureGraph.js';
import { ARCHITECTURE_AREA_HEIGHT, ARCHITECTURE_AREA_WIDTH, layoutArchitectureGraph } from '../src/webview/graph/layout.js';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const files: GraphNodeView[] = ['src/a.ts', 'src/b.ts', 'src/c.ts'].map((file) => ({ file, title: file.slice(4), area: 'Source', description: 'Real file', score: 0, confidence: 0, tier: 'small', learningStatus: { icon: '⚪', label: 'Not visited' }, hasEdge: false }));
const architecture: ArchitectureModel = {
  fingerprint: 'fixture', summary: 'Fixture architecture.', warnings: [], fileRoles: [],
  areas: [
    { id: 'one', name: 'One', shortPurpose: 'First area.', files: ['src/a.ts', 'src/b.ts'], importantFiles: ['src/a.ts'], evidenceFiles: ['src/a.ts'], confidence: 0.8 },
    { id: 'two', name: 'Two', shortPurpose: 'Second area.', files: ['src/c.ts'], importantFiles: ['src/c.ts'], evidenceFiles: ['src/c.ts'], confidence: 0.7 },
  ],
  relationships: [{ sourceAreaId: 'one', targetAreaId: 'two', type: 'supports', label: 'supports the second area', explanation: 'Fixture relation.', evidenceFiles: ['src/a.ts'], confidence: 0.7 }],
};

describe('ArchitectureModel graph adapter', () => {
  it('deterministically renders a synthetic root, areas, and validated relationships', () => {
    const first = buildArchitectureGraph(architecture, files, new Set(), new Set(), 'Fixture');
    const second = buildArchitectureGraph(architecture, files, new Set(), new Set(), 'Fixture');
    assert.deepEqual(first, second);
    assert.deepEqual(first.nodes.map((node) => node.file), ['architecture:area:one', 'architecture:area:two', 'architecture:project']);
    const relationship = first.edges.find((edge) => edge.kind === 'architecture');
    assert.equal(relationship?.source, 'architecture:area:one');
    assert.equal(relationship?.target, 'architecture:area:two');
    assert.equal(relationship?.relationshipType, 'supports');
    assert.equal(relationship?.label, 'supports', 'visible labels come from the controlled vocabulary');
    assert.deepEqual(relationship?.evidenceFiles, ['src/a.ts']);
    assert.ok(first.edges.some((edge) => edge.kind === 'root'));
    assert.equal(first.edges.filter((edge) => edge.kind === 'membership').length, 0, 'collapsed areas have no file membership connectors');
    assert.equal(first.edges.filter((edge) => edge.kind === 'architecture').length, 1);
    assert.equal(first.edges.filter((edge) => edge.kind === 'root').length, 2, 'root grouping stays distinct from semantic relationships');
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

  it('gives every visible connection a stable label while retaining separate structural grammar', () => {
    const graph = buildArchitectureGraph(architecture, files, new Set(['one']), new Set());
    const semanticEdges = graph.edges.filter(isSemanticArchitectureEdge);
    assert.ok(semanticEdges.length > 0);
    assert.ok(semanticEdges.every((edge) => Boolean(visibleArchitectureEdgeLabel(edge))), 'every semantic arrow must have a visible label');
    const structuralEdges = graph.edges.filter((edge) => edge.kind === 'root' || edge.kind === 'membership');
    assert.ok(structuralEdges.length > 0);
    assert.ok(structuralEdges.every((edge) => visibleArchitectureConnectionLabel(edge) === 'contains'));
    assert.ok(structuralEdges.every((edge) => !isSemanticArchitectureEdge(edge)), 'structural connectors must not masquerade as arrows');
  });

  it('preserves concise matching labels and falls back to the normalized type for long prose', () => {
    const concise: ArchitectureModel = {
      ...architecture,
      relationships: [{ sourceAreaId: 'one', targetAreaId: 'two', type: 'provides', label: 'provides data', explanation: 'Fixture relation.', evidenceFiles: ['src/a.ts'], confidence: 0.7 }],
    };
    const conciseEdge = buildArchitectureGraph(concise, files, new Set(), new Set()).edges.find(isSemanticArchitectureEdge)!;
    assert.equal(visibleArchitectureEdgeLabel(conciseEdge), 'provides data');

    const fallbackEdge = buildArchitectureGraph(architecture, files, new Set(), new Set()).edges.find(isSemanticArchitectureEdge)!;
    assert.equal(visibleArchitectureEdgeLabel(fallbackEdge), 'supports');
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
    assert.ok(all.edges.some((edge) => edge.kind === 'membership' && edge.source === 'architecture:area:one' && edge.target === 'src/a.ts'));
  });

  it('returns only immediate incoming and outgoing semantic relationships for area focus', () => {
    const graph = buildArchitectureGraph(architecture, files, new Set(), new Set());
    const focus = architectureFocusAreaIds(graph.edges, 'one');
    assert.deepEqual([...focus].sort(), ['one', 'two']);
    const relationships = architectureRelationshipsForArea(graph.edges, 'two');
    assert.equal(relationships.incoming.length, 1);
    assert.equal(relationships.outgoing.length, 0);
    assert.equal(relationships.incoming[0]?.explanation, 'Fixture relation.');
  });

  it('has deterministic ELK geometry for the same architecture graph', async () => {
    const graph = buildArchitectureGraph(architecture, files, new Set(), new Set());
    const first = await layoutArchitectureGraph(graph.nodes, graph.edges);
    const second = await layoutArchitectureGraph(graph.nodes, graph.edges);
    assert.deepEqual(first, second);
    const relationship = first.edges.find((edge) => edge.id.startsWith('architecture:'));
    assert.equal(relationship?.source, 'architecture:area:one', 'layout preserves semantic source direction');
    assert.equal(relationship?.target, 'architecture:area:two', 'layout preserves semantic target direction');
  });

  it('uses stable larger dimensions for architecture areas without overlapping expanded files', async () => {
    const initialGraph = buildArchitectureGraph(architecture, files, new Set(), new Set());
    const initial = await layoutArchitectureGraph(initialGraph.nodes, initialGraph.edges);
    const expandedGraph = buildArchitectureGraph(architecture, files, new Set(['one']), new Set(['one']));
    const expanded = await layoutArchitectureGraph(expandedGraph.nodes, expandedGraph.edges);
    const initialArea = initial.nodes.find((node) => node.file === 'architecture:area:one')!;
    const expandedArea = expanded.nodes.find((node) => node.file === 'architecture:area:one')!;
    assert.deepEqual({ width: initialArea.width, height: initialArea.height }, { width: ARCHITECTURE_AREA_WIDTH, height: ARCHITECTURE_AREA_HEIGHT });
    assert.deepEqual({ width: expandedArea.width, height: expandedArea.height }, { width: initialArea.width, height: initialArea.height }, 'Expand must not resize the architecture card');
    for (let index = 0; index < expanded.nodes.length; index += 1) {
      for (let other = index + 1; other < expanded.nodes.length; other += 1) {
        assert.ok(!overlaps(expanded.nodes[index]!, expanded.nodes[other]!));
      }
    }
  });
});
