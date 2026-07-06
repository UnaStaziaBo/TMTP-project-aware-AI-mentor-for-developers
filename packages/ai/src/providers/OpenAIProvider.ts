import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';
import { parseGuidedTour } from '../validateGuidedTour.js';
import type { AIContext } from '../types/AIContext.js';
import type { GuidedTour } from '../types/GuidedTour.js';
import type { AIProvider, AIProviderCredentials, TestConnectionResult } from './AIProvider.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI';

  async testConnection(credentials: AIProviderCredentials): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });

      if (response.ok) {
        return { ok: true };
      }

      const body = await response.text();
      return { ok: false, message: `OpenAI returned ${response.status}: ${body.slice(0, 200)}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async generateGuidedTour(
    context: AIContext,
    credentials: AIProviderCredentials,
  ): Promise<GuidedTour> {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: credentials.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not contain any message content');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error('OpenAI response was not valid JSON');
    }

    return parseGuidedTour(raw);
  }
}
