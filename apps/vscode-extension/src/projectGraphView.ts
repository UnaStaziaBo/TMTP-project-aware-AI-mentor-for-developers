import type { ProjectScanResult } from '@tmpt/scanner';
import { deriveProjectArea, deriveShortDescription, importanceTier, type ImportanceTier } from './knowledgeMap.js';

export interface GraphLearningStatus {
  icon: string;
  label: string;
}

export interface GraphNodeView {
  file: string;
  /** The file's own basename — never invented. */
  title: string;
  area: string;
  description: string;
  score: number;
  confidence: number;
  tier: ImportanceTier;
  learningStatus: GraphLearningStatus;
  hasEdge: boolean;
}

export interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
}

export interface ProjectGraphViewModel {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  /** Files hidden by the default clutter filter (no score, no edges). */
  hiddenCount: number;
}

export type LearningStatusLookup = (file: string) => GraphLearningStatus;

/**
 * Builds the deterministic node/edge view model for the Interactive Project
 * Graph, purely from data the scanner already computed (`startingFiles` for
 * importance, `projectGraph.edges` for relationships) plus the caller's own
 * learning-progress lookup. No AI, no new analysis, no invented edges — a
 * node with no score and no edges is exactly what it looks like: a file the
 * deterministic pipeline found no strong signal about.
 *
 * By default, orphan files (no importance score and no edges) are filtered
 * out to avoid clutter; pass `includeAll: true` to show every file (e.g. from
 * a search hit).
 */
export function buildProjectGraphViewModel(
  result: ProjectScanResult,
  learningStatusFor: LearningStatusLookup,
  options: { includeAll?: boolean } = {},
): ProjectGraphViewModel {
  const candidateByFile = new Map(result.startingFiles.map((candidate) => [candidate.file, candidate]));
  const filesWithEdges = new Set<string>();
  for (const edge of result.projectGraph.edges) {
    filesWithEdges.add(edge.from);
    filesWithEdges.add(edge.to);
  }

  const allNodes: GraphNodeView[] = result.files.map((file) => {
    const candidate = candidateByFile.get(file.path);
    const confidence = candidate?.confidence ?? 0;
    return {
      file: file.path,
      title: file.path.split('/').pop() ?? file.path,
      area: deriveProjectArea(file.path),
      description: deriveShortDescription(file.path, candidate?.reasons ?? []),
      score: candidate?.score ?? 0,
      confidence,
      tier: importanceTier(confidence),
      learningStatus: learningStatusFor(file.path),
      hasEdge: filesWithEdges.has(file.path),
    };
  });

  const visibleNodes = options.includeAll
    ? allNodes
    : allNodes.filter((node) => node.confidence > 0 || node.hasEdge);

  const visibleFiles = new Set(visibleNodes.map((node) => node.file));
  const edges: GraphEdgeView[] = result.projectGraph.edges
    .filter((edge) => visibleFiles.has(edge.from) && visibleFiles.has(edge.to))
    .map((edge) => ({ id: `${edge.from}=>${edge.to}`, source: edge.from, target: edge.to }));

  return { nodes: visibleNodes, edges, hiddenCount: allNodes.length - visibleNodes.length };
}
