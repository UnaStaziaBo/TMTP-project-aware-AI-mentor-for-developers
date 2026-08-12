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

  private async requestJSON(
    systemPrompt: string,
    userPrompt: string,
    credentials: AIProviderCredentials,
  ): Promise<unknown> {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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

    try {
      return JSON.parse(content);
    } catch {
      throw new Error('OpenAI response was not valid JSON');
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
