import type { ProjectGraphEdge } from './ProjectGraphEdge.js';

/**
 * The deterministic project-wide relationship graph. Only ever contains
 * edges the scanner's import resolver could actually verify — if only
 * partial dependency information exists (e.g. an unsupported language),
 * `edges` is simply shorter, never padded or guessed.
 */
export interface ProjectGraph {
  edges: ProjectGraphEdge[];
}
