import type { ProjectArchitectureContext } from '@tmpt/ai';
import type { ProjectScanResult } from '@tmpt/scanner';

const CONTEXT_VERSION = 1;
const MAX_IMPORTS = 80;
const MAX_REGIONS = 18;
const MAX_REPRESENTATIVES = 4;

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 0x01000193); }
  return (result >>> 0).toString(16);
}

/** Bounded, deterministic architecture evidence generated entirely from the scan result. */
export function buildArchitectureContext(result: ProjectScanResult): ProjectArchitectureContext {
  const files = result.files.map((file) => file.path).sort();
  const incoming = new Map<string, number>();
  for (const edge of result.projectGraph.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const candidates = [...result.startingFiles]
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.file.localeCompare(b.file));
  const importantFiles = candidates.slice(0, 20).map((candidate) => ({
    file: candidate.file,
    reasons: candidate.reasons.slice(0, 3),
    referenceCount: incoming.get(candidate.file) ?? 0,
  }));
  const filesByRegion = new Map<string, string[]>();
  for (const file of files) {
    const parts = file.split('/');
    const region = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join('/') : '(root)';
    const list = filesByRegion.get(region) ?? [];
    list.push(file); filesByRegion.set(region, list);
  }
  const importantSet = new Set(importantFiles.map((entry) => entry.file));
  const regions = [...filesByRegion.entries()]
    .sort(([leftPath, left], [rightPath, right]) => right.length - left.length || leftPath.localeCompare(rightPath))
    .slice(0, MAX_REGIONS)
    .map(([path, entries]) => ({
      path,
      fileCount: entries.length,
      representativeFiles: [...entries].sort((a, b) => Number(importantSet.has(b)) - Number(importantSet.has(a)) || a.localeCompare(b)).slice(0, MAX_REPRESENTATIVES),
    }));
  const imports = [...result.projectGraph.edges]
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .slice(0, MAX_IMPORTS)
    .map((edge) => ({ source: edge.from, target: edge.to }));
  const entryFiles = candidates.filter((candidate) => candidate.reasons.some((reason) => /entry|bootstrap|conventional filename/i.test(reason))).map((candidate) => candidate.file).slice(0, 12);
  const fingerprintSource = JSON.stringify({ files, languages: result.languages, frameworks: result.frameworks, dependencies: result.dependencies, edges: result.projectGraph.edges, starting: candidates });
  return {
    version: CONTEXT_VERSION,
    fingerprint: `architecture-v${CONTEXT_VERSION}-${hash(fingerprintSource)}`,
    fileCount: files.length,
    eligibleFiles: files,
    languages: result.languages.map((item) => item.name).sort(),
    frameworks: result.frameworks.map((item) => item.name).sort(),
    dependencies: result.dependencies.map((item) => item.name).sort(),
    entryFiles,
    importantFiles,
    regions,
    imports,
    omittedFileCount: Math.max(0, files.length - new Set([...importantFiles.map((item) => item.file), ...regions.flatMap((region) => region.representativeFiles)]).size),
  };
}
