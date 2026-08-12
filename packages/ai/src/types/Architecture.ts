/** Compact, deterministic evidence supplied to an AI provider. No source contents. */
export interface ProjectArchitectureContext {
  version: 1;
  fingerprint: string;
  fileCount: number;
  /** Authoritative validation list. It is deliberately omitted from the AI prompt for token discipline. */
  eligibleFiles: string[];
  languages: string[];
  frameworks: string[];
  dependencies: string[];
  entryFiles: string[];
  importantFiles: Array<{ file: string; reasons: string[]; referenceCount: number }>;
  regions: Array<{ path: string; fileCount: number; representativeFiles: string[] }>;
  imports: Array<{ source: string; target: string }>;
  omittedFileCount: number;
}

export interface ArchitectureArea {
  id: string;
  name: string;
  shortPurpose: string;
  files: string[];
  importantFiles: string[];
  evidenceFiles: string[];
  confidence: number;
}

export interface ArchitectureRelationship {
  sourceAreaId: string;
  targetAreaId: string;
  label: string;
  explanation: string;
  evidenceFiles: string[];
  confidence: number;
}

/** AI-interpreted architecture, separate from verified scanner relationships. */
export interface ArchitectureModel {
  summary: string;
  areas: ArchitectureArea[];
  fileRoles: Array<{ file: string; role: string; confidence: number }>;
  relationships: ArchitectureRelationship[];
  warnings: string[];
  fingerprint: string;
}
