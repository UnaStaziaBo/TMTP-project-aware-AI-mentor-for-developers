import { FILE_LESSON_SYSTEM_PROMPT, buildFileLessonUserPrompt } from '../prompts/fileLessonPrompt.js';
import { PRACTICE_PLAN_SYSTEM_PROMPT, buildPracticePlanUserPrompt } from '../prompts/practicePlanPrompt.js';
import { parseFileLesson } from '../validateFileLesson.js';
import { parsePracticePlan } from '../validatePracticePlan.js';
import type { FileLesson } from '../types/FileLesson.js';
import type { FileLessonContext } from '../types/FileLessonContext.js';
import type { PracticePlan } from '../types/PracticePlan.js';
import type { PracticePlanContext } from '../types/PracticePlanContext.js';
import type { AIProvider, AIProviderCredentials, TestConnectionResult } from './AIProvider.js';
import { ARCHITECTURE_SYSTEM_PROMPT, buildArchitectureUserPrompt } from '../prompts/architecturePrompt.js';
import { parseArchitectureModel } from '../validateArchitecture.js';
import type { ArchitectureModel, ProjectArchitectureContext } from '../types/Architecture.js';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function headers(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  };
}

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly label = 'Anthropic Claude';

  async testConnection(credentials: AIProviderCredentials): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${ANTHROPIC_BASE_URL}/models?limit=1`, {
        headers: headers(credentials.apiKey),
      });
      if (response.ok) return { ok: true };

      const body = await response.text();
      return { ok: false, message: `Anthropic returned ${response.status}: ${body.slice(0, 200)}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async requestJSON(
    systemPrompt: string,
    userPrompt: string,
    credentials: AIProviderCredentials,
  ): Promise<unknown> {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: headers(credentials.apiKey),
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as AnthropicMessageResponse;
    const content = payload.content?.find((block) => block.type === 'text')?.text;
    if (!content) throw new Error('Anthropic response did not contain any text content');

    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Anthropic response was not valid JSON');
    }
  }

  async generateFileLesson(context: FileLessonContext, credentials: AIProviderCredentials): Promise<FileLesson> {
    const raw = await this.requestJSON(FILE_LESSON_SYSTEM_PROMPT, buildFileLessonUserPrompt(context), credentials);
    return parseFileLesson(context.file, raw);
  }

  async generatePracticePlan(
    context: PracticePlanContext,
    credentials: AIProviderCredentials,
  ): Promise<PracticePlan> {
    const raw = await this.requestJSON(
      PRACTICE_PLAN_SYSTEM_PROMPT,
      buildPracticePlanUserPrompt(context),
      credentials,
    );
    return parsePracticePlan(raw, context.scenarios);
  }

  async generateArchitecture(context: ProjectArchitectureContext, credentials: AIProviderCredentials): Promise<ArchitectureModel> {
    return parseArchitectureModel(context, await this.requestJSON(ARCHITECTURE_SYSTEM_PROMPT, buildArchitectureUserPrompt(context), credentials));
  }
}
