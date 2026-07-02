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
    expectedLanguage: 'Python',
  },
  {
    projectName: 'react-demo',
    expectedLanguage: 'TypeScript',
  },
  {
    projectName: 'nestjs-demo',
    expectedLanguage: 'TypeScript',
  },
  {
    projectName: 'django-demo',
    expectedLanguage: 'Python',
  },
  {
    projectName: 'spring-demo',
    expectedLanguage: 'Java',
  },
] as const;

for (const { projectName, expectedLanguage } of scenarios) {
  describe(`language detection integration for ${projectName}`, () => {
    it('detects at least one language', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      assert.ok(result.languages.length > 0, `${projectName} should detect at least one language`);
    });

    it('detects the expected language', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);
      const language = result.languages.find((item) => item.name === expectedLanguage);

      assert.ok(language, `${projectName} should detect ${expectedLanguage}`);
    });

    it('assigns positive confidence', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const language of result.languages) {
        assert.ok(language.confidence > 0, `${projectName} should have positive confidence`);
      }
    });

    it('provides evidence for each detected language', async () => {
      const projectPath = path.join(repoRoot, 'examples', projectName);
      const result = await scanProject(projectPath);

      for (const language of result.languages) {
        assert.ok(language.evidence.length > 0, `${projectName} should provide evidence for ${language.name}`);
      }
    });
  });
}
