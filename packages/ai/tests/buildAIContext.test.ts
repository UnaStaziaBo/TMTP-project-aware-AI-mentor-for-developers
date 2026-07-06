import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '@tmpt/scanner';
import { buildAIContext } from '../src/buildAIContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

describe('buildAIContext', () => {
  it('reuses the scanner result without re-analysis', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'fastapi-demo');
    const result = await scanProject(projectPath);
    const context = buildAIContext('fastapi-demo', result);

    assert.equal(context.projectName, 'fastapi-demo');
    assert.equal(context.overview.fileCount, result.files.length);
    assert.equal(context.overview.folderCount, result.folders.length);
    assert.equal(context.overview.manifestCount, result.manifests.length);
    assert.deepEqual(
      context.languages.map((l) => l.name),
      result.languages.map((l) => l.name),
    );
    assert.deepEqual(
      context.startingFiles.map((s) => s.file),
      result.startingFiles.map((s) => s.file),
    );
  });

  it('caps the folder sample without lying about the true count', () => {
    const manyFolders = Array.from({ length: 100 }, (_, i) => ({ path: `folder-${i}` }));
    const context = buildAIContext('big-project', {
      files: [],
      folders: manyFolders,
      manifests: [],
      languages: [],
      frameworks: [],
      infrastructure: [],
      dependencies: [],
      startingFiles: [],
    });

    assert.ok(context.folders.length < manyFolders.length);
    assert.equal(context.overview.folderCount, 100);
  });
});
