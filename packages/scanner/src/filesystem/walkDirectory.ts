import { promises as fs } from 'node:fs';
import path from 'node:path';
import { shouldIgnoreDirectory } from './ignoreRules.js';

export async function walkDirectory(rootPath: string): Promise<{
  files: string[];
  folders: string[];
}> {
  const files: string[] = [];
  const folders: string[] = [];

  async function visit(currentPath: string): Promise<void> {
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
