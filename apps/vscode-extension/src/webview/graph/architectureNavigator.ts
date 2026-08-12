import type { GraphNodeView } from '../../projectGraphView.js';

export interface ArchitectureNavigatorViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ArchitectureNavigatorAreaProgress {
  totalFiles: number;
  exploredFiles: number;
  averageProgress: number;
}

/**
 * React Flow exposes the canvas transform as a viewport. Convert that exact
 * transform into flow-space bounds for the Navigator's viewport rectangle.
 */
export function architectureNavigatorViewportBounds(viewport: ArchitectureNavigatorViewport, canvasWidth: number, canvasHeight: number) {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: canvasWidth / viewport.zoom,
    height: canvasHeight / viewport.zoom,
  };
}

/** The explicitly selected area takes precedence; canonical membership resolves selected files. */
export function selectedArchitectureNavigatorArea(selectedArea: string | null, selectedFile: string | null, areaByFile: ReadonlyMap<string, string>): string | null {
  return selectedArea ?? (selectedFile ? areaByFile.get(selectedFile) ?? null : null);
}

/**
 * An explored file is one with non-zero TMTP learning progress (explained,
 * practiced, or mastered). This intentionally does not treat opening a file
 * as exploration. Areas may share canonical files, so each area's model
 * membership is aggregated independently.
 */
export function architectureNavigatorProgress(areas: ReadonlyArray<{ id: string; files: readonly string[] }>, files: readonly GraphNodeView[]) {
  const progressByFile = new Map(files.map((file) => [file.file, file.learningProgress ?? 0]));
  const byArea = new Map<string, ArchitectureNavigatorAreaProgress>();
  let startedAreas = 0;

  for (const area of areas) {
    const totalFiles = area.files.length;
    const progress = area.files.map((file) => progressByFile.get(file) ?? 0);
    const exploredFiles = progress.filter((value) => value > 0).length;
    const averageProgress = totalFiles ? Math.round(progress.reduce((sum, value) => sum + value, 0) / totalFiles) : 0;
    if (exploredFiles > 0) startedAreas += 1;
    byArea.set(area.id, { totalFiles, exploredFiles, averageProgress });
  }

  return { byArea, startedAreas, totalAreas: areas.length };
}
