import { InvalidAIResponseError } from './errors.js';
import type { ArchitectureArea, ArchitectureModel, ArchitectureRelationship, ProjectArchitectureContext } from './types/Architecture.js';
import { normalizeArchitecturalRole, normalizeArchitectureRelationshipType } from './architectureSemantics.js';

const MAX_AREAS = 12;
const MAX_RELATIONSHIPS = 16;
const text = (value: unknown, max: number): string | undefined => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined;
const confidence = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
const validFiles = (value: unknown, known: Set<string>): string[] => Array.isArray(value) ? [...new Set(value.filter((file): file is string => typeof file === 'string' && known.has(file)))].sort() : [];

/** Drops invalid individual interpretations; never fuzzy-matches AI file paths. */
export function parseArchitectureModel(context: ProjectArchitectureContext, raw: unknown): ArchitectureModel {
  if (typeof raw !== 'object' || raw === null) throw new InvalidAIResponseError('Architecture response was not a JSON object');
  const input = raw as Record<string, unknown>;
  const summary = text(input.summary, 600);
  if (!summary || !Array.isArray(input.areas)) throw new InvalidAIResponseError('Architecture response is missing summary or areas');
  const known = new Set(context.eligibleFiles);
  const areas: ArchitectureArea[] = [];
  const ids = new Set<string>();
  for (const candidate of input.areas.slice(0, MAX_AREAS)) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const area = candidate as Record<string, unknown>;
    const id = text(area.id, 48);
    const name = text(area.name, 80);
    const shortPurpose = text(area.shortPurpose, 240);
    const files = validFiles(area.files, known);
    const evidenceFiles = validFiles(area.evidenceFiles, known);
    const level = confidence(area.confidence);
    if (!id || !/^[a-z0-9-]+$/.test(id) || ids.has(id) || !name || !shortPurpose || evidenceFiles.length === 0 || level === undefined) continue;
    ids.add(id);
    areas.push({ id, name, shortPurpose, files, importantFiles: validFiles(area.importantFiles, known).filter((file) => files.includes(file)), evidenceFiles, confidence: level, role: normalizeArchitecturalRole(area.role, `${name} ${shortPurpose}`) });
  }
  if (areas.length === 0) throw new InvalidAIResponseError('Architecture response contained no valid evidence-backed areas');
  const relationships: ArchitectureRelationship[] = [];
  for (const candidate of Array.isArray(input.relationships) ? input.relationships.slice(0, MAX_RELATIONSHIPS) : []) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const relation = candidate as Record<string, unknown>;
    const sourceAreaId = text(relation.sourceAreaId, 48);
    const targetAreaId = text(relation.targetAreaId, 48);
    const label = text(relation.label, 60);
    const explanation = text(relation.explanation, 240);
    const level = confidence(relation.confidence);
    const evidenceFiles = validFiles(relation.evidenceFiles, known);
    if (!sourceAreaId || !targetAreaId || sourceAreaId === targetAreaId || !ids.has(sourceAreaId) || !ids.has(targetAreaId) || !label || !explanation || !evidenceFiles.length || level === undefined) continue;
    const type = normalizeArchitectureRelationshipType(relation.type ?? label);
    relationships.push({ sourceAreaId, targetAreaId, type, label, explanation, evidenceFiles, confidence: level });
  }
  const fileRoles = (Array.isArray(input.fileRoles) ? input.fileRoles : []).flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    const file = text(item.file, 500); const role = text(item.role, 100); const level = confidence(item.confidence);
    return file && known.has(file) && role && level !== undefined ? [{ file, role, confidence: level }] : [];
  });
  return { summary, areas, fileRoles, relationships, warnings: (Array.isArray(input.warnings) ? input.warnings : []).flatMap((warning) => text(warning, 180) ? [text(warning, 180)!] : []).slice(0, 8), fingerprint: context.fingerprint };
}
