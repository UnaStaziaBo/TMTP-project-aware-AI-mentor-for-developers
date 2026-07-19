import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildSingleFileScenarioPlan } from '../src/practicePlanner.js';

describe('buildSingleFileScenarioPlan', () => {
  const files = ['src/main.ts', 'src/router.ts', 'src/service.ts', 'src/db.ts'];

  it('rotates correct answers instead of always using the practised file', () => {
    const plan = buildSingleFileScenarioPlan('src/router.ts', files);
    assert.deepEqual(plan.map((scenario) => scenario.file), [
      'src/router.ts',
      'src/service.ts',
      'src/db.ts',
    ]);
    assert.ok(plan.every((scenario) => scenario.learningFile === 'src/router.ts'));
  });

  it('keeps both the correct answer and practised file among the options', () => {
    const plan = buildSingleFileScenarioPlan('src/router.ts', files);
    for (const scenario of plan) {
      assert.ok(scenario.options.includes(scenario.file));
      assert.ok(scenario.options.includes('src/router.ts'));
    }
  });

  it('does not keep the correct answer in one predictable option position', () => {
    const plan = buildSingleFileScenarioPlan('src/router.ts', files);
    const positions = plan.map((scenario) => scenario.options.indexOf(scenario.file));
    assert.ok(new Set(positions).size > 1, `expected varied correct positions, got ${positions.join(', ')}`);
  });

  it('remains valid for a project with only one candidate file', () => {
    const plan = buildSingleFileScenarioPlan('main.py', ['main.py']);
    assert.ok(plan.every((scenario) => scenario.file === 'main.py'));
    assert.ok(plan.every((scenario) => scenario.options.includes('main.py')));
  });
});
