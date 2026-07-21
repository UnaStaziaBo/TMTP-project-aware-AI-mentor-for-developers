import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import type { AIProvider, AIProviderId } from './AIProvider.js';

export function createAIProvider(id: AIProviderId): AIProvider {
  switch (id) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'gemini':
      return new GeminiProvider();
  }
}
