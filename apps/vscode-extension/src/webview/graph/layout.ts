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

function routeLearningEdge(
  edge: GraphEdgeView,
  nodesByFile: Map<string, PositionedGraphNode>,
): RoutedGraphEdge | null {
  const source = nodesByFile.get(edge.source);
  const target = nodesByFile.get(edge.target);
  if (!source || !target) return null;

  // Learning-path links are an existing visual overlay, not project
  // dependencies. Route them after hierarchy placement so they remain
  // visible without changing ranks or connecting isolated components.
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const flowsDown = target.y >= source.y;
  const start = { x: sourceCenterX, y: flowsDown ? source.y + source.height : source.y };
  const end = { x: targetCenterX, y: flowsDown ? target.y : target.y + target.height };
  const middleY = (start.y + end.y) / 2;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    points: [start, { x: sourceCenterX, y: middleY }, { x: targetCenterX, y: middleY }, end],
  };
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
  return layoutGraph(nodes, edges, false);
}

/**
 * Architecture keeps semantic edge direction intact while using controlled
 * area roles as deterministic rank/order hints. It is intentionally separate
 * from the dependency layout so dependency graph behavior cannot regress.
 */
export async function layoutArchitectureGraph(
  nodes: readonly GraphNodeView[],
  edges: readonly GraphEdgeView[],
): Promise<LayoutResult> {
  return layoutGraph(nodes, edges, true);
}

async function layoutGraph(
  nodes: readonly GraphNodeView[],
  edges: readonly GraphEdgeView[],
  architecture: boolean,
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const roleRank: Record<string, number> = { entry: 0, orchestration: 1, core: 2, integration: 3, shared: 4, supporting: 5, testing: 6, documentation: 7 };
  const sortedNodes = [...nodes].sort((a, b) => {
    if (architecture) {
      const aRank = roleRank[(a as GraphNodeView & { role?: string }).role ?? 'core'] ?? 2;
      const bRank = roleRank[(b as GraphNodeView & { role?: string }).role ?? 'core'] ?? 2;
      if (aRank !== bRank) return aRank - bRank;
    }
    return a.file.localeCompare(b.file);
  });
  const nodeIds = new Set(sortedNodes.map((node) => node.file));
  const dependencyEdges = edges
    .filter((edge) => edge.kind !== 'learning' && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((a, b) => a.id.localeCompare(b.id));
  const learningEdges = edges
    .filter((edge) => edge.kind === 'learning' && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((a, b) => a.id.localeCompare(b.id));

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
      ...(architecture ? {
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.spacing.nodeNode': '70',
        'elk.layered.spacing.nodeNodeBetweenLayers': '125',
      } : {}),
      // Unrelated files (no import path between them) form their own visual
      // clusters instead of being interleaved into one hairball.
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '90',
    },
    children: sortedNodes.map((node) => ({
      id: node.file,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      ...(architecture ? {
        layoutOptions: node.file === 'architecture:project'
          ? { 'elk.layered.layering.layerConstraint': 'FIRST' }
          : ['documentation', 'testing'].includes((node as GraphNodeView & { role?: string }).role ?? '')
            ? { 'elk.layered.layering.layerConstraint': 'LAST' }
            : undefined,
      } : {}),
    })),
    edges: dependencyEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const result = await elk.layout(graph);
  const positionByFile = new Map((result.children ?? []).map((child) => [child.id, child]));

  const positionedByFile = new Map<string, PositionedGraphNode>();
  for (const node of sortedNodes) {
    const placed = positionByFile.get(node.file);
    positionedByFile.set(node.file, {
      ...node,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      x: placed?.x ?? 0,
      y: placed?.y ?? 0,
    });
  }
  // Preserve the caller's view ordering; positions themselves are based on
  // the sorted input above.
  const positionedNodes = nodes.map((node) => positionedByFile.get(node.file)!);

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

  for (const edge of learningEdges) {
    const routed = routeLearningEdge(edge, positionedByFile);
    if (routed) routedEdges.push(routed);
  }

  return { nodes: positionedNodes, edges: routedEdges.sort((a, b) => a.id.localeCompare(b.id)) };
}
