export interface DetectedTechnology {
  name: string;
  version?: string;
}

export async function scanProject(projectPath: string): Promise<DetectedTechnology[]> {
  void projectPath;
  return [];
}

