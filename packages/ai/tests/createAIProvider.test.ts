import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AnthropicProvider } from '../src/providers/AnthropicProvider.js';
import { createAIProvider } from '../src/providers/createAIProvider.js';
import { GeminiProvider } from '../src/providers/GeminiProvider.js';
import { OpenAIProvider } from '../src/providers/OpenAIProvider.js';

describe('createAIProvider', () => {
  it('creates every supported provider', () => {
    assert.ok(createAIProvider('openai') instanceof OpenAIProvider);
    assert.ok(createAIProvider('anthropic') instanceof AnthropicProvider);
    assert.ok(createAIProvider('gemini') instanceof GeminiProvider);
  });
});
