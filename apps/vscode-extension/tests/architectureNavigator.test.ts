import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { architectureNavigatorProgress, architectureNavigatorViewportBounds, selectedArchitectureNavigatorArea } from '../src/webview/graph/architectureNavigator.js';

describe('Architecture Navigator state', () => {
  it('uses React Flow viewport transforms to describe the exact visible flow-space bounds', () => {
    assert.deepEqual(architectureNavigatorViewportBounds({ x: -200, y: -100, zoom: 2 }, 1000, 800), { x: 100, y: 50, width: 500, height: 400 });
    // A fit, pan, or zoom is represented by a new React Flow viewport, not a
    // separate Navigator state machine.
    assert.deepEqual(architectureNavigatorViewportBounds({ x: 40, y: 80, zoom: 0.5 }, 1000, 800), { x: -80, y: -160, width: 2000, height: 1600 });
  });

  it('orients a selected canonical file through its validated architecture membership', () => {
    const areaByFile = new Map([['src/scan.ts', 'scanner'], ['src/view.ts', 'extension']]);
    assert.equal(selectedArchitectureNavigatorArea(null, 'src/scan.ts', areaByFile), 'scanner');
    assert.equal(selectedArchitectureNavigatorArea('extension', 'src/scan.ts', areaByFile), 'extension');
    assert.equal(selectedArchitectureNavigatorArea(null, 'missing.ts', areaByFile), null);
  });

  it('aggregates only recorded TMTP learning progress and never treats a file open as exploration', () => {
    const progress = architectureNavigatorProgress(
      [{ id: 'scanner', files: ['src/scan.ts', 'src/model.ts'] }, { id: 'extension', files: ['src/view.ts'] }],
      [
        { file: 'src/scan.ts', learningProgress: 80 },
        { file: 'src/model.ts', learningProgress: 0 },
        { file: 'src/view.ts', learningProgress: 100 },
      ] as any,
    );
    assert.deepEqual(progress.byArea.get('scanner'), { totalFiles: 2, exploredFiles: 1, averageProgress: 40 });
    assert.deepEqual(progress.byArea.get('extension'), { totalFiles: 1, exploredFiles: 1, averageProgress: 100 });
    assert.equal(progress.startedAreas, 2);
  });
});
