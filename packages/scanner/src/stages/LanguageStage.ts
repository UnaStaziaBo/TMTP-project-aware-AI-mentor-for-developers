import { detectLanguages } from '../language/detectLanguages.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class LanguageStage implements PipelineStage {
  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    return {
      ...result,
      languages: detectLanguages(result),
    };
  }
}
