import type { ProjectScanResult } from '@tmpt/scanner';
import type { AIContext, AIContextDetection } from './types/AIContext.js';

// Keeps the prompt small and bounded on large repositories. This is a
// representative sample for orientation, not the full tree — overview.folderCount
// carries the true total.
const MAX_FOLDERS_IN_CONTEXT = 40;

function toDetections(
  items: ReadonlyArray<{ name: string; confidence: number; evidence: string[] }>,
): AIContextDetection[] {
  return items.map((item) => ({ name: item.name, confidence: item.confidence, evidence: item.evidence }));
}

/**
 * Builds the exact, deterministic payload that will be sent to the AI provider.
 * Only reuses data already computed by the scanner pipeline — no re-analysis.
 */
export function buildAIContext(projectName: string, result: ProjectScanResult): AIContext {
  const sortedFolders = result.folders.map((folder) => folder.path).sort();

  return {
    projectName,
    overview: {
      fileCount: result.files.length,
      folderCount: result.folders.length,
      manifestCount: result.manifests.length,
    },
    languages: toDetections(result.languages),
    frameworks: toDetections(result.frameworks),
    dependencies: toDetections(result.dependencies),
    startingFiles: result.startingFiles.map((candidate) => ({
      file: candidate.file,
      score: candidate.score,
      confidence: candidate.confidence,
      reasons: candidate.reasons,
    })),
    folders: sortedFolders.slice(0, MAX_FOLDERS_IN_CONTEXT),
  };
}
