import React from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export interface GroupNodeData extends Record<string, unknown> {
  path: string;
  kind: 'directory' | 'package';
  fileCount: number;
  expanded: boolean;
  onToggle: (path: string) => void;
}

export type GroupFlowNode = Node<GroupNodeData, 'group'>;

export function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  const label = data.kind === 'package' ? 'PACKAGE' : 'DIRECTORY';
  const toggle = () => data.onToggle(data.path);
  return (
    <div
      className="graph-group-node"
      role="button"
      tabIndex={0}
      aria-label={`${label.toLowerCase()} ${data.path}, ${data.fileCount} files, collapsed`}
      aria-expanded={false}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="graph-group-title">📁 {data.path}</div>
      <div className="graph-group-kind">{label}</div>
      <div className="graph-group-count">{data.fileCount} eligible file{data.fileCount === 1 ? '' : 's'} · Expand</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const GROUP_NODE_TYPES = { group: GroupNode };
