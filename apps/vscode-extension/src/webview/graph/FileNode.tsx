import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

export interface FileNodeData extends Record<string, unknown> {
  file: string;
  title: string;
  area: string;
  description: string;
  confidence: number;
  learningProgress: number;
  tier: 'large' | 'medium' | 'small';
  learningStatus: { icon: string; label: string };
  dimmed: boolean;
  learningStep?: number;
  learningReason: string;
}

export type FileFlowNode = Node<FileNodeData, 'file'>;

const TIER_CLASS: Record<FileNodeData['tier'], string> = {
  large: 'graph-node-large',
  medium: 'graph-node-medium',
  small: 'graph-node-small',
};

export function FileNode({ data, selected }: NodeProps<FileFlowNode>) {
  const percent = Math.round(data.learningProgress);

  return (
    <div
      className={`graph-node ${TIER_CLASS[data.tier]} ${selected ? 'graph-node-selected' : ''} ${data.dimmed ? 'graph-node-dimmed' : ''}`}
      title={data.file}
    >
      <Handle type="target" position={Position.Top} />
      <div className="graph-node-top">
        <span className="graph-node-status" title={data.learningStatus.label}>
          {data.learningStatus.icon}
        </span>
        <span className="graph-node-title">{data.title}</span>
        {data.learningStep ? <span className="graph-learning-step">Step {data.learningStep}</span> : null}
      </div>
      <div className="graph-node-area">{data.area}</div>
      <div className="graph-node-description">{data.description}</div>
      {data.learningStep ? <div className="graph-learning-reason">{data.learningReason}</div> : null}
      <div className="graph-node-meta" title={`Learning progress: ${percent}%`}>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${percent}%` }} />
          </span>
          <span className="percent">{percent}%</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const FILE_NODE_TYPES = { file: FileNode };
