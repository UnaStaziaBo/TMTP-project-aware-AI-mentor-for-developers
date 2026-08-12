import React, { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, Panel, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react';
import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphNodeView } from '../../projectGraphView.js';
import { FILE_NODE_TYPES, type FileFlowNode } from './FileNode.js';
import { ARCHITECTURE_NODE_TYPES, type ArchitectureFlowNode } from './ArchitectureNode.js';
import { ROUTED_EDGE_TYPES, type RoutedEdgeData } from './RoutedEdge.js';
import { layoutProjectGraph, type LayoutResult } from './layout.js';
import { buildArchitectureGraph, type ArchitectureGraphNode } from './architectureGraph.js';
import { buildSmoothPath } from './edgePath.js';

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };
const FIT_OPTIONS = { padding: 0.22, duration: 300 };

function ArchitectureOverview({ layout, onFit }: { layout: LayoutResult; onFit: () => void }) {
  if (!layout.nodes.length) return null;
  const padding = 100;
  const minX = Math.min(...layout.nodes.map((node) => node.x)) - padding;
  const minY = Math.min(...layout.nodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...layout.nodes.map((node) => node.x + node.width)) + padding;
  const maxY = Math.max(...layout.nodes.map((node) => node.y + node.height)) + padding;
  return <Panel position="bottom-right" className="graph-overview-panel"><button className="graph-overview-button" onClick={onFit} title="Fit architecture map to screen"><span className="graph-overview-label">Architecture overview</span><svg className="graph-overview-svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}><>{layout.edges.map((edge) => <path key={edge.id} className="graph-overview-edge import" d={buildSmoothPath(edge.points)} />)}{layout.nodes.map((node) => <rect key={node.file} className="graph-overview-node graph-overview-node-medium" x={node.x} y={node.y} width={node.width} height={node.height} rx={12} />)}</></svg></button></Panel>;
}

