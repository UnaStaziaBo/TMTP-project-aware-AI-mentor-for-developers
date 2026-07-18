import { detectStartingFiles } from '../startingFiles/detectStartingFiles.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class StartingFileStage implements PipelineStage {
  constructor(private readonly projectPath: string) {}

  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    const { candidates, graphEdges } = await detectStartingFiles(this.projectPath, result);
    return {
      ...result,
      startingFiles: candidates,
      // Reuses the same import-resolution pass Starting File Discovery already
      // does — zero extra file reads, and never invents a relationship it
      // couldn't otherwise verify.
      projectGraph: { edges: graphEdges },
    };
  }
}
