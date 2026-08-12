import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseArchitectureModel } from '../src/validateArchitecture.js';
import type { ProjectArchitectureContext } from '../src/types/Architecture.js';

const context: ProjectArchitectureContext = {
  version: 1, fingerprint: 'test', fileCount: 3, eligibleFiles: ['main.ts', 'lib.ts', 'test.ts'], languages: ['TypeScript'], frameworks: [], dependencies: [], entryFiles: ['main.ts'],
  importantFiles: [{ file: 'main.ts', reasons: ['Entry'], referenceCount: 0 }], regions: [{ path: 'src', fileCount: 3, representativeFiles: ['main.ts', 'lib.ts'] }], imports: [{ source: 'main.ts', target: 'lib.ts' }], omittedFileCount: 0,
};

describe('architecture model validation', () => {
  it('keeps only evidence-backed areas and relationships', () => {
    const model = parseArchitectureModel(context, { summary: 'A small application.', areas: [
      { id: 'app', name: 'Application', shortPurpose: 'Runs the project.', files: ['main.ts', 'missing.ts'], importantFiles: ['main.ts'], evidenceFiles: ['main.ts'], confidence: 0.8 },
      { id: 'lib', name: 'Library', shortPurpose: 'Supports the application.', files: ['lib.ts'], importantFiles: [], evidenceFiles: ['lib.ts'], confidence: 0.7 },
    ], fileRoles: [{ file: 'missing.ts', role: 'Invented', confidence: 1 }], relationships: [
      { sourceAreaId: 'app', targetAreaId: 'lib', label: 'uses', explanation: 'Uses local import.', evidenceFiles: ['main.ts'], confidence: 0.7 },
      { sourceAreaId: 'app', targetAreaId: 'missing', label: 'uses', explanation: 'Invalid.', evidenceFiles: ['main.ts'], confidence: 0.7 },
    ], warnings: [] });
    assert.deepEqual(model.areas[0]!.files, ['main.ts']);
    assert.equal(model.relationships.length, 1);
    assert.equal(model.fileRoles.length, 0);
  });

  it('rejects areas with no valid evidence and duplicate ids', () => {
    assert.throws(() => parseArchitectureModel(context, { summary: 'x', areas: [
      { id: 'same', name: 'One', shortPurpose: 'x', files: [], importantFiles: [], evidenceFiles: [], confidence: 0.5 },
      { id: 'same', name: 'Two', shortPurpose: 'x', files: [], importantFiles: [], evidenceFiles: [], confidence: 0.5 },
    ] }));
  });
});
