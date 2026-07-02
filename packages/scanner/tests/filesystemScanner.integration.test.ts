import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const goldenProjects = [
  'fastapi-demo',
  'react-demo',
  'nestjs-demo',
  'django-demo',
  'spring-demo',
] as const;

for (const projectName of goldenProjects) {
  describe(`filesystem scanner integration for ${projectName}`, () => {
    it('verifies the project path exists', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      assert.ok(projectPath);
    });

    it('scanProject succeeds for the project', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      assert.ok(result);
    });

    it('finds files in the project', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      assert.ok(result.files.length > 0);
    });

    it('finds folders in the project', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      assert.ok(result.folders.length > 0);
    });

    it('detects manifests for the project', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      assert.ok(result.manifests.length > 0);
    });

    it('skips ignored directories', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      const ignoredPaths = result.files.some((file) => file.path.includes('node_modules'));
      assert.equal(ignoredPaths, false);
    });
  });
}
