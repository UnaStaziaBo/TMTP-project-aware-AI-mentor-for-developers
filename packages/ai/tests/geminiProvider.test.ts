import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { GeminiProvider } from '../src/providers/GeminiProvider.js';
import type { FileLessonContext } from '../src/types/FileLessonContext.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const context: FileLessonContext = {
  language: 'Python',
  file: 'app/main.py',
  fileContent: 'app = FastAPI()',
  reasons: ['FastAPI application bootstrap detected'],
};

describe('GeminiProvider', () => {
  it('tests the API key against the models endpoint', async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'gemini-test');
      return Response.json({ models: [] });
    }) as typeof fetch;

    assert.deepEqual(
      await new GeminiProvider().testConnection({ apiKey: 'gemini-test', model: 'gemini-3.5-flash' }),
      { ok: true },
    );
  });

  it('requests JSON mode and parses a grounded file lesson', async () => {
    let body: any;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
      body = JSON.parse(init!.body as string);
      return Response.json({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                title: 'FastAPI bootstrap',
                responsibility: 'This file creates the application.',
                keyConstructs: [{ snippet: 'FastAPI()', project: 'Creates the app.', language: 'Calls a constructor.', architecture: 'Centralizes startup.' }],
              }),
            }],
          },
        }],
      });
    }) as typeof fetch;

    const lesson = await new GeminiProvider().generateFileLesson(context, {
      apiKey: 'gemini-test',
      model: 'models/gemini-3.5-flash',
    });

    assert.equal(lesson.file, 'app/main.py');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.systemInstruction.parts[0].text.includes('guided walkthrough'), true);
    assert.equal(body.contents[0].parts[0].text.includes('app/main.py'), true);
  });
});
