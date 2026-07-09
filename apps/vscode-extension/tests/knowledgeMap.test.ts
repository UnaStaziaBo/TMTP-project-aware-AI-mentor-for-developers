import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { StartingFileCandidate } from '@tmpt/scanner';
import {
  buildKnowledgeMapAreas,
  deriveProjectArea,
  deriveShortDescription,
  importanceTier,
} from '../src/knowledgeMap.js';

describe('deriveProjectArea', () => {
  it('skips generic monorepo containers in favor of the package/app name', () => {
    assert.equal(deriveProjectArea('packages/scanner/src/index.ts'), 'Scanner');
    assert.equal(deriveProjectArea('apps/vscode-extension/src/extension.ts'), 'Vscode Extension');
  });

  it('falls back to the top-level folder for non-container layouts', () => {
    assert.equal(deriveProjectArea('backend/api/main.py'), 'Backend');
  });
});

describe('deriveShortDescription', () => {
  it('recognizes an entry-point reason', () => {
    assert.equal(
      deriveShortDescription('app/main.py', ['Executable entry point (`if __name__ == "__main__":`)']),
      'Entry point',
    );
  });

  it('recognizes a framework bootstrap reason', () => {
    assert.equal(
      deriveShortDescription('app/main.py', ['FastAPI application bootstrap detected']),
      'FastAPI bootstrap',
    );
  });

  it('falls back to a humanized filename when no strong signal applies', () => {
    assert.equal(
      deriveShortDescription('packages/scanner/src/stages/FilesystemStage.ts', ['Referenced by 5 other project files']),
      'Filesystem Stage',
    );
  });
});

describe('importanceTier', () => {
  it('buckets confidence into large/medium/small', () => {
    assert.equal(importanceTier(0.75), 'large');
    assert.equal(importanceTier(0.4), 'medium');
    assert.equal(importanceTier(0.1), 'small');
  });
});

describe('buildKnowledgeMapAreas', () => {
  const candidates: StartingFileCandidate[] = [
    { file: 'packages/scanner/src/index.ts', score: 60, confidence: 0.6, reasons: ['Conventional filename (`index.ts`)'] },
    {
      file: 'packages/scanner/src/stages/FilesystemStage.ts',
      score: 35,
      confidence: 0.35,
      reasons: ['Referenced by 5 other project files'],
    },
    { file: 'apps/vscode-extension/src/extension.ts', score: 20, confidence: 0.2, reasons: ['Imports 6 project modules'] },
  ];

  it('groups nodes by area and sorts each area by score descending', () => {
    const areas = buildKnowledgeMapAreas(candidates);
    const scanner = areas.find((a) => a.area === 'Scanner');
    assert.ok(scanner);
    assert.equal(scanner!.nodes.length, 2);
    assert.equal(scanner!.nodes[0]?.file, 'packages/scanner/src/index.ts');
    assert.equal(scanner!.nodes[1]?.file, 'packages/scanner/src/stages/FilesystemStage.ts');
  });

  it('sorts areas by their top file score descending', () => {
    const areas = buildKnowledgeMapAreas(candidates);
    assert.equal(areas[0]?.area, 'Scanner');
  });

  it('never invents a node beyond the given candidates', () => {
    const areas = buildKnowledgeMapAreas(candidates);
    const total = areas.reduce((sum, a) => sum + a.nodes.length, 0);
    assert.equal(total, candidates.length);
  });
});
