import { Pipeline } from '../pipeline/Pipeline.js';
import { FilesystemStage } from '../stages/FilesystemStage.js';
import { LanguageStage } from '../stages/LanguageStage.js';
import { FrameworkStage } from '../stages/FrameworkStage.js';
import { InfrastructureStage } from '../stages/InfrastructureStage.js';
import { DependencyStage } from '../stages/DependencyStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export async function scanProject(projectPath: string): Promise<ProjectScanResult> {
  const initialResult: ProjectScanResult = {
    files: [],
    folders: [],
    manifests: [],
    languages: [],
    frameworks: [],
    infrastructure: [],
    dependencies: [],
  };

  const pipeline = new Pipeline([
    new FilesystemStage(projectPath),
    new LanguageStage(),
    new FrameworkStage(),
    new InfrastructureStage(),
    new DependencyStage(),
  ]);

  return pipeline.execute(initialResult);
}
