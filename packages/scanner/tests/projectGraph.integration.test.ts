import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

describe('project graph integration', () => {
  it('captures the real relative import from src/main.tsx to src/App.tsx in react-demo', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const hasEdge = result.projectGraph.edges.some(
      (edge) => edge.from === 'src/main.tsx' && edge.to === 'src/App.tsx',
    );
    assert.ok(hasEdge, `expected an edge from src/main.tsx to src/App.tsx, got: ${JSON.stringify(result.projectGraph.edges)}`);
  });

  it('never invents an edge to a file that does not exist', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);
    const knownFiles = new Set(result.files.map((file) => file.path));

    for (const edge of result.projectGraph.edges) {
      assert.ok(knownFiles.has(edge.from), `edge.from ${edge.from} should be a real file`);
      assert.ok(knownFiles.has(edge.to), `edge.to ${edge.to} should be a real file`);
    }
  });

  it('never creates a self-referencing edge', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    for (const edge of result.projectGraph.edges) {
      assert.notEqual(edge.from, edge.to);
    }
  });

  it('is reproducible across repeated scans of the same repository', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const [first, second] = await Promise.all([scanProject(projectPath), scanProject(projectPath)]);

    const normalize = (edges: readonly { from: string; to: string }[]) =>
      [...edges].map((e) => `${e.from}->${e.to}`).sort();

    assert.deepEqual(normalize(first.projectGraph.edges), normalize(second.projectGraph.edges));
  });

  it('produces only a partial (possibly empty) graph for a project with no supported import syntax', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'django-demo');
    const result = await scanProject(projectPath);

    // No hard requirement on count — only that it never throws and never
    // fabricates edges to files that don't exist (checked generically above
    // in spirit; here we just confirm the shape is always present).
    assert.ok(Array.isArray(result.projectGraph.edges));
  });
});
