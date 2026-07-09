import type { StartingFileCandidate } from '@tmpt/scanner';

export type ImportanceTier = 'large' | 'medium' | 'small';

export interface KnowledgeMapNode {
  file: string;
  /** The file's own basename — unambiguous, never invented. */
  title: string;
  /** A short deterministic blurb: overridden to something like "Entry point" when a strong scanner
   * signal applies, otherwise the humanized basename. Never AI-generated. */
  description: string;
  score: number;
  confidence: number;
  tier: ImportanceTier;
}

export interface KnowledgeMapArea {
  area: string;
  nodes: KnowledgeMapNode[];
  tier: ImportanceTier;
}

const CONTAINER_SEGMENTS = new Set(['packages', 'apps', 'libs', 'services', 'src']);

/**
 * Derives a human-readable project area from a file's path alone — no AI,
 * no manifest parsing. Generic monorepo containers ("packages", "apps", …)
 * are skipped in favor of the package/app name directly beneath them; any
 * other layout just uses the top-level folder.
 */
export function deriveProjectArea(file: string): string {
  const segments = file.split('/');
  const first = segments[0] ?? file;
  const areaSegment = CONTAINER_SEGMENTS.has(first) && segments.length > 1 ? segments[1]! : first;
  return humanizeWords(areaSegment);
}

function humanizeWords(raw: string): string {
  const spaced = raw
    .replace(/\.[^./]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

const ENTRY_POINT_PATTERN = /^(Executable entry point|Conventional filename)/;
const BOOTSTRAP_PATTERN = /^(.+) application bootstrap detected$/;

/**
 * Never invents a responsibility — either reflects a reason the scanner's
 * own Starting File Discovery rules already produced, or falls back to a
 * humanized version of the filename itself.
 */
export function deriveShortDescription(file: string, reasons: readonly string[]): string {
  for (const reason of reasons) {
    if (ENTRY_POINT_PATTERN.test(reason)) {
      return 'Entry point';
    }
    const bootstrapMatch = reason.match(BOOTSTRAP_PATTERN);
    if (bootstrapMatch) {
      return `${bootstrapMatch[1]} bootstrap`;
    }
  }
  return humanizeWords(basenameOf(file));
}

function basenameOf(file: string): string {
  return file.split('/').pop() ?? file;
}

export function importanceTier(confidence: number): ImportanceTier {
  if (confidence >= 0.6) return 'large';
  if (confidence >= 0.3) return 'medium';
  return 'small';
}

/**
 * Groups the scanner's own ranked starting-file candidates into project
 * areas, purely by path and by the deterministic score/confidence/reasons
 * already computed by Starting File Discovery. No AI call, no new analysis
 * — reproducible from the same repository every time.
 */
export function buildKnowledgeMapAreas(candidates: readonly StartingFileCandidate[]): KnowledgeMapArea[] {
  const byArea = new Map<string, KnowledgeMapNode[]>();

  for (const candidate of candidates) {
    const area = deriveProjectArea(candidate.file);
    const node: KnowledgeMapNode = {
      file: candidate.file,
      title: basenameOf(candidate.file),
      description: deriveShortDescription(candidate.file, candidate.reasons),
      score: candidate.score,
      confidence: candidate.confidence,
      tier: importanceTier(candidate.confidence),
    };
    const list = byArea.get(area);
    if (list) {
      list.push(node);
    } else {
      byArea.set(area, [node]);
    }
  }

  const areas: KnowledgeMapArea[] = [...byArea.entries()].map(([area, nodes]) => {
    const sorted = [...nodes].sort((a, b) => b.score - a.score);
    return { area, nodes: sorted, tier: importanceTier(sorted[0]?.confidence ?? 0) };
  });

  areas.sort((a, b) => (b.nodes[0]?.score ?? 0) - (a.nodes[0]?.score ?? 0));
  return areas;
}
