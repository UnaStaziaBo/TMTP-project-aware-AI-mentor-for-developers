import React, { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, Panel, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react';
import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphNodeView } from '../../projectGraphView.js';
import { FILE_NODE_TYPES, type FileFlowNode } from './FileNode.js';
import { ARCHITECTURE_NODE_TYPES, type ArchitectureFlowNode } from './ArchitectureNode.js';
import { ROUTED_EDGE_TYPES, type RoutedEdgeData } from './RoutedEdge.js';
import { layoutArchitectureGraph, type LayoutResult } from './layout.js';
import { architectureFocusAreaIds, architectureRelationshipsForArea, buildArchitectureGraph, type ArchitectureGraphEdge, type ArchitectureGraphNode } from './architectureGraph.js';
import { buildSmoothPath } from './edgePath.js';

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };
const FIT_OPTIONS = { padding: 0.22, duration: 300 };

function ArchitectureOverview({ layout, edgeById, onFit }: { layout: LayoutResult; edgeById: ReadonlyMap<string, ArchitectureGraphEdge>; onFit: () => void }) {
  if (!layout.nodes.length) return null;
  const padding = 100;
  const minX = Math.min(...layout.nodes.map((node) => node.x)) - padding;
  const minY = Math.min(...layout.nodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...layout.nodes.map((node) => node.x + node.width)) + padding;
  const maxY = Math.max(...layout.nodes.map((node) => node.y + node.height)) + padding;
  return <Panel position="bottom-right" className="graph-overview-panel"><button className="graph-overview-button" onClick={onFit} title="Fit architecture map to screen"><span className="graph-overview-label">Architecture overview</span><svg className="graph-overview-svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>{layout.edges.map((edge) => <path key={edge.id} className={edgeById.get(edge.id)?.kind === 'architecture' ? 'graph-overview-edge architecture' : 'graph-overview-edge import'} d={buildSmoothPath(edge.points)} />)}{layout.nodes.map((node) => <rect key={node.file} className="graph-overview-node graph-overview-node-medium" x={node.x} y={node.y} width={node.width} height={node.height} rx={12} />)}</svg></button></Panel>;
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
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingFocusFile, setPendingFocusFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);
  const { fitView } = useReactFlow();
  const areaByFile = useMemo(() => {
    const result = new Map<string, string>();
    for (const area of [...architecture.areas].sort((a, b) => a.id.localeCompare(b.id))) for (const file of area.files) if (!result.has(file)) result.set(file, area.id);
    return result;
  }, [architecture]);
  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? files.filter((file) => file.file.toLowerCase().includes(query)).sort((a, b) => a.file.localeCompare(b.file)) : [];
  }, [files, search]);
  const graph = useMemo(() => buildArchitectureGraph(architecture, files, expandedAreas, allFilesAreas, projectName), [architecture, files, expandedAreas, allFilesAreas, projectName]);
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges]);
  const areaNameById = useMemo(() => new Map(architecture.areas.map((area) => [area.id, area.name])), [architecture]);
  const focusAreaId = selectedArea ?? hoveredArea;
  const focusEdgeId = selectedEdgeId ?? hoveredEdgeId;
  const relatedAreaIds = useMemo(() => {
    const ids = new Set<string>();
    if (focusAreaId) {
      for (const id of architectureFocusAreaIds(graph.edges, focusAreaId)) ids.add(id);
    }
    const focusedEdge = focusEdgeId ? edgeById.get(focusEdgeId) : undefined;
    if (focusedEdge?.kind === 'architecture') {
      ids.add(focusedEdge.source.slice('architecture:area:'.length));
      ids.add(focusedEdge.target.slice('architecture:area:'.length));
    }
    return ids;
  }, [focusAreaId, focusEdgeId, graph.edges, edgeById]);

  useEffect(() => {
    let cancelled = false;
    void layoutArchitectureGraph(graph.nodes, graph.edges).then((result) => {
      if (cancelled) return;
      setLayout(result);
      requestAnimationFrame(() => {
        if (pendingFocusFile && result.nodes.some((node) => node.file === pendingFocusFile)) {
          void fitView({ nodes: [{ id: pendingFocusFile }], duration: 300, maxZoom: 1.2, padding: 0.3 });
          setPendingFocusFile(null);
        } else void fitView(FIT_OPTIONS);
      });
    });
    return () => { cancelled = true; };
  }, [graph, fitView, pendingFocusFile]);

  function toggleArea(areaId: string, allFiles: boolean) {
    if (allFiles) {
      setExpandedAreas((current) => new Set([...current, areaId]));
      setAllFilesAreas((current) => { const next = new Set(current); next.has(areaId) ? next.delete(areaId) : next.add(areaId); return next; });
      return;
    }
    setExpandedAreas((current) => {
      const next = new Set(current);
      if (next.has(areaId)) { next.delete(areaId); setAllFilesAreas((all) => { const nextAll = new Set(all); nextAll.delete(areaId); return nextAll; }); } else next.add(areaId);
      return next;
    });
  }

  function revealFile(file: string) {
    const areaId = areaByFile.get(file);
    const area = areaId ? architecture.areas.find((candidate) => candidate.id === areaId) : undefined;
    if (!area || !areaId) return;
    const keyFiles = (area.importantFiles.length ? area.importantFiles : area.files).slice().sort((a, b) => a.localeCompare(b));
    setExpandedAreas((current) => new Set([...current, areaId]));
    if (!keyFiles.slice(0, 4).includes(file)) setAllFilesAreas((current) => new Set([...current, areaId]));
    setPendingFocusFile(file);
  }

  const flowNodes: Node[] = useMemo(() => layout.nodes.map((node) => {
    const architectureNode = node as ArchitectureGraphNode;
    if (architectureNode.entityType === 'architecture-area' || architectureNode.entityType === 'architecture-root') {
      const areaId = architectureNode.areaId;
      const dimmed = relatedAreaIds.size > 0 && (!areaId || !relatedAreaIds.has(areaId));
      return { id: node.file, type: 'architecture', position: { x: node.x, y: node.y }, selected: areaId === selectedArea,
        style: { width: node.width, height: node.height, opacity: dimmed ? 0.28 : 1 },
        data: { kind: architectureNode.entityType, title: node.title, shortPurpose: architectureNode.shortPurpose, roleLabel: architectureNode.roleLabel, fileCount: architectureNode.fileCount, areaId, expanded: areaId ? expandedAreas.has(areaId) : false, allFiles: areaId ? allFilesAreas.has(areaId) : false, onToggle: toggleArea },
      } satisfies ArchitectureFlowNode;
    }
    const dimmed = relatedAreaIds.size > 0 && (!architectureNode.areaId || !relatedAreaIds.has(architectureNode.areaId));
    return { id: node.file, type: 'file', position: { x: node.x, y: node.y }, selected: node.file === selectedFile, style: { width: node.width, height: node.height, opacity: dimmed ? 0.28 : 1 },
      data: { file: node.file, title: node.title, area: node.area, description: node.description, confidence: node.confidence, learningProgress: node.learningProgress ?? 0, tier: node.tier, learningStatus: node.learningStatus, learningReason: node.learningReason ?? 'Architecture map file', dimmed },
    } satisfies FileFlowNode;
  }), [layout.nodes, relatedAreaIds, selectedArea, expandedAreas, allFilesAreas, selectedFile]);

  const flowEdges: Edge[] = useMemo(() => layout.edges.map((edge) => {
    const source = edgeById.get(edge.id);
    const semantic = source?.kind === 'architecture';
    const focused = semantic && (edge.id === focusEdgeId || (focusAreaId !== null && (edge.source === `architecture:area:${focusAreaId}` || edge.target === `architecture:area:${focusAreaId}`)));
    const dimmed = relatedAreaIds.size > 0 && semantic && !focused;
    const isRoot = source?.kind === 'root';
    return { id: edge.id, source: edge.source, target: edge.target, type: 'routed', selected: edge.id === selectedEdgeId, selectable: semantic, interactionWidth: semantic ? 24 : 8,
      data: { points: edge.points, kind: source?.kind ?? 'membership', label: semantic ? source?.label : undefined, explanation: source?.explanation } satisfies RoutedEdgeData,
      markerEnd: semantic ? { type: MarkerType.ArrowClosed, width: 20, height: 20, color: 'var(--vscode-charts-purple)' } : undefined,
      style: semantic ? { stroke: 'var(--vscode-charts-purple)', strokeWidth: focused || edge.id === selectedEdgeId ? 3.2 : 2.3, opacity: dimmed ? 0.12 : focused ? 1 : 0.82 } : isRoot ? { stroke: 'var(--vscode-descriptionForeground)', strokeWidth: 1, strokeDasharray: '2 6', opacity: 0.2 } : { stroke: 'var(--vscode-descriptionForeground)', strokeWidth: 1.15, opacity: relatedAreaIds.size > 0 && !relatedAreaIds.has(edge.source.slice('architecture:area:'.length)) ? 0.14 : 0.4 },
    };
  }), [layout.edges, edgeById, focusAreaId, focusEdgeId, relatedAreaIds, selectedEdgeId]);

  const selectedRelationship = selectedEdgeId ? edgeById.get(selectedEdgeId) : undefined;
  const relationships = selectedArea ? architectureRelationshipsForArea(graph.edges, selectedArea) : { incoming: [], outgoing: [] };
  const { incoming, outgoing } = relationships;

  return <ReactFlow
    nodes={flowNodes} edges={flowEdges} nodeTypes={{ ...FILE_NODE_TYPES, ...ARCHITECTURE_NODE_TYPES }} edgeTypes={ROUTED_EDGE_TYPES}
    onNodeClick={(_event, node) => { if (node.id.startsWith('architecture:area:')) { setSelectedArea(node.id.slice('architecture:area:'.length)); setSelectedEdgeId(null); } else if (!node.id.startsWith('architecture:')) onSelectFile(node.id); }}
    onNodeMouseEnter={(_event, node) => { if (node.id.startsWith('architecture:area:')) setHoveredArea(node.id.slice('architecture:area:'.length)); }}
    onNodeMouseLeave={() => setHoveredArea(null)}
    onNodeDoubleClick={(_event, node) => { if (node.id.startsWith('architecture:area:')) toggleArea(node.id.slice('architecture:area:'.length), false); }}
    onEdgeClick={(_event, edge) => { if (edgeById.get(edge.id)?.kind === 'architecture') { setSelectedEdgeId(edge.id); setSelectedArea(null); } }}
    onEdgeMouseEnter={(_event, edge) => { if (edgeById.get(edge.id)?.kind === 'architecture') setHoveredEdgeId(edge.id); }}
    onEdgeMouseLeave={() => setHoveredEdgeId(null)} onPaneClick={() => { setSelectedArea(null); setSelectedEdgeId(null); }}
    minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
  >
    <Background gap={24} /><Controls showInteractive={false} />
    <ArchitectureOverview layout={layout} edgeById={edgeById} onFit={() => void fitView(FIT_OPTIONS)} />
    <Panel position="top-left" className="graph-search-panel"><input className="ai-text-input graph-search-input" type="text" placeholder="Search files…" value={search} onChange={(event) => { const next = event.target.value; setSearch(next); const match = files.filter((file) => file.file.toLowerCase().includes(next.trim().toLowerCase())).sort((a, b) => a.file.localeCompare(b.file))[0]; if (match && next.trim()) revealFile(match.file); }} onKeyDown={(event) => { if (event.key === 'Enter' && searchMatches[0]) revealFile(searchMatches[0].file); }} />{search ? <div className="graph-search-count">{searchMatches.length} match{searchMatches.length === 1 ? '' : 'es'}</div> : null}<div className="architecture-provenance">AI-interpreted from verified scanner evidence</div></Panel>
    <Panel position="top-right" className="graph-toggle-panel"><button className="graph-scope-button" onClick={onBack}>Dependencies</button><button className="graph-scope-button active">Architecture</button><button className="architecture-help-button" onClick={() => setShowHelp((current) => !current)} aria-expanded={showHelp}>How to read this map?</button><button className="ai-link-button" onClick={() => void fitView(FIT_OPTIONS)}>Fit to Screen</button></Panel>
    {showHelp ? <Panel position="top-right" className="architecture-help-panel"><strong>Reading the map</strong><span>Position follows architectural role and semantic flow.</span><span>Arrow + verb means one area interacts with another.</span><span>Thin connector means a file belongs to an area.</span><span>Click an arrow for evidence; click an area to focus it.</span></Panel> : null}
    {selectedRelationship?.kind === 'architecture' ? <Panel position="bottom-center" className="architecture-inspector"><button className="architecture-inspector-close" onClick={() => setSelectedEdgeId(null)} aria-label="Close relationship details">×</button><strong>{areaNameById.get(selectedRelationship.source.slice('architecture:area:'.length))} <span>→ {selectedRelationship.label} →</span> {areaNameById.get(selectedRelationship.target.slice('architecture:area:'.length))}</strong><p>{selectedRelationship.explanation}</p><small>Evidence from verified project files</small><div className="architecture-evidence">{selectedRelationship.evidenceFiles?.length ? selectedRelationship.evidenceFiles.map((file) => <button key={file} onClick={() => onSelectFile(file)}>{file}</button>) : <span>No specific file evidence available.</span>}</div></Panel> : null}
    {selectedArea && !selectedRelationship ? <Panel position="bottom-center" className="architecture-inspector architecture-area-inspector"><button className="architecture-inspector-close" onClick={() => setSelectedArea(null)} aria-label="Close area details">×</button><strong>{areaNameById.get(selectedArea)}</strong><div className="architecture-relationship-summary"><span>Incoming</span>{incoming.length ? incoming.map((edge) => <button key={edge.id} onClick={() => { setSelectedEdgeId(edge.id); setSelectedArea(null); }}>← {areaNameById.get(edge.source.slice('architecture:area:'.length))} · {edge.label}</button>) : <small>None</small>}<span>Outgoing</span>{outgoing.length ? outgoing.map((edge) => <button key={edge.id} onClick={() => { setSelectedEdgeId(edge.id); setSelectedArea(null); }}>→ {areaNameById.get(edge.target.slice('architecture:area:'.length))} · {edge.label}</button>) : <small>None</small>}</div></Panel> : null}
    <Panel position="bottom-left" className="graph-legend-panel architecture-legend"><span>Arrow: architecture interaction · thin connector: membership</span></Panel>
  </ReactFlow>;
}
