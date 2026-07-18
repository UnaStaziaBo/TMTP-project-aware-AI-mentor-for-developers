export interface Point {
  x: number;
  y: number;
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
