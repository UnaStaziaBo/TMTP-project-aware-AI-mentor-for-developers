import type { ProjectScanResult } from "@tmpt/scanner";

export async function scanProject(
  projectPath: string
): Promise<ProjectScanResult> {
  void projectPath;

  return {
    files: [],
    folders: [],
    manifests: [],
    languages: [],
    frameworks: [],
    infrastructure: [],
    dependencies: [],
    startingFiles: [],
  };
}