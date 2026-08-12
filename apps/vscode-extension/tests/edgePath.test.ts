import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { edgeLabelPoint } from '../src/webview/graph/edgePath.js';

describe('architecture edge label placement', () => {
  it('uses the length-weighted middle of an ELK route rather than its middle bend index', () => {
    const point = edgeLabelPoint([
      { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 20 },
    ]);
    assert.deepEqual(point, { x: 50, y: 10 });
  });
});
