import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from '@xyflow/react';
import { layoutProjectGraph, type LayoutResult } from './layout.js';
import { FILE_NODE_TYPES, type FileFlowNode } from './FileNode.js';
import { ROUTED_EDGE_TYPES, type RoutedEdgeData } from './RoutedEdge.js';
import type { GraphEdgeView, GraphNodeView } from '../../projectGraphView.js';

export interface ProjectGraphCanvasProps {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };
const FIT_VIEW_OPTIONS = { padding: 0.2, duration: 300 };

function isClutterByDefault(node: GraphNodeView): boolean {
  return node.confidence === 0 && !node.hasEdge;
}

function GraphInner({ nodes, edges, selectedFile, onSelectFile }: ProjectGraphCanvasProps) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);
  const [isLayouting, setIsLayouting] = useState(true);
  const { fitView } = useReactFlow();

  const hiddenCount = useMemo(() => nodes.filter(isClutterByDefault).length, [nodes]);

  const visibleNodes = useMemo(
    () => (showAll ? nodes : nodes.filter((node) => !isClutterByDefault(node))),
    [nodes, showAll],
  );

  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return null;
    return new Set(nodes.filter((node) => node.file.toLowerCase().includes(query)).map((node) => node.file));
  }, [nodes, search]);

  const visibleFileSet = useMemo(() => new Set(visibleNodes.map((node) => node.file)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleFileSet.has(edge.source) && visibleFileSet.has(edge.target)),
    [edges, visibleFileSet],
  );

  // Recomputing the layout only when the *visible set* changes (mount,
  // "Show more files", etc.) — never merely when a node is selected — is
  // what keeps a click from jumping the camera. Fitting the view here is a
  // direct consequence of the set of nodes actually changing, not a
  // surprise reaction to selection.
  useEffect(() => {
    let cancelled = false;
    setIsLayouting(true);

    void layoutProjectGraph(visibleNodes, visibleEdges).then((result) => {
      if (cancelled) return;
      setLayout(result);
      setIsLayouting(false);
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, visibleEdges]);

  const flowNodes: FileFlowNode[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.file,
        type: 'file',
        position: { x: node.x, y: node.y },
        selected: node.file === selectedFile,
        style: { width: node.width, height: node.height },
        data: {
          file: node.file,
          title: node.title,
          description: node.description,
          confidence: node.confidence,
          tier: node.tier,
          learningStatus: node.learningStatus,
          dimmed: searchMatches !== null && !searchMatches.has(node.file),
        },
      })),
    [layout.nodes, selectedFile, searchMatches],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'routed',
        data: { points: edge.points } satisfies RoutedEdgeData,
      })),
    [layout.edges],
  );

  function focusFile(file: string) {
    void fitView({ nodes: [{ id: file }], duration: 400, maxZoom: 1.2, padding: 0.3 });
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={FILE_NODE_TYPES}
      edgeTypes={ROUTED_EDGE_TYPES}
      onNodeClick={(_event, node) => onSelectFile(node.id)}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
      <Panel position="top-left" className="graph-search-panel">
        <input
          className="ai-text-input graph-search-input"
          type="text"
          placeholder="Search files…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && searchMatches && searchMatches.size > 0) {
              focusFile([...searchMatches][0]!);
            }
          }}
        />
        {search && searchMatches ? (
          <div className="graph-search-count">{searchMatches.size} match{searchMatches.size === 1 ? '' : 'es'}</div>
        ) : null}
        {isLayouting ? <div className="graph-search-count">Arranging…</div> : null}
      </Panel>
      <Panel position="top-right" className="graph-toggle-panel">
        <button className="ai-link-button" onClick={() => void fitView(FIT_VIEW_OPTIONS)}>
          Fit to Screen
        </button>
        {hiddenCount > 0 ? (
          <button className="ai-link-button" onClick={() => setShowAll((value) => !value)}>
            {showAll ? `Hide ${hiddenCount} unscored file${hiddenCount === 1 ? '' : 's'}` : `Show ${hiddenCount} more file${hiddenCount === 1 ? '' : 's'}`}
          </button>
        ) : null}
      </Panel>
    </ReactFlow>
  );
}

export function ProjectGraphCanvas(props: ProjectGraphCanvasProps) {
  if (props.nodes.length === 0) {
    return <div className="empty-line">No files with a strong enough signal to graph yet.</div>;
  }

  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
