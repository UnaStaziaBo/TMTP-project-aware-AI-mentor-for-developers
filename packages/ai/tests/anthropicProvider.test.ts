import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { AnthropicProvider } from '../src/providers/AnthropicProvider.js';
import type { FileLessonContext } from '../src/types/FileLessonContext.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const context: FileLessonContext = {
  language: 'TypeScript',
  file: 'src/main.ts',
  fileContent: 'export function main() {}',
  reasons: ['Conventional filename'],
};

describe('AnthropicProvider', () => {
  it('tests the API key against the models endpoint', async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://api.anthropic.com/v1/models?limit=1');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['x-api-key'], 'sk-ant-test');
      assert.equal(headers['anthropic-version'], '2023-06-01');
      return Response.json({ data: [] });
    }) as typeof fetch;

    assert.deepEqual(
      await new AnthropicProvider().testConnection({ apiKey: 'sk-ant-test', model: 'claude-opus-4-8' }),
      { ok: true },
    );
  });

  it('generates and parses a grounded file lesson', async () => {
    let body: any;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      body = JSON.parse(init!.body as string);
      return Response.json({
        content: [{
          type: 'text',
          text: JSON.stringify({
            title: 'Application entry point',
            responsibility: 'This file starts the application.',
            keyConstructs: [{ snippet: 'main()', project: 'Starts the app.', language: 'Calls a function.', architecture: 'Keeps startup explicit.' }],
          }),
        }],
      });
    }) as typeof fetch;

    const lesson = await new AnthropicProvider().generateFileLesson(context, {
      apiKey: 'sk-ant-test',
      model: 'claude-opus-4-8',
    });

    assert.equal(lesson.file, 'src/main.ts');
    assert.equal(body.model, 'claude-opus-4-8');
    assert.equal(body.system.includes('guided walkthrough'), true);
    assert.equal(body.messages[0].content.includes('src/main.ts'), true);
  });
});
