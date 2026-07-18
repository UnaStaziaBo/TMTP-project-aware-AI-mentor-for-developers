import React from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { buildSmoothPath, type Point } from './edgePath.js';

export interface RoutedEdgeData extends Record<string, unknown> {
  points: Point[];
  kind: 'import' | 'learning';
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

  return <BaseEdge path={buildSmoothPath(points)} style={style} markerEnd={markerEnd} />;
}

export const ROUTED_EDGE_TYPES = { routed: RoutedEdge };
