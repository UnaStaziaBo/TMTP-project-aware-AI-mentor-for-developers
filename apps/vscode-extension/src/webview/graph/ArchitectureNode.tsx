import React from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export interface ArchitectureNodeData extends Record<string, unknown> {
  kind: 'architecture-root' | 'architecture-area';
  title: string;
  shortPurpose?: string;
  fileCount?: number;
  areaId?: string;
  expanded?: boolean;
  allFiles?: boolean;
  onToggle?: (areaId: string, allFiles: boolean) => void;
}
export type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architecture'>;

export function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const isArea = data.kind === 'architecture-area';
  return <div className={`architecture-graph-node ${isArea ? 'architecture-graph-area' : 'architecture-graph-root'} ${selected ? 'architecture-graph-selected' : ''}`}>
    <Handle type="target" position={Position.Top} />
    <div className="architecture-graph-title">{data.title}</div>
    {isArea ? <>
      <div className="architecture-graph-purpose">{data.shortPurpose}</div>
      <div className="architecture-graph-count">{data.fileCount} represented file{data.fileCount === 1 ? '' : 's'}</div>
      <div className="architecture-graph-actions">
        <button onClick={(event) => { event.stopPropagation(); data.onToggle?.(data.areaId!, false); }}>{data.expanded ? 'Collapse' : 'Expand'}</button>
        {data.expanded && data.fileCount! > 4 ? <button onClick={(event) => { event.stopPropagation(); data.onToggle?.(data.areaId!, true); }}>{data.allFiles ? 'Show key' : 'Show all'}</button> : null}
      </div>
    </> : <div className="architecture-graph-root-label">Synthetic project anchor</div>}
    <Handle type="source" position={Position.Bottom} />
  </div>;
}
export const ARCHITECTURE_NODE_TYPES = { architecture: ArchitectureNode };
