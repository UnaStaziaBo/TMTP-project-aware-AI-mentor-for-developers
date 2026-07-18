import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { GraphEdgeView, GraphNodeView } from '../../projectGraphView.js';
import type { Point } from './edgePath.js';

export interface PositionedGraphNode extends GraphNodeView {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedGraphEdge {
  id: string;
  source: string;
  target: string;
  points: Point[];
}

export interface LayoutResult {
  nodes: PositionedGraphNode[];
  edges: RoutedGraphEdge[];
}

// Node size is deliberately uniform: importance is communicated through
// border weight and color intensity (see FileNode.tsx), not physical size.
// Mixed sizes were the single biggest cause of the old layout's uneven,
// gappy look — a layered layout sizes each rank by its tallest node, so one
// "large" node next to several "small" ones wasted enormous vertical space.
export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 112;

// Reused across layout calls — constructing it is cheap, but there's no
// reason to throw it away each time.
const elk = new ELK();

function toPoint(point: { x: number; y: number }): Point {
  return { x: point.x, y: point.y };
}

/**
 * Deterministic hierarchical layout via ELK's layered (Sugiyama-style)
 * algorithm: dependency edges flow top-to-bottom, so files many others
 * depend on naturally settle higher, and the same nodes/edges always
 * produce the same layout. Compared to a simpler algorithm, ELK's layered
 * crossing-minimization and node placement produce noticeably fewer crossed
 * edges and a more compact, evenly-spaced result — and it hands back the
 * actual routed path for each edge (`sections`), which lets rendering avoid
 * drawing a line straight through an unrelated node.
 */
export async function layoutProjectGraph(
  nodes: readonly GraphNodeView[],
  edges: readonly GraphEdgeView[],
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeIds = new Set(nodes.map((node) => node.file));
  const validEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      // POLYLINE (not SPLINES): node-avoidance is the same either way, and
      // the client already smooths the resulting points into curves (see
      // edgePath.ts) — SPLINES computes its own curve fitting on top of
      // that, which is measurably slower for no visible benefit here.
      'elk.edgeRouting': 'POLYLINE',
      // Consistent spacing rules (goal: no large gaps, no overlaps) — fixed
      // values, not derived from node size, since size is now uniform.
      'elk.spacing.nodeNode': '56',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.edgeNode': '28',
      'elk.spacing.edgeEdge': '18',
      // Stronger crossing minimization + compact placement than a single-pass heuristic.
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      // Unrelated files (no import path between them) form their own visual
      // clusters instead of being interleaved into one hairball.
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '90',
    },
    children: nodes.map((node) => ({
      id: node.file,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: validEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const result = await elk.layout(graph);
  const positionByFile = new Map((result.children ?? []).map((child) => [child.id, child]));

  const positionedNodes: PositionedGraphNode[] = nodes.map((node) => {
    const placed = positionByFile.get(node.file);
    return {
      ...node,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      x: placed?.x ?? 0,
      y: placed?.y ?? 0,
    };
  });

  const routedEdges: RoutedGraphEdge[] = [];
  for (const elkEdge of (result.edges ?? []) as ElkExtendedEdge[]) {
    const section = elkEdge.sections?.[0];
    if (!section) continue;
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(toPoint);
    routedEdges.push({
      id: elkEdge.id,
      source: elkEdge.sources[0]!,
      target: elkEdge.targets[0]!,
      points,
    });
  }

  return { nodes: positionedNodes, edges: routedEdges };
}
