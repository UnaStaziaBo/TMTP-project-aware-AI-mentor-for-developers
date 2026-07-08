/**
 * Unlike AIContext, a file lesson must ground itself in the file's actual
 * code, so it deliberately includes the full file content — scoped to a
 * single starting file, not the whole repository. "reasons" carries the
 * deterministic signals the scanner already used to rank this file as a
 * starting point, so the lesson can reference them instead of guessing.
 */
export interface FileLessonContext {
  language: string;
  file: string;
  fileContent: string;
  reasons: string[];
}
