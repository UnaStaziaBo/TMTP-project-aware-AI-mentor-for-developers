import { promises as fs } from 'node:fs';
import path from 'node:path';
import { walkDirectory } from '../filesystem/walkDirectory.js';
const MANIFEST_NAMES = new Set([
    'package.json',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'Cargo.toml',
    'go.mod',
]);
export async function scanProject(projectPath) {
    const resolvedPath = path.resolve(projectPath);
    let stats;
    try {
        stats = await fs.stat(resolvedPath);
    }
    catch {
        throw new Error(`Project path does not exist: ${projectPath}`);
    }
    if (!stats.isDirectory()) {
        throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    const { files, folders } = await walkDirectory(resolvedPath);
    const projectFiles = [];
    const projectFolders = [];
    const projectManifests = [];
    for (const filePath of files) {
        const stats = await fs.stat(filePath);
        const extension = path.extname(filePath);
        projectFiles.push({
            path: path.relative(resolvedPath, filePath),
            extension,
            size: stats.size,
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
        files: projectFiles,
        folders: projectFolders,
        manifests: projectManifests,
        languages: [],
    };
}
//# sourceMappingURL=scanProject.js.map