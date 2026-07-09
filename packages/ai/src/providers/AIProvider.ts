import type { FileLesson } from '../types/FileLesson.js';
import type { FileLessonContext } from '../types/FileLessonContext.js';
import type { PracticePlan } from '../types/PracticePlan.js';
import type { PracticePlanContext } from '../types/PracticePlanContext.js';

export interface AIProviderCredentials {
  apiKey: string;
  model: string;
}

export type TestConnectionResult = { ok: true } | { ok: false; message: string };

/**
 * The provider abstraction future AI features should build on. OpenAIProvider
 * is the first implementation; adding another provider means implementing
 * this interface, not touching call sites.
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  testConnection(credentials: AIProviderCredentials): Promise<TestConnectionResult>;
  generateFileLesson(context: FileLessonContext, credentials: AIProviderCredentials): Promise<FileLesson>;
  generatePracticePlan(context: PracticePlanContext, credentials: AIProviderCredentials): Promise<PracticePlan>;
}
