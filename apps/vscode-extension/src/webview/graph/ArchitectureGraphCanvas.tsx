import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, MarkerType, Panel, ReactFlow, useReactFlow, useStore, useViewport, type Edge, type Node } from '@xyflow/react';
import type { ArchitectureModel } from '@tmpt/ai';
import type { GraphNodeView } from '../../projectGraphView.js';
import { FILE_NODE_TYPES, type FileFlowNode } from './FileNode.js';
import { ARCHITECTURE_NODE_TYPES, type ArchitectureFlowNode } from './ArchitectureNode.js';
import { ROUTED_EDGE_TYPES, type RoutedEdgeData } from './RoutedEdge.js';
import { layoutArchitectureGraph, type LayoutResult } from './layout.js';
import { architectureFocusAreaIds, architectureRelationshipsForArea, buildArchitectureGraph, isSemanticArchitectureEdge, visibleArchitectureConnectionLabel, type ArchitectureGraphEdge, type ArchitectureGraphNode } from './architectureGraph.js';
import { buildSmoothPath } from './edgePath.js';
import { architectureNavigatorProgress, architectureNavigatorViewportBounds, selectedArchitectureNavigatorArea, type ArchitectureNavigatorAreaProgress } from './architectureNavigator.js';

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };
const FIT_OPTIONS = { padding: 0.16, duration: 300 };

function ArchitectureNavigator({ layout, edgeById, selectedArea, selectedFile, areaByFile, progressByArea, startedAreas, totalAreas, onFocusArea, onFit }: {
  layout: LayoutResult;
  edgeById: ReadonlyMap<string, ArchitectureGraphEdge>;
  selectedArea: string | null;
  selectedFile: string | null;
  areaByFile: ReadonlyMap<string, string>;
  progressByArea: ReadonlyMap<string, ArchitectureNavigatorAreaProgress>;
  startedAreas: number;
  totalAreas: number;
  onFocusArea: (areaId: string) => void;
  onFit: () => void;
}) {
  const viewport = useViewport();
  const canvasWidth = useStore((state) => state.width);
  const canvasHeight = useStore((state) => state.height);
  const navigatorNodes = useMemo(() => layout.nodes.filter((node) => {
    const architectureNode = node as ArchitectureGraphNode;
    return architectureNode.entityType === 'architecture-root' || architectureNode.entityType === 'architecture-area';
  }), [layout.nodes]);

  if (!navigatorNodes.length) return null;

  const navigatorNodeIds = new Set(navigatorNodes.map((node) => node.file));
  const padding = 80;
  const minX = Math.min(...navigatorNodes.map((node) => node.x)) - padding;
  const minY = Math.min(...navigatorNodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...navigatorNodes.map((node) => node.x + node.width)) + padding;
  const maxY = Math.max(...navigatorNodes.map((node) => node.y + node.height)) + padding;
  const currentAreaId = selectedArchitectureNavigatorArea(selectedArea, selectedFile, areaByFile);
  const currentArea = currentAreaId ? navigatorNodes.find((node) => (node as ArchitectureGraphNode).areaId === currentAreaId) as ArchitectureGraphNode | undefined : undefined;
  const currentAreaProgress = currentArea?.areaId ? progressByArea.get(currentArea.areaId) : undefined;
  const viewportBounds = architectureNavigatorViewportBounds(viewport, canvasWidth, canvasHeight);
  const navigateWithKeyboard = (event: React.KeyboardEvent<SVGGElement>, areaId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFocusArea(areaId);
    }
  };

  return <Panel position="bottom-right" className="graph-overview-panel architecture-navigator-panel nopan">
    <div className="architecture-navigator-header">
      <span className="graph-overview-label">Architecture Navigator</span>
      <button className="architecture-navigator-fit" onClick={onFit} title="Fit architecture map to screen">Fit</button>
    </div>
    <svg className="graph-overview-svg architecture-navigator-svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-label="Architecture navigator">
      <title>Architecture Navigator</title>
      {layout.edges.filter((edge) => {
        const source = edgeById.get(edge.id);
        return Boolean(source && navigatorNodeIds.has(edge.source) && navigatorNodeIds.has(edge.target) && (source.kind === 'root' || source.kind === 'architecture'));
      }).map((edge) => <path key={edge.id} className={edgeById.get(edge.id)?.kind === 'architecture' ? 'architecture-navigator-edge architecture' : 'architecture-navigator-edge hierarchy'} d={buildSmoothPath(edge.points)} />)}
      <rect className="architecture-navigator-viewport" x={viewportBounds.x} y={viewportBounds.y} width={viewportBounds.width} height={viewportBounds.height} rx={14} pointerEvents="none" />
      {navigatorNodes.map((node) => {
        const architectureNode = node as ArchitectureGraphNode;
        const areaId = architectureNode.areaId;
        const isRoot = architectureNode.entityType === 'architecture-root';
        const selected = areaId === currentAreaId;
        const progress = areaId ? progressByArea.get(areaId) : undefined;
        const progressState = !progress || progress.exploredFiles === 0 ? 'unstarted' : progress.exploredFiles === progress.totalFiles ? 'complete' : 'started';
        const label = isRoot ? `${node.title}, project root` : `${node.title}, ${architectureNode.roleLabel ?? 'architecture area'}, ${architectureNode.fileCount ?? 0} files, ${progress?.exploredFiles ?? 0} explored`;
        return <g key={node.file} className={`architecture-navigator-node ${isRoot ? 'root' : 'area'}${selected ? ' selected' : ''}`} role={areaId ? 'button' : undefined} tabIndex={areaId ? 0 : undefined} aria-label={label} onClick={areaId ? () => onFocusArea(areaId) : undefined} onKeyDown={areaId ? (event) => navigateWithKeyboard(event, areaId) : undefined}>
          <title>{isRoot ? node.title : `${node.title}: ${architectureNode.shortPurpose ?? 'Architecture area'} (${architectureNode.fileCount ?? 0} files)`}</title>
          <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={14} />
          {!isRoot ? <circle className={`architecture-navigator-progress ${progressState}`} cx={node.x + node.width - 15} cy={node.y + 15} r={6} pointerEvents="none" /> : null}
        </g>;
      })}
    </svg>
    <div className="architecture-navigator-summary" aria-live="polite">
      {currentArea ? <><small>Selected</small><strong>{selectedFile ? selectedFile : currentArea.title}</strong><span>{selectedFile ? `inside ${currentArea.title}` : `${currentArea.roleLabel ?? 'Architecture area'} · ${currentArea.fileCount ?? 0} files`}</span>{currentAreaProgress ? <span>{currentAreaProgress.exploredFiles} / {currentAreaProgress.totalFiles} files explored</span> : null}</> : <span>Hover an area for details, or click it to orient in the map.</span>}
    </div>
    {totalAreas ? <div className="architecture-navigator-project-progress">Architecture progress · {startedAreas} / {totalAreas} areas started</div> : null}
  </Panel>;
}

