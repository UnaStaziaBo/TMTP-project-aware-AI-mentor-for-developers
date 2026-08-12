import type { ArchitecturalRole, ArchitectureRelationshipType } from './types/Architecture.js';

export const ARCHITECTURAL_ROLES: readonly ArchitecturalRole[] = [
  'entry', 'orchestration', 'core', 'integration', 'shared', 'supporting', 'testing', 'documentation',
];

export const ARCHITECTURE_RELATIONSHIP_TYPES: readonly ArchitectureRelationshipType[] = [
  'uses', 'produces', 'provides', 'feeds', 'configures', 'coordinates', 'implements', 'invokes',
  'reads-from', 'writes-to', 'supports', 'validates', 'tests', 'demonstrates',
];

const RELATIONSHIP_LABELS: Record<ArchitectureRelationshipType, string> = {
  uses: 'uses', produces: 'produces', provides: 'provides', feeds: 'feeds', configures: 'configures',
  coordinates: 'coordinates', implements: 'implements', invokes: 'invokes', 'reads-from': 'reads from',
  'writes-to': 'writes to', supports: 'supports', validates: 'validates', tests: 'tests', demonstrates: 'demonstrates',
};

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[ _]+/g, '-').replace(/[^a-z-]/g, '') : '';
}

/** Converts bounded AI wording into a small, stable vocabulary for the canvas. */
export function normalizeArchitectureRelationshipType(value: unknown): ArchitectureRelationshipType {
  const candidate = normalized(value);
  if ((ARCHITECTURE_RELATIONSHIP_TYPES as readonly string[]).includes(candidate)) return candidate as ArchitectureRelationshipType;
  if (candidate.includes('read')) return 'reads-from';
  if (candidate.includes('write')) return 'writes-to';
  if (candidate.includes('produc') || candidate.includes('output') || candidate.includes('result')) return 'produces';
  if (candidate.includes('feed') || candidate.includes('supply')) return 'feeds';
  if (candidate.includes('provid')) return 'provides';
  if (candidate.includes('config')) return 'configures';
  if (candidate.includes('coordin') || candidate.includes('orchestrat')) return 'coordinates';
  if (candidate.includes('implement')) return 'implements';
  if (candidate.includes('invoke') || candidate.includes('call')) return 'invokes';
  if (candidate.includes('validat')) return 'validates';
  if (candidate.includes('test')) return 'tests';
  if (candidate.includes('demo') || candidate.includes('example')) return 'demonstrates';
  if (candidate.includes('support')) return 'supports';
  return 'uses';
}

export function architectureRelationshipLabel(type: ArchitectureRelationshipType): string {
  return RELATIONSHIP_LABELS[type];
}

/** Roles are hints for reading/layout, never a source of fabricated dependencies. */
export function normalizeArchitecturalRole(value: unknown, fallbackText = ''): ArchitecturalRole {
  const candidate = `${normalized(value)} ${normalized(fallbackText)}`;
  if (candidate.includes('document') || candidate.includes('readme') || candidate.includes('guide')) return 'documentation';
  if (candidate.includes('test') || candidate.includes('spec')) return 'testing';
  if (candidate.includes('entry') || candidate.includes('host') || candidate.includes('command') || candidate.includes('webview')) return 'entry';
  if (candidate.includes('orchestrat') || candidate.includes('pipeline') || candidate.includes('coordinat')) return 'orchestration';
  if (candidate.includes('integrat') || candidate.includes('provider') || candidate.includes('adapter')) return 'integration';
  if (candidate.includes('shared') || candidate.includes('contract') || candidate.includes('model') || candidate.includes('type')) return 'shared';
  if (candidate.includes('support') || candidate.includes('example') || candidate.includes('tool')) return 'supporting';
  return 'core';
}

export function architecturalRoleLabel(role: ArchitecturalRole): string {
  return role === 'entry' ? 'ENTRY' : role === 'orchestration' ? 'ORCHESTRATION' : role === 'core' ? 'CORE' : role.toUpperCase();
}
