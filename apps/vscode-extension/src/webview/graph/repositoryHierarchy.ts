import type { GraphEdgeView, GraphNodeView } from '../../projectGraphView.js';

/** A visual summary of a real filesystem subtree; it never represents a source file. */
export interface GraphGroupView extends GraphNodeView {
  entityType: 'group';
  groupPath: string;
  groupKind: 'directory' | 'package';
  fileCount: number;
  expanded: boolean;
}

export interface RepositoryGroup {
  path: string;
  name: string;
  kind: 'root' | 'directory' | 'package';
  children: string[];
  directFiles: string[];
  descendantFiles: string[];
}

export interface RepositoryHierarchy {
  groups: Map<string, RepositoryGroup>;
  ancestorsByFile: Map<string, string[]>;
}

export interface VisibleGraphProjection {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  /** Complete-model file path -> currently visible file/group entity id. */
  entityByFile: Map<string, string>;
}

// Twelve cards remain immediately readable on a typical graph canvas. Above
// that, grouping avoids an initial wall of cards while preserving one-click
// access to each next filesystem level.
export const DIRECT_FILE_THRESHOLD = 12;

// These are the same deterministic project-boundary manifests the scanner
// already discovers. A directory containing one is a meaningful package-like
// navigation stop regardless of the language ecosystem.
const PACKAGE_MANIFESTS = new Set(['package.json', 'pyproject.toml', 'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod']);

function parentPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

function groupId(path: string): string {
  return `group:${path}`;
}

/** Builds the repository tree from already-scanned eligible file paths only. */
export function buildRepositoryHierarchy(nodes: readonly GraphNodeView[]): RepositoryHierarchy {
  const groups = new Map<string, RepositoryGroup>();
  groups.set('', { path: '', name: 'Repository', kind: 'root', children: [], directFiles: [], descendantFiles: [] });
  const packagePaths = new Set(
    nodes.filter((node) => PACKAGE_MANIFESTS.has(basename(node.file))).map((node) => parentPath(node.file)),
  );

  const ensureGroup = (path: string): RepositoryGroup => {
    const existing = groups.get(path);
    if (existing) return existing;
    const parent = parentPath(path);
    const group: RepositoryGroup = {
      path,
      name: basename(path),
      kind: packagePaths.has(path) ? 'package' : 'directory',
      children: [],
      directFiles: [],
      descendantFiles: [],
    };
    groups.set(path, group);
    const parentGroup = ensureGroup(parent);
    parentGroup.children.push(path);
    return group;
  };

  const ancestorsByFile = new Map<string, string[]>();
  for (const node of [...nodes].sort((a, b) => a.file.localeCompare(b.file))) {
    const directory = parentPath(node.file);
    ensureGroup(directory).directFiles.push(node.file);
    const ancestors = [''];
    let current = '';
    for (const segment of directory.split('/').filter(Boolean)) {
      current = current ? `${current}/${segment}` : segment;
      ancestors.push(current);
    }
    ancestorsByFile.set(node.file, ancestors);
  }

  const collect = (path: string): string[] => {
    const group = groups.get(path)!;
    group.children.sort((a, b) => a.localeCompare(b));
    group.directFiles.sort((a, b) => a.localeCompare(b));
    group.descendantFiles = [...group.directFiles, ...group.children.flatMap(collect)].sort((a, b) => a.localeCompare(b));
    return group.descendantFiles;
  };
  collect('');
  return { groups, ancestorsByFile };
}

/** Initial disclosure is fully expanded only when the repository is card-sized. */
export function initialExpandedGroups(hierarchy: RepositoryHierarchy): Set<string> {
  const root = hierarchy.groups.get('')!;
  if (root.descendantFiles.length <= DIRECT_FILE_THRESHOLD) {
    return new Set(hierarchy.groups.keys());
  }

  const expanded = new Set<string>(['']);
  // Surface package/workspace-like boundaries beneath generic top-level
  // containers (e.g. apps/ and packages/) without hard-coding their names.
  for (const path of root.children) {
    const group = hierarchy.groups.get(path)!;
    if (group.kind === 'directory' && group.directFiles.length === 0 && group.children.some((child) => hierarchy.groups.get(child)!.kind === 'package')) {
      expanded.add(path);
    }
  }
  return expanded;
}

