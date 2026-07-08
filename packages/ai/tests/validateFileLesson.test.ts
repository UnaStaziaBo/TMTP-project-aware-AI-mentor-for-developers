import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseFileLesson } from '../src/validateFileLesson.js';
import { InvalidAIResponseError } from '../src/errors.js';

const wellFormed = {
  title: 'Entry point of the Scanner',
  responsibility: 'This file orchestrates every scanning stage. It exists so the pipeline has one place to sequence stages.',
  keyConstructs: [
    {
      snippet: "import { FilesystemStage } from './stages/FilesystemStage';",
      project: 'This imports the stage responsible for scanning the file system.',
      language: 'This is a TypeScript import statement.',
      architecture: 'The scanner is split into independent stages so new ones can be added easily.',
    },
  ],
};

describe('parseFileLesson', () => {
  it('parses a well-formed response and attaches the requested file', () => {
    const lesson = parseFileLesson('packages/scanner/src/index.ts', wellFormed);
    assert.equal(lesson.file, 'packages/scanner/src/index.ts');
    assert.equal(lesson.title, wellFormed.title);
    assert.equal(lesson.keyConstructs.length, 1);
    assert.equal(lesson.keyConstructs[0]?.snippet, wellFormed.keyConstructs[0]?.snippet);
  });

  it('throws when the response is not an object', () => {
    assert.throws(() => parseFileLesson('a.ts', 'not an object'), InvalidAIResponseError);
  });

  it('throws when "title" is missing', () => {
    const { title, ...rest } = wellFormed;
    assert.throws(() => parseFileLesson('a.ts', rest), InvalidAIResponseError);
  });

  it('throws when "responsibility" is missing', () => {
    const { responsibility, ...rest } = wellFormed;
    assert.throws(() => parseFileLesson('a.ts', rest), InvalidAIResponseError);
  });

  it('throws when "keyConstructs" is empty', () => {
    assert.throws(() => parseFileLesson('a.ts', { ...wellFormed, keyConstructs: [] }), InvalidAIResponseError);
  });

  it('throws when a key construct is missing a required field', () => {
    const broken = {
      ...wellFormed,
      keyConstructs: [{ snippet: 'x', project: 'y', language: 'z' }],
    };
    assert.throws(() => parseFileLesson('a.ts', broken), InvalidAIResponseError);
  });
});
