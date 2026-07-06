export interface StartingFileCandidate {
  file: string;
  score: number;
  confidence: number;
  reasons: string[];
}
