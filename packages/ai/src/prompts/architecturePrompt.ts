import type { ProjectArchitectureContext } from '../types/Architecture.js';

export const ARCHITECTURE_SYSTEM_PROMPT = `You organize verified repository evidence into a concise architecture map for a developer new to the codebase. Use only supplied files and evidence. Never invent files, directories, frameworks, code behavior, source dependencies, or coordinates. Return JSON only.

Areas are AI interpretations, not verified facts. Prefer 1-2 areas for tiny repositories, otherwise a small number of meaningful responsibility-oriented areas (not one per folder/file). Every area and area relationship must cite existing evidence files. Keep purpose, roles, relationship labels, and explanations concise. Use confidence from 0 to 1. Do not include source code or any fields outside the requested schema.`;

export function buildArchitectureUserPrompt(context: ProjectArchitectureContext): string {
  const { eligibleFiles: _eligibleFiles, ...promptContext } = context;
  return `Analyze this bounded deterministic architecture context. Omitted files exist and must not be treated as absent.\n\n${JSON.stringify(promptContext)}\n\nReturn this JSON shape: {"summary":"...","areas":[{"id":"lowercase-id","name":"...","shortPurpose":"...","files":["..."],"importantFiles":["..."],"evidenceFiles":["..."],"confidence":0.0}],"fileRoles":[{"file":"...","role":"...","confidence":0.0}],"relationships":[{"sourceAreaId":"...","targetAreaId":"...","label":"...","explanation":"...","evidenceFiles":["..."],"confidence":0.0}],"warnings":["..."]}`;
}
