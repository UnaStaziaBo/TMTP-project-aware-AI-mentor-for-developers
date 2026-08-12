import React from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { buildSmoothPath, edgeLabelPoint, type Point } from './edgePath.js';

export interface RoutedEdgeData extends Record<string, unknown> {
  points: Point[];
  kind: 'import' | 'learning' | 'architecture' | 'membership' | 'root';
  label?: string;
  explanation?: string;
  labelOpacity?: number;
  labelEmphasized?: boolean;
  labelStructural?: boolean;
}

/**
 * Renders ELK's actual computed route instead of letting React Flow guess a
 * path from just the two endpoints. ELK already routed this path to avoid
 * other nodes; smoothing it (see edgePath.ts) keeps that property while
 * removing sharp corners at each bend.
 */
export function RoutedEdge({ data, style, markerEnd }: EdgeProps) {
  const points = (data as RoutedEdgeData | undefined)?.points ?? [];
  if (points.length < 2) {
    return null;
  }

  const edgeData = data as RoutedEdgeData | undefined;
  const label = edgeData?.label?.trim();
  if (!label) {
    return <BaseEdge path={buildSmoothPath(points)} style={style} markerEnd={markerEnd} />;
  }
  const middle = edgeLabelPoint(points);
  const labelWidth = Math.max(42, Math.min(116, label.length * 6.7 + 16));
  return <>
    <BaseEdge path={buildSmoothPath(points)} style={style} markerEnd={markerEnd} />
    <g aria-label={edgeData?.explanation ?? label} className={`${edgeData?.labelEmphasized ? 'architecture-edge-label-emphasized' : ''} ${edgeData?.labelStructural ? 'architecture-structural-label' : ''}`} opacity={edgeData?.labelOpacity}>
      <rect className="architecture-edge-label-pill" x={middle.x - labelWidth / 2} y={middle.y - 15} width={labelWidth} height={18} rx={9} />
      <text x={middle.x} y={middle.y - 3} className="architecture-edge-label" textAnchor="middle">{label}</text>
    </g>
  </>;
}

export const ROUTED_EDGE_TYPES = { routed: RoutedEdge };
