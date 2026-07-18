const TS_LIKE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const TS_RELATIVE_IMPORT_PATTERN =
  /\bfrom\s+['"](\.[^'"]*)['"]|\bimport\(\s*['"](\.[^'"]*)['"]\s*\)|\brequire\(\s*['"](\.[^'"]*)['"]\s*\)|^\s*import\s+['"](\.[^'"]*)['"]/gm;

const PY_RELATIVE_IMPORT_PATTERN = /^\s*from\s+(\.+)([\w.]*)\s+import\b/gm;
const PY_FROM_IMPORT_PATTERN = /^\s*from\s+([a-zA-Z_][\w.]*)\s+import\b/gm;
const PY_IMPORT_PATTERN = /^\s*import\s+([a-zA-Z_][\w.]*)/gm;

export interface ImportGraphEdge {
  from: string;
  to: string;
}

export interface ImportGraphResult {
  localImportCounts: Map<string, number>;
  referencedByCounts: Map<string, number>;
  edges: ImportGraphEdge[];
}

function dirname(relativePath: string): string {
  const segments = relativePath.split('/');
  segments.pop();
  return segments.join('/');
}

function extname(relativePath: string): string {
  const basename = relativePath.split('/').pop() ?? '';
  const dot = basename.lastIndexOf('.');
  return dot === -1 ? '' : basename.slice(dot);
}

function normalizeJoin(dir: string, specifier: string): string {
  const parts = dir ? dir.split('/') : [];
  for (const segment of specifier.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

function resolveTsSpecifier(dir: string, specifier: string, knownFiles: Set<string>): string | null {
  const joined = normalizeJoin(dir, specifier);
  const candidates = [
    joined,
    `${joined}.ts`,
    `${joined}.tsx`,
    `${joined}.js`,
    `${joined}.jsx`,
    `${joined}/index.ts`,
    `${joined}/index.tsx`,
    `${joined}/index.js`,
    `${joined}/index.jsx`,
  ];
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

function extractTsRelativeSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const match of content.matchAll(TS_RELATIVE_IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function resolvePyRelative(
  dir: string,
  dots: number,
  modulePath: string,
  knownFiles: Set<string>,
): string | null {
  const parts = dir ? dir.split('/') : [];
  const hops = dots - 1;
  for (let i = 0; i < hops; i += 1) {
    parts.pop();
  }

  if (modulePath) {
    const joined = [...parts, ...modulePath.split('.')].join('/');
    if (knownFiles.has(`${joined}.py`)) return `${joined}.py`;
    if (knownFiles.has(`${joined}/__init__.py`)) return `${joined}/__init__.py`;
    return null;
  }

  const joined = parts.join('/');
  const initPath = joined ? `${joined}/__init__.py` : '__init__.py';
  return knownFiles.has(initPath) ? initPath : null;
}

function buildPythonBasenameIndex(knownFiles: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const file of knownFiles) {
    if (extname(file) !== '.py') continue;
    const segments = file.split('/');
    const base = segments[segments.length - 1]!.replace(/\.py$/, '');
    const key = base === '__init__' ? (segments[segments.length - 2] ?? base) : base;
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(file);
    } else {
      index.set(key, [file]);
    }
  }
  return index;
}

function resolvePyAbsolute(dottedPath: string, basenameIndex: Map<string, string[]>): string | null {
  const segments = dottedPath.split('.');
  const last = segments[segments.length - 1]!;
  const candidates = basenameIndex.get(last);
  if (!candidates) return null;

  const suffixFile = `${segments.join('/')}.py`;
  const suffixPackage = `${segments.join('/')}/__init__.py`;

  return (
    candidates.find(
      (candidate) =>
        candidate === suffixFile ||
        candidate.endsWith(`/${suffixFile}`) ||
        candidate === suffixPackage ||
        candidate.endsWith(`/${suffixPackage}`),
    ) ?? null
  );
}

function extractPyImportTargets(
  relativePath: string,
  content: string,
  knownFiles: Set<string>,
  basenameIndex: Map<string, string[]>,
): Set<string> {
  const dir = dirname(relativePath);
  const resolved = new Set<string>();

  for (const match of content.matchAll(PY_RELATIVE_IMPORT_PATTERN)) {
    const dots = match[1]!.length;
    const modulePath = match[2] ?? '';
    const target = resolvePyRelative(dir, dots, modulePath, knownFiles);
    if (target && target !== relativePath) resolved.add(target);
  }

  for (const match of content.matchAll(PY_FROM_IMPORT_PATTERN)) {
    const target = resolvePyAbsolute(match[1]!, basenameIndex);
    if (target && target !== relativePath) resolved.add(target);
  }

  for (const match of content.matchAll(PY_IMPORT_PATTERN)) {
    const target = resolvePyAbsolute(match[1]!, basenameIndex);
    if (target && target !== relativePath) resolved.add(target);
  }

  return resolved;
}

/**
 * Builds a lightweight local (project-relative) import graph: feeds the
 * starting-file scoring rules (via the count maps) and the deterministic
 * Project Graph (via `edges`) from the same single pass — never invented,
 * only relationships this resolver could actually verify. Each candidate
 * file's content is read once by the caller and reused here for both
 * extraction and resolution.
 */
export function buildImportGraph(
  candidateContents: Map<string, string>,
  knownFiles: string[],
): ImportGraphResult {
  const knownFilesSet = new Set(knownFiles);
  const basenameIndex = buildPythonBasenameIndex(knownFiles);
  const localImportCounts = new Map<string, number>();
  const referencedByCounts = new Map<string, number>();
  const edges: ImportGraphEdge[] = [];

  for (const [relativePath, content] of candidateContents) {
    let resolved: Set<string>;

    if (TS_LIKE_EXTENSIONS.has(extname(relativePath))) {
      const dir = dirname(relativePath);
      resolved = new Set(
        extractTsRelativeSpecifiers(content)
          .map((specifier) => resolveTsSpecifier(dir, specifier, knownFilesSet))
          .filter((target): target is string => target !== null && target !== relativePath),
      );
    } else if (extname(relativePath) === '.py') {
      resolved = extractPyImportTargets(relativePath, content, knownFilesSet, basenameIndex);
    } else {
      resolved = new Set();
    }

    localImportCounts.set(relativePath, resolved.size);
    for (const target of resolved) {
      referencedByCounts.set(target, (referencedByCounts.get(target) ?? 0) + 1);
      edges.push({ from: relativePath, to: target });
    }
  }

  return { localImportCounts, referencedByCounts, edges };
}
