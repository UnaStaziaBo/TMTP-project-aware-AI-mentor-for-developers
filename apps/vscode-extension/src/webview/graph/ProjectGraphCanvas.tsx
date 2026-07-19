import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import { layoutProjectGraph, type LayoutResult } from './layout.js';
import { FILE_NODE_TYPES, type FileFlowNode } from './FileNode.js';
import { ROUTED_EDGE_TYPES, type RoutedEdgeData } from './RoutedEdge.js';
import { buildSmoothPath } from './edgePath.js';
import type { GraphEdgeView, GraphNodeView } from '../../projectGraphView.js';

export interface ProjectGraphCanvasProps {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };
const FIT_VIEW_OPTIONS = { padding: 0.2, duration: 300 };
const CORE_FILE_LIMIT = 10;
type GraphScope = 'core' | 'related' | 'all';

function GraphOverview({ layout, onFit }: { layout: LayoutResult; onFit: () => void }) {
  if (layout.nodes.length === 0) return null;

  const padding = 100;
  const minX = Math.min(...layout.nodes.map((node) => node.x)) - padding;
  const minY = Math.min(...layout.nodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...layout.nodes.map((node) => node.x + node.width)) + padding;
  const maxY = Math.max(...layout.nodes.map((node) => node.y + node.height)) + padding;

  return (
    <Panel position="bottom-right" className="graph-overview-panel">
      <button className="graph-overview-button" onClick={onFit} title="Fit the project graph to the screen">
        <span className="graph-overview-label">Project overview</span>
        <svg
          className="graph-overview-svg"
          viewBox={`${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Miniature overview of project nodes and relationships"
        >
          {layout.edges.map((edge) => (
            <path
              key={edge.id}
              className={edge.id.startsWith('learn:') ? 'graph-overview-edge learning' : 'graph-overview-edge import'}
              d={buildSmoothPath(edge.points)}
            />
          ))}
          {layout.nodes.map((node) => (
            <rect
              key={node.file}
              className={`graph-overview-node graph-overview-node-${node.tier}`}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={12}
            />
          ))}
        </svg>
      </button>
    </Panel>
  );
}

function GraphInner({ nodes, edges, selectedFile, onSelectFile }: ProjectGraphCanvasProps) {
  const [scope, setScope] = useState<GraphScope>('core');
  const [search, setSearch] = useState('');
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);
  const [isLayouting, setIsLayouting] = useState(true);
  const { fitView } = useReactFlow();

  const coreFiles = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }

    const ranked = [...nodes]
        .filter((node) => !node.isAuxiliary && (node.score > 0 || (degree.get(node.file) ?? 0) > 0))
        .sort(
          (a, b) =>
            b.score - a.score ||
            (degree.get(b.file) ?? 0) - (degree.get(a.file) ?? 0) ||
            a.file.localeCompare(b.file),
        );

    // A global top-ten is usually ten entry points from the same demo or
    // package. Take representatives across architectural areas first, then
    // fill remaining slots by rank. This makes a monorepo's major pieces
    // visible immediately instead of letting one directory dominate.
    const selected: GraphNodeView[] = [];
    const perArea = new Map<string, number>();
    for (const node of ranked) {
      if ((perArea.get(node.area) ?? 0) >= 2) continue;
      selected.push(node);
      perArea.set(node.area, (perArea.get(node.area) ?? 0) + 1);
      if (selected.length === CORE_FILE_LIMIT) break;
    }
    for (const node of ranked) {
      if (selected.length === CORE_FILE_LIMIT) break;
      if (!selected.includes(node)) selected.push(node);
    }
    return new Set(selected.map((node) => node.file));
  }, [nodes, edges]);

  const relatedFiles = useMemo(() => {
    const files = new Set(coreFiles);
    for (const edge of edges) {
      if (coreFiles.has(edge.source) || coreFiles.has(edge.target)) {
        const source = nodes.find((node) => node.file === edge.source);
        const target = nodes.find((node) => node.file === edge.target);
        if (source && !source.isAuxiliary) files.add(edge.source);
        if (target && !target.isAuxiliary) files.add(edge.target);
      }
    }
    return files;
  }, [coreFiles, edges, nodes]);

  const learningOrder = useMemo(() => {
    const coreNodes = nodes.filter((node) => coreFiles.has(node.file));
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    return coreNodes.sort(
      (a, b) =>
        b.score - a.score ||
        (degree.get(b.file) ?? 0) - (degree.get(a.file) ?? 0) ||
        a.area.localeCompare(b.area) ||
        a.file.localeCompare(b.file),
    );
  }, [nodes, edges, coreFiles]);

  const learningStepByFile = useMemo(
    () => new Map(learningOrder.map((node, index) => [node.file, index + 1])),
    [learningOrder],
  );

  const visibleNodes = useMemo(
    () => {
      const query = search.trim().toLowerCase();
      return nodes.filter((node) => {
        // Search must be able to reveal a file even when it is outside the
        // current teaching scope; otherwise a successful search looks broken.
        if (query && node.file.toLowerCase().includes(query)) return true;
        if (scope === 'core') return coreFiles.has(node.file);
        if (scope === 'related') return relatedFiles.has(node.file);
        return true;
      });
    },
    [nodes, scope, coreFiles, relatedFiles, search],
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

  const layoutEdges = useMemo(() => {
    const learningEdges: GraphEdgeView[] = [];
    for (let index = 1; index < learningOrder.length; index += 1) {
      const source = learningOrder[index - 1]!.file;
      const target = learningOrder[index]!.file;
      if (visibleFileSet.has(source) && visibleFileSet.has(target)) {
        learningEdges.push({ id: `learn:${source}=>${target}`, source, target, kind: 'learning' });
      }
    }
    return [...visibleEdges, ...learningEdges];
  }, [visibleEdges, learningOrder, visibleFileSet]);

  // Recomputing the layout only when the *visible set* changes (mount,
  // "Show more files", etc.) — never merely when a node is selected — is
  // what keeps a click from jumping the camera. Fitting the view here is a
  // direct consequence of the set of nodes actually changing, not a
  // surprise reaction to selection.
  useEffect(() => {
    let cancelled = false;
    setIsLayouting(true);

    void layoutProjectGraph(visibleNodes, layoutEdges).then((result) => {
      if (cancelled) return;
      setLayout(result);
      setIsLayouting(false);
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, layoutEdges]);

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
          area: node.area,
          description: node.description,
          confidence: node.confidence,
          learningProgress: node.learningProgress ?? 0,
          tier: node.tier,
          learningStatus: node.learningStatus,
          learningStep: learningStepByFile.get(node.file),
          learningReason: node.learningReason ?? 'Useful supporting project file',
          dimmed: searchMatches !== null && !searchMatches.has(node.file),
        },
      })),
    [layout.nodes, selectedFile, searchMatches, learningStepByFile],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'routed',
        data: {
          points: edge.points,
          kind: edge.id.startsWith('learn:') ? 'learning' : 'import',
        } satisfies RoutedEdgeData,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        animated: !edge.id.startsWith('learn:') && hoveredFile !== null && edge.source === hoveredFile,
        style: {
          opacity: edge.id.startsWith('learn:') ? 0.9 : hoveredFile === null || edge.source === hoveredFile || edge.target === hoveredFile ? 0.65 : 0.1,
          strokeWidth: edge.id.startsWith('learn:') ? 2 : hoveredFile !== null && (edge.source === hoveredFile || edge.target === hoveredFile) ? 2.5 : 1.2,
          strokeDasharray: edge.id.startsWith('learn:') ? '7 5' : undefined,
          stroke:
            edge.id.startsWith('learn:')
              ? 'var(--vscode-charts-green)'
              : hoveredFile !== null && edge.source === hoveredFile
              ? 'var(--vscode-charts-orange)'
              : hoveredFile !== null && edge.target === hoveredFile
                ? 'var(--vscode-charts-blue)'
                : 'var(--vscode-descriptionForeground)',
        },
      })),
    [layout.edges, hoveredFile],
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
      onNodeMouseEnter={(_event, node) => setHoveredFile(node.id)}
      onNodeMouseLeave={() => setHoveredFile(null)}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <GraphOverview layout={layout} onFit={() => void fitView(FIT_VIEW_OPTIONS)} />
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
        <span className="graph-scope-label">View</span>
        {(['core', 'related', 'all'] as const).map((value) => (
          <button
            key={value}
            className={`graph-scope-button ${scope === value ? 'active' : ''}`}
            onClick={() => setScope(value)}
            title={
              value === 'core'
                ? 'The most important files'
                : value === 'related'
                  ? 'Core files and their direct neighbours'
                  : 'Every scanned file'
            }
          >
            {value === 'all' ? 'All files' : value[0]!.toUpperCase() + value.slice(1)}
          </button>
        ))}
        <button className="ai-link-button" onClick={() => void fitView(FIT_VIEW_OPTIONS)}>
          Fit to Screen
        </button>
      </Panel>
      <Panel position="bottom-left" className="graph-legend-panel">
        <strong>Relationships</strong>
        <span className="graph-legend-learning">- -→ recommended next lesson</span>
        <span>—→ imports</span>
        <span className="graph-legend-outgoing">Hover: uses</span>
        <span className="graph-legend-incoming">used by</span>
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
