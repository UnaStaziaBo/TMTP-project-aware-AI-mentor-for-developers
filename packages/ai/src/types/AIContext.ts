export interface AIContextDetection {
  name: string;
  confidence: number;
  evidence: string[];
}

export interface AIContextStartingFile {
  file: string;
  score: number;
  confidence: number;
  reasons: string[];
}

export interface AIContext {
  projectName: string;
  overview: {
    fileCount: number;
    folderCount: number;
    manifestCount: number;
  };
  languages: AIContextDetection[];
  frameworks: AIContextDetection[];
  dependencies: AIContextDetection[];
  startingFiles: AIContextStartingFile[];
  /** A representative, alphabetically-sorted sample of folder paths (capped — see buildAIContext). */
  folders: string[];
}
