import type { ProjectScanResult } from '@tmpt/scanner';
import { deriveProjectArea, deriveShortDescription, importanceTier, type ImportanceTier } from './knowledgeMap.js';

export interface GraphLearningStatus {
  icon: string;
  label: string;
  progress?: number;
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
  /** Tests, examples and generated compiler sidecars stay available in All files, but never lead the teaching view. */
  isAuxiliary?: boolean;
  /** Scanner evidence explaining why this file matters as a learning stop. */
  learningReason?: string;
  /** Actual study progress; scanner confidence remains a separate importance signal. */
  learningProgress?: number;
}

export interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
  kind?: 'import' | 'learning';
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
  const allFilePaths = new Set(result.files.map((file) => file.path));

  function isAuxiliaryFile(file: string): boolean {
    const segments = file.split('/');
    if (segments.some((segment) => ['test', 'tests', '__tests__', 'examples', 'generated', 'dist', 'build'].includes(segment))) {
      return true;
    }
    if (file.endsWith('.map') || file.endsWith('.d.ts')) return true;
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const stem = file.replace(/\.jsx?$/, '');
      // A JS file beside its TS source is compiler output, not a second
      // architectural component. It remains discoverable in All files.
      if (allFilePaths.has(`${stem}.ts`) || allFilePaths.has(`${stem}.tsx`)) return true;
    }
    return false;
  }
  const filesWithEdges = new Set<string>();
  for (const edge of result.projectGraph.edges) {
    filesWithEdges.add(edge.from);
    filesWithEdges.add(edge.to);
  }

  // Filesystem discovery is authoritative for the node universe. Sort the
  // presentation copy so a filesystem's traversal order cannot make the
  // graph's otherwise deterministic layout jump between scans.
  const allNodes: GraphNodeView[] = [...result.files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => {
      const candidate = candidateByFile.get(file.path);
      const confidence = candidate?.confidence ?? 0;
      const learningStatus = learningStatusFor(file.path);
      return {
        file: file.path,
        title: file.path.split('/').pop() ?? file.path,
        area: deriveProjectArea(file.path),
        description: deriveShortDescription(file.path, candidate?.reasons ?? []),
        score: candidate?.score ?? 0,
        confidence,
        tier: importanceTier(confidence),
        learningStatus,
        learningProgress: learningStatus.progress ?? 0,
        hasEdge: filesWithEdges.has(file.path),
        isAuxiliary: isAuxiliaryFile(file.path),
        learningReason:
          candidate?.reasons[0] ??
          (filesWithEdges.has(file.path)
            ? 'Connected to other project source files'
            : 'Supporting project file'),
      };
    });

  const visibleNodes = options.includeAll
    ? allNodes
    : allNodes.filter((node) => node.confidence > 0 || node.hasEdge);

  const visibleFiles = new Set(visibleNodes.map((node) => node.file));
  const edgeById = new Map<string, GraphEdgeView>();
  for (const edge of result.projectGraph.edges) {
    if (!visibleFiles.has(edge.from) || !visibleFiles.has(edge.to)) continue;
    const id = `${edge.from}=>${edge.to}`;
    // The scanner normally emits unique edges, but keeping the view model
    // idempotent prevents duplicate visual relationships if an upstream
    // detector reports the same verified import more than once.
    edgeById.set(id, { id, source: edge.from, target: edge.to, kind: 'import' });
  }
  const edges = [...edgeById.values()].sort((a, b) => a.id.localeCompare(b.id));

  return { nodes: visibleNodes, edges, hiddenCount: allNodes.length - visibleNodes.length };
}
