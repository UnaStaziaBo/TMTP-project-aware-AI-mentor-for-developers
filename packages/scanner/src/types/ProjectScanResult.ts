import type { ProjectFile } from './ProjectFile.js';
import type { ProjectFolder } from './ProjectFolder.js';
import type { ProjectManifest } from './ProjectManifest.js';
import type { DetectedLanguage } from './DetectedLanguage.js';
import type { DetectedFramework } from './DetectedFramework.js';
import type { DetectedInfrastructure } from './DetectedInfrastructure.js';
import type { DetectedDependency } from './DetectedDependency.js';

export interface ProjectScanResult {
  files: ProjectFile[];
  folders: ProjectFolder[];
  manifests: ProjectManifest[];
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  infrastructure: DetectedInfrastructure[];
  dependencies: DetectedDependency[];
}
