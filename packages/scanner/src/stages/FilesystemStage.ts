import { promises as fs } from 'node:fs';
import path from 'node:path';
import { walkDirectory } from '../filesystem/walkDirectory.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectFile } from '../types/ProjectFile.js';
import type { ProjectFolder } from '../types/ProjectFolder.js';
import type { ProjectManifest } from '../types/ProjectManifest.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

const MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'Cargo.toml',
  'go.mod',
]);

export class FilesystemStage implements PipelineStage {
  constructor(private readonly projectPath: string) {}

  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    const resolvedPath = path.resolve(this.projectPath);

    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch {
      throw new Error(`Project path does not exist: ${this.projectPath}`);
    }

    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${this.projectPath}`);
    }

    const { files, folders } = await walkDirectory(resolvedPath);
    const projectFiles: ProjectFile[] = [];
    const projectFolders: ProjectFolder[] = [];
    const projectManifests: ProjectManifest[] = [];

    for (const filePath of files) {
      const fileStats = await fs.stat(filePath);
      const extension = path.extname(filePath);

      projectFiles.push({
        path: path.relative(resolvedPath, filePath),
        extension,
        size: fileStats.size,
      });

      const baseName = path.basename(filePath);
      if (MANIFEST_NAMES.has(baseName)) {
        projectManifests.push({
          path: path.relative(resolvedPath, filePath),
          type: baseName,
        });
      }
    }

    for (const folderPath of folders) {
      projectFolders.push({
        path: path.relative(resolvedPath, folderPath),
      });
    }

    return {
      ...result,
      files: projectFiles,
      folders: projectFolders,
      manifests: projectManifests,
    };
  }
}
