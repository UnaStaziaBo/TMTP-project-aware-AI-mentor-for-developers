import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { OpenAIProvider } from '../src/providers/OpenAIProvider.js';
import type { FileLessonContext } from '../src/types/FileLessonContext.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('OpenAIProvider.testConnection', () => {
  it('reports ok on a 200 response', async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://api.openai.com/v1/models');
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer sk-test');
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const result = await new OpenAIProvider().testConnection({ apiKey: 'sk-test', model: 'gpt-5.5' });
    assert.deepEqual(result, { ok: true });
  });

  it('reports the failure reason on a non-200 response', async () => {
    globalThis.fetch = (async () => new Response('invalid api key', { status: 401 })) as typeof fetch;

    const result = await new OpenAIProvider().testConnection({ apiKey: 'sk-bad', model: 'gpt-5.5' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /401/);
    }
  });

  it('reports network errors instead of throwing', async () => {
    globalThis.fetch = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as typeof fetch;

    const result = await new OpenAIProvider().testConnection({ apiKey: 'sk-test', model: 'gpt-5.5' });
    assert.equal(result.ok, false);
  });
});

const fileLessonContext: FileLessonContext = {
  language: 'Python',
  file: 'app/main.py',
  fileContent: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/users")\nasync def users():\n    ...\n',
  reasons: ['Conventional filename', 'Imports 5 project modules'],
};

describe('OpenAIProvider.generateFileLesson', () => {
  it('sends the file content and reasons, and attaches the file to the parsed lesson', async () => {
    let capturedBody: any;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      capturedBody = JSON.parse(init!.body as string);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'FastAPI bootstrap',
                responsibility: 'This file creates the FastAPI application and registers routes.',
                keyConstructs: [
                  {
                    snippet: '@app.get("/users")',
                    project: 'This registers the /users endpoint.',
                    language: 'This is a Python decorator.',
                    architecture: 'FastAPI uses decorators to declare routes close to their handlers.',
                  },
                ],
              }),
            },
          },
        ],
      });
    }) as typeof fetch;

    const lesson = await new OpenAIProvider().generateFileLesson(fileLessonContext, {
      apiKey: 'sk-test',
      model: 'gpt-5.5',
    });

    assert.equal(lesson.file, 'app/main.py');
    assert.equal(lesson.keyConstructs[0]?.snippet, '@app.get("/users")');
    assert.equal(capturedBody.model, 'gpt-5.5');
    assert.equal(capturedBody.response_format.type, 'json_object');
    assert.ok(capturedBody.messages[1].content.includes('async def users'));
    assert.ok(capturedBody.messages[1].content.includes('Conventional filename'));
  });

  it('does not send a temperature override (newer models reject non-default values)', async () => {
    let capturedBody: any;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'x',
                responsibility: 'y',
                keyConstructs: [{ snippet: 'a', project: 'b', language: 'c', architecture: 'd' }],
              }),
            },
          },
        ],
      });
    }) as typeof fetch;

    await new OpenAIProvider().generateFileLesson(fileLessonContext, { apiKey: 'sk-test', model: 'gpt-5.5' });
    assert.ok(!('temperature' in capturedBody));
  });

  it('throws a descriptive error on a non-200 response', async () => {
    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;

    await assert.rejects(
      () => new OpenAIProvider().generateFileLesson(fileLessonContext, { apiKey: 'sk-test', model: 'gpt-5.5' }),
      /429/,
    );
  });

  it('throws if the model response is not valid JSON', async () => {
    globalThis.fetch = (async () =>
      Response.json({ choices: [{ message: { content: 'not json' } }] })) as typeof fetch;

    await assert.rejects(() =>
      new OpenAIProvider().generateFileLesson(fileLessonContext, { apiKey: 'sk-test', model: 'gpt-5.5' }),
    );
  });

  it('throws if the JSON is missing required fields', async () => {
    globalThis.fetch = (async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'x' }) } }] })) as typeof fetch;

    await assert.rejects(() =>
      new OpenAIProvider().generateFileLesson(fileLessonContext, { apiKey: 'sk-test', model: 'gpt-5.5' }),
    );
  });
});
