import { promises as fs } from 'node:fs';
import path from 'node:path';
import { shouldIgnoreDirectory } from './ignoreRules.js';
export async function walkDirectory(rootPath) {
    const files = [];
    const folders = [];
    async function visit(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                if (shouldIgnoreDirectory(entry.name)) {
                    continue;
                }
                folders.push(entryPath);
                await visit(entryPath);
                continue;
            }
            if (entry.isFile()) {
                files.push(entryPath);
            }
        }
    }
    await visit(rootPath);
    return { files, folders };
}
//# sourceMappingURL=walkDirectory.js.map