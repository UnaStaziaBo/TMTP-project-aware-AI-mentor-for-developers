import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphEdgeView, GraphNodeView } from '../../projectGraphView.js';

export type ArchitectureEntityKind = 'architecture-root' | 'architecture-area' | 'architecture-file';

export interface ArchitectureGraphNode extends GraphNodeView {
  entityType: ArchitectureEntityKind;
  areaId?: string;
  shortPurpose?: string;
  fileCount?: number;
  isSynthetic?: boolean;
}

export interface ArchitectureGraphEdge extends GraphEdgeView {
  kind: 'architecture' | 'membership';
  label?: string;
  explanation?: string;
}

export interface ArchitectureGraph {
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
  areaByFile: Map<string, string>;
}

const INITIAL_FILES_PER_AREA = 4;
const ROOT_ID = 'architecture:project';

function areaNodeId(id: string): string { return `architecture:area:${id}`; }

/**
 * Deterministically adapts validated AI interpretation into canvas entities.
 * Areas remain AI-interpreted; revealed files reuse their canonical scanner
 * node identity and metadata. No AI output controls positions or file facts.
 */
export function buildArchitectureGraph(
  architecture: ArchitectureModel,
  files: readonly GraphNodeView[],
  expandedAreas: ReadonlySet<string>,
  allFilesAreas: ReadonlySet<string>,
  projectName = 'Project',
): ArchitectureGraph {
  const fileByPath = new Map(files.map((file) => [file.file, file]));
  const areas = [...architecture.areas].sort((a, b) => a.id.localeCompare(b.id));
  const areaByFile = new Map<string, string>();
  const nodes: ArchitectureGraphNode[] = [{
    entityType: 'architecture-root', isSynthetic: true, file: ROOT_ID, title: projectName, area: 'Project',
    description: 'Architecture map', score: 0, confidence: 1, tier: 'large', learningStatus: { icon: '◈', label: 'Project root' }, hasEdge: false,
  }];
  const edges: ArchitectureGraphEdge[] = [];

  for (const area of areas) {
    nodes.push({
      entityType: 'architecture-area', areaId: area.id, shortPurpose: area.shortPurpose, fileCount: area.files.length,
      file: areaNodeId(area.id), title: area.name, area: 'AI-interpreted area', description: area.shortPurpose,
      score: 0, confidence: area.confidence, tier: 'medium', learningStatus: { icon: '◇', label: 'AI-interpreted architecture area' }, hasEdge: false,
    });
    edges.push({ id: `${ROOT_ID}=>${areaNodeId(area.id)}`, source: ROOT_ID, target: areaNodeId(area.id), kind: 'membership' });
    if (!expandedAreas.has(area.id)) continue;
    const candidates = (allFilesAreas.has(area.id) ? area.files : area.importantFiles.length ? area.importantFiles : area.files)
      .filter((file, index, list) => list.indexOf(file) === index)
      .sort((a, b) => a.localeCompare(b));
    const visibleFiles = allFilesAreas.has(area.id) ? candidates : candidates.slice(0, INITIAL_FILES_PER_AREA);
    for (const file of visibleFiles) {
      // A file can be interpreted in more than one area. Render it once,
      // deterministically owned by the alphabetically first expanded area.
      if (areaByFile.has(file)) continue;
      const node = fileByPath.get(file);
      if (!node) continue;
      areaByFile.set(file, area.id);
      nodes.push({ ...node, entityType: 'architecture-file', areaId: area.id });
      edges.push({ id: `${areaNodeId(area.id)}=>${file}`, source: areaNodeId(area.id), target: file, kind: 'membership' });
    }
  }
  const areaIds = new Set(areas.map((area) => area.id));
  for (const relationship of architecture.relationships) {
    if (!areaIds.has(relationship.sourceAreaId) || !areaIds.has(relationship.targetAreaId)) continue;
    edges.push({
      id: `architecture:${relationship.sourceAreaId}=>${relationship.targetAreaId}:${relationship.label}`,
      source: areaNodeId(relationship.sourceAreaId), target: areaNodeId(relationship.targetAreaId), kind: 'architecture',
      label: relationship.label, explanation: relationship.explanation,
    });
  }
  return {
    nodes: nodes.sort((a, b) => a.file.localeCompare(b.file)),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    areaByFile,
  };
}

export function architectureAreaNodeId(areaId: string): string { return areaNodeId(areaId); }
