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

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiGenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function normalizeModel(model: string): string {
  return model.startsWith('models/') ? model.slice('models/'.length) : model;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly label = 'Google Gemini';

  async testConnection(credentials: AIProviderCredentials): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models?pageSize=1`, {
        headers: { 'x-goog-api-key': credentials.apiKey },
      });
      if (response.ok) return { ok: true };

      const body = await response.text();
      return { ok: false, message: `Gemini returned ${response.status}: ${body.slice(0, 200)}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async requestJSON(
    systemPrompt: string,
    userPrompt: string,
    credentials: AIProviderCredentials,
  ): Promise<unknown> {
    const model = encodeURIComponent(normalizeModel(credentials.model));
    const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': credentials.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const content = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!content) throw new Error('Gemini response did not contain any text content');

    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Gemini response was not valid JSON');
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