function compressedGroup(hierarchy: RepositoryHierarchy, startPath: string): RepositoryGroup {
  let group = hierarchy.groups.get(startPath)!;
  // A one-child directory chain conveys no choice. Keep package boundaries
  // explicit so they remain meaningful navigation stops.
  while (
    group.kind === 'directory' &&
    group.directFiles.length === 0 &&
    group.children.length === 1 &&
    hierarchy.groups.get(group.children[0]!)!.kind !== 'package'
  ) {
    group = hierarchy.groups.get(group.children[0]!)!;
  }
  return group;
}

function groupView(group: RepositoryGroup, expanded: boolean): GraphGroupView {
  return {
    entityType: 'group',
    file: groupId(group.path),
    groupPath: group.path,
    groupKind: group.kind === 'package' ? 'package' : 'directory',
    fileCount: group.descendantFiles.length,
    expanded,
    title: group.path,
    area: group.kind === 'package' ? 'Package' : 'Directory',
    description: `${group.descendantFiles.length} eligible file${group.descendantFiles.length === 1 ? '' : 's'}`,
    score: 0,
    confidence: 0,
    tier: 'medium',
    learningStatus: { icon: '📁', label: 'Repository group' },
    hasEdge: false,
  };
}

/**
 * Derives the renderable graph from the complete model. Collapsed groups map
 * their descendant files to one entity; file edges are then aggregated only
 * when that mapping crosses visible entities.
 */
export function projectVisibleGraph(
  hierarchy: RepositoryHierarchy,
  allNodes: readonly GraphNodeView[],
  edges: readonly GraphEdgeView[],
  visibleFiles: ReadonlySet<string>,
  expandedGroups: ReadonlySet<string>,
): VisibleGraphProjection {
  const nodeByFile = new Map(allNodes.map((node) => [node.file, node]));
  const nodes: GraphNodeView[] = [];
  const entityByFile = new Map<string, string>();
  const hasVisibleDescendant = (group: RepositoryGroup) => group.descendantFiles.some((file) => visibleFiles.has(file));

  const addCollapsed = (group: RepositoryGroup) => {
    if (!hasVisibleDescendant(group)) return;
    nodes.push(groupView(group, false));
    for (const file of group.descendantFiles) if (visibleFiles.has(file)) entityByFile.set(file, groupId(group.path));
  };
  const visitExpanded = (path: string) => {
    const group = hierarchy.groups.get(path)!;
    for (const file of group.directFiles) {
      if (!visibleFiles.has(file)) continue;
      const node = nodeByFile.get(file);
      if (node) {
        nodes.push(node);
        entityByFile.set(file, file);
      }
    }
    for (const childPath of group.children) {
      const child = compressedGroup(hierarchy, childPath);
      if (!hasVisibleDescendant(child)) continue;
      if (expandedGroups.has(child.path)) visitExpanded(child.path);
      else addCollapsed(child);
    }
  };
  visitExpanded('');

  const edgeById = new Map<string, GraphEdgeView>();
  for (const edge of edges) {
    const source = entityByFile.get(edge.source);
    const target = entityByFile.get(edge.target);
    if (!source || !target || source === target) continue;
    const id = `${source}=>${target}`;
    const existing = edgeById.get(id);
    if (existing) {
      existing.underlyingEdgeCount = (existing.underlyingEdgeCount ?? 1) + 1;
      continue;
    }
    edgeById.set(id, {
      id,
      source,
      target,
      kind: 'import',
      underlyingEdgeCount: 1,
      underlyingFiles: [[edge.source, edge.target]],
    });
  }
  return {
    nodes: nodes.sort((a, b) => a.file.localeCompare(b.file)),
    edges: [...edgeById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    entityByFile,
  };
}

export function expansionForFile(hierarchy: RepositoryHierarchy, file: string): Set<string> {
  return new Set(hierarchy.ancestorsByFile.get(file) ?? []);
}
