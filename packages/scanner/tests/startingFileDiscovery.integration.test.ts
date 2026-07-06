import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const scenarios = [
  {
    projectName: 'fastapi-demo',
    expectedTopFile: 'app/main.py',
  },
  {
    projectName: 'nestjs-demo',
    expectedTopFile: 'src/main.ts',
  },
  {
    projectName: 'react-demo',
    expectedTopFile: 'src/main.tsx',
  },
  {
    projectName: 'spring-demo',
    expectedTopFile: 'src/main/java/com/example/demo/Application.java',
  },
] as const;

for (const { projectName, expectedTopFile } of scenarios) {
  describe(`starting file discovery integration for ${projectName}`, () => {
    it('detects at least one starting file candidate', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.ok(result.startingFiles.length > 0, `${projectName} should detect at least one starting file`);
    });

    it(`ranks ${expectedTopFile} first`, async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.equal(result.startingFiles[0]?.file, expectedTopFile);
    });

    it('sorts candidates by descending score', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (let i = 1; i < result.startingFiles.length; i += 1) {
        assert.ok(result.startingFiles[i - 1]!.score >= result.startingFiles[i]!.score);
      }
    });

    it('provides reasons and a normalized confidence for each candidate', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const candidate of result.startingFiles) {
        assert.ok(candidate.reasons.length > 0, `${candidate.file} should have at least one reason`);
        assert.ok(candidate.confidence >= 0 && candidate.confidence <= 1);
        assert.ok(candidate.score > 0);
      }
    });
  });
}

describe('starting file discovery exclusions', () => {
  it('never nominates node_modules, dist, or generated files as starting points', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    for (const candidate of result.startingFiles) {
      assert.ok(!candidate.file.includes('node_modules'));
      assert.ok(!candidate.file.endsWith('.d.ts'));
    }
  });

  it('ranks a real bootstrap entrypoint above a file with no signals', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const mainFile = result.startingFiles.find((c) => c.file === 'src/main.tsx');
    const routerFile = result.startingFiles.find((c) => c.file === 'src/router.tsx');

    assert.ok(mainFile, 'src/main.tsx should be a candidate');
    if (routerFile) {
      assert.ok(mainFile!.score > routerFile.score);
    }
  });
});
