import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  parseGuidedTour,
  groundTourStops,
  DEFAULT_INTRODUCTION,
  InvalidAIResponseError,
} from '../src/validateGuidedTour.js';

describe('parseGuidedTour', () => {
  it('parses a well-formed tour', () => {
    const tour = parseGuidedTour({
      introduction: 'Welcome to the tour.',
      stops: [
        {
          title: 'The public API',
          file: 'src/index.ts',
          whyThisFile: 'It exposes the package to the rest of the project.',
          whatToNotice: ['exported functions', 'module structure'],
          nextReason: 'Next we look at the pipeline that powers it.',
        },
      ],
    });

    assert.equal(tour.introduction, 'Welcome to the tour.');
    assert.equal(tour.stops.length, 1);
    assert.equal(tour.stops[0]?.file, 'src/index.ts');
  });

  it('falls back to the default introduction when missing', () => {
    const tour = parseGuidedTour({ stops: [] });
    assert.equal(tour.introduction, DEFAULT_INTRODUCTION);
  });

  it('rejects a response missing "stops"', () => {
    assert.throws(() => parseGuidedTour({ introduction: 'hi' }), InvalidAIResponseError);
  });

  it('rejects a non-object response', () => {
    assert.throws(() => parseGuidedTour('just a string'), InvalidAIResponseError);
  });

  it('drops malformed stops instead of throwing', () => {
    const tour = parseGuidedTour({
      introduction: 'Welcome.',
      stops: [
        { title: 'Missing fields' },
        {
          title: 'Valid stop',
          file: 'src/index.ts',
          whyThisFile: 'It matters.',
          whatToNotice: ['a thing'],
          nextReason: '',
        },
        'garbage',
      ],
    });

    assert.equal(tour.stops.length, 1);
    assert.equal(tour.stops[0]?.title, 'Valid stop');
  });
});

describe('groundTourStops', () => {
  const startingFiles = [
    { file: 'app/main.py', score: 55, confidence: 0.55, reasons: [] },
    { file: 'app/router.py', score: 40, confidence: 0.4, reasons: [] },
    { file: 'app/db.py', score: 30, confidence: 0.3, reasons: [] },
  ];

  function stop(file: string) {
    return { title: file, file, whyThisFile: 'x', whatToNotice: ['y'], nextReason: '' };
  }

  it('drops stops referencing files outside the deterministic ranking', () => {
    const tour = groundTourStops(
      { introduction: 'x', stops: [stop('app/main.py'), stop('app/made-up.py')] },
      startingFiles,
    );

    assert.deepEqual(
      tour.stops.map((s) => s.file),
      ['app/main.py'],
    );
  });

  it('reorders stops to match the deterministic ranking regardless of model order', () => {
    const tour = groundTourStops(
      { introduction: 'x', stops: [stop('app/db.py'), stop('app/main.py'), stop('app/router.py')] },
      startingFiles,
    );

    assert.deepEqual(
      tour.stops.map((s) => s.file),
      ['app/main.py', 'app/router.py', 'app/db.py'],
    );
  });

  it('returns an empty stop list rather than throwing if nothing survives grounding', () => {
    const tour = groundTourStops({ introduction: 'x', stops: [stop('nope.py')] }, startingFiles);
    assert.equal(tour.stops.length, 0);
  });
});
