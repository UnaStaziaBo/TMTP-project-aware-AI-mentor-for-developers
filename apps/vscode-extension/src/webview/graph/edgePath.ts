export interface Point {
  x: number;
  y: number;
}

/**
 * Finds the length-weighted midpoint of an ELK route. Unlike choosing the
 * middle bend by array index, this stays attached to the useful central
 * segment of a long or curved edge.
 */
export function edgeLabelPoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const segments = points.slice(1).map((point, index) => {
    const start = points[index]!;
    return { start, end: point, length: Math.hypot(point.x - start.x, point.y - start.y) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= total / 2 && segment.length > 0) {
      const ratio = (total / 2 - traversed) / segment.length;
      return { x: segment.start.x + (segment.end.x - segment.start.x) * ratio, y: segment.start.y + (segment.end.y - segment.start.y) * ratio };
    }
    traversed += segment.length;
  }
  return points[points.length - 1]!;
}

/**
 * Converts a polyline (ELK's routed bend points) into a smooth SVG path
 * using quadratic curves through the midpoint of each segment. This is the
 * standard "smooth a polyline" trick: it removes the sharp corner at every
 * interior bend point while still passing close to ELK's actual route (which
 * was already computed to avoid other nodes), so the result stays both
 * smooth and node-avoiding — unlike letting React Flow guess a path from
 * just the two endpoints.
 */
export function buildSmoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;
  return path;
}
