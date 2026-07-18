import { promises as fs } from 'node:fs';
import path from 'node:path';
import { shouldExcludeFromStartingFiles } from './exclusion.js';
import { buildImportGraph } from './importGraph.js';
import { runStartingFileRules, type StartingFileContext, type StartingFileRule } from './registry.js';
import { ExecutableEntryRule } from './rules/ExecutableEntryRule.js';
import { FrameworkBootstrapRule } from './rules/FrameworkBootstrapRule.js';
import { ConventionalFilenameRule } from './rules/ConventionalFilenameRule.js';
import { ImportCentralityRule } from './rules/ImportCentralityRule.js';
import { ReferencedByManyRule } from './rules/ReferencedByManyRule.js';
import { OrchestrationFileRule } from './rules/OrchestrationFileRule.js';
import { SmallFilePenaltyRule } from './rules/SmallFilePenaltyRule.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';
import type { StartingFileCandidate } from '../types/StartingFileCandidate.js';
import type { ProjectGraphEdge } from '../types/ProjectGraphEdge.js';

const MAX_CONFIDENCE_SCORE = 100;

const rules: StartingFileRule[] = [
  ExecutableEntryRule,
  FrameworkBootstrapRule,
  ConventionalFilenameRule,
  ImportCentralityRule,
  ReferencedByManyRule,
  OrchestrationFileRule,
  SmallFilePenaltyRule,
];

function toConfidence(score: number): number {
  const clamped = Math.max(0, Math.min(MAX_CONFIDENCE_SCORE, score));
  return Math.round((clamped / MAX_CONFIDENCE_SCORE) * 100) / 100;
}

export interface StartingFileDetectionResult {
  candidates: StartingFileCandidate[];
  graphEdges: ProjectGraphEdge[];
}

export async function detectStartingFiles(
  projectPath: string,
  result: ProjectScanResult,
): Promise<StartingFileDetectionResult> {
  const candidatePaths = result.files
    .map((file) => file.path)
    .filter((relativePath) => !shouldExcludeFromStartingFiles(relativePath));

  const contents = new Map<string, string>();
  for (const relativePath of candidatePaths) {
    try {
      contents.set(relativePath, await fs.readFile(path.join(projectPath, relativePath), 'utf-8'));
    } catch {
      // Unreadable file (permissions, race with deletion, etc.) — skip as a candidate.
    }
  }

  const knownFiles = result.files.map((file) => file.path);
  const { localImportCounts, referencedByCounts, edges } = buildImportGraph(contents, knownFiles);

  const candidates: StartingFileCandidate[] = [];

  for (const [relativePath, content] of contents) {
    const context: StartingFileContext = {
      relativePath,
      basename: path.basename(relativePath),
      extension: path.extname(relativePath),
      content,
      lineCount: content.split(/\r?\n/).length,
      localImportCount: localImportCounts.get(relativePath) ?? 0,
      referencedByCount: referencedByCounts.get(relativePath) ?? 0,
    };

    const { score, reasons } = runStartingFileRules(rules, context);
    if (score > 0) {
      candidates.push({ file: relativePath, score, confidence: toConfidence(score), reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return { candidates, graphEdges: edges };
}
