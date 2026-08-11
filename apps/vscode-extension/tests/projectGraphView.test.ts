import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '@tmpt/scanner';
import type { ProjectScanResult } from '@tmpt/scanner';
import { buildProjectGraphViewModel } from '../src/projectGraphView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const notVisited = () => ({ icon: '⚪', label: 'Not visited' });

function scanResult(files: string[], edges: Array<{ from: string; to: string }> = []): ProjectScanResult {
  return {
    files: files.map((file) => ({ path: file, extension: path.extname(file), size: 1 })),
    folders: [],
    manifests: [],
    languages: [],
    frameworks: [],
    infrastructure: [],
    dependencies: [],
    startingFiles: [],
    projectGraph: { edges },
  };
}

describe('buildProjectGraphViewModel', () => {
  it('includes an edge for a real relative import in react-demo', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const model = buildProjectGraphViewModel(result, notVisited);
    const edge = model.edges.find((e) => e.source === 'src/main.tsx' && e.target === 'src/App.tsx');
    assert.ok(edge, 'expected src/main.tsx -> src/App.tsx edge to survive into the view model');
  });

  it('filters out orphan files with no score and no edges by default', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const model = buildProjectGraphViewModel(result, notVisited);
    // vite.config.ts / tsconfig.json / package.json etc. have no starting-file
    // score and no import relationships — they should not clutter the graph.
    assert.ok(!model.nodes.some((n) => n.file === 'vite.config.ts'));
    assert.ok(model.hiddenCount > 0);
  });

  it('includeAll: true shows every scanned file, hiddenCount is 0', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const model = buildProjectGraphViewModel(result, notVisited, { includeAll: true });
    assert.equal(model.hiddenCount, 0);
    assert.equal(model.nodes.length, result.files.length);
  });

  it('represents every eligible file in an edgeless complete view', () => {
    const model = buildProjectGraphViewModel(
      scanResult(['utils.py', 'hello.py', 'config.py']),
      notVisited,
      { includeAll: true },
    );

    assert.deepEqual(model.nodes.map((node) => node.file), ['config.py', 'hello.py', 'utils.py']);
    assert.deepEqual(model.edges, []);
    assert.equal(model.hiddenCount, 0);
  });

  it('keeps isolated files when only some files participate in verified relationships', () => {
    const model = buildProjectGraphViewModel(
      scanResult(['index.ts', 'utils.ts', 'constants.ts'], [{ from: 'index.ts', to: 'utils.ts' }]),
      notVisited,
      { includeAll: true },
    );

    assert.equal(model.nodes.length, 3);
    assert.ok(model.nodes.some((node) => node.file === 'constants.ts' && !node.hasEdge));
    assert.deepEqual(model.edges.map((edge) => edge.id), ['index.ts=>utils.ts']);
  });

  it('never fabricates an edge to or from a node outside the view model', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const model = buildProjectGraphViewModel(result, notVisited);
    const files = new Set(model.nodes.map((n) => n.file));
    for (const edge of model.edges) {
      assert.ok(files.has(edge.source));
      assert.ok(files.has(edge.target));
    }
  });

  it('reflects the caller-provided learning status per node', async () => {
    const projectPath = path.join(repoRoot, 'examples', 'react-demo');
    const result = await scanProject(projectPath);

    const model = buildProjectGraphViewModel(result, (file) =>
      file === 'src/main.tsx' ? { icon: '⭐', label: 'Mastered' } : notVisited(),
    );

    const mainNode = model.nodes.find((n) => n.file === 'src/main.tsx');
    assert.equal(mainNode?.learningStatus.label, 'Mastered');
  });
});