export function ArchitectureGraphCanvas({ architecture, files, projectName, selectedFile, onSelectFile, onBack }: {
  architecture: ArchitectureModel;
  files: GraphNodeView[];
  projectName?: string;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onBack: () => void;
}) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [allFilesAreas, setAllFilesAreas] = useState<Set<string>>(new Set());
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingFocusFile, setPendingFocusFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);
  const { fitView } = useReactFlow();
  const areaByFile = useMemo(() => {
    const result = new Map<string, string>();
    for (const area of [...architecture.areas].sort((a, b) => a.id.localeCompare(b.id))) {
      for (const file of area.files) if (!result.has(file)) result.set(file, area.id);
    }
    return result;
  }, [architecture]);
  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return files.filter((file) => file.file.toLowerCase().includes(query)).sort((a, b) => a.file.localeCompare(b.file));
  }, [files, search]);
  const graph = useMemo(
    () => buildArchitectureGraph(architecture, files, expandedAreas, allFilesAreas, projectName),
    [architecture, files, expandedAreas, allFilesAreas, projectName],
  );

  useEffect(() => {
    let cancelled = false;
    void layoutProjectGraph(graph.nodes, graph.edges).then((result) => {
      if (cancelled) return;
      setLayout(result);
      requestAnimationFrame(() => {
        if (pendingFocusFile && result.nodes.some((node) => node.file === pendingFocusFile)) {
          void fitView({ nodes: [{ id: pendingFocusFile }], duration: 300, maxZoom: 1.2, padding: 0.3 });
          setPendingFocusFile(null);
        } else {
          void fitView(FIT_OPTIONS);
        }
      });
    });
    return () => { cancelled = true; };
  }, [graph, fitView, pendingFocusFile]);

  function toggleArea(areaId: string, allFiles: boolean) {
    if (allFiles) {
      setExpandedAreas((current) => new Set([...current, areaId]));
      setAllFilesAreas((current) => {
        const next = new Set(current);
        next.has(areaId) ? next.delete(areaId) : next.add(areaId);
        return next;
      });
      return;
    }
    setExpandedAreas((current) => {
      const next = new Set(current);
      if (next.has(areaId)) {
        next.delete(areaId);
        setAllFilesAreas((all) => { const nextAll = new Set(all); nextAll.delete(areaId); return nextAll; });
      } else next.add(areaId);
      return next;
    });
  }

  function revealFile(file: string) {
    const areaId = areaByFile.get(file);
    if (!areaId) return;
    const area = architecture.areas.find((candidate) => candidate.id === areaId);
    if (!area) return;
    const keyFiles = (area.importantFiles.length ? area.importantFiles : area.files).slice().sort((a, b) => a.localeCompare(b));
    setExpandedAreas((current) => new Set([...current, areaId]));
    if (!keyFiles.slice(0, 4).includes(file)) {
      setAllFilesAreas((current) => new Set([...current, areaId]));
    }
    setPendingFocusFile(file);
  }

  const flowNodes: Node[] = useMemo(() => layout.nodes.map((node) => {
    const architectureNode = node as ArchitectureGraphNode;
    if (architectureNode.entityType === 'architecture-area' || architectureNode.entityType === 'architecture-root') {
      const areaId = architectureNode.areaId;
      return {
        id: node.file, type: 'architecture', position: { x: node.x, y: node.y },
        selected: areaId === selectedArea,
        style: { width: node.width, height: node.height },
        data: {
          kind: architectureNode.entityType,
          title: node.title,
          shortPurpose: architectureNode.shortPurpose,
          fileCount: architectureNode.fileCount,
          areaId,
          expanded: areaId ? expandedAreas.has(areaId) : false,
          allFiles: areaId ? allFilesAreas.has(areaId) : false,
          onToggle: toggleArea,
        },
      } satisfies ArchitectureFlowNode;
    }
    return {
      id: node.file, type: 'file', position: { x: node.x, y: node.y }, selected: node.file === selectedFile,
      style: { width: node.width, height: node.height },
      data: {
        file: node.file, title: node.title, area: node.area, description: node.description, confidence: node.confidence,
        learningProgress: node.learningProgress ?? 0, tier: node.tier, learningStatus: node.learningStatus,
        learningReason: node.learningReason ?? 'Architecture map file', dimmed: false,
      },
    } satisfies FileFlowNode;
  }), [layout.nodes, selectedArea, expandedAreas, allFilesAreas, selectedFile]);

  const flowEdges: Edge[] = useMemo(() => layout.edges.map((edge) => {
    const source = graph.edges.find((candidate) => candidate.id === edge.id);
    const architectureRelationship = source?.kind === 'architecture';
    return {
      id: edge.id, source: edge.source, target: edge.target, type: 'routed',
      data: { points: edge.points, kind: source?.kind ?? 'membership', label: source?.label, explanation: source?.explanation } satisfies RoutedEdgeData,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: {
        stroke: architectureRelationship ? 'var(--vscode-charts-purple)' : 'var(--vscode-descriptionForeground)',
        strokeWidth: architectureRelationship ? 2.2 : 1,
        strokeDasharray: architectureRelationship ? undefined : '4 4',
        opacity: architectureRelationship ? 0.9 : 0.38,
      },
    };
  }), [layout.edges, graph.edges]);

  return <ReactFlow
    nodes={flowNodes} edges={flowEdges} nodeTypes={{ ...FILE_NODE_TYPES, ...ARCHITECTURE_NODE_TYPES }} edgeTypes={ROUTED_EDGE_TYPES}
    onNodeClick={(_event, node) => {
      if (node.id.startsWith('architecture:area:')) setSelectedArea(node.id.slice('architecture:area:'.length));
      else if (!node.id.startsWith('architecture:')) onSelectFile(node.id);
    }}
    onNodeDoubleClick={(_event, node) => { if (node.id.startsWith('architecture:area:')) toggleArea(node.id.slice('architecture:area:'.length), false); }}
    minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
  >
    <Background gap={24} /><Controls showInteractive={false} />
    <ArchitectureOverview layout={layout} onFit={() => void fitView(FIT_OPTIONS)} />
    <Panel position="top-left" className="graph-search-panel">
      <input
        className="ai-text-input graph-search-input"
        type="text"
        placeholder="Search files…"
        value={search}
        onChange={(event) => {
          const next = event.target.value;
          setSearch(next);
          const match = files.filter((file) => file.file.toLowerCase().includes(next.trim().toLowerCase())).sort((a, b) => a.file.localeCompare(b.file))[0];
          if (match && next.trim()) revealFile(match.file);
        }}
        onKeyDown={(event) => { if (event.key === 'Enter' && searchMatches[0]) revealFile(searchMatches[0].file); }}
      />
      {search ? <div className="graph-search-count">{searchMatches.length} match{searchMatches.length === 1 ? '' : 'es'}</div> : null}
      <div className="architecture-provenance">AI-interpreted from verified scanner evidence</div>
    </Panel>
    <Panel position="top-right" className="graph-toggle-panel"><button className="graph-scope-button" onClick={onBack}>Dependencies</button><button className="graph-scope-button active">Architecture</button><button className="ai-link-button" onClick={() => void fitView(FIT_OPTIONS)}>Fit to Screen</button></Panel>
    <Panel position="bottom-left" className="graph-legend-panel"><span>Solid: architecture relationship · dashed: area membership · real files retain TMTP actions</span></Panel>
  </ReactFlow>;
}
