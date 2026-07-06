import { Pipeline } from '../pipeline/Pipeline.js';
import { FilesystemStage } from '../stages/FilesystemStage.js';
import { LanguageStage } from '../stages/LanguageStage.js';
import { FrameworkStage } from '../stages/FrameworkStage.js';
import { InfrastructureStage } from '../stages/InfrastructureStage.js';
import { DependencyStage } from '../stages/DependencyStage.js';
import { StartingFileStage } from '../stages/StartingFileStage.js';
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
    startingFiles: [],
  };

  const pipeline = new Pipeline([
    new FilesystemStage(projectPath),
    new LanguageStage(),
    new FrameworkStage(),
    new InfrastructureStage(),
    new DependencyStage(),
    new StartingFileStage(projectPath),
  ]);

  return pipeline.execute(initialResult);
}
