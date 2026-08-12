import React from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { buildSmoothPath, type Point } from './edgePath.js';

export interface RoutedEdgeData extends Record<string, unknown> {
  points: Point[];
  kind: 'import' | 'learning' | 'architecture' | 'membership';
  label?: string;
  explanation?: string;
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
  const label = edgeData?.label;
  if (!label) {
    return <BaseEdge path={buildSmoothPath(points)} style={style} markerEnd={markerEnd} />;
  }
  const middle = points[Math.floor(points.length / 2)]!;
  return <g aria-label={edgeData?.explanation ?? label}>
    <BaseEdge path={buildSmoothPath(points)} style={style} markerEnd={markerEnd} />
    <text x={middle.x} y={middle.y - 8} className="architecture-edge-label" textAnchor="middle">{label}</text>
  </g>;
}

export const ROUTED_EDGE_TYPES = { routed: RoutedEdge };
