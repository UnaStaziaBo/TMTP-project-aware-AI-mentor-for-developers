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
    expectedDependencies: ['Pydantic', 'SQLAlchemy'],
  },
  {
    projectName: 'react-demo',
    expectedDependencies: ['React Router', 'Axios'],
  },
  {
    projectName: 'nestjs-demo',
    expectedDependencies: ['JWT'],
  },
  {
    projectName: 'django-demo',
    expectedDependencies: ['Django REST Framework'],
  },
  {
    projectName: 'spring-demo',
    expectedDependencies: ['Spring Security'],
  },
] as const;

for (const { projectName, expectedDependencies } of scenarios) {
  describe(`dependency detection integration for ${projectName}`, () => {
    it('detects at least one dependency', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.ok(result.dependencies.length > 0, `${projectName} should detect at least one dependency`);
    });

    it('detects the expected dependencies', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const expectedDependency of expectedDependencies) {
        const exists = result.dependencies.some((dependency) => dependency.name === expectedDependency);
        assert.ok(exists, `${projectName} should detect ${expectedDependency}`);
      }
    });

    it('assigns positive confidence', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const dependency of result.dependencies) {
        assert.ok(dependency.confidence > 0, `${projectName} should have positive confidence for ${dependency.name}`);
      }
    });

    it('provides evidence for each detected dependency', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const dependency of result.dependencies) {
        assert.ok(dependency.evidence.length > 0, `${projectName} should provide evidence for ${dependency.name}`);
      }
    });
  });
}
