import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parsePracticePlan } from '../src/validatePracticePlan.js';
import { InvalidAIResponseError } from '../src/errors.js';
import type { ScenarioFocus } from '../src/types/PracticePlanContext.js';

const scenarios: ScenarioFocus[] = [
  { file: 'a.ts', options: ['a.ts', 'b.ts', 'c.ts'], difficulty: 'intro' },
  { file: 'b.ts', options: ['a.ts', 'b.ts', 'c.ts', 'd.ts'], difficulty: 'advanced' },
];

describe('parsePracticePlan', () => {
  it('zips situation/explanation onto the deterministic file/options/correctOption', () => {
    const plan = parsePracticePlan(
      {
        scenarios: [
          { situation: 'Where would you look first?', explanation: 'a.ts because...' },
          { situation: 'What if this stage were removed?', explanation: 'b.ts because...' },
        ],
      },
      scenarios,
    );

    assert.equal(plan.scenarios.length, 2);
    assert.equal(plan.scenarios[0]?.correctOption, 'a.ts');
    assert.deepEqual(plan.scenarios[0]?.options, ['a.ts', 'b.ts', 'c.ts']);
    assert.equal(plan.scenarios[1]?.correctOption, 'b.ts');
    assert.equal(plan.scenarios[1]?.situation, 'What if this stage were removed?');
  });

  it('truncates to the shorter length if the model returns fewer scenarios', () => {
    const plan = parsePracticePlan(
      { scenarios: [{ situation: 'Only one.', explanation: 'because a.ts...' }] },
      scenarios,
    );
    assert.equal(plan.scenarios.length, 1);
    assert.equal(plan.scenarios[0]?.correctOption, 'a.ts');
  });

  it('throws when the response is not an object', () => {
    assert.throws(() => parsePracticePlan('nope', scenarios), InvalidAIResponseError);
  });

  it('throws when "scenarios" is missing', () => {
    assert.throws(() => parsePracticePlan({}, scenarios), InvalidAIResponseError);
  });

  it('throws when there are no usable scenarios', () => {
    assert.throws(() => parsePracticePlan({ scenarios: [] }, scenarios), InvalidAIResponseError);
  });

  it('throws when a scenario is missing "explanation"', () => {
    assert.throws(
      () => parsePracticePlan({ scenarios: [{ situation: 'x' }] }, scenarios),
      InvalidAIResponseError,
    );
  });
});
