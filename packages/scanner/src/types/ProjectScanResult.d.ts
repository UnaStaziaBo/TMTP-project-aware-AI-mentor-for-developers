import type { ProjectFile } from './ProjectFile.js';
import type { ProjectFolder } from './ProjectFolder.js';
import type { ProjectManifest } from './ProjectManifest.js';
export interface ProjectScanResult {
    files: ProjectFile[];
    folders: ProjectFolder[];
    manifests: ProjectManifest[];
    languages: string[];
}
