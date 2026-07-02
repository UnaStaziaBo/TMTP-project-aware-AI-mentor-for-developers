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
    expectedFramework: 'FastAPI',
  },
  {
    projectName: 'react-demo',
    expectedFramework: 'React',
  },
  {
    projectName: 'nestjs-demo',
    expectedFramework: 'NestJS',
  },
  {
    projectName: 'django-demo',
    expectedFramework: 'Django',
  },
  {
    projectName: 'spring-demo',
    expectedFramework: 'Spring Boot',
  },
] as const;

for (const { projectName, expectedFramework } of scenarios) {
  describe(`framework detection integration for ${projectName}`, () => {
    it('detects at least one framework', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.ok(result.frameworks.length > 0, `${projectName} should detect at least one framework`);
    });

    it(`detects the expected framework ${expectedFramework}`, async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      const framework = result.frameworks.find((item) => item.name === expectedFramework);

      assert.ok(framework, `${projectName} should detect ${expectedFramework}`);
    });

    it('provides evidence for each detected framework', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const framework of result.frameworks) {
        assert.ok(framework.evidence.length > 0, `${projectName} should provide evidence for ${framework.name}`);
      }
    });
  });
}