export function ArchitectureGraphCanvas({ architecture, files, projectName, selectedFile, onSelectFile, onBack }: {
  architecture: ArchitectureModel;
  files: GraphNodeView[];
  projectName?: string;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  /** Legacy dependency-mode return control; omitted by the active Project Graph. */
  onBack?: () => void;
}) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [allFilesAreas, setAllFilesAreas] = useState<Set<string>>(new Set());
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingFocusFile, setPendingFocusFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView, getZoom, setCenter } = useReactFlow();
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
  const navigatorProgress = useMemo(() => architectureNavigatorProgress(architecture.areas, files), [architecture.areas, files]);
  const focusAreaId = selectedArea ?? hoveredArea;
  const focusEdgeId = selectedEdgeId;
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

  useEffect(() => () => {
    if (hoverClearTimer.current !== null) clearTimeout(hoverClearTimer.current);
  }, []);

  function beginAreaHover(areaId: string) {
    if (hoverClearTimer.current !== null) {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    setHoveredArea((current) => current === areaId ? current : areaId);
  }

  function endAreaHover() {
    if (hoverClearTimer.current !== null) clearTimeout(hoverClearTimer.current);
    // Handles, labels, and child controls can briefly move the pointer out of
    // React Flow's node hit target. A short grace period prevents emphasis
    // from oscillating while moving within one architecture card.
    hoverClearTimer.current = setTimeout(() => {
      hoverClearTimer.current = null;
      setHoveredArea(null);
    }, 140);
  }

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

  function focusNavigatorArea(areaId: string) {
    const node = layout.nodes.find((candidate) => candidate.file === `architecture:area:${areaId}`);
    if (!node) return;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setSelectedArea(areaId);
    setSelectedEdgeId(null);
    void setCenter(node.x + node.width / 2, node.y + node.height / 2, {
      zoom: Math.max(0.45, Math.min(getZoom(), 0.85)),
      duration: reducedMotion ? 0 : 260,
    });
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
    const semantic = source ? isSemanticArchitectureEdge(source) : false;
    const label = source ? visibleArchitectureConnectionLabel(source) : undefined;
    const focused = semantic && (edge.id === focusEdgeId || (focusAreaId !== null && (edge.source === `architecture:area:${focusAreaId}` || edge.target === `architecture:area:${focusAreaId}`)));
    const dimmed = relatedAreaIds.size > 0 && semantic && !focused;
    const isRoot = source?.kind === 'root';
    const structural = source?.kind === 'root' || source?.kind === 'membership';
    const opacity = dimmed ? 0.12 : focused ? 1 : 0.82;
    const structuralAreaId = isRoot ? edge.target.slice('architecture:area:'.length) : edge.source.slice('architecture:area:'.length);
    const structuralOpacity = relatedAreaIds.size > 0 && !relatedAreaIds.has(structuralAreaId) ? 0.28 : isRoot ? 0.58 : 0.66;
    return { id: edge.id, source: edge.source, target: edge.target, type: 'routed', selected: edge.id === selectedEdgeId, selectable: semantic, interactionWidth: semantic ? 24 : 8, animated: false,
      data: { points: edge.points, kind: source?.kind ?? 'membership', label, explanation: source?.explanation, labelOpacity: semantic ? opacity : structural ? structuralOpacity : undefined, labelEmphasized: focused || edge.id === selectedEdgeId, labelStructural: structural } satisfies RoutedEdgeData,
      // `label` is resolved from the relationship type before this point, so
      // a semantic arrowhead can never be emitted without readable text.
      markerEnd: semantic && label ? { type: MarkerType.ArrowClosed, width: 20, height: 20, color: 'var(--vscode-charts-purple)' } : undefined,
      style: semantic ? { stroke: 'var(--vscode-charts-purple)', strokeWidth: focused || edge.id === selectedEdgeId ? 3.2 : 2.3, opacity } : isRoot ? { stroke: 'var(--vscode-descriptionForeground)', strokeWidth: 1.35, strokeDasharray: '2 6', opacity: structuralOpacity } : { stroke: 'var(--vscode-descriptionForeground)', strokeWidth: 1.35, strokeDasharray: '3 5', opacity: structuralOpacity },
    };
  }), [layout.edges, edgeById, focusAreaId, focusEdgeId, relatedAreaIds, selectedEdgeId]);

  const selectedRelationship = selectedEdgeId ? edgeById.get(selectedEdgeId) : undefined;
  const relationships = selectedArea ? architectureRelationshipsForArea(graph.edges, selectedArea) : { incoming: [], outgoing: [] };
  const { incoming, outgoing } = relationships;

  return <ReactFlow
    nodes={flowNodes} edges={flowEdges} nodeTypes={{ ...FILE_NODE_TYPES, ...ARCHITECTURE_NODE_TYPES }} edgeTypes={ROUTED_EDGE_TYPES}
    onNodeClick={(_event, node) => { if (node.id.startsWith('architecture:area:')) { setSelectedArea(node.id.slice('architecture:area:'.length)); setSelectedEdgeId(null); } else if (!node.id.startsWith('architecture:')) onSelectFile(node.id); }}
    onNodeMouseEnter={(_event, node) => { if (node.id.startsWith('architecture:area:')) beginAreaHover(node.id.slice('architecture:area:'.length)); }}
    onNodeMouseLeave={endAreaHover}
    onNodeDoubleClick={(_event, node) => { if (node.id.startsWith('architecture:area:')) toggleArea(node.id.slice('architecture:area:'.length), false); }}
    onEdgeClick={(_event, edge) => { if (edgeById.get(edge.id)?.kind === 'architecture') { setSelectedEdgeId(edge.id); setSelectedArea(null); } }}
    onPaneClick={() => { setSelectedArea(null); setSelectedEdgeId(null); }}
    minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
  >
    <Background gap={24} /><Controls showInteractive={false} />
    <ArchitectureNavigator layout={layout} edgeById={edgeById} selectedArea={selectedArea} selectedFile={selectedFile} areaByFile={areaByFile} progressByArea={navigatorProgress.byArea} startedAreas={navigatorProgress.startedAreas} totalAreas={navigatorProgress.totalAreas} onFocusArea={focusNavigatorArea} onFit={() => void fitView(FIT_OPTIONS)} />
    <Panel position="top-left" className="graph-search-panel"><input className="ai-text-input graph-search-input" type="text" placeholder="Search files…" value={search} onChange={(event) => { const next = event.target.value; setSearch(next); const match = files.filter((file) => file.file.toLowerCase().includes(next.trim().toLowerCase())).sort((a, b) => a.file.localeCompare(b.file))[0]; if (match && next.trim()) revealFile(match.file); }} onKeyDown={(event) => { if (event.key === 'Enter' && searchMatches[0]) revealFile(searchMatches[0].file); }} />{search ? <div className="graph-search-count">{searchMatches.length} match{searchMatches.length === 1 ? '' : 'es'}</div> : null}<div className="architecture-provenance">AI-interpreted from verified scanner evidence</div></Panel>
    <Panel position="top-right" className="graph-toggle-panel">{onBack ? <><button className="graph-scope-button" onClick={onBack}>Dependencies</button><button className="graph-scope-button active">Architecture</button></> : null}<button className="architecture-help-button" onClick={() => setShowHelp((current) => !current)} aria-expanded={showHelp}>How to read this map?</button><button className="ai-link-button" onClick={() => void fitView(FIT_OPTIONS)}>Fit to Screen</button></Panel>
    {showHelp ? <Panel position="top-right" className="architecture-help-panel"><strong>Reading the map</strong><span>Position follows architectural role and semantic flow.</span><span>Purple arrow + verb means one area interacts with another.</span><span>Grey connector + contains means project or area membership.</span><span>Click an arrow for evidence; click an area to focus it.</span></Panel> : null}
    {selectedRelationship?.kind === 'architecture' ? <Panel position="bottom-center" className="architecture-inspector"><button className="architecture-inspector-close" onClick={() => setSelectedEdgeId(null)} aria-label="Close relationship details">×</button><strong>{areaNameById.get(selectedRelationship.source.slice('architecture:area:'.length))} <span>→ {selectedRelationship.label} →</span> {areaNameById.get(selectedRelationship.target.slice('architecture:area:'.length))}</strong><p>{selectedRelationship.explanation}</p><small>Evidence from verified project files</small><div className="architecture-evidence">{selectedRelationship.evidenceFiles?.length ? selectedRelationship.evidenceFiles.map((file) => <button key={file} onClick={() => onSelectFile(file)}>{file}</button>) : <span>No specific file evidence available.</span>}</div></Panel> : null}
    {selectedArea && !selectedRelationship ? <Panel position="bottom-center" className="architecture-inspector architecture-area-inspector"><button className="architecture-inspector-close" onClick={() => setSelectedArea(null)} aria-label="Close area details">×</button><strong>{areaNameById.get(selectedArea)}</strong><div className="architecture-relationship-summary"><span>Incoming</span>{incoming.length ? incoming.map((edge) => <button key={edge.id} onClick={() => { setSelectedEdgeId(edge.id); setSelectedArea(null); }}>← {areaNameById.get(edge.source.slice('architecture:area:'.length))} · {edge.label}</button>) : <small>None</small>}<span>Outgoing</span>{outgoing.length ? outgoing.map((edge) => <button key={edge.id} onClick={() => { setSelectedEdgeId(edge.id); setSelectedArea(null); }}>→ {areaNameById.get(edge.target.slice('architecture:area:'.length))} · {edge.label}</button>) : <small>None</small>}</div></Panel> : null}
    <Panel position="bottom-left" className="graph-legend-panel architecture-legend"><span>Purple arrow: architecture interaction · grey contains: hierarchy / membership</span></Panel>
  </ReactFlow>;
}
