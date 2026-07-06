import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { OpenAIProvider } from '../src/providers/OpenAIProvider.js';
import type { AIContext } from '../src/types/AIContext.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const context: AIContext = {
  projectName: 'fastapi-demo',
  overview: { fileCount: 9, folderCount: 1, manifestCount: 1 },
  languages: [{ name: 'Python', confidence: 1, evidence: ['*.py files'] }],
  frameworks: [{ name: 'FastAPI', confidence: 1, evidence: ['FastAPI(...)'] }],
  dependencies: [],
  startingFiles: [{ file: 'app/main.py', score: 55, confidence: 0.55, reasons: ['Conventional filename'] }],
  folders: ['app'],
};

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

describe('OpenAIProvider.generateGuidedTour', () => {
  it('sends the deterministic context and parses a well-formed completion', async () => {
    let capturedBody: any;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      capturedBody = JSON.parse(init!.body as string);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                introduction: 'Welcome to the tour.',
                stops: [
                  {
                    title: 'The FastAPI bootstrap',
                    file: 'app/main.py',
                    whyThisFile: 'It creates the FastAPI application.',
                    whatToNotice: ['the FastAPI() call', 'route registration'],
                    nextReason: 'This is the only stop.',
                  },
                ],
              }),
            },
          },
        ],
      });
    }) as typeof fetch;

    const tour = await new OpenAIProvider().generateGuidedTour(context, {
      apiKey: 'sk-test',
      model: 'gpt-5.5',
    });

    assert.equal(tour.stops[0]?.file, 'app/main.py');
    assert.equal(capturedBody.model, 'gpt-5.5');
    assert.equal(capturedBody.response_format.type, 'json_object');
    assert.ok(capturedBody.messages[1].content.includes('fastapi-demo'));
  });

  it('does not send a temperature override (newer models reject non-default values)', async () => {
    let capturedBody: any;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ introduction: 'hi', stops: [] }) } }],
      });
    }) as typeof fetch;

    await new OpenAIProvider().generateGuidedTour(context, { apiKey: 'sk-test', model: 'gpt-5.5' });
    assert.ok(!('temperature' in capturedBody));
  });

  it('throws a descriptive error on a non-200 response', async () => {
    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;

    await assert.rejects(
      () => new OpenAIProvider().generateGuidedTour(context, { apiKey: 'sk-test', model: 'gpt-5.5' }),
      /429/,
    );
  });

  it('throws if the model response is not valid JSON', async () => {
    globalThis.fetch = (async () =>
      Response.json({ choices: [{ message: { content: 'not json' } }] })) as typeof fetch;

    await assert.rejects(() =>
      new OpenAIProvider().generateGuidedTour(context, { apiKey: 'sk-test', model: 'gpt-5.5' }),
    );
  });

  it('throws if the JSON is missing required fields', async () => {
    globalThis.fetch = (async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ introduction: 'x' }) } }] })) as typeof fetch;

    await assert.rejects(() =>
      new OpenAIProvider().generateGuidedTour(context, { apiKey: 'sk-test', model: 'gpt-5.5' }),
    );
  });
});
