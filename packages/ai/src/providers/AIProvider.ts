import type { FileLesson } from '../types/FileLesson.js';
import type { FileLessonContext } from '../types/FileLessonContext.js';
import type { PracticePlan } from '../types/PracticePlan.js';
import type { PracticePlanContext } from '../types/PracticePlanContext.js';
import type { ArchitectureModel, ProjectArchitectureContext } from '../types/Architecture.js';

export interface AIProviderCredentials {
  apiKey: string;
  model: string;
}

export type AIProviderId = 'openai' | 'anthropic' | 'gemini';

export type TestConnectionResult = { ok: true } | { ok: false; message: string };

/**
 * The provider abstraction all AI features build on. Provider-specific API
 * formats stay behind this interface so lesson and practice call sites share
 * the same deterministic contexts and validated result contracts.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  testConnection(credentials: AIProviderCredentials): Promise<TestConnectionResult>;
  generateFileLesson(context: FileLessonContext, credentials: AIProviderCredentials): Promise<FileLesson>;
  generatePracticePlan(context: PracticePlanContext, credentials: AIProviderCredentials): Promise<PracticePlan>;
  generateArchitecture(context: ProjectArchitectureContext, credentials: AIProviderCredentials): Promise<ArchitectureModel>;
}
