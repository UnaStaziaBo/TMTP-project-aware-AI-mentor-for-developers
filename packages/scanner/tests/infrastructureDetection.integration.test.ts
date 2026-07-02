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
    expectedInfrastructure: ['Docker', 'Docker Compose'],
  },
  {
    projectName: 'react-demo',
    expectedInfrastructure: ['Docker'],
  },
  {
    projectName: 'nestjs-demo',
    expectedInfrastructure: ['Docker', 'GitHub Actions'],
  },
  {
    projectName: 'django-demo',
    expectedInfrastructure: ['Docker'],
  },
  {
    projectName: 'spring-demo',
    expectedInfrastructure: ['Docker', 'Docker Compose'],
  },
] as const;

for (const { projectName, expectedInfrastructure } of scenarios) {
  describe(`infrastructure detection integration for ${projectName}`, () => {
    it('detects at least one infrastructure technology', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.ok(result.infrastructure.length > 0, `${projectName} should detect at least one infrastructure technology`);
    });

    it('detects the expected infrastructure technologies', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const expected of expectedInfrastructure) {
        const exists = result.infrastructure.some((item) => item.name === expected);
        assert.ok(exists, `${projectName} should detect ${expected}`);
      }
    });

    it('assigns positive confidence', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const infrastructure of result.infrastructure) {
        assert.ok(infrastructure.confidence > 0, `${projectName} should have positive confidence for ${infrastructure.name}`);
      }
    });

    it('provides evidence for each detected infrastructure technology', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const infrastructure of result.infrastructure) {
        assert.ok(infrastructure.evidence.length > 0, `${projectName} should provide evidence for ${infrastructure.name}`);
      }
    });
  });
}
