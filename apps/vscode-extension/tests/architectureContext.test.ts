import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildArchitectureContext } from '../src/architectureContext.js';
import type { ProjectScanResult } from '@tmpt/scanner';

function scan(files: string[]): ProjectScanResult {
  return { files: files.map((path) => ({ path, extension: path.slice(path.lastIndexOf('.')), size: 1 })), folders: [], manifests: [], languages: [], frameworks: [], infrastructure: [], dependencies: [], startingFiles: [{ file: 'src/main.ts', score: 50, confidence: 0.5, reasons: ['Entry point'] }], projectGraph: { edges: [{ from: 'src/main.ts', to: 'src/lib.ts' }] } };
}
describe('architecture context', () => {
  it('is deterministic and preserves entry/important files under a bounded context', () => {
    const result = scan(['src/main.ts', 'src/lib.ts', ...Array.from({ length: 100 }, (_, index) => `packages/p${index}/file.ts`)]);
    const first = buildArchitectureContext(result); const second = buildArchitectureContext(result);
    assert.deepEqual(first, second);
    assert.ok(first.entryFiles.includes('src/main.ts'));
    assert.ok(first.importantFiles.some((item) => item.file === 'src/main.ts'));
    assert.ok(first.regions.length <= 18);
  });
});
